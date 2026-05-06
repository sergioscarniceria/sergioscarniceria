import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Health check: verifica el estado del sistema y cuenta registros.
 * Útil para detectar si la base se está llenando.
 *
 * GET /api/health?secret=<ADMIN_SECRET>
 */

const TABLES = [
  "orders",
  "order_items",
  "customers",
  "cash_movements",
  "cash_closures",
  "cash_openings",
  "cash_expenses",
  "cxc_notes",
  "cxc_note_items",
  "cxc_payments",
  "products",
  "butchers",
  "suppliers",
  "livestock_purchases",
  "supplier_expenses",
  "supplier_payments",
  "app_pins",
];

/** HEAD /api/health — lightweight ping (no auth needed) */
export async function HEAD() {
  return new Response(null, { status: 200 });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");

  // Aceptar cualquiera de los dos secrets
  const secrets = [process.env.ADMIN_SECRET, process.env.NEXT_PUBLIC_ADMIN_SECRET].filter(Boolean);
  if (secrets.length === 0 || !secrets.includes(secret || "")) {
    return NextResponse.json({ error: "Secret inválido" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Faltan variables" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const tableCounts: Record<string, number> = {};
  const errors: string[] = [];

  for (const table of TABLES) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true });

      if (error) {
        errors.push(`${table}: ${error.message}`);
        tableCounts[table] = -1;
      } else {
        tableCounts[table] = count || 0;
      }
    } catch {
      tableCounts[table] = -1;
    }
  }

  const totalRows = Object.values(tableCounts).reduce(
    (a, c) => a + (c > 0 ? c : 0),
    0
  );

  // Estimate DB size (rough: ~0.5KB per row average for this type of data)
  const estimatedSizeMB = Number((totalRows * 0.5 / 1024).toFixed(2));

  let status = "ok";
  let warning: string | null = null;

  // Check if we can write (not in read-only mode)
  let canWrite = false;
  try {
    const { error: insertError } = await supabase
      .from("cash_movements")
      .insert([{ type: "_health_check", amount: 0, payment_method: "none", source: "health" }])
      .select("id")
      .single();

    if (!insertError) {
      canWrite = true;
      // Clean up test record
      await supabase
        .from("cash_movements")
        .delete()
        .eq("type", "_health_check")
        .eq("source", "health");
    }
  } catch {
    canWrite = false;
  }

  // ─── Tamaño real de la DB vía SQL + info del plan ───
  let realDbSize: { size_mb: number; size_pretty: string } | null = null;
  let storageSize: { size_mb: number; bucket_count: number } | null = null;
  let planInfo: { plan: string; org: string; egress_quota_gb: number; db_limit_gb: number; storage_limit_gb: number } | null = null;

  try {
    // DB size real via función get_db_size()
    const { data: dbSizeData, error: dbSizeErr } = await supabase
      .rpc("get_db_size")
      .single();

    if (!dbSizeErr && dbSizeData) {
      const row = dbSizeData as { bytes: number; size_pretty: string };
      const bytes = Number(row.bytes);
      realDbSize = {
        size_mb: Number((bytes / 1024 / 1024).toFixed(2)),
        size_pretty: row.size_pretty || `${(bytes / 1024 / 1024).toFixed(1)} MB`,
      };
    }
  } catch { /* Si falla, usamos estimación por filas */ }

  // Storage bucket sizes
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    if (buckets) {
      storageSize = { size_mb: 0, bucket_count: buckets.length };
    }
  } catch { /* ignore */ }

  // Plan info from Management API (solo metadata, no usage)
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
  if (accessToken && supabaseUrl) {
    try {
      const refMatch = supabaseUrl.match(/https:\/\/([^.]+)\.supabase/);
      const projectRef = refMatch ? refMatch[1] : null;
      if (projectRef) {
        const projRes = await fetch(`https://api.supabase.com/v1/projects/${projectRef}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (projRes.ok) {
          const projData = await projRes.json();
          const orgId = projData.organization_id;
          // Get org details (plan name)
          const orgRes = await fetch(`https://api.supabase.com/v1/organizations/${orgId}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (orgRes.ok) {
            const orgData = await orgRes.json();
            const plan = orgData.plan || "free";
            // Quotas por plan (valores oficiales Supabase 2026)
            const quotas: Record<string, { egress: number; db: number; storage: number }> = {
              free: { egress: 5, db: 0.5, storage: 1 },
              pro: { egress: 250, db: 8, storage: 100 },
              team: { egress: 250, db: 8, storage: 100 },
            };
            const q = quotas[plan] || quotas.pro;
            planInfo = {
              plan,
              org: orgData.name || orgId,
              egress_quota_gb: q.egress,
              db_limit_gb: q.db,
              storage_limit_gb: q.storage,
            };
          }
        }
      }
    } catch { /* No romper health check */ }
  }

  // Calcular uso real vs límite del plan
  const dbSizeMB = realDbSize?.size_mb || estimatedSizeMB;
  const dbLimitMB = (planInfo?.db_limit_gb || 0.5) * 1024;
  const dbUsagePct = Number(((dbSizeMB / dbLimitMB) * 100).toFixed(1));

  if (dbUsagePct > 80) {
    status = "critical";
    warning = `Base de datos al ${dbUsagePct}% del límite del plan ${planInfo?.plan || "free"}.`;
  } else if (dbUsagePct > 50) {
    status = "warning";
    warning = `Base de datos al ${dbUsagePct}% del límite del plan.`;
  }

  return NextResponse.json({
    status,
    timestamp: new Date().toISOString(),
    plan: planInfo,
    database: {
      can_write: canWrite,
      total_rows: totalRows,
      real_size_mb: realDbSize?.size_mb || null,
      real_size_pretty: realDbSize?.size_pretty || null,
      estimated_size_mb: estimatedSizeMB,
      limit_mb: dbLimitMB,
      usage_percent: dbUsagePct,
      warning,
    },
    storage: storageSize,
    tables: tableCounts,
    errors: errors.length > 0 ? errors : null,
    recommendations: [
      dbUsagePct > 80 ? "Base de datos cerca del límite. Considerar archivar datos antiguos." : null,
      !canWrite ? "LA BASE ESTÁ EN MODO SOLO-LECTURA. Upgrade urgente." : null,
      totalRows > 50000 ? "Considerar archivar movimientos antiguos (>6 meses)" : null,
    ].filter(Boolean),
    nota: "Egress (transferencia) no disponible vía API. Revisar en: https://supabase.com/dashboard/org/_/usage",
  });
}
