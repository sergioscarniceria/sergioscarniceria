import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Lookup the auth email for a customer by phone or email
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phone, email } = body;

    if ((!phone || !phone.trim()) && (!email || !email.trim())) {
      return NextResponse.json({ error: "Teléfono o correo requerido" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let profile: any = null;

    // Search by phone first
    if (phone && phone.trim()) {
      const { data } = await supabase
        .from("customer_profiles")
        .select("customer_id")
        .eq("phone", phone.trim())
        .maybeSingle();

      profile = data;
    }

    // If not found by phone, try by email
    if (!profile && email && email.trim()) {
      const { data } = await supabase
        .from("customer_profiles")
        .select("customer_id")
        .eq("email", email.trim().toLowerCase())
        .maybeSingle();

      profile = data;
    }

    if (!profile?.customer_id) {
      return NextResponse.json(
        { error: "No encontramos una cuenta con esos datos" },
        { status: 404 }
      );
    }

    // Auth email is always {customer_id}@clientes.sergios.mx
    const authEmail = `${profile.customer_id}@clientes.sergios.mx`;

    return NextResponse.json({ email: authEmail });
  } catch (err: any) {
    console.error("Phone/email lookup error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
