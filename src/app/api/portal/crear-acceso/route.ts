import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { customer_id, customer_name, phone, email, password, secret } = body;

    if (secret !== "sergios2026") {
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

    // Determine the email to use for auth
    // If customer has email, use it. Otherwise generate from phone
    const authEmail = email && email.trim()
      ? email.trim().toLowerCase()
      : phone && phone.trim()
        ? `${phone.trim().replace(/\D/g, "")}@clientes.sergios.mx`
        : null;

    if (!authEmail) {
      return NextResponse.json(
        { error: "El cliente necesita al menos un teléfono o correo" },
        { status: 400 }
      );
    }

    // Check if auth user already exists with this email
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existing = existingUsers?.users?.find(
      (u: any) => u.email?.toLowerCase() === authEmail
    );

    if (existing) {
      // Check if already linked to this customer
      const { data: existingProfile } = await supabase
        .from("customer_profiles")
        .select("*")
        .eq("id", existing.id)
        .maybeSingle();

      if (existingProfile?.customer_id === customer_id) {
        return NextResponse.json(
          { error: "Este cliente ya tiene acceso al portal" },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: `Ya existe una cuenta con el correo ${authEmail}` },
        { status: 400 }
      );
    }

    // Create auth user using admin API (doesn't affect current session)
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: authEmail,
      password,
      email_confirm: true, // Auto-confirm so they can login immediately
    });

    if (createError || !newUser?.user) {
      console.error("Error creating auth user:", createError);
      return NextResponse.json(
        { error: createError?.message || "No se pudo crear el usuario" },
        { status: 500 }
      );
    }

    // Create customer_profiles entry linking auth user to customer
    const { error: profileError } = await supabase.from("customer_profiles").upsert([
      {
        id: newUser.user.id,
        customer_id,
        full_name: customer_name,
        phone: phone || null,
        email: authEmail,
        customer_type: "menudeo",
        role: "customer",
      },
    ]);

    if (profileError) {
      console.error("Error creating profile:", profileError);
      // Try to clean up the auth user
      await supabase.auth.admin.deleteUser(newUser.user.id);
      return NextResponse.json(
        { error: "Se creó el usuario pero falló el perfil. Intenta de nuevo." },
        { status: 500 }
      );
    }

    // Create loyalty account
    await supabase.from("loyalty_accounts").upsert([{ customer_id }]);

    // Update customer email if they didn't have one
    if (email && email.trim()) {
      await supabase
        .from("customers")
        .update({ email: email.trim() })
        .eq("id", customer_id);
    }

    return NextResponse.json({
      success: true,
      auth_email: authEmail,
      user_id: newUser.user.id,
      message: authEmail.includes("@clientes.sergios.mx")
        ? `Cuenta creada. El cliente inicia sesión con su teléfono (${phone}) y la contraseña que pusiste.`
        : `Cuenta creada. El cliente inicia sesión con ${authEmail} y la contraseña que pusiste.`,
    });
  } catch (err: any) {
    console.error("Portal access error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
