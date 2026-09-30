import { NextResponse } from "next/server";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";
import { identificarPorPin } from "@/lib/auth-server";

/**
 * POST /api/auth/verify-employee-code
 * Body: { code: "1002", roles?: ["cajera","admin"] }
 * Retorna: { name, role } o 401
 *
 * Para los momentos en que una pantalla pide "código de cajera" para
 * autorizar algo (cancelar un cobro, cambiar método de pago, ajustar
 * inventario). Antes cada pantalla leía la tabla de códigos desde el
 * navegador; ahora se pregunta al servidor y la tabla nunca sale.
 *
 * NO abre sesión: solo confirma quién autorizó. Rate limit 10/min por IP.
 */
export async function POST(req: Request) {
  try {
    const ip = getClientIP(req);
    const rl = checkRateLimit(`verify-code:${ip}`, { limit: 10, windowSeconds: 60 });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Demasiados intentos. Reintenta en ${rl.retryAfterSeconds}s` },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const code = String(body?.code ?? "").trim();
    const roles: string[] | undefined = Array.isArray(body?.roles) ? body.roles.map(String) : undefined;

    if (!/^\d{4}$/.test(code)) {
      return NextResponse.json({ error: "Código inválido" }, { status: 400 });
    }

    const id = await identificarPorPin(code);
    if (!id) {
      return NextResponse.json({ error: "Código incorrecto" }, { status: 401 });
    }

    // Admin siempre puede autorizar. Si la pantalla pidió roles específicos, se respetan.
    if (roles && roles.length > 0 && id.role !== "admin" && !roles.includes(id.role)) {
      return NextResponse.json({ error: "Este código no tiene permiso para esta acción" }, { status: 403 });
    }

    return NextResponse.json({ name: id.name || id.label, role: id.role });
  } catch (e) {
    console.error("verify-employee-code:", e);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}
