import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");
  const validSecrets = [process.env.ADMIN_SECRET, process.env.NEXT_PUBLIC_ADMIN_SECRET].filter(Boolean);
  if (validSecrets.length === 0 || !validSecrets.includes(secret || "")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // Check table structure
  const { data: cols, error: colsError } = await supabase.rpc("exec_sql", {
    sql: `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'customer_profiles' ORDER BY ordinal_position;`
  });

  // Try a direct insert to see the exact error
  const testId = "00000000-0000-0000-0000-000000000001";
  const { error: insertError } = await supabase
    .from("customer_profiles")
    .upsert([{
      id: testId,
      customer_id: testId,
      full_name: "Debug Test",
      phone: "1234567890",
      email: null,
      customer_type: "menudeo",
      role: "customer",
    }]);

  // Clean up
  await supabase.from("customer_profiles").delete().eq("id", testId);

  // Check if RLS is enabled
  const { data: rlsData, error: rlsError } = await supabase.rpc("exec_sql", {
    sql: `SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'customer_profiles';`
  });

  return NextResponse.json({
    columns: cols,
    columnsError: colsError?.message || null,
    insertError: insertError?.message || null,
    insertErrorDetails: insertError ? JSON.stringify(insertError) : null,
    rls: rlsData,
    rlsError: rlsError?.message || null,
  });
}
