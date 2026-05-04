/**
 * Customer-Facing Display (CFD) — Cross-tab communication via localStorage
 *
 * Usa localStorage + evento "storage" para comunicar entre pestañas.
 * El evento "storage" se dispara en TODAS las otras pestañas/ventanas
 * del mismo origen cuando se modifica localStorage.
 * Más confiable que BroadcastChannel en kiosk mode y distintas ventanas.
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

const KEY_MOSTRADOR = "cfd-mostrador";
const KEY_CAJA = "cfd-caja";

function getKey(target: "mostrador" | "caja") {
  return target === "mostrador" ? KEY_MOSTRADOR : KEY_CAJA;
}

// ─── Emisor (se usa en ventas / cobranza) ───

export function sendCfd(target: "mostrador" | "caja", msg: CfdMessage) {
  try {
    const key = getKey(target);
    // Agregar timestamp para que el evento siempre se dispare
    // (localStorage solo dispara "storage" si el valor CAMBIA)
    const payload = JSON.stringify({ ...msg, _ts: Date.now() });
    localStorage.setItem(key, payload);
  } catch {
    // localStorage no disponible — ignorar
  }
}

// ─── Listener (se usa en /display/*) ───

export function listenCfd(
  target: "mostrador" | "caja",
  onMessage: (msg: CfdMessage) => void
): () => void {
  const key = getKey(target);

  function handler(e: StorageEvent) {
    if (e.key !== key || !e.newValue) return;
    try {
      const parsed = JSON.parse(e.newValue);
      onMessage(parsed as CfdMessage);
    } catch {
      // JSON inválido — ignorar
    }
  }

  window.addEventListener("storage", handler);

  // También leer el valor actual al arrancar (por si ya hay datos)
  try {
    const current = localStorage.getItem(key);
    if (current) {
      const parsed = JSON.parse(current);
      // Solo usar si es reciente (menos de 30s)
      if (parsed._ts && Date.now() - parsed._ts < 30000) {
        onMessage(parsed as CfdMessage);
      }
    }
  } catch {
    // ignorar
  }

  return () => window.removeEventListener("storage", handler);
}
