import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

/**
 * POST /api/auth/verify-pin
 * Body: { pin: "1234" }
 * Retorna: { role, label } o 401
 */
export async function POST(req: Request) {
  try {
    const { pin } = await req.json();

    if (!pin || typeof pin !== "string") {
      return NextResponse.json({ error: "PIN requerido" }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("app_pins")
      .select("role, label")
      .eq("pin", pin)
      .limit(1)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "PIN incorrecto" }, { status: 401 });
    }

    return NextResponse.json({ role: data.role, label: data.label });
  } catch {
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}
