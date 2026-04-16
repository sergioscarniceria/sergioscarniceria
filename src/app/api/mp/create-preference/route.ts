import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: NextRequest) {
  try {
    const { order_id } = await req.json();

    if (!order_id) {
      return NextResponse.json({ error: "order_id requerido" }, { status: 400 });
    }

    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) {
      return NextResponse.json({ error: "MP_ACCESS_TOKEN no configurado" }, { status: 500 });
    }

    // Traer order + items
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", order_id)
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }

    // Construir items para MP
    const items = (order.order_items || []).map((item: Record<string, unknown>) => {
      const qty = item.sale_type === "pieza" ? Number(item.quantity || item.kilos || 1) : 1;
      const unitPrice =
        item.sale_type === "pieza"
          ? Number(item.price || 0)
          : Number(item.price || 0) * Number(item.kilos || 0);

      return {
        title: String(item.product || "Producto"),
        quantity: qty,
        unit_price: Number(unitPrice.toFixed(2)),
        currency_id: "MXN",
      };
    });

    const total = items.reduce((acc: number, i: { unit_price: number; quantity: number }) => acc + i.unit_price * i.quantity, 0);

    if (total <= 0) {
      return NextResponse.json({ error: "El pedido no tiene monto" }, { status: 400 });
    }

    // Determinar URL base
    const origin = req.headers.get("origin") || req.headers.get("referer")?.replace(/\/$/, "") || "https://sergioscarniceria.com";

    // Crear preferencia en MP
    const mpResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        items,
        external_reference: order_id,
        back_urls: {
          success: `${origin}/cliente?payment=success&order_id=${order_id}`,
          failure: `${origin}/cliente?payment=failure&order_id=${order_id}`,
          pending: `${origin}/cliente?payment=pending&order_id=${order_id}`,
        },
        auto_return: "approved",
        notification_url: `${origin}/api/mp/webhook`,
        statement_descriptor: "SERGIOS CARNICERIA",
      }),
    });

    if (!mpResponse.ok) {
      const errBody = await mpResponse.text();
      console.error("MP error:", errBody);
      return NextResponse.json({ error: "Error al crear preferencia en MP" }, { status: 500 });
    }

    const mpData = await mpResponse.json();

    // Guardar preference id en el pedido
    await supabase
      .from("orders")
      .update({
        mp_preference_id: mpData.id,
        payment_method: "tarjeta_mp",
        payment_status: "pendiente",
      })
      .eq("id", order_id);

    return NextResponse.json({
      init_point: mpData.init_point,
      sandbox_init_point: mpData.sandbox_init_point,
      preference_id: mpData.id,
    });
  } catch (err) {
    console.error("create-preference error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
