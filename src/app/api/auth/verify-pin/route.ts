import { NextResponse } from "next/server";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";
import { verifyPinSchema, validateBody } from "@/lib/schemas";
import { identificarPorPin, abrirSesionEmpleado } from "@/lib/auth-server";

/**
 * POST /api/auth/verify-pin
 * Body: { pin: "1234" }
 * Retorna: { role, label, name, session: { access_token, refresh_token, expires_at } } o 401
 *
 * Valida el PIN contra app_pins y employee_codes CON LA LLAVE DE SERVIDOR
 * (antes usaba la llave pública, que es la que va a tener la puerta cerrada)
 * y devuelve además una sesión de Supabase Auth para que todas las consultas
 * que haga esa pantalla lleven la identidad del empleado.
 *
 * Si por lo que sea no se puede abrir la sesión, igual se responde con el
 * rol: el sistema sigue funcionando como hasta hoy. Nunca se bloquea el cobro.
 *
 * Rate limit: 5 intentos por minuto por IP.
 */
export async function POST(req: Request) {
  try {
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

    const identidad = await identificarPorPin(pin);
    if (!identidad) {
      return NextResponse.json({ error: "PIN incorrecto" }, { status: 401 });
    }

    let session: Awaited<ReturnType<typeof abrirSesionEmpleado>> | null = null;
    try {
      session = await abrirSesionEmpleado(identidad);
    } catch (e) {
      // No detener el login: el rol ya se validó. Solo se pierde la identidad
      // en la base para esta sesión, que hoy no bloquea nada.
      console.error("verify-pin: no se pudo abrir sesión Auth:", e);
    }

    return NextResponse.json({
      role: identidad.role,
      label: identidad.label,
      name: identidad.name,
      session,
    });
  } catch (e) {
    console.error("verify-pin:", e);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}
