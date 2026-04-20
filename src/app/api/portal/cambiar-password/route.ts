import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { customer_id, new_password, secret } = body;

    if (![process.env.ADMIN_SECRET, process.env.NEXT_PUBLIC_ADMIN_SECRET].filter(Boolean).includes(secret)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    if (!customer_id || !new_password) {
      return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
    }

    if (new_password.length < 6) {
      return NextResponse.json({ error: "Mínimo 6 caracteres" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Find the auth user linked to this customer
    const { data: profile } = await supabase
      .from("customer_profiles")
      .select("id")
      .eq("customer_id", customer_id)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ error: "Este cliente no tiene cuenta portal" }, { status: 404 });
    }

    // Update password in Supabase Auth
    const { error: authError } = await supabase.auth.admin.updateUserById(profile.id, {
      password: new_password,
    });

    if (authError) {
      console.error("Error updating password:", authError);
      return NextResponse.json({ error: "No se pudo cambiar la contraseña" }, { status: 500 });
    }

    // Save new password in customers table for admin reference
    await supabase
      .from("customers")
      .update({ portal_password: new_password })
      .eq("id", customer_id);

    return NextResponse.json({
      success: true,
      message: `Contraseña cambiada exitosamente`,
    });
  } catch (err: any) {
    console.error("Password change error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
