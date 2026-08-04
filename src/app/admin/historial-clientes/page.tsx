"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";

const C = {
  bg: "#f7f1e8",
  bgSoft: "#fbf8f3",
  card: "rgba(255,255,255,0.92)",
  cardStrong: "rgba(255,255,255,0.97)",
  border: "rgba(92,27,17,0.10)",
  text: "#3b1c16",
  muted: "#7a5a52",
  primary: "#7b2218",
  success: "#1f7a4d",
  warning: "#a66a10",
  danger: "#b42318",
  info: "#355c7d",
  shadow: "0 10px 30px rgba(91,25,15,0.08)",
};

type ClienteRow = {
  customer_name: string;
  tickets: number;
  total_bruto: number;
  descuentos: number;
  total_neto: number;
  kilos: number;
  primera_compra: string | null;
  ultima_compra: string | null;
};

type TicketRow = {
  order_id: string;
  fecha: string;
  status: string | null;
  payment_status: string | null;
  payment_method: string | null;
  total: number;
  descuento: number;
  productos: string | null;
};

function money(n: number) {
  return Number(n || 0).toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtDate(v?: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("es-MX", {
    timeZone: "America/Mexico_City",
    day: "2-digit", month: "short", year: "numeric",
  });
}

function fmtDateTime(v?: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleString("es-MX", {
    timeZone: "America/Mexico_City",
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function HistorialClientesPage() {
  const supabase = getSupabaseClient();

  const [rows, setRows] = useState<ClienteRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Detalle expandido
  const [expanded, setExpanded] = useState<string | null>(null);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("compras_por_cliente", {
        p_from: dateFrom || null,
        p_to: dateTo || null,
        p_search: search.trim() || null,
      });
      if (error) {
        console.log("Error:", error);
        setRows([]);
      } else {
        setRows(
          (data || []).map((r: Record<string, unknown>) => ({
            customer_name: String(r.customer_name || ""),
            tickets: Number(r.tickets || 0),
            total_bruto: Number(r.total_bruto || 0),
            descuentos: Number(r.descuentos || 0),
            total_neto: Number(r.total_neto || 0),
            kilos: Number(r.kilos || 0),
            primera_compra: r.primera_compra ? String(r.primera_compra) : null,
            ultima_compra: r.ultima_compra ? String(r.ultima_compra) : null,
          }))
        );
      }
    } catch (err) {
      console.log("Error:", err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [supabase, dateFrom, dateTo, search]);

  useEffect(() => {
    const t = setTimeout(() => { loadData(); }, 350);
    return () => clearTimeout(t);
  }, [loadData]);

  async function toggleExpand(name: string) {
    if (expanded === name) {
      setExpanded(null);
      setTickets([]);
      return;
    }
    setExpanded(name);
    setLoadingTickets(true);
    try {
      const { data, error } = await supabase.rpc("tickets_de_cliente", {
        p_customer_name: name,
        p_from: dateFrom || null,
        p_to: dateTo || null,
      });
      if (error) {
        console.log("Error:", error);
        setTickets([]);
      } else {
        setTickets(
          (data || []).map((r: Record<string, unknown>) => ({
            order_id: String(r.order_id || ""),
            fecha: String(r.fecha || ""),
            status: r.status ? String(r.status) : null,
            payment_status: r.payment_status ? String(r.payment_status) : null,
            payment_method: r.payment_method ? String(r.payment_method) : null,
            total: Number(r.total || 0),
            descuento: Number(r.descuento || 0),
            productos: r.productos ? String(r.productos) : null,
          }))
        );
      }
    } catch (err) {
      console.log("Error:", err);
      setTickets([]);
    } finally {
      setLoadingTickets(false);
    }
  }

  const totales = useMemo(() => {
    return {
      clientes: rows.length,
      tickets: rows.reduce((a, r) => a + r.tickets, 0),
      neto: rows.reduce((a, r) => a + r.total_neto, 0),
      kilos: rows.reduce((a, r) => a + r.kilos, 0),
    };
  }, [rows]);

  function setRangoMes() {
    const d = new Date();
    setDateFrom(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
    setDateTo(todayStr());
  }
  function setRangoAnio() {
    const d = new Date();
    setDateFrom(`${d.getFullYear()}-01-01`);
    setDateTo(todayStr());
  }
  function limpiarRango() {
    setDateFrom("");
    setDateTo("");
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, padding: 16, fontFamily: "system-ui, -apple-system, Arial, sans-serif" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <div>
            <h1 style={{ margin: 0, color: C.text, fontSize: 24 }}>Historial de compras por cliente</h1>
            <p style={{ margin: "4px 0 0", color: C.muted, fontSize: 13 }}>
              Cuánto ha comprado cada cliente — busca, filtra por fechas y desglosa
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href="/admin/clientes" style={navBtn}>Clientes</Link>
            <Link href="/admin/dashboard" style={navBtn}>Dashboard</Link>
            <Link href="/" style={navBtn}>Inicio</Link>
          </div>
        </div>

        {/* Filtros */}
        <div style={{ background: C.cardStrong, borderRadius: 16, padding: 16, border: `1px solid ${C.border}`, marginBottom: 16, boxShadow: C.shadow }}>
          <input
            placeholder="Buscar cliente por nombre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%", padding: "12px 14px", borderRadius: 12,
              border: `1px solid ${C.border}`, fontSize: 15, color: C.text,
              background: "white", boxSizing: "border-box", marginBottom: 12,
            }}
          />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <label style={{ fontSize: 12, color: C.muted, fontWeight: 700 }}>Desde:</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={dateInput} />
            <label style={{ fontSize: 12, color: C.muted, fontWeight: 700 }}>Hasta:</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={dateInput} />
            <button onClick={setRangoMes} style={chipBtn}>Este mes</button>
            <button onClick={setRangoAnio} style={chipBtn}>Este año</button>
            <button onClick={limpiarRango} style={{ ...chipBtn, background: C.primary, color: "white", border: "none" }}>
              Todo el historial
            </button>
          </div>
        </div>

        {/* Totales */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 16 }}>
          <StatCard label="Clientes" value={String(totales.clientes)} />
          <StatCard label="Tickets" value={String(totales.tickets)} />
          <StatCard label="Total vendido" value={`$${money(totales.neto)}`} color={C.success} />
          <StatCard label="Kilos" value={`${money(totales.kilos)} kg`} />
        </div>

        {/* Lista */}
        <div style={{ background: C.cardStrong, borderRadius: 16, border: `1px solid ${C.border}`, boxShadow: C.shadow, overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: C.muted }}>Cargando...</div>
          ) : rows.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: C.muted }}>
              {search ? `Sin resultados para "${search}"` : "Sin datos en el rango"}
            </div>
          ) : (
            rows.map((r, i) => {
              const isOpen = expanded === r.customer_name;
              return (
                <div key={r.customer_name} style={{ borderTop: i === 0 ? "none" : `1px solid ${C.border}` }}>
                  <div
                    onClick={() => toggleExpand(r.customer_name)}
                    style={{
                      padding: "14px 18px", cursor: "pointer",
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      gap: 12, flexWrap: "wrap",
                      background: isOpen ? "rgba(123,34,24,0.04)" : "transparent",
                    }}
                  >
                    <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                      <div style={{ fontWeight: 800, color: C.text, fontSize: 15 }}>
                        <span style={{ color: C.muted, fontSize: 11, marginRight: 6 }}>{isOpen ? "▼" : "▶"}</span>
                        {r.customer_name}
                      </div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>
                        {r.tickets} ticket{r.tickets === 1 ? "" : "s"} · {money(r.kilos)} kg ·
                        {" "}{fmtDate(r.primera_compra)} → {fmtDate(r.ultima_compra)}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 19, fontWeight: 900, color: C.success }}>
                        ${money(r.total_neto)}
                      </div>
                      {r.descuentos > 0 && (
                        <div style={{ fontSize: 11, color: C.warning }}>
                          Desc: ${money(r.descuentos)}
                        </div>
                      )}
                    </div>
                  </div>

                  {isOpen && (
                    <div style={{ padding: "0 18px 16px", background: "rgba(123,34,24,0.02)" }}>
                      {loadingTickets ? (
                        <div style={{ padding: 20, textAlign: "center", color: C.muted, fontSize: 13 }}>
                          Cargando tickets...
                        </div>
                      ) : tickets.length === 0 ? (
                        <div style={{ padding: 20, textAlign: "center", color: C.muted, fontSize: 13 }}>
                          Sin tickets
                        </div>
                      ) : (
                        <div style={{ display: "grid", gap: 6 }}>
                          {tickets.map((t) => (
                            <div key={t.order_id} style={{
                              padding: "10px 12px", background: "white", borderRadius: 10,
                              border: `1px solid ${C.border}`, fontSize: 12,
                            }}>
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontWeight: 700, color: C.text }}>
                                    {fmtDateTime(t.fecha)}
                                    <span style={{
                                      marginLeft: 8, padding: "1px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700,
                                      background: t.payment_status === "pagado" ? "rgba(31,122,77,0.12)"
                                        : t.payment_status?.includes("credito") ? "rgba(166,106,16,0.12)"
                                        : "rgba(53,92,125,0.12)",
                                      color: t.payment_status === "pagado" ? C.success
                                        : t.payment_status?.includes("credito") ? C.warning : C.info,
                                    }}>
                                      {t.payment_status === "pagado" ? "Pagado"
                                        : t.payment_status?.includes("credito") ? "Crédito"
                                        : t.status || "Pendiente"}
                                    </span>
                                  </div>
                                  {t.productos && (
                                    <div style={{ color: C.muted, marginTop: 4, lineHeight: 1.4 }}>
                                      {t.productos}
                                    </div>
                                  )}
                                </div>
                                <div style={{ textAlign: "right", flexShrink: 0 }}>
                                  <div style={{ fontWeight: 800, color: C.text, fontSize: 14 }}>
                                    ${money(t.total - t.descuento)}
                                  </div>
                                  {t.descuento > 0 && (
                                    <div style={{ fontSize: 10, color: C.warning }}>
                                      −${money(t.descuento)}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
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

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: C.cardStrong, borderRadius: 14, padding: 14, border: `1px solid ${C.border}`, boxShadow: C.shadow }}>
      <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: color || C.text, marginTop: 4 }}>{value}</div>
    </div>
  );
}

const navBtn: React.CSSProperties = {
  padding: "9px 16px", borderRadius: 12, border: `1px solid ${C.border}`,
  background: "white", color: C.text, textDecoration: "none", fontWeight: 700, fontSize: 13,
};

const dateInput: React.CSSProperties = {
  padding: "8px 10px", borderRadius: 10, border: `1px solid ${C.border}`,
  fontSize: 13, color: C.text, background: "white",
};

const chipBtn: React.CSSProperties = {
  padding: "8px 14px", borderRadius: 10, border: `1px solid ${C.border}`,
  background: "white", color: C.text, fontWeight: 700, fontSize: 13, cursor: "pointer",
};
