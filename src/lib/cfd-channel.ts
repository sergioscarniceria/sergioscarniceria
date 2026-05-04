/**
 * Customer-Facing Display (CFD) — Supabase Realtime Broadcast
 *
 * Usa Supabase Realtime channels para comunicar entre pestañas,
 * ventanas e incluso computadoras distintas.
 * Funciona aunque sean 2 instancias de Chrome diferentes.
 */

import { getSupabaseClient } from "@/lib/supabase";

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

// Canal único por target (singleton para no crear duplicados)
const channels: Record<string, ReturnType<ReturnType<typeof getSupabaseClient>["channel"]>> = {};

function getChannel(target: "mostrador" | "caja") {
  const name = `cfd-${target}`;
  if (!channels[name]) {
    const supabase = getSupabaseClient();
    channels[name] = supabase.channel(name);
  }
  return channels[name];
}

// ─── Emisor (se usa en ventas / cobranza) ───

export function sendCfd(target: "mostrador" | "caja", msg: CfdMessage) {
  try {
    const channel = getChannel(target);
    // Suscribirse si no está suscrito (necesario para poder enviar)
    if ((channel as unknown as { state?: string }).state !== "joined") {
      channel.subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          channel.send({
            type: "broadcast",
            event: "cfd-msg",
            payload: { ...msg, _ts: Date.now() },
          });
        }
      });
    } else {
      channel.send({
        type: "broadcast",
        event: "cfd-msg",
        payload: { ...msg, _ts: Date.now() },
      });
    }
  } catch {
    // Supabase no disponible — ignorar
  }
}

// ─── Listener (se usa en /display/*) ───

export function listenCfd(
  target: "mostrador" | "caja",
  onMessage: (msg: CfdMessage) => void
): () => void {
  const channel = getChannel(target);

  channel
    .on("broadcast", { event: "cfd-msg" }, (payload: { payload: CfdMessage & { _ts?: number } }) => {
      try {
        onMessage(payload.payload as CfdMessage);
      } catch {
        // ignorar
      }
    })
    .subscribe();

  return () => {
    channel.unsubscribe();
    const name = `cfd-${target}`;
    delete channels[name];
  };
}
