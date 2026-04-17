import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Reset password for a customer by phone number.
 * The client sends phone + new_password.
 * We verify the phone exists, then update the password.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phone, new_password } = body;

    if (!phone || !phone.trim()) {
      return NextResponse.json({ error: "Escribe tu número de teléfono" }, { status: 400 });
    }

    if (!new_password || new_password.length < 4) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 4 caracteres" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Find customer profile by phone
    const { data: profile } = await supabase
      .from("customer_profiles")
      .select("id, customer_id, full_name")
      .eq("phone", phone.trim())
      .maybeSingle();

    if (!profile) {
      return NextResponse.json(
        { error: "No encontramos una cuenta con ese teléfono" },
        { status: 404 }
      );
    }

    // Update password via admin API
    const { error: authError } = await supabase.auth.admin.updateUserById(profile.id, {
      password: new_password,
    });

    if (authError) {
      console.error("Reset password error:", authError);
      return NextResponse.json({ error: "No se pudo cambiar la contraseña" }, { status: 500 });
    }

    // Update in customers table for admin reference
    await supabase
      .from("customers")
      .update({ portal_password: new_password })
      .eq("id", profile.customer_id);

    return NextResponse.json({
      success: true,
      name: profile.full_name,
    });
  } catch (err) {
    console.error("Reset password error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
