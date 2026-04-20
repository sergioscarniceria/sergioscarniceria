import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { customer_id, customer_name, phone, email, password, secret } = body;

    if (![process.env.ADMIN_SECRET, process.env.NEXT_PUBLIC_ADMIN_SECRET].filter(Boolean).includes(secret || "")) {
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

    // Ensure customer_profiles table exists and RLS is disabled
    await supabase.rpc("exec_sql", {
      sql: `
        CREATE TABLE IF NOT EXISTS customer_profiles (
          id UUID PRIMARY KEY,
          customer_id UUID,
          full_name TEXT,
          phone TEXT,
          email TEXT,
          customer_type TEXT DEFAULT 'menudeo',
          role TEXT DEFAULT 'customer',
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        ALTER TABLE customer_profiles DISABLE ROW LEVEL SECURITY;
      `
    });

    // Ensure loyalty_accounts exists
    await supabase.rpc("exec_sql", {
      sql: `
        CREATE TABLE IF NOT EXISTS loyalty_accounts (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          customer_id UUID UNIQUE,
          points INTEGER DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        ALTER TABLE loyalty_accounts DISABLE ROW LEVEL SECURITY;
      `
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

    const authEmail = `${customer_id}@clientes.sergios.mx`;

    // Check if auth user already exists (from a previous failed attempt)
    // If so, delete it first
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingAuthUser = existingUsers?.users?.find(
      (u) => u.email === authEmail
    );
    if (existingAuthUser) {
      // Delete orphaned auth user from previous failed attempt
      await supabase.auth.admin.deleteUser(existingAuthUser.id);
      // Also clean up any orphaned profile
      await supabase.from("customer_profiles").delete().eq("id", existingAuthUser.id);
    }

    // Create auth user
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: authEmail,
      password,
      email_confirm: true,
    });

    if (createError || !newUser?.user) {
      console.error("Error creating auth user:", createError);
      return NextResponse.json(
        { error: createError?.message || "No se pudo crear el usuario de auth" },
        { status: 500 }
      );
    }

    // Store profile
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
      // Try direct SQL as fallback
      const { error: sqlError } = await supabase.rpc("exec_sql", {
        sql: `INSERT INTO customer_profiles (id, customer_id, full_name, phone, email, customer_type, role)
              VALUES ('${newUser.user.id}', '${customer_id}', '${customer_name.replace(/'/g, "''")}', ${displayPhone ? `'${displayPhone}'` : 'NULL'}, ${displayEmail ? `'${displayEmail}'` : 'NULL'}, 'menudeo', 'customer')
              ON CONFLICT (id) DO NOTHING;`
      });

      if (sqlError) {
        console.error("SQL fallback also failed:", sqlError);
        await supabase.auth.admin.deleteUser(newUser.user.id);
        return NextResponse.json(
          { error: `Falló el perfil: ${profileError.message}. SQL: ${sqlError.message}` },
          { status: 500 }
        );
      }
    }

    // Create loyalty account (ignore errors)
    await supabase.from("loyalty_accounts").upsert([{ customer_id }]).then(() => {});

    // Save password in customers table for admin reference
    const updateData: Record<string, string> = { portal_password: password };
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
      { error: `Error interno: ${err.message || "desconocido"}` },
      { status: 500 }
    );
  }
}
