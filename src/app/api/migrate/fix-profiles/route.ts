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

  const queries = [
    `CREATE TABLE IF NOT EXISTS customer_profiles (
      id UUID PRIMARY KEY,
      customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
      full_name TEXT,
      phone TEXT,
      email TEXT,
      customer_type TEXT DEFAULT 'menudeo',
      role TEXT DEFAULT 'customer',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`,
    `CREATE INDEX IF NOT EXISTS idx_customer_profiles_customer_id ON customer_profiles(customer_id);`,
    `CREATE INDEX IF NOT EXISTS idx_customer_profiles_phone ON customer_profiles(phone);`,
    `CREATE INDEX IF NOT EXISTS idx_customer_profiles_email ON customer_profiles(email);`,
    `CREATE TABLE IF NOT EXISTS loyalty_accounts (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      customer_id UUID REFERENCES customers(id) ON DELETE CASCADE UNIQUE,
      points INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`,
    // Clean up any orphaned test auth users
    `DELETE FROM customer_profiles WHERE customer_id::text = 'test';`,
  ];

  const results: string[] = [];

  for (const sql of queries) {
    const { error } = await supabase.rpc("exec_sql", { sql });
    if (error) {
      results.push(`ERROR: ${error.message} — SQL: ${sql.slice(0, 80)}`);
    } else {
      results.push(`OK: ${sql.slice(0, 80)}`);
    }
  }

  // Also try to delete the test auth user we created earlier
  try {
    const { data: testProfiles } = await supabase
      .from("customer_profiles")
      .select("id")
      .eq("customer_id", "test");

    // List auth users to find and clean test
    // (can't easily do this without knowing the user ID, skip for now)
  } catch {}

  return NextResponse.json({ results });
}
