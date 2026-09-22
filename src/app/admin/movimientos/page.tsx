"use client";

/**
 * Movimientos totales — la bitácora del día.
 *
 * Reconstruye, minuto a minuto, todo lo que pasó en la carnicería en una
 * fecha: quién llegó, cuándo se abrió la caja, cada ticket que levantó un
 * carnicero, cada cobro de la cajera, cancelaciones, abonos a crédito,
 * gastos y el corte final.
 *
 * Es solo lectura. No modifica nada.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";

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
  violet: "#6b4c9a",
  shadow: "0 10px 30px rgba(91, 25, 15, 0.08)",
};

function money(n: number) {
  return Math.ceil(n).toLocaleString("en-US");
}

function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function hora(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "--:--";
  return d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: true });
}

/** Categorías de evento. El color y el icono ayudan a leer la columna de un vistazo. */
type Categoria =
  | "asistencia"
  | "apertura"
  | "ticket"
  | "cobro"
  | "cancelacion"
  | "credito"
  | "abono"
  | "gasto"
  | "edicion"
  | "cierre";

const ESTILO: Record<Categoria, { color: string; icono: string; etiqueta: string }> = {
  asistencia:  { color: C.info,    icono: "🕐", etiqueta: "Asistencia" },
  apertura:    { color: C.violet,  icono: "🔓", etiqueta: "Apertura de caja" },
  ticket:      { color: C.muted,   icono: "🧾", etiqueta: "Ticket levantado" },
  cobro:       { color: C.success, icono: "💵", etiqueta: "Cobro" },
  cancelacion: { color: C.danger,  icono: "✖️", etiqueta: "Cancelación" },
  credito:     { color: C.warning, icono: "📋", etiqueta: "Crédito" },
  abono:       { color: C.success, icono: "💰", etiqueta: "Abono a crédito" },
  gasto:       { color: C.danger,  icono: "📤", etiqueta: "Gasto" },
  edicion:     { color: C.warning, icono: "✏️", etiqueta: "Edición" },
  cierre:      { color: C.violet,  icono: "🔒", etiqueta: "Corte de caja" },
};

type Evento = {
  id: string;
  hora: string;
  categoria: Categoria;
  titulo: string;
  detalle: string;
  quien: string | null;
  monto: number | null;
  tono?: "normal" | "alerta";
};

const METODOS: Record<string, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
  credito: "Crédito",
  mercado_pago: "Mercado Pago",
  tarjeta_mp: "Tarjeta (MP)",
  mixto: "Mixto",
};

export default function MovimientosTotalesPage() {
  const supabase = getSupabaseClient();

  const [fecha, setFecha] = useState(hoyISO());
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtros, setFiltros] = useState<Set<Categoria>>(new Set());

  const cargar = useCallback(async (dia: string) => {
    setCargando(true);
    const desde = `${dia}T00:00:00`;
    const hasta = `${dia}T23:59:59.999`;

    try {
      const [
        asistencias, aperturas, ordenes, movimientos,
        notasCxc, pagosCxc, gastos, cierres, auditorias,
      ] = await Promise.all([
        supabase.from("asistencias_eventos")
          .select("id, tipo_evento, timestamp_evento, empleado_id")
          .gte("timestamp_evento", desde).lte("timestamp_evento", hasta),
        supabase.from("cash_openings")
          .select("id, initial_amount, created_at, notes")
          .eq("opening_date", dia),
        supabase.from("orders")
          .select("id, customer_name, created_at, butcher_name, captured_by, source, status, payment_status")
          .gte("created_at", desde).lte("created_at", hasta),
        supabase.from("cash_movements")
          .select("id, type, source, amount, payment_method, created_at, cashier_name, is_cancelled, cancel_reason, cancelled_by, cancelled_at, payment_method_original, payment_method_changed_at, payment_method_changed_by")
          .gte("created_at", desde).lte("created_at", hasta),
        supabase.from("cxc_notes")
          .select("id, customer_name, note_number, total_amount, created_at")
          .gte("created_at", desde).lte("created_at", hasta),
        supabase.from("cxc_payments")
          .select("id, customer_name, amount, payment_method, created_at, reference")
          .gte("created_at", desde).lte("created_at", hasta),
        supabase.from("cash_expenses")
          .select("id, concept, amount, category, created_at, payment_method, notes")
          .gte("created_at", desde).lte("created_at", hasta),
        supabase.from("cash_closures")
          .select("id, counted_cash, expected_cash, difference, total_general, created_at, closed_by")
          .eq("closure_date", dia),
        supabase.from("audit_log")
          .select("id, action, user_label, user_role, entity_type, entity_id, amount, details, created_at")
          .gte("created_at", desde).lte("created_at", hasta),
      ]);

      // Nombres de empleados para las asistencias
      const idsEmpleados = Array.from(
        new Set((asistencias.data || []).map((a) => a.empleado_id).filter(Boolean))
      );
      const nombres = new Map<string, string>();
      if (idsEmpleados.length > 0) {
        const { data: emps } = await supabase
          .from("empleados").select("id, nombre").in("id", idsEmpleados);
        for (const e of emps || []) nombres.set(e.id, e.nombre);
      }

      const lista: Evento[] = [];

      for (const a of asistencias.data || []) {
        const tipo = (a.tipo_evento || "").toLowerCase();
        const esEntrada = tipo.includes("entrada") || tipo.includes("in");
        lista.push({
          id: `as-${a.id}`,
          hora: a.timestamp_evento,
          categoria: "asistencia",
          titulo: esEntrada ? "Llegó" : "Salió",
          detalle: nombres.get(a.empleado_id) || "Empleado",
          quien: nombres.get(a.empleado_id) || null,
          monto: null,
        });
      }

      for (const ap of aperturas.data || []) {
        lista.push({
          id: `ap-${ap.id}`,
          hora: ap.created_at,
          categoria: "apertura",
          titulo: "Se abrió la caja",
          detalle: ap.notes || "Fondo inicial contado",
          quien: null,
          monto: Number(ap.initial_amount || 0),
        });
      }

      for (const o of ordenes.data || []) {
        const origen = o.source === "mostrador" ? "Mostrador"
          : o.source === "caja_manual" ? "Captura manual en caja"
          : o.source === "pedido_mostrador" ? "Pedido en mostrador"
          : o.source === "telefono" ? "Teléfono"
          : o.source === "app_cliente" || o.source === "cliente" ? "Tienda en línea"
          : o.source || "Sin origen";
        lista.push({
          id: `or-${o.id}`,
          hora: o.created_at,
          categoria: "ticket",
          titulo: `Ticket TK-${String(o.id).slice(0, 6).toUpperCase()}`,
          detalle: `${o.customer_name || "Mostrador"} · ${origen}${o.butcher_name ? ` · Atendió ${o.butcher_name}` : ""}`,
          quien: o.captured_by || o.butcher_name || null,
          monto: null,
        });
      }

      for (const m of movimientos.data || []) {
        const metodo = METODOS[m.payment_method || ""] || m.payment_method || "";
        const esCxc = m.type === "cxc_pago";

        lista.push({
          id: `cm-${m.id}`,
          hora: m.created_at,
          categoria: "cobro",
          titulo: esCxc ? "Cobro de crédito" : "Venta cobrada",
          detalle: `${metodo}${m.cashier_name ? ` · Cajera ${m.cashier_name}` : ""}`,
          quien: m.cashier_name || null,
          monto: Number(m.amount || 0),
          tono: m.is_cancelled ? "alerta" : "normal",
        });

        if (m.is_cancelled && m.cancelled_at) {
          lista.push({
            id: `cx-${m.id}`,
            hora: m.cancelled_at,
            categoria: "cancelacion",
            titulo: "Se canceló un cobro",
            detalle: `${m.cancel_reason || "Sin motivo anotado"}${m.cancelled_by ? ` · Canceló ${m.cancelled_by}` : ""}`,
            quien: m.cancelled_by || null,
            monto: Number(m.amount || 0),
            tono: "alerta",
          });
        }

        if (m.payment_method_changed_at) {
          lista.push({
            id: `pm-${m.id}`,
            hora: m.payment_method_changed_at,
            categoria: "edicion",
            titulo: "Cambió el método de pago",
            detalle: `De ${METODOS[m.payment_method_original || ""] || m.payment_method_original || "?"} a ${metodo}${m.payment_method_changed_by ? ` · ${m.payment_method_changed_by}` : ""}`,
            quien: m.payment_method_changed_by || null,
            monto: Number(m.amount || 0),
            tono: "alerta",
          });
        }
      }

      for (const n of notasCxc.data || []) {
        lista.push({
          id: `cn-${n.id}`,
          hora: n.created_at,
          categoria: "credito",
          titulo: "Se dio crédito",
          detalle: `${n.customer_name || "Cliente"}${n.note_number ? ` · Nota ${n.note_number}` : ""}`,
          quien: null,
          monto: Number(n.total_amount || 0),
        });
      }

      for (const p of pagosCxc.data || []) {
        lista.push({
          id: `cp-${p.id}`,
          hora: p.created_at,
          categoria: "abono",
          titulo: "Abono a crédito",
          detalle: `${p.customer_name || "Cliente"} · ${METODOS[p.payment_method || ""] || p.payment_method || ""}${p.reference ? ` · Ref ${p.reference}` : ""}`,
          quien: null,
          monto: Number(p.amount || 0),
        });
      }

      for (const g of gastos.data || []) {
        lista.push({
          id: `ge-${g.id}`,
          hora: g.created_at,
          categoria: "gasto",
          titulo: "Salió dinero",
          detalle: `${g.concept || "Gasto"}${g.category ? ` · ${g.category}` : ""}${g.notes ? ` · ${g.notes}` : ""}`,
          quien: null,
          monto: Number(g.amount || 0),
        });
      }

      for (const c of cierres.data || []) {
        const dif = Number(c.difference || 0);
        lista.push({
          id: `cc-${c.id}`,
          hora: c.created_at,
          categoria: "cierre",
          titulo: "Corte de caja",
          detalle: `Contado $${money(Number(c.counted_cash || 0))} · Esperado $${money(Number(c.expected_cash || 0))} · ${
            dif === 0 ? "Cuadró exacto" : dif > 0 ? `Sobró $${money(dif)}` : `Faltó $${money(Math.abs(dif))}`
          }${c.closed_by ? ` · Cerró ${c.closed_by}` : ""}`,
          quien: c.closed_by || null,
          monto: Number(c.total_general || 0),
          tono: dif !== 0 ? "alerta" : "normal",
        });
      }

      for (const a of auditorias.data || []) {
        // Los cobros y cancelaciones ya salen arriba desde cash_movements.
        // Aquí solo lo que no tiene otra fuente, para no duplicar renglones.
        if (["cobro_efectivo", "cobro_tarjeta", "cobro_transferencia", "cobro_credito", "cxc_pago", "cancelar_ticket"].includes(a.action)) continue;

        const d = (a.details || {}) as Record<string, unknown>;
        const extra = typeof d.descripcion === "string" ? d.descripcion
          : typeof d.motivo === "string" ? d.motivo
          : Object.keys(d).length > 0 ? JSON.stringify(d).slice(0, 120) : "";

        lista.push({
          id: `au-${a.id}`,
          hora: a.created_at,
          categoria: "edicion",
          titulo: a.action.replace(/_/g, " "),
          detalle: `${a.user_label || a.user_role || "Sistema"}${extra ? ` · ${extra}` : ""}`,
          quien: a.user_label || null,
          monto: a.amount ? Number(a.amount) : null,
        });
      }

      lista.sort((x, y) => (x.hora < y.hora ? -1 : x.hora > y.hora ? 1 : 0));
      setEventos(lista);
    } catch (e) {
      console.log(e);
      alert("No se pudieron cargar los movimientos del día.");
    } finally {
      setCargando(false);
    }
  }, [supabase]);

  useEffect(() => { cargar(fecha); }, [fecha, cargar]);

  const visibles = useMemo(
    () => (filtros.size === 0 ? eventos : eventos.filter((e) => filtros.has(e.categoria))),
    [eventos, filtros]
  );

  const resumen = useMemo(() => {
    const cobrado = eventos.filter((e) => e.categoria === "cobro" && e.tono !== "alerta")
      .reduce((a, e) => a + (e.monto || 0), 0);
    const gastado = eventos.filter((e) => e.categoria === "gasto").reduce((a, e) => a + (e.monto || 0), 0);
    const alertas = eventos.filter((e) => e.tono === "alerta").length;
    return {
      total: eventos.length,
      tickets: eventos.filter((e) => e.categoria === "ticket").length,
      cobros: eventos.filter((e) => e.categoria === "cobro").length,
      cobrado, gastado, alertas,
    };
  }, [eventos]);

  function alternarFiltro(c: Categoria) {
    setFiltros((prev) => {
      const n = new Set(prev);
      if (n.has(c)) n.delete(c); else n.add(c);
      return n;
    });
  }

  function moverDia(dias: number) {
    const d = new Date(`${fecha}T12:00:00`);
    d.setDate(d.getDate() + dias);
    setFecha(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  }

  const categoriasPresentes = useMemo(() => {
    const s = new Set<Categoria>();
    for (const e of eventos) s.add(e.categoria);
    return Array.from(s);
  }, [eventos]);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, padding: "26px 18px 60px", fontFamily: "'Segoe UI', system-ui, -apple-system, Arial, sans-serif" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
          <div>
            <h1 style={{ margin: 0, color: C.text }}>Movimientos totales</h1>
            <p style={{ margin: "6px 0 0 0", color: C.muted }}>
              Todo lo que pasó en el día, minuto a minuto
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/admin/dashboard" style={btnSec}>Dashboard</Link>
            <Link href="/admin/caja" style={btnSec}>Caja</Link>
            <Link href="/" style={btnSec}>Inicio</Link>
          </div>
        </div>

        {/* Selector de día */}
        <div style={panel}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button onClick={() => moverDia(-1)} style={{ ...btnSec, cursor: "pointer" }}>← Día anterior</button>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              style={{ padding: "12px 14px", borderRadius: 13, border: `1px solid ${C.border}`, fontSize: 15, fontWeight: 700, color: C.text, background: "white" }}
            />
            <button
              onClick={() => moverDia(1)}
              disabled={fecha >= hoyISO()}
              style={{ ...btnSec, cursor: fecha >= hoyISO() ? "not-allowed" : "pointer", opacity: fecha >= hoyISO() ? 0.5 : 1 }}
            >
              Día siguiente →
            </button>
            <button onClick={() => setFecha(hoyISO())} style={{ ...btnSec, cursor: "pointer" }}>Hoy</button>
            <button onClick={() => cargar(fecha)} style={{ ...btnPri, cursor: "pointer" }}>Actualizar</button>
          </div>
        </div>

        {/* Resumen */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 16 }}>
          <Tarjeta etiqueta="Movimientos" valor={String(resumen.total)} />
          <Tarjeta etiqueta="Tickets" valor={String(resumen.tickets)} />
          <Tarjeta etiqueta="Cobros" valor={String(resumen.cobros)} />
          <Tarjeta etiqueta="Cobrado" valor={`$${money(resumen.cobrado)}`} color={C.success} />
          <Tarjeta etiqueta="Gastos" valor={`$${money(resumen.gastado)}`} color={C.danger} />
          <Tarjeta etiqueta="Cosas raras" valor={String(resumen.alertas)} color={resumen.alertas > 0 ? C.danger : C.muted} />
        </div>

        {/* Filtros */}
        {categoriasPresentes.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            {categoriasPresentes.map((c) => {
              const activo = filtros.has(c);
              const st = ESTILO[c];
              return (
                <button key={c} onClick={() => alternarFiltro(c)} style={{
                  padding: "8px 14px", borderRadius: 999, cursor: "pointer",
                  border: activo ? "none" : `1px solid ${C.border}`,
                  background: activo ? st.color : "white",
                  color: activo ? "white" : C.text,
                  fontWeight: 700, fontSize: 13,
                }}>
                  {st.icono} {st.etiqueta}
                </button>
              );
            })}
            {filtros.size > 0 && (
              <button onClick={() => setFiltros(new Set())} style={{ ...btnSec, cursor: "pointer" }}>
                Ver todo
              </button>
            )}
          </div>
        )}

        {/* Línea de tiempo */}
        <div style={panel}>
          {cargando ? (
            <div style={{ padding: 40, textAlign: "center", color: C.muted }}>Cargando el día...</div>
          ) : visibles.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: C.muted }}>
              {eventos.length === 0
                ? "No hay movimientos registrados en esta fecha."
                : "Ningún movimiento coincide con los filtros."}
            </div>
          ) : (
            <div>
              {visibles.map((e, i) => {
                const st = ESTILO[e.categoria];
                const alerta = e.tono === "alerta";
                return (
                  <div key={e.id} style={{
                    display: "flex", gap: 14, padding: "14px 4px",
                    borderBottom: i < visibles.length - 1 ? `1px solid ${C.border}` : "none",
                    background: alerta ? "rgba(180,35,24,0.035)" : "transparent",
                  }}>
                    <div style={{ minWidth: 78, fontSize: 13, fontWeight: 800, color: C.muted, paddingTop: 2 }}>
                      {hora(e.hora)}
                    </div>

                    <div style={{
                      width: 34, height: 34, borderRadius: 11, flexShrink: 0,
                      background: `${st.color}18`, display: "flex",
                      alignItems: "center", justifyContent: "center", fontSize: 16,
                    }}>
                      {st.icono}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, color: alerta ? C.danger : C.text, fontSize: 15, marginBottom: 2 }}>
                        {e.titulo}
                      </div>
                      <div style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.5, wordBreak: "break-word" }}>
                        {e.detalle}
                      </div>
                    </div>

                    {e.monto !== null && (
                      <div style={{
                        fontWeight: 900, fontSize: 16, whiteSpace: "nowrap",
                        color: e.categoria === "gasto" ? C.danger : alerta ? C.danger : C.text,
                        alignSelf: "center",
                      }}>
                        {e.categoria === "gasto" ? "−" : ""}${money(e.monto)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <p style={{ color: C.muted, fontSize: 13, marginTop: 14, lineHeight: 1.6 }}>
          El sistema no guarda en qué pantallas entra cada quien, así que aquí se ve
          lo que <b>hicieron</b> (lo que dejó rastro en ventas, caja y crédito), no por dónde navegaron.
        </p>
      </div>
    </div>
  );
}

function Tarjeta({ etiqueta, valor, color }: { etiqueta: string; valor: string; color?: string }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "14px 16px", boxShadow: C.shadow }}>
      <div style={{ fontSize: 12, color: C.muted, fontWeight: 700, marginBottom: 4 }}>{etiqueta}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: color || C.text }}>{valor}</div>
    </div>
  );
}

const panel: React.CSSProperties = {
  background: C.card,
  border: `1px solid ${C.border}`,
  borderRadius: 20,
  padding: 18,
  boxShadow: C.shadow,
  marginBottom: 16,
};

const btnSec: React.CSSProperties = {
  padding: "11px 16px",
  borderRadius: 12,
  border: `1px solid ${C.border}`,
  background: "white",
  color: C.text,
  fontWeight: 700,
  fontSize: 14,
  textDecoration: "none",
  whiteSpace: "nowrap",
};

const btnPri: React.CSSProperties = {
  padding: "11px 18px",
  borderRadius: 12,
  border: "none",
  background: C.primary,
  color: "white",
  fontWeight: 800,
  fontSize: 14,
  textDecoration: "none",
  whiteSpace: "nowrap",
};
