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
  const limitMB = 500;
  const usagePercent = Number(((estimatedSizeMB / limitMB) * 100).toFixed(1));

  let status = "ok";
  let warning = null;

  if (usagePercent > 80) {
    status = "critical";
    warning = "Base de datos arriba del 80%. Considera upgrade a Pro ($25/mes) o limpiar datos antiguos.";
  } else if (usagePercent > 50) {
    status = "warning";
    warning = "Base de datos arriba del 50%. Monitorear crecimiento.";
  }

  // Check if we can write (not in read-only mode)
  let canWrite = false;
  try {
    const testId = `health-check-${Date.now()}`;
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

  // ─── Supabase Management API: Egress, Storage, DB size real ───
  let quotaUsage: any = null;
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
  if (accessToken && supabaseUrl) {
    try {
      // Extraer project ref del URL (ej: https://xxxxx.supabase.co)
      const refMatch = supabaseUrl.match(/https:\/\/([^.]+)\.supabase/);
      const projectRef = refMatch ? refMatch[1] : null;

      if (projectRef) {
        // 1. Obtener org_id del proyecto
        const projRes = await fetch(`https://api.supabase.com/v1/projects/${projectRef}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (projRes.ok) {
          const projData = await projRes.json();
          const orgId = projData.organization_id;

          if (orgId) {
            // 2. Obtener usage de la organización (ciclo de facturación actual)
            const usageRes = await fetch(
              `https://api.supabase.com/v1/organizations/${orgId}/usage`,
              { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            if (usageRes.ok) {
              const usageData = await usageRes.json();
              // usageData es un array de métricas con { metric, usage, limit, cost, ... }
              const metrics: Record<string, { usage: number; limit: number; pct: number }> = {};
              const metricNames: Record<string, string> = {
                EGRESS: "Egress (transferencia)",
                DB_SIZE: "Base de datos",
                STORAGE_SIZE: "Almacenamiento",
                FUNC_INVOCATIONS: "Edge Functions",
                REALTIME_PEAK_CONNECTIONS: "Realtime conexiones",
                MONTHLY_ACTIVE_USERS: "Usuarios activos",
              };

              if (Array.isArray(usageData)) {
                for (const m of usageData) {
                  const name = metricNames[m.metric] || m.metric;
                  const usage = m.usage ?? 0;
                  const limit = m.limit ?? 0;
                  const pct = limit > 0 ? Number(((usage / limit) * 100).toFixed(1)) : 0;
                  metrics[name] = { usage, limit, pct };
                }
              }
              quotaUsage = { metrics, raw: usageData };
            }
          }
        }
      }
    } catch (e) {
      // Si falla el management API, no romper el health check
      console.error("Management API error:", e);
    }
  }

  return NextResponse.json({
    status,
    timestamp: new Date().toISOString(),
    database: {
      can_write: canWrite,
      total_rows: totalRows,
      estimated_size_mb: estimatedSizeMB,
      limit_mb: limitMB,
      usage_percent: usagePercent,
      warning,
    },
    tables: tableCounts,
    quota: quotaUsage,
    errors: errors.length > 0 ? errors : null,
    recommendations: [
      usagePercent > 50 ? "Considerar upgrade a Supabase Pro ($25/mes)" : null,
      !canWrite ? "LA BASE ESTÁ EN MODO SOLO-LECTURA. Upgrade urgente." : null,
      totalRows > 50000 ? "Considerar archivar movimientos antiguos (>6 meses)" : null,
    ].filter(Boolean),
  });
}
