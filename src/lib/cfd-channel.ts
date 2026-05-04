/**
 * Customer-Facing Display (CFD) — BroadcastChannel helper
 *
 * Comunica la pestaña del operador (ventas / cobranza) con la
 * pestaña del display (/display/mostrador o /display/caja) que
 * corre en el segundo monitor de la misma PC.
 */

export type CfdItemLine = {
  product: string;
  kilos: number;
  price: number;
  sale_type?: "kg" | "pieza";
  quantity?: number | null;
  is_fixed_price_piece?: boolean;
};

export type CfdMessage =
  | { type: "heartbeat" }
  | { type: "venta_activa"; items: CfdItemLine[]; total: number; customerName?: string }
  | { type: "ticket_listo"; total: number; customerName?: string; folio?: string }
  | { type: "pago_confirmado"; total: number; customerName?: string; method?: string }
  | { type: "idle" };

const CHANNEL_MOSTRADOR = "cfd-mostrador";
const CHANNEL_CAJA = "cfd-caja";

// ─── Canal persistente (singleton por target) ───
const channels: Record<string, BroadcastChannel> = {};

function getOrCreateChannel(target: "mostrador" | "caja"): BroadcastChannel {
  const name = target === "mostrador" ? CHANNEL_MOSTRADOR : CHANNEL_CAJA;
  if (!channels[name] || channels[name].name === "") {
    try {
      channels[name] = new BroadcastChannel(name);
    } catch {
      // fallback
    }
  }
  return channels[name];
}

// ─── Emisor (se usa en ventas / cobranza) ───

export function sendCfd(target: "mostrador" | "caja", msg: CfdMessage) {
  try {
    const ch = getOrCreateChannel(target);
    if (ch) ch.postMessage(msg);
  } catch {
    // BroadcastChannel no soportado o error — ignorar silenciosamente
  }
}

// ─── Listener (se usa en /display/*) ───

export function listenCfd(
  target: "mostrador" | "caja",
  onMessage: (msg: CfdMessage) => void
): () => void {
  const name = target === "mostrador" ? CHANNEL_MOSTRADOR : CHANNEL_CAJA;
  const ch = new BroadcastChannel(name);
  ch.onmessage = (e) => onMessage(e.data as CfdMessage);
  return () => ch.close();
}
