import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { customer_id, customer_name, phone, email, password, secret } = body;

    if (secret !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    if (!customer_id || !customer_name || !password) {
      return NextResponse.json(
        { error: "Faltan datos: customer_id, customer_name y password son obligatorios" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 6 caracteres" },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Check if this customer already has portal access
    const { data: existingProfile } = await supabase
      .from("customer_profiles")
      .select("id")
      .eq("customer_id", customer_id)
      .maybeSingle();

    if (existingProfile) {
      return NextResponse.json(
        { error: "Este cliente ya tiene acceso al portal" },
        { status: 400 }
      );
    }

    // Always use customer_id as auth email to guarantee uniqueness
    // This allows multiple customers to share the same real email/phone
    const authEmail = `${customer_id}@clientes.sergios.mx`;

    // Create auth user using admin API (doesn't affect current session)
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: authEmail,
      password,
      email_confirm: true,
    });

    if (createError || !newUser?.user) {
      console.error("Error creating auth user:", createError);
      return NextResponse.json(
        { error: createError?.message || "No se pudo crear el usuario" },
        { status: 500 }
      );
    }

    // Store the real email and phone in customer_profiles for login lookup
    const displayEmail = email && email.trim() ? email.trim().toLowerCase() : null;
    const displayPhone = phone && phone.trim() ? phone.trim() : null;

    const { error: profileError } = await supabase.from("customer_profiles").upsert([
      {
        id: newUser.user.id,
        customer_id,
        full_name: customer_name,
        phone: displayPhone,
        email: displayEmail,
        customer_type: "menudeo",
        role: "customer",
      },
    ]);

    if (profileError) {
      console.error("Error creating profile:", profileError);
      await supabase.auth.admin.deleteUser(newUser.user.id);
      return NextResponse.json(
        { error: "Se creó el usuario pero falló el perfil. Intenta de nuevo." },
        { status: 500 }
      );
    }

    // Create loyalty account
    await supabase.from("loyalty_accounts").upsert([{ customer_id }]);

    // Save password and email in customers table for admin reference
    const updateData: any = { portal_password: password };
    if (displayEmail) {
      updateData.email = displayEmail;
    }
    await supabase
      .from("customers")
      .update(updateData)
      .eq("id", customer_id);

    // Build login instructions
    let loginInfo = "";
    if (displayPhone) {
      loginInfo = `El cliente entra con su teléfono (${displayPhone}) y contraseña: ${password}`;
    } else if (displayEmail) {
      loginInfo = `El cliente entra con su correo (${displayEmail}) y contraseña: ${password}`;
    } else {
      loginInfo = `Cuenta creada con contraseña: ${password}`;
    }

    return NextResponse.json({
      success: true,
      auth_email: authEmail,
      user_id: newUser.user.id,
      message: `Cuenta creada. ${loginInfo}`,
    });
  } catch (err: any) {
    console.error("Portal access error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
