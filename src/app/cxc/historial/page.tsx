"use client";

/**
 * Historial de movimientos de un cliente en Cuentas por Cobrar.
 *
 * Junta en una sola línea de tiempo las COMPRAS a crédito (cxc_notes) y los
 * PAGOS (cxc_payments), filtrados por cliente y rango de fechas, con saldo
 * corriente para poder explicarle al cliente de dónde sale lo que debe.
 *
 * Es solo lectura: no modifica notas ni pagos.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { coincideEnAlguno } from "@/lib/search";

const COLORS = {
  bg: "#f7f1e8",
  bgSoft: "#fbf8f3",
  card: "rgba(255,255,255,0.82)",
  cardStrong: "rgba(255,255,255,0.92)",
  border: "rgba(92, 27, 17, 0.10)",
  text: "#3b1c16",
  muted: "#7a5a52",
  primary: "#7b2218",
  primaryDark: "#5a190f",
  success: "#1f7a4d",
  warning: "#a66a10",
  danger: "#b42318",
  info: "#355c7d",
  shadow: "0 10px 30px rgba(91, 25, 15, 0.08)",
};

function money(n: number) {
  return Math.ceil(n).toLocaleString("en-US");
}

function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Primer día del mes, tres meses atrás. Rango inicial cómodo. */
function inicioRangoISO() {
  const d = new Date();
  d.setMonth(d.getMonth() - 3);
  d.setDate(1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function fechaBonita(iso: string | null | undefined) {
  if (!iso) return "—";
  const solo = iso.slice(0, 10);
  const d = new Date(`${solo}T12:00:00`);
  if (isNaN(d.getTime())) return solo;
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

type Cliente = { id: string; name: string; phone: string | null; business_name: string | null };

type Movimiento = {
  id: string;
  tipo: "compra" | "pago";
  fecha: string;
  concepto: string;
  referencia: string;
  cargo: number;
  abono: number;
  metodo: string | null;
  notas: string | null;
  saldoCorriente: number;
};

const METODOS: Record<string, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
};

export default function HistorialCxcPage() {
  const supabase = getSupabaseClient();

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [cargandoClientes, setCargandoClientes] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [clienteSel, setClienteSel] = useState<Cliente | null>(null);

  const [desde, setDesde] = useState(inicioRangoISO());
  const [hasta, setHasta] = useState(hoyISO());

  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [saldoPrevio, setSaldoPrevio] = useState(0);
  const [saldoActual, setSaldoActual] = useState(0);
  const [cargando, setCargando] = useState(false);
  const [yaBusco, setYaBusco] = useState(false);
  const [generandoPdf, setGenerandoPdf] = useState(false);

  // ─── Clientes ───
  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, phone, business_name")
        .order("name");
      if (!vivo) return;
      if (error) {
        console.log(error);
        alert("No se pudieron cargar los clientes");
      } else {
        setClientes((data as Cliente[]) || []);
      }
      setCargandoClientes(false);
    })();
    return () => { vivo = false; };
  }, [supabase]);

  // Búsqueda tolerante: hay clientes capturados con doble espacio en el nombre
  const clientesFiltrados = useMemo(() => {
    const q = busqueda.trim();
    if (!q) return clientes.slice(0, 40);
    return clientes
      .filter((c) => coincideEnAlguno([c.name, c.phone, c.business_name], q))
      .slice(0, 40);
  }, [clientes, busqueda]);

  // ─── Cargar movimientos del cliente en el rango ───
  const cargarMovimientos = useCallback(async (cliente: Cliente) => {
    setCargando(true);
    setYaBusco(true);

    try {
      // Compras a crédito y pagos, ambos del cliente completo (sin filtrar por
      // fecha todavía) para poder calcular el saldo ANTERIOR al rango.
      const [notasRes, pagosRes] = await Promise.all([
        supabase
          .from("cxc_notes")
          .select("id, note_number, note_date, total_amount, balance_due, status, notes, created_at")
          .eq("customer_id", cliente.id)
          .order("note_date", { ascending: true }),
        supabase
          .from("cxc_payments")
          .select("id, payment_date, amount, payment_method, reference, notes, created_at")
          .eq("customer_id", cliente.id)
          .order("payment_date", { ascending: true }),
      ]);

      if (notasRes.error || pagosRes.error) {
        console.log(notasRes.error || pagosRes.error);
        alert("No se pudo cargar el historial de este cliente.");
        setCargando(false);
        return;
      }

      const notas = notasRes.data || [];
      const pagos = pagosRes.data || [];

      type Crudo = { fecha: string; mov: Omit<Movimiento, "saldoCorriente"> };
      const crudos: Crudo[] = [];

      for (const n of notas) {
        const fecha = (n.note_date || n.created_at || "").slice(0, 10);
        crudos.push({
          fecha,
          mov: {
            id: `n-${n.id}`,
            tipo: "compra",
            fecha,
            concepto: "Compra a crédito",
            referencia: n.note_number || String(n.id).slice(0, 8).toUpperCase(),
            cargo: Number(n.total_amount || 0),
            abono: 0,
            metodo: null,
            notas: n.notes || null,
          },
        });
      }

      for (const p of pagos) {
        const fecha = (p.payment_date || p.created_at || "").slice(0, 10);
        crudos.push({
          fecha,
          mov: {
            id: `p-${p.id}`,
            tipo: "pago",
            fecha,
            concepto: "Pago recibido",
            referencia: p.reference || String(p.id).slice(0, 8).toUpperCase(),
            cargo: 0,
            abono: Number(p.amount || 0),
            metodo: p.payment_method || null,
            notas: p.notes || null,
          },
        });
      }

      // Orden cronológico. Si empatan el mismo día, primero la compra:
      // no se puede pagar algo que todavía no se compró.
      crudos.sort((a, b) => {
        if (a.fecha !== b.fecha) return a.fecha < b.fecha ? -1 : 1;
        if (a.mov.tipo === b.mov.tipo) return 0;
        return a.mov.tipo === "compra" ? -1 : 1;
      });

      // Saldo acumulado antes del rango
      let saldo = 0;
      let previo = 0;
      const dentro: Movimiento[] = [];

      for (const c of crudos) {
        saldo += c.mov.cargo - c.mov.abono;
        const enRango = c.fecha >= desde && c.fecha <= hasta;
        if (c.fecha < desde) {
          previo = saldo;
        } else if (enRango) {
          dentro.push({ ...c.mov, saldoCorriente: saldo });
        }
      }

      setSaldoPrevio(previo);
      setSaldoActual(saldo);
      setMovimientos(dentro);
    } finally {
      setCargando(false);
    }
  }, [supabase, desde, hasta]);

  function elegirCliente(c: Cliente) {
    setClienteSel(c);
    setBusqueda("");
    cargarMovimientos(c);
  }

  const totales = useMemo(() => {
    const cargos = movimientos.reduce((a, m) => a + m.cargo, 0);
    const abonos = movimientos.reduce((a, m) => a + m.abono, 0);
    return { cargos, abonos, compras: movimientos.filter((m) => m.tipo === "compra").length, pagos: movimientos.filter((m) => m.tipo === "pago").length };
  }, [movimientos]);

  // ─── PDF para mandarle al cliente ───
  const generarPdf = useCallback(async () => {
    if (!clienteSel || movimientos.length === 0) return;
    setGenerandoPdf(true);

    try {
      const jsPDFModule = await import("jspdf");
      const jsPDF = jsPDFModule.default;
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
      const pageW = doc.internal.pageSize.getWidth();
      const marginL = 15;
      const marginR = 15;
      const contentW = pageW - marginL - marginR;
      let y = 15;

      function checkPage(need: number) {
        if (y + need > 258) {
          doc.addPage();
          y = 15;
          encabezadoTabla();
        }
      }

      // Encabezado del documento
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(59, 28, 22);
      doc.text("Sergio's Carniceria", marginL, y);
      y += 6;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(122, 90, 82);
      doc.text("Historial de movimientos", marginL, y);
      doc.text(`Emitido: ${new Date().toLocaleDateString("es-MX")}`, pageW - marginR, y, { align: "right" });
      y += 5;
      doc.setFontSize(8);
      doc.text("H. Colegio Militar No. 122, Ezequiel Montes, Qro.  |  441 115 3314  |  441 118 5767", marginL, y);
      y += 4;
      doc.text("cotizaciones@sergioscarniceria.com  |  sergioscarniceria.com", marginL, y);
      y += 6;

      doc.setDrawColor(123, 34, 24);
      doc.setLineWidth(0.5);
      doc.line(marginL, y, pageW - marginR, y);
      y += 8;

      // Cliente y periodo
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(59, 28, 22);
      doc.text(clienteSel.name, marginL, y);
      y += 6;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(122, 90, 82);
      doc.text(`Periodo: ${fechaBonita(desde)} al ${fechaBonita(hasta)}`, marginL, y);
      if (clienteSel.phone) {
        doc.text(`Tel: ${clienteSel.phone}`, pageW - marginR, y, { align: "right" });
      }
      y += 8;

      // Resumen
      doc.setFillColor(247, 241, 232);
      doc.roundedRect(marginL, y, contentW, 24, 3, 3, "F");
      const c1 = marginL + 5;
      const c2 = marginL + contentW / 4;
      const c3 = marginL + (contentW * 2) / 4;
      const c4 = marginL + (contentW * 3) / 4;

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(122, 90, 82);
      doc.text("Saldo anterior", c1, y + 7);
      doc.text("Compras del periodo", c2, y + 7);
      doc.text("Pagos del periodo", c3, y + 7);
      doc.text("Saldo actual", c4, y + 7);

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(59, 28, 22);
      doc.text(`$${money(saldoPrevio)}`, c1, y + 15);
      doc.text(`$${money(totales.cargos)}`, c2, y + 15);
      doc.setTextColor(31, 122, 77);
      doc.text(`$${money(totales.abonos)}`, c3, y + 15);
      doc.setTextColor(saldoActual > 0 ? 180 : 31, saldoActual > 0 ? 35 : 122, saldoActual > 0 ? 24 : 77);
      doc.text(`$${money(saldoActual)}`, c4, y + 15);
      y += 32;

      // Cabecera de la tabla (se repite en cada página)
      const colFecha = marginL;
      const colConcepto = marginL + 26;
      const colRef = marginL + 78;
      const colCargo = marginL + 112;
      const colAbono = marginL + 142;
      const colSaldo = pageW - marginR;

      function encabezadoTabla() {
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(122, 90, 82);
        doc.text("FECHA", colFecha, y);
        doc.text("CONCEPTO", colConcepto, y);
        doc.text("REFERENCIA", colRef, y);
        doc.text("CARGO", colCargo + 22, y, { align: "right" });
        doc.text("ABONO", colAbono + 22, y, { align: "right" });
        doc.text("SALDO", colSaldo, y, { align: "right" });
        y += 2;
        doc.setDrawColor(200, 190, 180);
        doc.setLineWidth(0.2);
        doc.line(marginL, y, pageW - marginR, y);
        y += 5;
      }

      encabezadoTabla();

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);

      for (const m of movimientos) {
        checkPage(8);

        doc.setTextColor(59, 28, 22);
        doc.text(fechaBonita(m.fecha), colFecha, y);

        const concepto = m.tipo === "pago" && m.metodo
          ? `${m.concepto} (${METODOS[m.metodo] || m.metodo})`
          : m.concepto;
        doc.text(concepto.slice(0, 32), colConcepto, y);
        doc.text(String(m.referencia).slice(0, 18), colRef, y);

        if (m.cargo > 0) {
          doc.setTextColor(59, 28, 22);
          doc.text(`$${money(m.cargo)}`, colCargo + 22, y, { align: "right" });
        }
        if (m.abono > 0) {
          doc.setTextColor(31, 122, 77);
          doc.text(`$${money(m.abono)}`, colAbono + 22, y, { align: "right" });
        }

        doc.setTextColor(59, 28, 22);
        doc.setFont("helvetica", "bold");
        doc.text(`$${money(m.saldoCorriente)}`, colSaldo, y, { align: "right" });
        doc.setFont("helvetica", "normal");

        y += 6;
      }

      // Cierre
      checkPage(20);
      y += 2;
      doc.setDrawColor(123, 34, 24);
      doc.setLineWidth(0.4);
      doc.line(marginL, y, pageW - marginR, y);
      y += 7;

      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(59, 28, 22);
      doc.text("SALDO AL CORTE:", colAbono - 10, y, { align: "right" });
      doc.setTextColor(saldoActual > 0 ? 180 : 31, saldoActual > 0 ? 35 : 122, saldoActual > 0 ? 24 : 77);
      doc.setFontSize(13);
      doc.text(`$${money(saldoActual)}`, colSaldo, y, { align: "right" });
      y += 10;

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(122, 90, 82);
      doc.text(
        "Este documento es un resumen informativo de los movimientos registrados en el periodo indicado.",
        marginL, y
      );
      y += 4;
      doc.text("Cualquier aclaracion, con gusto la revisamos. Gracias por su preferencia.", marginL, y);

      const slug = clienteSel.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      doc.save(`historial-${slug || "cliente"}-${desde}-a-${hasta}.pdf`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "desconocido";
      alert("No se pudo generar el PDF: " + msg);
    } finally {
      setGenerandoPdf(false);
    }
  }, [clienteSel, movimientos, desde, hasta, saldoPrevio, saldoActual, totales]);

  return (
    <div style={pageStyle}>
      <div style={shellStyle}>
        <div style={topBarStyle}>
          <div>
            <h1 style={{ margin: 0, color: COLORS.text }}>Historial de cliente</h1>
            <p style={{ margin: "6px 0 0 0", color: COLORS.muted }}>
              Compras y pagos en una sola línea de tiempo
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/cxc" style={secondaryButtonStyle}>Cuentas por cobrar</Link>
            <Link href="/" style={secondaryButtonStyle}>Inicio</Link>
          </div>
        </div>

        {/* ─── Filtros ─── */}
        <div style={panelStyle}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
            <div>
              <label style={labelStyle}>Cliente</label>
              {clienteSel ? (
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  gap: 12, padding: "14px 16px", borderRadius: 14,
                  background: "rgba(123,34,24,0.06)", border: `1px solid ${COLORS.border}`,
                  flexWrap: "wrap",
                }}>
                  <div>
                    <div style={{ fontWeight: 800, color: COLORS.text, fontSize: 17 }}>{clienteSel.name}</div>
                    {clienteSel.phone && (
                      <div style={{ fontSize: 13, color: COLORS.muted }}>{clienteSel.phone}</div>
                    )}
                  </div>
                  <button
                    onClick={() => { setClienteSel(null); setMovimientos([]); setYaBusco(false); }}
                    style={{ ...secondaryButtonStyle, cursor: "pointer" }}
                  >
                    Cambiar cliente
                  </button>
                </div>
              ) : (
                <>
                  <input
                    placeholder="Escribe el nombre, teléfono o negocio del cliente"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    style={inputStyle}
                  />
                  {cargandoClientes ? (
                    <div style={{ padding: 14, color: COLORS.muted }}>Cargando clientes...</div>
                  ) : (
                    <div style={{
                      marginTop: 10, maxHeight: 280, overflowY: "auto",
                      border: `1px solid ${COLORS.border}`, borderRadius: 14,
                      background: "white",
                    }}>
                      {clientesFiltrados.length === 0 ? (
                        <div style={{ padding: 16, color: COLORS.muted }}>
                          No se encontró ningún cliente con eso.
                        </div>
                      ) : (
                        clientesFiltrados.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => elegirCliente(c)}
                            style={{
                              display: "block", width: "100%", textAlign: "left",
                              padding: "12px 16px", border: "none",
                              borderBottom: `1px solid ${COLORS.border}`,
                              background: "transparent", cursor: "pointer",
                              color: COLORS.text, fontSize: 15, fontWeight: 600,
                            }}
                          >
                            {c.name}
                            {c.business_name && (
                              <span style={{ color: COLORS.muted, fontWeight: 500 }}> — {c.business_name}</span>
                            )}
                            {c.phone && (
                              <span style={{ color: COLORS.muted, fontWeight: 500, fontSize: 13 }}> · {c.phone}</span>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 12, alignItems: "end" }} className="fecha-grid">
              <div>
                <label style={labelStyle}>Desde</label>
                <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Hasta</label>
                <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} style={inputStyle} />
              </div>
              <button
                onClick={() => clienteSel && cargarMovimientos(clienteSel)}
                disabled={!clienteSel || cargando}
                style={{
                  ...primaryButtonStyle,
                  cursor: !clienteSel || cargando ? "not-allowed" : "pointer",
                  opacity: !clienteSel || cargando ? 0.55 : 1,
                  height: 48,
                }}
              >
                {cargando ? "Buscando..." : "Buscar"}
              </button>
            </div>
          </div>
        </div>

        {/* ─── Resultados ─── */}
        {yaBusco && clienteSel && (
          <>
            <div style={summaryGridStyle}>
              <div style={summaryCardStyle}>
                <div style={summaryLabelStyle}>Saldo anterior</div>
                <div style={{ ...summaryValueStyle, color: COLORS.muted }}>${money(saldoPrevio)}</div>
              </div>
              <div style={summaryCardStyle}>
                <div style={summaryLabelStyle}>Compras ({totales.compras})</div>
                <div style={{ ...summaryValueStyle, color: COLORS.text }}>${money(totales.cargos)}</div>
              </div>
              <div style={summaryCardStyle}>
                <div style={summaryLabelStyle}>Pagos ({totales.pagos})</div>
                <div style={{ ...summaryValueStyle, color: COLORS.success }}>${money(totales.abonos)}</div>
              </div>
              <div style={summaryCardStyle}>
                <div style={summaryLabelStyle}>Saldo actual</div>
                <div style={{ ...summaryValueStyle, color: saldoActual > 0 ? COLORS.danger : COLORS.success }}>
                  ${money(saldoActual)}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
              <button
                onClick={generarPdf}
                disabled={movimientos.length === 0 || generandoPdf}
                style={{
                  ...primaryButtonStyle,
                  cursor: movimientos.length === 0 || generandoPdf ? "not-allowed" : "pointer",
                  opacity: movimientos.length === 0 || generandoPdf ? 0.55 : 1,
                }}
              >
                {generandoPdf ? "Generando..." : "Descargar PDF para el cliente"}
              </button>
            </div>

            <div style={panelStyle}>
              {cargando ? (
                <div style={{ padding: 30, textAlign: "center", color: COLORS.muted }}>
                  Cargando movimientos...
                </div>
              ) : movimientos.length === 0 ? (
                <div style={{ padding: 30, textAlign: "center", color: COLORS.muted }}>
                  Este cliente no tiene movimientos entre {fechaBonita(desde)} y {fechaBonita(hasta)}.
                  {saldoPrevio > 0 && (
                    <div style={{ marginTop: 8, color: COLORS.text, fontWeight: 700 }}>
                      Traía un saldo anterior de ${money(saldoPrevio)}.
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Fecha</th>
                        <th style={thStyle}>Concepto</th>
                        <th style={thStyle}>Referencia</th>
                        <th style={{ ...thStyle, textAlign: "right" }}>Cargo</th>
                        <th style={{ ...thStyle, textAlign: "right" }}>Abono</th>
                        <th style={{ ...thStyle, textAlign: "right" }}>Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movimientos.map((m) => (
                        <tr key={m.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                          <td style={tdStyle}>{fechaBonita(m.fecha)}</td>
                          <td style={tdStyle}>
                            <span style={{
                              display: "inline-block", padding: "3px 10px", borderRadius: 999,
                              fontSize: 12, fontWeight: 800, marginRight: 8,
                              background: m.tipo === "compra" ? "rgba(180,35,24,0.10)" : "rgba(31,122,77,0.12)",
                              color: m.tipo === "compra" ? COLORS.danger : COLORS.success,
                            }}>
                              {m.tipo === "compra" ? "Compra" : "Pago"}
                            </span>
                            {m.tipo === "pago" && m.metodo && (
                              <span style={{ color: COLORS.muted, fontSize: 13 }}>
                                {METODOS[m.metodo] || m.metodo}
                              </span>
                            )}
                            {m.notas && (
                              <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 3 }}>{m.notas}</div>
                            )}
                          </td>
                          <td style={{ ...tdStyle, color: COLORS.muted, fontSize: 13 }}>{m.referencia}</td>
                          <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700 }}>
                            {m.cargo > 0 ? `$${money(m.cargo)}` : "—"}
                          </td>
                          <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700, color: COLORS.success }}>
                            {m.abono > 0 ? `$${money(m.abono)}` : "—"}
                          </td>
                          <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800 }}>
                            ${money(m.saldoCorriente)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {!yaBusco && (
          <div style={{ ...panelStyle, textAlign: "center", color: COLORS.muted, padding: 40 }}>
            Elige un cliente para ver todas sus compras y pagos.
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 700px) {
          .fecha-grid { grid-template-columns: 1fr !important; }
        }
      ` }} />
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: COLORS.bg,
  padding: "28px 18px 60px",
  fontFamily: "'Segoe UI', system-ui, -apple-system, Arial, sans-serif",
};

const shellStyle: React.CSSProperties = {
  maxWidth: 1180,
  margin: "0 auto",
};

const topBarStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  flexWrap: "wrap",
  marginBottom: 22,
};

const panelStyle: React.CSSProperties = {
  background: COLORS.cardStrong,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 22,
  padding: 22,
  boxShadow: COLORS.shadow,
  marginBottom: 18,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 700,
  color: COLORS.muted,
  marginBottom: 7,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "13px 15px",
  borderRadius: 14,
  border: `1px solid ${COLORS.border}`,
  fontSize: 15,
  color: COLORS.text,
  background: "white",
  outline: "none",
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "13px 22px",
  borderRadius: 14,
  border: "none",
  background: COLORS.primary,
  color: "white",
  fontWeight: 800,
  fontSize: 15,
  textDecoration: "none",
  whiteSpace: "nowrap",
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: "11px 18px",
  borderRadius: 13,
  border: `1px solid ${COLORS.border}`,
  background: "white",
  color: COLORS.text,
  fontWeight: 700,
  fontSize: 14,
  textDecoration: "none",
  whiteSpace: "nowrap",
};

const summaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: 14,
  marginBottom: 18,
};

const summaryCardStyle: React.CSSProperties = {
  background: COLORS.cardStrong,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 18,
  padding: "18px 20px",
  boxShadow: COLORS.shadow,
};

const summaryLabelStyle: React.CSSProperties = {
  fontSize: 13,
  color: COLORS.muted,
  fontWeight: 700,
  marginBottom: 6,
};

const summaryValueStyle: React.CSSProperties = {
  fontSize: 26,
  fontWeight: 900,
  color: COLORS.text,
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  fontSize: 12,
  fontWeight: 800,
  color: COLORS.muted,
  textTransform: "uppercase",
  letterSpacing: 0.4,
  borderBottom: `2px solid ${COLORS.border}`,
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "12px",
  fontSize: 14,
  color: COLORS.text,
  verticalAlign: "top",
};
