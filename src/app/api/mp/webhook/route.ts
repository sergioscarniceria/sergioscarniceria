import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Validate Mercado Pago webhook HMAC signature.
 * MP sends x-signature header with format: "ts=...,v1=..."
 * See: https://www.mercadopago.com.mx/developers/es/docs/your-integrations/notifications/webhooks
 */
function validateMPSignature(req: NextRequest, body: string): boolean {
  const mpWebhookSecret = process.env.MP_WEBHOOK_SECRET;
  if (!mpWebhookSecret) {
    // If no secret configured, log warning but allow (backward compatible)
    console.warn("MP_WEBHOOK_SECRET no configurado - webhook sin validar");
    return true;
  }

  const xSignature = req.headers.get("x-signature");
  const xRequestId = req.headers.get("x-request-id");

  if (!xSignature || !xRequestId) {
    console.warn("Webhook sin x-signature o x-request-id");
    return false;
  }

  // Parse x-signature: "ts=TIMESTAMP,v1=HASH"
  const parts: Record<string, string> = {};
  for (const part of xSignature.split(",")) {
    const [key, val] = part.split("=", 2);
    if (key && val) parts[key.trim()] = val.trim();
  }

  const ts = parts["ts"];
  const v1 = parts["v1"];
  if (!ts || !v1) return false;

  // Parse body to get data.id
  let dataId = "";
  try {
    const parsed = JSON.parse(body);
    dataId = parsed?.data?.id ? String(parsed.data.id) : "";
  } catch {
    return false;
  }

  // Build manifest string per MP docs
  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const hmac = crypto.createHmac("sha256", mpWebhookSecret).update(manifest).digest("hex");

  return hmac === v1;
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    // Validate HMAC signature
    if (!validateMPSignature(req, rawBody)) {
      console.warn("Webhook rechazado: firma HMAC inválida");
      return NextResponse.json({ error: "invalid_signature" }, { status: 403 });
    }

    const body = JSON.parse(rawBody);

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
