"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";

const C = {
  bg: "#f7f1e8",
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

type CatRow = {
  categoria: string;
  tickets: number;
  unidades: number;
  kilos: number;
  ventas: number;
  costo: number;
  utilidad: number;
  margen_pct: number;
};

type DetalleInv = {
  fuente: string;
  producto: string;
  unidades: number;
  ventas: number;
  costo: number;
  utilidad: number;
};

type Inversion = {
  id: string;
  nombre: string;
  monto: number;
  fecha_compra: string;
  categoria_ligada: string | null;
  utilidad_acumulada: number;
  pct_recuperado: number;
  falta: number;
  dias_operando: number;
  utilidad_diaria_prom: number;
  dias_estimados_restantes: number | null;
};

function money(n: number) {
  return Number(n || 0).toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function mesInicio() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default function CategoriasPage() {
  const supabase = getSupabaseClient();

  const [rows, setRows] = useState<CatRow[]>([]);
  const [inversiones, setInversiones] = useState<Inversion[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(mesInicio());
  const [dateTo, setDateTo] = useState(todayStr());
  const [catSeleccionada, setCatSeleccionada] = useState<string | null>(null);
  const [invExpandida, setInvExpandida] = useState<string | null>(null);
  const [detalleInv, setDetalleInv] = useState<DetalleInv[]>([]);
  const [loadingDetalleInv, setLoadingDetalleInv] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [catRes, invRes] = await Promise.all([
        supabase.rpc("ventas_por_categoria", { p_from: dateFrom || null, p_to: dateTo || null }),
        supabase.rpc("recuperacion_inversiones"),
      ]);

      if (!catRes.error && catRes.data) {
        setRows(
          catRes.data.map((r: Record<string, unknown>) => ({
            categoria: String(r.categoria || ""),
            tickets: Number(r.tickets || 0),
            unidades: Number(r.unidades || 0),
            kilos: Number(r.kilos || 0),
            ventas: Number(r.ventas || 0),
            costo: Number(r.costo || 0),
            utilidad: Number(r.utilidad || 0),
            margen_pct: Number(r.margen_pct || 0),
          }))
        );
      }

      if (!invRes.error && invRes.data) {
        setInversiones(
          invRes.data.map((r: Record<string, unknown>) => ({
            id: String(r.id),
            nombre: String(r.nombre || ""),
            monto: Number(r.monto || 0),
            fecha_compra: String(r.fecha_compra || ""),
            categoria_ligada: r.categoria_ligada ? String(r.categoria_ligada) : null,
            utilidad_acumulada: Number(r.utilidad_acumulada || 0),
            pct_recuperado: Number(r.pct_recuperado || 0),
            falta: Number(r.falta || 0),
            dias_operando: Number(r.dias_operando || 0),
            utilidad_diaria_prom: Number(r.utilidad_diaria_prom || 0),
            dias_estimados_restantes: r.dias_estimados_restantes != null ? Number(r.dias_estimados_restantes) : null,
          }))
        );
      }
    } finally {
      setLoading(false);
    }
  }, [supabase, dateFrom, dateTo]);

  useEffect(() => { loadData(); }, [loadData]);

  async function toggleDetalleInversion(invId: string) {
    if (invExpandida === invId) {
      setInvExpandida(null);
      setDetalleInv([]);
      return;
    }
    setInvExpandida(invId);
    setLoadingDetalleInv(true);
    try {
      const { data, error } = await supabase.rpc("detalle_inversion", { p_inversion_id: invId });
      if (error) {
        console.log("Error:", error);
        setDetalleInv([]);
      } else {
        setDetalleInv(
          (data || []).map((r: Record<string, unknown>) => ({
            fuente: String(r.fuente || ""),
            producto: String(r.producto || ""),
            unidades: Number(r.unidades || 0),
            ventas: Number(r.ventas || 0),
            costo: Number(r.costo || 0),
            utilidad: Number(r.utilidad || 0),
          }))
        );
      }
    } finally {
      setLoadingDetalleInv(false);
    }
  }

  const totales = useMemo(() => ({
    ventas: rows.reduce((a, r) => a + r.ventas, 0),
    costo: rows.reduce((a, r) => a + r.costo, 0),
    utilidad: rows.reduce((a, r) => a + r.utilidad, 0),
  }), [rows]);

  const detalle = useMemo(
    () => rows.find((r) => r.categoria === catSeleccionada) || null,
    [rows, catSeleccionada]
  );

  const sinCosto = useMemo(() => rows.filter((r) => r.costo === 0 && r.ventas > 0), [rows]);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, padding: 16, fontFamily: "system-ui, -apple-system, Arial, sans-serif" }}>
      <div style={{ maxWidth: 1150, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <div>
            <h1 style={{ margin: 0, color: C.text, fontSize: 24 }}>Análisis por categoría</h1>
            <p style={{ margin: "4px 0 0", color: C.muted, fontSize: 13 }}>
              Ventas, costo y utilidad de cada línea de producto
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href="/admin/dashboard" style={navBtn}>Dashboard</Link>
            <Link href="/admin/productos" style={navBtn}>Productos</Link>
            <Link href="/" style={navBtn}>Inicio</Link>
          </div>
        </div>

        {/* Recuperación de inversiones */}
        {inversiones.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            {inversiones.map((inv) => {
              const listo = inv.pct_recuperado >= 100;
              return (
                <div key={inv.id} style={{
                  background: listo ? "rgba(31,122,77,0.07)" : C.cardStrong,
                  borderRadius: 16, padding: 18,
                  border: `2px solid ${listo ? "rgba(31,122,77,0.35)" : "rgba(166,106,16,0.30)"}`,
                  boxShadow: C.shadow, marginBottom: 12,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 12, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>
                        Recuperación de inversión
                      </div>
                      <div style={{ fontSize: 19, fontWeight: 900, color: C.text, marginTop: 2 }}>
                        {inv.nombre} — ${money(inv.monto)}
                      </div>
                      {inv.categoria_ligada && (
                        <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                          Se recupera con la utilidad de: <b>{inv.categoria_ligada}</b>
                          {" · "}{inv.dias_operando} día{inv.dias_operando === 1 ? "" : "s"} operando
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 30, fontWeight: 900, color: listo ? C.success : C.warning }}>
                        {inv.pct_recuperado.toFixed(1)}%
                      </div>
                      <div style={{ fontSize: 12, color: C.muted }}>recuperado</div>
                    </div>
                  </div>

                  {/* Barra */}
                  <div style={{ height: 16, background: "rgba(0,0,0,0.06)", borderRadius: 8, overflow: "hidden", marginBottom: 12 }}>
                    <div style={{
                      width: `${Math.min(100, inv.pct_recuperado)}%`, height: "100%",
                      background: listo ? C.success : `linear-gradient(90deg, ${C.warning} 0%, #d18f1f 100%)`,
                      transition: "width 0.4s ease",
                    }} />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
                    <MiniStat label="Ya recuperado" value={`$${money(inv.utilidad_acumulada)}`} color={C.success} />
                    <MiniStat label="Falta" value={`$${money(inv.falta)}`} color={inv.falta > 0 ? C.danger : C.success} />
                    <MiniStat label="Utilidad diaria prom." value={`$${money(inv.utilidad_diaria_prom)}`} color={C.info} />
                    <MiniStat
                      label="Días para recuperar"
                      value={
                        listo ? "¡Ya se pagó!" :
                        inv.dias_estimados_restantes == null ? "Sin datos aún" :
                        inv.dias_estimados_restantes > 365 ? `+${Math.round(inv.dias_estimados_restantes / 30)} meses` :
                        `${inv.dias_estimados_restantes} días`
                      }
                      color={listo ? C.success : C.warning}
                    />
                  </div>

                  {/* Boton desglose */}
                  <button
                    onClick={() => toggleDetalleInversion(inv.id)}
                    style={{
                      marginTop: 12, width: "100%", padding: "9px 14px", borderRadius: 10,
                      border: `1px solid ${C.border}`, background: "white",
                      color: C.text, fontWeight: 700, fontSize: 13, cursor: "pointer",
                    }}
                  >
                    {invExpandida === inv.id ? "▲ Ocultar desglose" : "▼ Ver qué está aportando"}
                  </button>

                  {invExpandida === inv.id && (
                    <div style={{ marginTop: 10 }}>
                      {loadingDetalleInv ? (
                        <div style={{ padding: 16, textAlign: "center", color: C.muted, fontSize: 13 }}>Cargando...</div>
                      ) : detalleInv.length === 0 ? (
                        <div style={{
                          padding: 16, textAlign: "center", color: C.muted, fontSize: 13,
                          background: "white", borderRadius: 10, border: `1px solid ${C.border}`,
                        }}>
                          Todavía no hay ventas registradas de estos productos
                        </div>
                      ) : (
                        <div style={{ display: "grid", gap: 6 }}>
                          {detalleInv.map((d, idx) => (
                            <div key={`${d.producto}-${idx}`} style={{
                              padding: "10px 12px", background: "white", borderRadius: 10,
                              border: `1px solid ${C.border}`,
                              display: "flex", justifyContent: "space-between", alignItems: "center",
                              gap: 10, flexWrap: "wrap",
                            }}>
                              <div style={{ flex: "1 1 160px", minWidth: 0 }}>
                                <div style={{ fontWeight: 700, color: C.text, fontSize: 13 }}>{d.producto}</div>
                                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                                  {money(d.unidades)} vendidos · Ventas ${money(d.ventas)} · Costo ${money(d.costo)}
                                </div>
                              </div>
                              <div style={{ textAlign: "right", flexShrink: 0 }}>
                                <div style={{ fontSize: 16, fontWeight: 800, color: C.success }}>
                                  ${money(d.utilidad)}
                                </div>
                                <div style={{ fontSize: 10, color: C.muted }}>utilidad</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Filtro fechas */}
        <div style={{ background: C.cardStrong, borderRadius: 16, padding: 14, border: `1px solid ${C.border}`, marginBottom: 16, boxShadow: C.shadow }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <label style={{ fontSize: 12, color: C.muted, fontWeight: 700 }}>Desde:</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={dateInp} />
            <label style={{ fontSize: 12, color: C.muted, fontWeight: 700 }}>Hasta:</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={dateInp} />
            <button onClick={() => { setDateFrom(mesInicio()); setDateTo(todayStr()); }} style={chip}>Este mes</button>
            <button onClick={() => {
              const d = new Date();
              setDateFrom(`${d.getFullYear()}-01-01`); setDateTo(todayStr());
            }} style={chip}>Este año</button>
            <button onClick={() => { setDateFrom(""); setDateTo(""); }} style={{ ...chip, background: C.primary, color: "white", border: "none" }}>
              Todo
            </button>
          </div>
        </div>

        {/* Totales */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 16 }}>
          <Stat label="Ventas totales" value={`$${money(totales.ventas)}`} color={C.success} />
          <Stat label="Costo total" value={`$${money(totales.costo)}`} color={C.danger} />
          <Stat label="Utilidad bruta" value={`$${money(totales.utilidad)}`} color={C.primary} />
        </div>

        {/* Aviso costos faltantes */}
        {sinCosto.length > 0 && (
          <div style={{
            background: "rgba(166,106,16,0.08)", borderRadius: 12, padding: "12px 16px",
            border: `1px solid rgba(166,106,16,0.25)`, marginBottom: 16, fontSize: 13, color: C.text,
          }}>
            <b style={{ color: C.warning }}>Aviso:</b> estas categorías no tienen precio de compra capturado, así que su utilidad se muestra igual a la venta:{" "}
            <b>{sinCosto.map((r) => r.categoria).join(", ")}</b>.
            {" "}Captura el costo en <Link href="/admin/productos" style={{ color: C.primary, fontWeight: 700 }}>Admin productos</Link> para ver la utilidad real.
          </div>
        )}

        {/* Tabla por categoría */}
        <div style={{ background: C.cardStrong, borderRadius: 16, border: `1px solid ${C.border}`, boxShadow: C.shadow, overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: C.muted }}>Cargando...</div>
          ) : rows.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: C.muted }}>Sin ventas en el rango</div>
          ) : (
            rows.map((r, i) => {
              const pctDelTotal = totales.ventas > 0 ? (r.ventas / totales.ventas) * 100 : 0;
              const isOpen = catSeleccionada === r.categoria;
              const tieneCosto = r.costo > 0;
              return (
                <div key={r.categoria} style={{ borderTop: i === 0 ? "none" : `1px solid ${C.border}` }}>
                  <div
                    onClick={() => setCatSeleccionada(isOpen ? null : r.categoria)}
                    style={{
                      padding: "14px 18px", cursor: "pointer",
                      background: isOpen ? "rgba(123,34,24,0.04)" : "transparent",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
                      <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                        <div style={{ fontWeight: 800, color: C.text, fontSize: 16 }}>
                          <span style={{ color: C.muted, fontSize: 11, marginRight: 6 }}>{isOpen ? "▼" : "▶"}</span>
                          {r.categoria}
                        </div>
                        <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>
                          {r.tickets} ticket{r.tickets === 1 ? "" : "s"}
                          {r.kilos > 0 && ` · ${money(r.kilos)} kg`}
                          {r.unidades > 0 && ` · ${money(r.unidades)} pzas`}
                          {` · ${pctDelTotal.toFixed(1)}% de las ventas`}
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: 18, fontWeight: 900, color: C.text }}>
                          ${money(r.ventas)}
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: tieneCosto ? C.success : C.muted }}>
                          {tieneCosto ? `Utilidad: $${money(r.utilidad)} (${r.margen_pct}%)` : "sin costo capturado"}
                        </div>
                      </div>
                    </div>
                    {/* Barra de participación */}
                    <div style={{ height: 6, background: "rgba(0,0,0,0.05)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ width: `${pctDelTotal}%`, height: "100%", background: C.primary }} />
                    </div>
                  </div>

                  {isOpen && detalle && (
                    <div style={{ padding: "0 18px 16px", background: "rgba(123,34,24,0.02)" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginTop: 4 }}>
                        <MiniStat label="Ventas" value={`$${money(detalle.ventas)}`} color={C.text} />
                        <MiniStat label="Costo" value={tieneCosto ? `$${money(detalle.costo)}` : "—"} color={C.danger} />
                        <MiniStat label="Utilidad" value={tieneCosto ? `$${money(detalle.utilidad)}` : "—"} color={C.success} />
                        <MiniStat label="Margen" value={tieneCosto ? `${detalle.margen_pct}%` : "—"} color={C.info} />
                        <MiniStat label="Tickets" value={String(detalle.tickets)} color={C.muted} />
                        <MiniStat
                          label="Ticket promedio"
                          value={`$${money(detalle.tickets > 0 ? detalle.ventas / detalle.tickets : 0)}`}
                          color={C.muted}
                        />
                      </div>
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

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: C.cardStrong, borderRadius: 14, padding: 14, border: `1px solid ${C.border}`, boxShadow: C.shadow }}>
      <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 900, color: color || C.text, marginTop: 4 }}>{value}</div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: "white", borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.border}` }}>
      <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: color || C.text, marginTop: 2 }}>{value}</div>
    </div>
  );
}

const navBtn: React.CSSProperties = {
  padding: "9px 16px", borderRadius: 12, border: `1px solid ${C.border}`,
  background: "white", color: C.text, textDecoration: "none", fontWeight: 700, fontSize: 13,
};

const dateInp: React.CSSProperties = {
  padding: "8px 10px", borderRadius: 10, border: `1px solid ${C.border}`,
  fontSize: 13, color: C.text, background: "white",
};

const chip: React.CSSProperties = {
  padding: "8px 14px", borderRadius: 10, border: `1px solid ${C.border}`,
  background: "white", color: C.text, fontWeight: 700, fontSize: 13, cursor: "pointer",
};
