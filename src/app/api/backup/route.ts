import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * API de backup: exporta TODAS las tablas principales a JSON.
 * Úsalo como respaldo diario. Se puede automatizar con Vercel cron.
 *
 * GET /api/backup?secret=sergios2026
 * → Devuelve JSON con todos los datos del sistema
 *
 * Puedes guardarlo manualmente o configurar un cron para que se ejecute diario.
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
  "loyalty_redemptions",
];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");

  if (secret !== "sergios2026") {
    return NextResponse.json({ error: "Secret inválido" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: "Faltan variables de entorno del servidor" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const backup: Record<string, { count: number; data: any[] }> = {};
  const errors: string[] = [];

  for (const table of TABLES) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50000);

      if (error) {
        errors.push(`${table}: ${error.message}`);
        backup[table] = { count: 0, data: [] };
      } else {
        backup[table] = { count: (data || []).length, data: data || [] };
      }
    } catch (e: any) {
      errors.push(`${table}: ${e?.message || "Error desconocido"}`);
      backup[table] = { count: 0, data: [] };
    }
  }

  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, "-");

  const summary = {
    backup_date: now.toISOString(),
    timestamp,
    tables_exported: Object.keys(backup).length,
    total_rows: Object.values(backup).reduce((a, t) => a + t.count, 0),
    table_counts: Object.fromEntries(
      Object.entries(backup).map(([k, v]) => [k, v.count])
    ),
    errors: errors.length > 0 ? errors : null,
  };

  return NextResponse.json(
    { summary, backup },
    {
      headers: {
        "Content-Disposition": `attachment; filename="backup-sergios-${timestamp}.json"`,
      },
    }
  );
}
