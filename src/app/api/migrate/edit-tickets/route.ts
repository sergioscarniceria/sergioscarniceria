import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SQL = `
-- Agregar columnas para rastreo de ediciones en orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS edited_by TEXT;

-- Agregar columna para guardar items originales antes de edición
ALTER TABLE orders ADD COLUMN IF NOT EXISTS original_items JSONB;

CREATE INDEX IF NOT EXISTS idx_orders_edited ON orders(edited_at) WHERE edited_at IS NOT NULL;
`;

export async function POST(req: Request) {
  try {
    const { secret } = await req.json();
    if (![process.env.ADMIN_SECRET, process.env.NEXT_PUBLIC_ADMIN_SECRET].filter(Boolean).includes(secret)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await supabase.rpc("exec_sql", { sql: SQL });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, message: "Columnas de edición agregadas a orders" });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
