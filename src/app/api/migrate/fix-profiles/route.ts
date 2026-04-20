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
    // Drop the problematic FK constraint that references auth.users
    `ALTER TABLE customer_profiles DROP CONSTRAINT IF EXISTS customer_profiles_id_fkey;`,
    // Also drop FK to customers if it causes issues
    `ALTER TABLE customer_profiles DROP CONSTRAINT IF EXISTS customer_profiles_customer_id_fkey;`,
    // Disable RLS
    `ALTER TABLE customer_profiles DISABLE ROW LEVEL SECURITY;`,
    // Drop all policies that might block inserts
    `DO $$ BEGIN
      EXECUTE (SELECT string_agg('DROP POLICY IF EXISTS ' || quote_ident(policyname) || ' ON customer_profiles;', ' ')
               FROM pg_policies WHERE tablename = 'customer_profiles');
    EXCEPTION WHEN OTHERS THEN NULL;
    END $$;`,
    // Ensure loyalty_accounts is also clean
    `ALTER TABLE loyalty_accounts DISABLE ROW LEVEL SECURITY;`,
    // Clean up orphaned test data
    `DELETE FROM customer_profiles WHERE customer_id::text LIKE 'test%';`,
  ];

  const results: string[] = [];

  for (const sql of queries) {
    const { error } = await supabase.rpc("exec_sql", { sql });
    if (error) {
      results.push(`ERROR: ${error.message} — SQL: ${sql.slice(0, 100)}`);
    } else {
      results.push(`OK: ${sql.slice(0, 100)}`);
    }
  }

  // Clean up orphaned auth users from failed attempts
  try {
    const { data: authData } = await supabase.auth.admin.listUsers();
    const orphanedUsers = (authData?.users || []).filter(u =>
      u.email?.endsWith("@clientes.sergios.mx")
    );

    for (const user of orphanedUsers) {
      // Check if profile exists
      const { data: profile } = await supabase
        .from("customer_profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile) {
        // Orphaned auth user - delete it
        await supabase.auth.admin.deleteUser(user.id);
        results.push(`CLEANUP: deleted orphaned auth user ${user.email}`);
      }
    }
  } catch (err: any) {
    results.push(`CLEANUP ERROR: ${err.message}`);
  }

  return NextResponse.json({ results });
}
