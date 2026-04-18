import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";
import { updatePinSchema, validateBody } from "@/lib/schemas";

function isAuthorized(req: Request): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("x-admin-secret") || req.headers.get("authorization")?.replace("Bearer ", "");
  return auth === secret;
}

/**
 * GET /api/auth/pins — lista los PINs (para panel admin, requiere auth)
 * PUT /api/auth/pins — actualizar un PIN { role, pin } (requiere auth)
 */
export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

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
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Rate limit PIN changes: 10 per minute
    const ip = getClientIP(req);
    const rl = checkRateLimit(`pins-put:${ip}`, { limit: 10, windowSeconds: 60 });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Demasiados intentos. Reintenta en ${rl.retryAfterSeconds}s` },
        { status: 429 }
      );
    }

    const body = await req.json();
    const v = validateBody(updatePinSchema, body);
    if (v.error) {
      return NextResponse.json({ error: v.error }, { status: 400 });
    }
    const { role, pin } = v.data!;

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
