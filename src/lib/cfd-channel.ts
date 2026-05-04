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
// Usa AMBOS: evento "storage" + polling cada 1s como respaldo.
// El evento "storage" NO se dispara en la misma pestaña que escribió,
// y puede fallar entre ventanas Chrome separadas (kiosk mode).
// El polling garantiza que siempre se reciba el mensaje.

export function listenCfd(
  target: "mostrador" | "caja",
  onMessage: (msg: CfdMessage) => void
): () => void {
  const key = getKey(target);
  let lastTs = 0; // para evitar llamar onMessage con el mismo dato

  function processValue(raw: string | null) {
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      const ts = parsed._ts || 0;
      if (ts > lastTs) {
        lastTs = ts;
        onMessage(parsed as CfdMessage);
      }
    } catch {
      // JSON inválido — ignorar
    }
  }

  // 1. Evento storage (se dispara en otras pestañas del mismo origen)
  function handler(e: StorageEvent) {
    if (e.key !== key || !e.newValue) return;
    processValue(e.newValue);
  }
  window.addEventListener("storage", handler);

  // 2. Polling cada 1s como respaldo (cubre kiosk, ventanas separadas, etc.)
  const poll = setInterval(() => {
    try {
      processValue(localStorage.getItem(key));
    } catch {
      // ignorar
    }
  }, 1000);

  // 3. Leer valor actual al arrancar (si es reciente)
  try {
    const current = localStorage.getItem(key);
    if (current) {
      const parsed = JSON.parse(current);
      if (parsed._ts && Date.now() - parsed._ts < 30000) {
        lastTs = parsed._ts;
        onMessage(parsed as CfdMessage);
      }
    }
  } catch {
    // ignorar
  }

  return () => {
    window.removeEventListener("storage", handler);
    clearInterval(poll);
  };
}
