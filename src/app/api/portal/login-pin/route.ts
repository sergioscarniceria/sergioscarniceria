import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Login by phone + 4-digit PIN.
 * Looks up customer by phone, verifies PIN, returns auth credentials
 * so the client can sign in via Supabase auth.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phone, pin } = body;

    if (!phone || !phone.trim()) {
      return NextResponse.json({ error: "Escribe tu teléfono" }, { status: 400 });
    }
    if (!pin || !pin.trim()) {
      return NextResponse.json({ error: "Escribe tu PIN" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Find customer by phone
    const { data: customer } = await supabase
      .from("customers")
      .select("id, client_pin, portal_password")
      .eq("phone", phone.trim())
      .maybeSingle();

    if (!customer) {
      return NextResponse.json(
        { error: "No encontramos una cuenta con ese teléfono" },
        { status: 404 }
      );
    }

    // 2. Verify PIN
    if (!customer.client_pin) {
      return NextResponse.json(
        { error: "Esta cuenta no tiene PIN. Entra con tu contraseña o pídele tu PIN al negocio." },
        { status: 400 }
      );
    }

    if (customer.client_pin !== pin.trim()) {
      return NextResponse.json(
        { error: "PIN incorrecto" },
        { status: 401 }
      );
    }

    // 3. Find auth user for this customer
    const authEmail = `${customer.id}@clientes.sergios.mx`;

    // Check if auth user exists
    const { data: profileData } = await supabase
      .from("customer_profiles")
      .select("id")
      .eq("customer_id", customer.id)
      .maybeSingle();

    if (!profileData) {
      // No auth user exists — create one using the portal_password or PIN as password
      const authPassword = customer.portal_password || pin.trim();

      const { data: newUser, error: authError } = await supabase.auth.admin.createUser({
        email: authEmail,
        password: authPassword,
        email_confirm: true,
      });

      if (authError || !newUser?.user) {
        // Maybe user exists in auth but not in profiles — try to get by email
        const { data: listData } = await supabase.auth.admin.listUsers();
        const existingAuthUser = listData?.users?.find((u: any) => u.email === authEmail);

        if (existingAuthUser) {
          // Update password to match PIN flow
          await supabase.auth.admin.updateUserById(existingAuthUser.id, {
            password: customer.portal_password || pin.trim(),
          });

          // Create profile
          await supabase.from("customer_profiles").upsert([{
            id: existingAuthUser.id,
            customer_id: customer.id,
            phone: phone.trim(),
            role: "customer",
          }]);
        } else {
          return NextResponse.json(
            { error: "Error al preparar tu cuenta. Intenta con contraseña." },
            { status: 500 }
          );
        }
      } else {
        // Create profile for new auth user
        await supabase.from("customer_profiles").upsert([{
          id: newUser.user.id,
          customer_id: customer.id,
          phone: phone.trim(),
          role: "customer",
        }]);
      }
    }

    // 4. Return auth email + password so frontend can sign in
    return NextResponse.json({
      success: true,
      auth_email: authEmail,
      auth_password: customer.portal_password || pin.trim(),
    });
  } catch (err) {
    console.error("PIN login error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
