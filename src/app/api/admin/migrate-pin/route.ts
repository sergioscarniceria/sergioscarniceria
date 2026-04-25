import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Migration endpoint: adds client_pin column and generates PINs.
 * Call GET /api/admin/migrate-pin?secret=sergios2026
 * Safe to call multiple times (idempotent).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");

  if (secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const results: string[] = [];

  // Step 1: Check if column exists
  const { error: checkError } = await supabase
    .from("customers")
    .select("client_pin")
    .limit(1);

  if (checkError && checkError.message.includes("does not exist")) {
    results.push("Column client_pin does not exist. Run this SQL in Supabase SQL Editor:");
    results.push("ALTER TABLE customers ADD COLUMN IF NOT EXISTS client_pin TEXT;");
    results.push("Then call this endpoint again to generate PINs.");
    return NextResponse.json({ results, step: "add_column" });
  }

  results.push("Column client_pin exists");

  // Step 2: Generate PINs for customers without one
  const { data: customers } = await supabase
    .from("customers")
    .select("id, name")
    .is("client_pin", null);

  if (customers && customers.length > 0) {
    let updated = 0;
    const generated: { name: string; pin: string }[] = [];

    for (const c of customers) {
      const pin = String(Math.floor(1000 + Math.random() * 9000));
      const { error } = await supabase
        .from("customers")
        .update({ client_pin: pin })
        .eq("id", c.id);

      if (!error) {
        updated++;
        generated.push({ name: c.name, pin });
      }
    }

    results.push(`Generated PINs for ${updated} customers`);
    return NextResponse.json({ results, generated, step: "done" });
  }

  results.push("All customers already have PINs");

  // Show current PINs
  const { data: allCustomers } = await supabase
    .from("customers")
    .select("name, phone, client_pin")
    .not("client_pin", "is", null)
    .order("name");

  return NextResponse.json({ results, customers: allCustomers, step: "done" });
}
