import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/portal/actualizar-mi-password
 * Endpoint para que el cliente mismo actualice su portal_password en customers.
 * Requiere: access_token de su sesión Supabase auth + new_password
 * El auth ya se cambia desde el cliente con supabase.auth.updateUser; este endpoint
 * SOLO sincroniza portal_password en customers para que admin lo vea.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { access_token, new_password } = body;

    if (!access_token || !new_password) {
      return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
    }
    if (new_password.length < 6) {
      return NextResponse.json({ error: "Mínimo 6 caracteres" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const sb = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verificar el access_token y obtener el user
    const { data: userData, error: userErr } = await sb.auth.getUser(access_token);
    if (userErr || !userData?.user?.id) {
      return NextResponse.json({ error: "Sesión inválida" }, { status: 401 });
    }
    const authUserId = userData.user.id;

    // Buscar el profile ligado a este auth user
    const { data: profile } = await sb
      .from("customer_profiles")
      .select("customer_id")
      .eq("id", authUserId)
      .maybeSingle();

    if (!profile?.customer_id) {
      return NextResponse.json({ error: "Perfil no encontrado" }, { status: 404 });
    }

    // Actualizar tanto el auth user password como el portal_password
    await sb.auth.admin.updateUserById(authUserId, { password: new_password });
    await sb.from("customers").update({ portal_password: new_password }).eq("id", profile.customer_id);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
