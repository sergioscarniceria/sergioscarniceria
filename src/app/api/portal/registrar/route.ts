import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Self-registration for customers.
 * Creates auth user via admin API (auto-confirmed), customer record, and profile.
 * Returns the auth email so the client can immediately sign in.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, phone, email, password } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Escribe tu nombre" }, { status: 400 });
    }
    if (!phone || !phone.trim()) {
      return NextResponse.json({ error: "Escribe tu teléfono" }, { status: 400 });
    }
    if (!password || password.length < 4) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 4 caracteres" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Check if phone already registered
    const { data: existing } = await supabase
      .from("customer_profiles")
      .select("id")
      .eq("phone", phone.trim())
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "Ya existe una cuenta con ese teléfono. Intenta entrar o recuperar tu contraseña." },
        { status: 400 }
      );
    }

    // 1. Create customer record
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .insert([{
        name: name.trim(),
        phone: phone.trim(),
        business_name: name.trim(),
        customer_type: "menudeo",
        email: email?.trim() || null,
        address: "",
        portal_password: password,
      }])
      .select()
      .single();

    if (customerError || !customer) {
      console.error("Customer creation error:", customerError);
      return NextResponse.json({ error: "Error al crear tu cuenta. Intenta de nuevo." }, { status: 500 });
    }

    // 2. Create auth user via admin API (auto-confirmed)
    const authEmail = `${customer.id}@clientes.sergios.mx`;
    const { data: newUser, error: authError } = await supabase.auth.admin.createUser({
      email: authEmail,
      password,
      email_confirm: true,
    });

    if (authError || !newUser?.user) {
      console.error("Auth user creation error:", authError);
      // Rollback: delete customer
      await supabase.from("customers").delete().eq("id", customer.id);
      return NextResponse.json({ error: "Error al crear tu cuenta. Intenta de nuevo." }, { status: 500 });
    }

    // 3. Create customer profile
    const { error: profileError } = await supabase.from("customer_profiles").upsert([{
      id: newUser.user.id,
      customer_id: customer.id,
      full_name: name.trim(),
      phone: phone.trim(),
      email: email?.trim()?.toLowerCase() || null,
      customer_type: "menudeo",
      role: "customer",
    }]);

    if (profileError) {
      console.error("Profile creation error:", profileError);
      // Don't rollback — user can still login, profile can be fixed later
    }

    // 4. Create loyalty account
    await supabase.from("loyalty_accounts").upsert([{ customer_id: customer.id }]);

    return NextResponse.json({
      success: true,
      auth_email: authEmail,
      customer_id: customer.id,
      name: name.trim(),
    });
  } catch (err) {
    console.error("Registration error:", err);
    return NextResponse.json({ error: "Error interno. Intenta de nuevo." }, { status: 500 });
  }
}
