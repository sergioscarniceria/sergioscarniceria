import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Lookup the auth email for a customer by phone number
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phone } = body;

    if (!phone || !phone.trim()) {
      return NextResponse.json({ error: "Teléfono requerido" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Look up customer_profiles by phone
    const { data: profile } = await supabase
      .from("customer_profiles")
      .select("email")
      .eq("phone", phone.trim())
      .maybeSingle();

    if (profile?.email) {
      return NextResponse.json({ email: profile.email });
    }

    // Try generated email pattern
    const cleanPhone = phone.trim().replace(/\D/g, "");
    const generatedEmail = `${cleanPhone}@clientes.sergios.mx`;

    // Check if this generated email exists in auth
    const { data: users } = await supabase.auth.admin.listUsers();
    const found = users?.users?.find(
      (u: any) => u.email?.toLowerCase() === generatedEmail
    );

    if (found) {
      return NextResponse.json({ email: generatedEmail });
    }

    return NextResponse.json({ error: "No encontramos una cuenta con ese teléfono" }, { status: 404 });
  } catch (err: any) {
    console.error("Phone lookup error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
