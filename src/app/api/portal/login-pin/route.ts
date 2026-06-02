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

    // 1. Find customer by phone + PIN (soporta múltiples clientes con mismo teléfono)
    const { data: customers } = await supabase
      .from("customers")
      .select("id, client_pin, portal_password")
      .eq("phone", phone.trim());

    if (!customers || customers.length === 0) {
      return NextResponse.json(
        { error: "No encontramos una cuenta con ese teléfono" },
        { status: 404 }
      );
    }

    // 2. Find the customer whose PIN matches
    const customer = customers.find((c) => c.client_pin === pin.trim());
    if (!customer) {
      const anyHasPin = customers.some((c) => c.client_pin);
      if (!anyHasPin) {
        return NextResponse.json(
          { error: "Esta cuenta no tiene PIN. Entra con tu contraseña o pídele tu PIN al negocio." },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: "PIN incorrecto" },
        { status: 401 }
      );
    }

    // 3. Find existing customer_profile (links customer to an auth user)
    const { data: profileData } = await supabase
      .from("customer_profiles")
      .select("id")
      .eq("customer_id", customer.id)
      .maybeSingle();

    const syntheticEmail = `${customer.id}@clientes.sergios.mx`;
    // El password de auth debe ser ≥6 chars. Usamos portal_password si existe,
    // o derivamos uno estable de PIN + customer.id.
    const derivedPassword = `pin-${pin.trim()}-${customer.id.slice(0, 8)}`;
    const desiredPassword = customer.portal_password || derivedPassword;
    let authEmail = syntheticEmail;
    let authUserId: string | null = null;

    if (profileData?.id) {
      // Ya existe profile — buscar el auth user real (puede tener email original del cliente)
      const { data: userRes, error: getUserErr } = await supabase.auth.admin.getUserById(profileData.id);
      if (!getUserErr && userRes?.user?.email) {
        authEmail = userRes.user.email;
        authUserId = userRes.user.id;
      } else {
        authUserId = profileData.id;
      }
      // Forzar password = desiredPassword (portal_password o derivado) para que signInWithPassword funcione
      try {
        if (authUserId) {
          await supabase.auth.admin.updateUserById(authUserId, {
            password: desiredPassword,
          });
        }
        // Si no tenía portal_password, guardar el derivado para que login con contraseña también funcione
        if (!customer.portal_password) {
          await supabase.from("customers").update({ portal_password: desiredPassword }).eq("id", customer.id);
        }
      } catch {
        // ignore — intentamos login igual
      }
    } else {
      // No hay profile — crear auth user + profile
      const { data: newUser, error: authError } = await supabase.auth.admin.createUser({
        email: syntheticEmail,
        password: desiredPassword,
        email_confirm: true,
      });

      if (authError || !newUser?.user) {
        // Tal vez ya existe en auth pero sin profile — buscar por email sintético
        const { data: listData } = await supabase.auth.admin.listUsers();
        const existingAuthUser = listData?.users?.find((u: { email?: string | null }) => u.email === syntheticEmail);

        if (existingAuthUser) {
          await supabase.auth.admin.updateUserById(existingAuthUser.id, {
            password: desiredPassword,
          });
          await supabase.from("customer_profiles").upsert([{
            id: existingAuthUser.id,
            customer_id: customer.id,
            phone: phone.trim(),
            role: "customer",
          }]);
          authEmail = syntheticEmail;
          authUserId = existingAuthUser.id;
        } else {
          return NextResponse.json(
            { error: "Error al preparar tu cuenta. Intenta con contraseña." },
            { status: 500 }
          );
        }
      } else {
        await supabase.from("customer_profiles").upsert([{
          id: newUser.user.id,
          customer_id: customer.id,
          phone: phone.trim(),
          role: "customer",
        }]);
        authEmail = syntheticEmail;
        authUserId = newUser.user.id;
      }
    }

    return NextResponse.json({
      success: true,
      auth_email: authEmail,
      auth_password: desiredPassword,
    });
  } catch (err) {
    console.error("PIN login error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
