import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";
import { verifyPinSchema, validateBody } from "@/lib/schemas";

/**
 * POST /api/auth/verify-pin
 * Body: { pin: "1234" }
 * Retorna: { role, label } o 401
 * Rate limit: 5 intentos por minuto por IP
 */
export async function POST(req: Request) {
  try {
    // Rate limit: 5 attempts per minute per IP
    const ip = getClientIP(req);
    const rl = checkRateLimit(`verify-pin:${ip}`, { limit: 5, windowSeconds: 60 });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Demasiados intentos. Reintenta en ${rl.retryAfterSeconds}s` },
        { status: 429 }
      );
    }

    const body = await req.json();
    const v = validateBody(verifyPinSchema, body);
    if (v.error) {
      return NextResponse.json({ error: v.error }, { status: 400 });
    }
    const { pin } = v.data!;

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
