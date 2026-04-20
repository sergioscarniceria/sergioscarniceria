import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SQL = `
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action TEXT NOT NULL,
  user_role TEXT,
  user_label TEXT,
  entity_type TEXT,
  entity_id TEXT,
  amount NUMERIC(12,2),
  details JSONB,
  ip TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
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

    return NextResponse.json({ ok: true, message: "Tabla audit_log creada" });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
