"use client";

/**
 * Cancelados — todo lo que se canceló: tickets (desde Cobranza / Mostrador)
 * y cobros ya registrados (desde Caja). Muestra quién, cuándo, por qué,
 * qué artículos y cuánto. Solo lectura.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { itemSubtotal } from "@/lib/itemSubtotal";

const C = {
  bg: "#f7f1e8",
  card: "rgba(255,255,255,0.92)",
  border: "rgba(92, 27, 17, 0.10)",
  text: "#3b1c16",
  muted: "#7a5a52",
  primary: "#7b2218",
  success: "#1f7a4d",
  warning: "#a66a10",
  danger: "#b42318",
  info: "#355c7d",
  shadow: "0 10px 30px rgba(91, 25, 15, 0.08)",
};

type Item = {
  product: string;
  kilos: number | null;
  prepared_kilos: number | null;
  quantity: number | null;
  price: number | null;
  sale_type: string | null;
  is_fixed_price_piece: boolean | null;
};

type Cancelado = {
  tipo: "ticket" | "cobro";
  id: string;
  folio: string;
  cuando: Date;           // hora de la cancelación
  creado: Date | null;    // hora en que se levantó el ticket
  cliente: string;
  origen: string;
  quien: string;
  motivo: string;
  monto: number;
  metodo: string | null;
  items: Item[];
  capturadoPor: string | null;
};

function money(n: number) {
  return Math.ceil(n).toLocaleString("en-US");
}

function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function mxToISO(dateStr: string, time: "start" | "end") {
  const clock = time === "start" ? "00:00:00" : "23:59:59";
  return new Date(`${dateStr}T${clock}-06:00`).toISOString();
}

// cash_movements guarda timestamps sin zona; se agrega Z para leerlos como UTC
function safeDate(v?: string | null): Date | null {
  if (!v) return null;
  const s = String(v);
  const hasTz = /Z$|[+-]\d{2}:?\d{2}$/.test(s);
  return new Date(hasTz ? s : s + "Z");
}

function hora(d: Date | null) {
  if (!d) return "—";
  return d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", timeZone: "America/Mexico_City" });
}

function fechaHora(d: Date | null) {
  if (!d) return "—";
  return d.toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Mexico_City" });
}

function origenLabel(s: string) {
  switch (s) {
    case "mostrador": return "Mostrador";
    case "pedido_mostrador": return "Pedido (mostrador)";
    case "caja_manual": return "Venta manual";
    case "telefono": return "Teléfono";
    case "cliente": return "Portal cliente";
    case "admin": return "Admin";
    default: return s || "—";
  }
}

function itemLabel(it: Item) {
  const esPieza = it.sale_type === "pieza" || !!it.is_fixed_price_piece;
  if (esPieza && it.is_fixed_price_piece) return `${Number(it.quantity ?? it.kilos ?? 0)} pza`;
  const kg = Number(it.prepared_kilos ?? it.kilos ?? 0);
  if (kg > 0) return `${kg.toFixed(3)} kg`;
  return `${Number(it.quantity ?? 0)} pza (sin pesar)`;
}

export default function CanceladosPage() {
  const supabase = getSupabaseClient();
  const [desde, setDesde] = useState(hoyISO());
  const [hasta, setHasta] = useState(hoyISO());
  const [rows, setRows] = useState<Cancelado[]>([]);
  const [loading, setLoading] = useState(true);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<"todos" | "ticket" | "cobro">("todos");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const ini = mxToISO(desde, "start");
      const fin = mxToISO(hasta, "end");

      const [ordRes, movRes] = await Promise.all([
        // Tickets cancelados (por fecha de cancelación; si no la tiene, por fecha de creación)
        supabase
          .from("orders")
          .select("id, customer_name, source, status, payment_status, payment_method, created_at, canceled_at, cancel_reason, cancelled_by, captured_by, attendant_name, order_items(product, kilos, prepared_kilos, quantity, price, sale_type, is_fixed_price_piece)")
          .or(`and(or(status.eq.cancelado,payment_status.eq.cancelado),or(and(canceled_at.gte.${ini},canceled_at.lte.${fin}),and(canceled_at.is.null,created_at.gte.${ini},created_at.lte.${fin})))`)
          .order("canceled_at", { ascending: false, nullsFirst: false })
          .limit(2000),
        // Cobros cancelados desde Caja
        supabase
          .from("cash_movements")
          .select("id, type, amount, payment_method, cashier_name, created_at, cancelled_at, cancel_reason, cancelled_by, reference_id")
          .eq("is_cancelled", true)
          .gte("cancelled_at", ini)
          .lte("cancelled_at", fin)
          .order("cancelled_at", { ascending: false })
          .limit(2000),
      ]);

      const out: Cancelado[] = [];

      for (const o of (ordRes.data || []) as any[]) {
        const items: Item[] = (o.order_items || []) as Item[];
        const monto = items.reduce((a, it) => a + itemSubtotal(it), 0);
        out.push({
          tipo: "ticket",
          id: o.id,
          folio: `TK-${String(o.id).slice(0, 6)}`,
          cuando: safeDate(o.canceled_at) || safeDate(o.created_at) || new Date(0),
          creado: safeDate(o.created_at),
          cliente: o.customer_name || "Mostrador",
          origen: origenLabel(o.source),
          quien: o.cancelled_by || "—",
          motivo: o.cancel_reason || "Sin motivo capturado",
          monto,
          metodo: o.payment_method || null,
          items,
          capturadoPor: o.captured_by || o.attendant_name || null,
        });
      }

      // Para los cobros cancelados, traer los artículos del ticket ligado
      const movs = (movRes.data || []) as any[];
      const refIds = Array.from(new Set(movs.map((m) => m.reference_id).filter(Boolean)));
      const itemsPorOrden = new Map<string, { items: Item[]; cliente: string | null; source: string | null }>();
      if (refIds.length > 0) {
        const { data: ords } = await supabase
          .from("orders")
          .select("id, customer_name, source, order_items(product, kilos, prepared_kilos, quantity, price, sale_type, is_fixed_price_piece)")
          .in("id", refIds);
        for (const o of (ords || []) as any[]) {
          itemsPorOrden.set(o.id, { items: (o.order_items || []) as Item[], cliente: o.customer_name, source: o.source });
        }
      }

      for (const m of movs) {
        const lig = m.reference_id ? itemsPorOrden.get(m.reference_id) : undefined;
        out.push({
          tipo: "cobro",
          id: m.id,
          folio: m.reference_id ? `TK-${String(m.reference_id).slice(0, 6)}` : (m.type === "cxc_pago" ? "Abono CxC" : m.type || "Movimiento"),
          cuando: safeDate(m.cancelled_at) || safeDate(m.created_at) || new Date(0),
          creado: safeDate(m.created_at),
          cliente: lig?.cliente || "Mostrador",
          origen: lig ? origenLabel(lig.source || "") : (m.type === "cxc_pago" ? "Abono a crédito" : "Caja"),
          quien: m.cancelled_by || "—",
          motivo: m.cancel_reason || "Sin motivo capturado",
          monto: Number(m.amount || 0),
          metodo: m.payment_method || null,
          items: lig?.items || [],
          capturadoPor: m.cashier_name || null,
        });
      }

      out.sort((a, b) => b.cuando.getTime() - a.cuando.getTime());
      setRows(out);
    } finally {
      setLoading(false);
    }
  }, [supabase, desde, hasta]);

  useEffect(() => { load(); }, [load]);

  const visibles = useMemo(
    () => rows.filter((r) => filtroTipo === "todos" || r.tipo === filtroTipo),
    [rows, filtroTipo]
  );

  const resumen = useMemo(() => {
    const tickets = rows.filter((r) => r.tipo === "ticket");
    const cobros = rows.filter((r) => r.tipo === "cobro");
    const porPersona = new Map<string, number>();
    for (const r of rows) porPersona.set(r.quien, (porPersona.get(r.quien) || 0) + 1);
    return {
      tickets: tickets.length,
      montoTickets: tickets.reduce((a, r) => a + r.monto, 0),
      cobros: cobros.length,
      montoCobros: cobros.reduce((a, r) => a + r.monto, 0),
      porPersona: Array.from(porPersona.entries()).sort((a, b) => b[1] - a[1]),
    };
  }, [rows]);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, padding: 16, fontFamily: "system-ui, -apple-system, Arial, sans-serif" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <div>
            <h1 style={{ margin: 0, color: C.text, fontSize: 24 }}>Cancelados</h1>
            <p style={{ margin: "4px 0 0", color: C.muted, fontSize: 13 }}>
              Tickets y cobros cancelados: quién, cuándo, por qué, artículos y monto
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href="/admin/movimientos" style={navBtn}>Movimientos</Link>
            <Link href="/admin/caja" style={navBtn}>Caja</Link>
            <Link href="/" style={navBtn}>Inicio</Link>
          </div>
        </div>

        {/* Filtros */}
        <div style={{ background: C.card, borderRadius: 16, padding: 14, border: `1px solid ${C.border}`, marginBottom: 16, boxShadow: C.shadow }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <label style={lbl}>Desde:</label>
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} style={dateInp} />
            <label style={lbl}>Hasta:</label>
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} style={dateInp} />
            <button onClick={() => { setDesde(hoyISO()); setHasta(hoyISO()); }} style={chip}>Hoy</button>
            <button onClick={() => {
              const d = new Date(); d.setDate(d.getDate() - 6);
              setDesde(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
              setHasta(hoyISO());
            }} style={chip}>7 días</button>
            <button onClick={() => {
              const d = new Date();
              setDesde(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
              setHasta(hoyISO());
            }} style={chip}>Este mes</button>
            <span style={{ flex: 1 }} />
            {(["todos", "ticket", "cobro"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFiltroTipo(t)}
                style={{ ...chip, background: filtroTipo === t ? C.primary : "white", color: filtroTipo === t ? "white" : C.text, border: filtroTipo === t ? "none" : chip.border }}
              >
                {t === "todos" ? "Todos" : t === "ticket" ? "Tickets" : "Cobros en caja"}
              </button>
            ))}
          </div>
        </div>

        {/* Resumen */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 16 }}>
          <Stat label="Tickets cancelados" value={String(resumen.tickets)} sub={`$${money(resumen.montoTickets)}`} color={C.danger} />
          <Stat label="Cobros cancelados (caja)" value={String(resumen.cobros)} sub={`$${money(resumen.montoCobros)}`} color={C.warning} />
          <div style={{ background: C.card, borderRadius: 14, padding: 14, border: `1px solid ${C.border}`, boxShadow: C.shadow }}>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>Quién canceló</div>
            <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 2 }}>
              {resumen.porPersona.length === 0 ? (
                <span style={{ color: C.muted, fontSize: 13 }}>—</span>
              ) : resumen.porPersona.map(([p, n]) => (
                <div key={p} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: C.text, fontWeight: 600 }}>{p}</span>
                  <span style={{ color: C.muted }}>{n}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Lista */}
        <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, boxShadow: C.shadow, overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: C.muted }}>Cargando...</div>
          ) : visibles.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: C.muted }}>Sin cancelaciones en el rango</div>
          ) : (
            visibles.map((r, i) => {
              const open = abierto === r.id;
              const color = r.tipo === "ticket" ? C.danger : C.warning;
              return (
                <div key={r.id} style={{ borderTop: i === 0 ? "none" : `1px solid ${C.border}` }}>
                  <div onClick={() => setAbierto(open ? null : r.id)} style={{ padding: "14px 18px", cursor: "pointer", background: open ? "rgba(123,34,24,0.04)" : "transparent" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 11, fontWeight: 800, color: "white", background: color, borderRadius: 6, padding: "2px 8px", textTransform: "uppercase" }}>
                            {r.tipo === "ticket" ? "Ticket" : "Cobro"}
                          </span>
                          <span style={{ fontWeight: 800, color: C.text, fontSize: 15 }}>{r.folio}</span>
                          <span style={{ color: C.muted, fontSize: 13 }}>· {r.cliente}</span>
                          <span style={{ color: C.muted, fontSize: 12 }}>· {r.origen}</span>
                        </div>
                        <div style={{ fontSize: 13, color: C.text, marginTop: 6 }}>
                          <b>Motivo:</b> {r.motivo}
                        </div>
                        <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>
                          Canceló <b style={{ color: C.text }}>{r.quien}</b> a las <b style={{ color: C.text }}>{hora(r.cuando)}</b>
                          {desde !== hasta && ` (${fechaHora(r.cuando)})`}
                          {r.creado && ` · levantado a las ${hora(r.creado)}`}
                          {r.capturadoPor && ` por ${r.capturadoPor}`}
                          {r.metodo && ` · ${r.metodo}`}
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: 18, fontWeight: 900, color }}>${money(r.monto)}</div>
                        <div style={{ fontSize: 11, color: C.muted }}>{r.items.length} artículo{r.items.length === 1 ? "" : "s"} {open ? "▲" : "▼"}</div>
                      </div>
                    </div>
                  </div>

                  {open && (
                    <div style={{ padding: "0 18px 14px", background: "rgba(123,34,24,0.02)" }}>
                      {r.items.length === 0 ? (
                        <div style={{ fontSize: 13, color: C.muted, padding: "8px 0" }}>Sin artículos ligados</div>
                      ) : (
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                          <thead>
                            <tr style={{ color: C.muted, fontSize: 11, textTransform: "uppercase" }}>
                              <th style={th}>Artículo</th>
                              <th style={{ ...th, textAlign: "right" }}>Cantidad</th>
                              <th style={{ ...th, textAlign: "right" }}>Precio</th>
                              <th style={{ ...th, textAlign: "right" }}>Importe</th>
                            </tr>
                          </thead>
                          <tbody>
                            {r.items.map((it, k) => (
                              <tr key={k} style={{ borderTop: `1px solid ${C.border}` }}>
                                <td style={td}>{it.product}</td>
                                <td style={{ ...td, textAlign: "right" }}>{itemLabel(it)}</td>
                                <td style={{ ...td, textAlign: "right" }}>${Number(it.price || 0).toFixed(2)}</td>
                                <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>${money(itemSubtotal(it))}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: C.card, borderRadius: 14, padding: 14, border: `1px solid ${C.border}`, boxShadow: C.shadow }}>
      <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 900, color: color || C.text, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

const navBtn: React.CSSProperties = {
  padding: "9px 16px", borderRadius: 12, border: `1px solid ${C.border}`,
  background: "white", color: C.text, textDecoration: "none", fontWeight: 700, fontSize: 13,
};
const lbl: React.CSSProperties = { fontSize: 12, color: C.muted, fontWeight: 700 };
const dateInp: React.CSSProperties = {
  padding: "8px 10px", borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 13, color: C.text, background: "white",
};
const chip: React.CSSProperties = {
  padding: "8px 14px", borderRadius: 10, border: `1px solid ${C.border}`,
  background: "white", color: C.text, fontWeight: 700, fontSize: 13, cursor: "pointer",
};
const th: React.CSSProperties = { textAlign: "left", padding: "6px 4px", fontWeight: 700 };
const td: React.CSSProperties = { padding: "6px 4px", color: C.text };
