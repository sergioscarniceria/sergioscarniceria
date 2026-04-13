import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

/**
 * GET /api/auth/pins — lista los PINs (para panel admin)
 * PUT /api/auth/pins — actualizar un PIN { role, pin }
 */
export async function GET() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("app_pins")
    .select("role, pin, label, updated_at")
    .order("role");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function PUT(req: Request) {
  try {
    const { role, pin } = await req.json();

    if (!role || !pin) {
      return NextResponse.json({ error: "role y pin requeridos" }, { status: 400 });
    }

    if (!/^\d{4}$/.test(pin)) {
      return NextResponse.json({ error: "El PIN debe ser de 4 dígitos" }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // Verificar que no haya otro rol con el mismo PIN
    const { data: existing } = await supabase
      .from("app_pins")
      .select("role")
      .eq("pin", pin)
      .neq("role", role)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: `Ese PIN ya está asignado al rol "${existing[0].role}"` },
        { status: 409 }
      );
    }

    const { error } = await supabase
      .from("app_pins")
      .update({ pin, updated_at: new Date().toISOString() })
      .eq("role", role);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}
