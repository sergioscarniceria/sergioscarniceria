import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function isAuthorized(req: Request): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("x-admin-secret") || req.headers.get("authorization")?.replace("Bearer ", "");
  return auth === secret;
}

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

async function generateUniquePin(sb: ReturnType<typeof adminClient>): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const pin = String(Math.floor(1000 + Math.random() * 9000));
    const { data } = await sb.from("customers").select("id").eq("client_pin", pin).limit(1);
    if (!data || data.length === 0) return pin;
  }
  return String(Math.floor(1000 + Math.random() * 9000));
}

/** POST /api/admin/clientes — crear cliente nuevo (opcionalmente con PIN de portal) */
export async function POST(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const body = await req.json();
    const {
      name,
      phone = null,
      email = null,
      business_name = null,
      address = null,
      customer_type = "menudeo",
      discount_percent = null,
      generar_pin = false,
    } = body;

    if (!name || !String(name).trim()) {
      return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
    }

    const sb = adminClient();

    const payload: Record<string, unknown> = {
      name: String(name).trim(),
      phone: phone ? String(phone).trim() : null,
      email: email ? String(email).trim() : null,
      business_name: business_name ? String(business_name).trim() : null,
      address: address ? String(address).trim() : null,
      customer_type: customer_type || "menudeo",
    };
    if (discount_percent !== null && discount_percent !== undefined && discount_percent !== "") {
      payload.discount_percent = Number(discount_percent);
    }

    if (generar_pin) {
      const pin = await generateUniquePin(sb);
      payload.client_pin = pin;
      payload.portal_password = "123456";
    }

    const { data, error } = await sb
      .from("customers")
      .insert([payload])
      .select("id, name, phone, client_pin, portal_password")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ customer: data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** PATCH /api/admin/clientes — generar PIN para cliente existente (o resetear password) */
export async function PATCH(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const body = await req.json();
    const { customer_id, action } = body;
    if (!customer_id) {
      return NextResponse.json({ error: "Falta customer_id" }, { status: 400 });
    }

    const sb = adminClient();

    if (action === "generar_pin") {
      // Verificar que el cliente exista
      const { data: customer, error: findErr } = await sb
        .from("customers")
        .select("id, name, phone, client_pin, portal_password")
        .eq("id", customer_id)
        .single();
      if (findErr || !customer) {
        return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
      }
      // Si ya tiene PIN, devolverlo
      if (customer.client_pin) {
        return NextResponse.json({ customer });
      }
      // Generar nuevo PIN
      const pin = await generateUniquePin(sb);
      const password = customer.portal_password || "123456";
      const { data: updated, error: updErr } = await sb
        .from("customers")
        .update({ client_pin: pin, portal_password: password })
        .eq("id", customer_id)
        .select("id, name, phone, client_pin, portal_password")
        .single();
      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
      return NextResponse.json({ customer: updated });
    }

    return NextResponse.json({ error: "Acción no reconocida" }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
