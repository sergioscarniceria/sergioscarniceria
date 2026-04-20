import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Delete a customer and all related auth/profile data.
 * Cleans up: auth user, customer_profiles, loyalty_accounts, then customers.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { customer_id, secret } = body;

    if (![process.env.ADMIN_SECRET, process.env.NEXT_PUBLIC_ADMIN_SECRET].filter(Boolean).includes(secret || "")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    if (!customer_id) {
      return NextResponse.json({ error: "customer_id requerido" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const cleaned: string[] = [];

    // 1. Find and delete auth user via customer_profiles
    const { data: profile } = await supabase
      .from("customer_profiles")
      .select("id")
      .eq("customer_id", customer_id)
      .maybeSingle();

    if (profile?.id) {
      // Delete auth user
      const { error: authErr } = await supabase.auth.admin.deleteUser(profile.id);
      if (!authErr) cleaned.push("auth_user");

      // Delete profile
      await supabase.from("customer_profiles").delete().eq("id", profile.id);
      cleaned.push("profile");
    }

    // 2. Delete loyalty account
    await supabase.from("loyalty_accounts").delete().eq("customer_id", customer_id);
    cleaned.push("loyalty");

    // 3. Delete CxC notes and items
    const { data: cxcNotes } = await supabase
      .from("cxc_notes")
      .select("id")
      .eq("customer_id", customer_id);

    if (cxcNotes && cxcNotes.length > 0) {
      const noteIds = cxcNotes.map((n: { id: string }) => n.id);
      await supabase.from("cxc_note_items").delete().in("cxc_note_id", noteIds);
      await supabase.from("cxc_payments").delete().eq("customer_id", customer_id);
      await supabase.from("cxc_notes").delete().eq("customer_id", customer_id);
      cleaned.push("cxc");
    }

    // 4. Delete orders and order_items
    const { data: orders } = await supabase
      .from("orders")
      .select("id")
      .eq("customer_id", customer_id);

    if (orders && orders.length > 0) {
      const orderIds = orders.map((o: { id: string }) => o.id);
      await supabase.from("order_items").delete().in("order_id", orderIds);
      await supabase.from("orders").delete().eq("customer_id", customer_id);
      cleaned.push("orders");
    }

    // 5. Delete cash_movements linked to this customer
    await supabase.from("cash_movements").delete().eq("customer_id", customer_id);
    cleaned.push("cash_movements");

    // 6. Finally delete the customer
    const { error: customerErr } = await supabase
      .from("customers")
      .delete()
      .eq("id", customer_id);

    if (customerErr) {
      return NextResponse.json({
        error: `Se limpiaron datos (${cleaned.join(", ")}) pero no se pudo eliminar el cliente: ${customerErr.message}`,
      }, { status: 500 });
    }

    cleaned.push("customer");

    return NextResponse.json({
      success: true,
      cleaned,
    });
  } catch (err) {
    console.error("Delete customer error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
