import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Lookup the auth email for a customer by phone or real email.
 * Handles both old accounts (real email as auth) and new accounts ({id}@clientes.sergios.mx).
 * Returns all possible auth emails so the client can try each one.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phone, email } = body;

    if ((!phone || !phone.trim()) && (!email || !email.trim())) {
      return NextResponse.json({ error: "Tel\u00e9fono o correo requerido" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Collect all possible auth emails to try
    const authEmails: string[] = [];

    // 1. Search in customer_profiles (has the auth user id)
    let profile: any = null;

    if (phone && phone.trim()) {
      const { data } = await supabase
        .from("customer_profiles")
        .select("id, customer_id, email")
        .eq("phone", phone.trim())
        .maybeSingle();
      profile = data;
    }

    if (!profile && email && email.trim()) {
      const { data } = await supabase
        .from("customer_profiles")
        .select("id, customer_id, email")
        .eq("email", email.trim().toLowerCase())
        .maybeSingle();
      profile = data;
    }

    if (profile) {
      // If we have the auth user id, get the actual auth email
      if (profile.id) {
        const { data: authUser } = await supabase.auth.admin.getUserById(profile.id);
        if (authUser?.user?.email) {
          authEmails.push(authUser.user.email);
        }
      }
      // Also add the new format as fallback
      if (profile.customer_id) {
        const newFormat = `${profile.customer_id}@clientes.sergios.mx`;
        if (!authEmails.includes(newFormat)) authEmails.push(newFormat);
      }
      // Also add the real email
      if (profile.email && !authEmails.includes(profile.email)) {
        authEmails.push(profile.email);
      }
    }

    // 2. Also search in customers table
    let customer: any = null;
    if (phone && phone.trim()) {
      const { data } = await supabase
        .from("customers")
        .select("id, email")
        .eq("phone", phone.trim())
        .maybeSingle();
      customer = data;
    }
    if (!customer && email && email.trim()) {
      const { data } = await supabase
        .from("customers")
        .select("id, email")
        .eq("email", email.trim().toLowerCase())
        .maybeSingle();
      customer = data;
    }

    if (customer) {
      const newFormat = `${customer.id}@clientes.sergios.mx`;
      if (!authEmails.includes(newFormat)) authEmails.push(newFormat);
      if (customer.email && !authEmails.includes(customer.email)) {
        authEmails.push(customer.email);
      }
    }

    // 3. If searching by email, also add the raw email as potential auth email (old signUp method)
    if (email && email.trim()) {
      const rawEmail = email.trim().toLowerCase();
      if (!authEmails.includes(rawEmail)) authEmails.push(rawEmail);
    }

    if (authEmails.length === 0) {
      return NextResponse.json(
        { error: "No encontramos una cuenta con esos datos" },
        { status: 404 }
      );
    }

    // Return primary + all alternatives
    return NextResponse.json({
      email: authEmails[0],
      alternatives: authEmails.slice(1),
    });
  } catch (err: any) {
    console.error("Phone/email lookup error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
