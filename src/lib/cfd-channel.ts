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

// Estado por canal
type ChannelState = {
  channel: ReturnType<ReturnType<typeof getSupabaseClient>["channel"]>;
  ready: boolean;
  pending: Array<Record<string, unknown>>;
};

const channelStates: Record<string, ChannelState> = {};

function ensureChannel(target: "mostrador" | "caja"): ChannelState {
  const name = `cfd-${target}`;
  if (!channelStates[name]) {
    const supabase = getSupabaseClient();
    const channel = supabase.channel(name);
    channelStates[name] = { channel, ready: false, pending: [] };
  }
  return channelStates[name];
}

function subscribeIfNeeded(cs: ChannelState) {
  if (cs.ready) return;

  const state = (cs.channel as unknown as { state?: string }).state;
  if (state === "joined") {
    cs.ready = true;
    flushPending(cs);
    return;
  }
  if (state === "joining") return; // ya está en proceso

  cs.channel.subscribe((status: string) => {
    if (status === "SUBSCRIBED") {
      cs.ready = true;
      flushPending(cs);
    }
  });
}

function flushPending(cs: ChannelState) {
  while (cs.pending.length > 0) {
    const payload = cs.pending.shift()!;
    cs.channel.send({ type: "broadcast", event: "cfd-msg", payload });
  }
}

// ─── Emisor (se usa en ventas / cobranza) ───

export function sendCfd(target: "mostrador" | "caja", msg: CfdMessage) {
  try {
    const cs = ensureChannel(target);
    const payload = { ...msg, _ts: Date.now() };

    if (cs.ready) {
      cs.channel.send({ type: "broadcast", event: "cfd-msg", payload });
    } else {
      cs.pending.push(payload);
      subscribeIfNeeded(cs);
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
  const cs = ensureChannel(target);

  cs.channel
    .on("broadcast", { event: "cfd-msg" }, (payload: { payload: CfdMessage & { _ts?: number } }) => {
      try {
        onMessage(payload.payload as CfdMessage);
      } catch {
        // ignorar
      }
    })
    .subscribe((status: string) => {
      if (status === "SUBSCRIBED") {
        cs.ready = true;
      }
    });

  return () => {
    cs.channel.unsubscribe();
    const name = `cfd-${target}`;
    delete channelStates[name];
  };
}
