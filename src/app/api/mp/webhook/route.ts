import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // MP envía varios tipos de notificación, solo nos interesa "payment"
    if (body.type !== "payment" && body.action !== "payment.updated" && body.action !== "payment.created") {
      return NextResponse.json({ received: true });
    }

    const paymentId = body.data?.id;
    if (!paymentId) {
      return NextResponse.json({ received: true });
    }

    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) {
      console.error("MP_ACCESS_TOKEN no configurado");
      return NextResponse.json({ error: "config" }, { status: 500 });
    }

    // Consultar detalles del pago a MP
    const paymentRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!paymentRes.ok) {
      console.error("MP payment fetch error:", await paymentRes.text());
      return NextResponse.json({ error: "mp_fetch" }, { status: 500 });
    }

    const payment = await paymentRes.json();
    const orderId = payment.external_reference;

    if (!orderId) {
      console.warn("Webhook sin external_reference, paymentId:", paymentId);
      return NextResponse.json({ received: true });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Mapear status de MP → nuestro payment_status
    let paymentStatus = "pendiente";
    if (payment.status === "approved") paymentStatus = "pagado";
    else if (payment.status === "rejected") paymentStatus = "rechazado";
    else if (payment.status === "in_process" || payment.status === "pending") paymentStatus = "procesando";
    else if (payment.status === "cancelled") paymentStatus = "cancelado";
    else if (payment.status === "refunded") paymentStatus = "reembolsado";

    const updateData: Record<string, unknown> = {
      payment_status: paymentStatus,
      mp_payment_id: String(paymentId),
    };

    if (payment.status === "approved") {
      updateData.paid_at = new Date().toISOString();
    }

    await supabase
      .from("orders")
      .update(updateData)
      .eq("id", orderId);

    console.log(`Webhook procesado: order=${orderId} status=${paymentStatus} mpPayment=${paymentId}`);

    return NextResponse.json({ received: true, order_id: orderId, status: paymentStatus });
  } catch (err) {
    console.error("webhook error:", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

// MP a veces envía GET para verificar que el endpoint existe
export async function GET() {
  return NextResponse.json({ status: "ok" });
}
