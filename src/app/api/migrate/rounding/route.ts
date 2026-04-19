import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");
  const validSecret = process.env.ADMIN_SECRET || process.env.NEXT_PUBLIC_ADMIN_SECRET;

  if (!validSecret || secret !== validSecret) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const queries = [
    `ALTER TABLE cash_movements ADD COLUMN IF NOT EXISTS rounding_amount NUMERIC(10,2) DEFAULT 0;`,
    `ALTER TABLE cxc_notes ADD COLUMN IF NOT EXISTS rounding_amount NUMERIC(10,2) DEFAULT 0;`,
  ];

  const results: string[] = [];

  for (const sql of queries) {
    const { error } = await supabase.rpc("exec_sql", { sql });
    if (error) {
      results.push(`ERROR: ${error.message} — SQL: ${sql}`);
    } else {
      results.push(`OK: ${sql}`);
    }
  }

  return NextResponse.json({ results });
}
