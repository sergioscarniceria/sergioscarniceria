"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";

type Movement = {
  id: string;
  type: string | null;
  source: string | null;
  amount: number | null;
  payment_method: string | null;
  created_at: string | null;
  reference_id?: string | null;
};

type CashClosure = {
  id: string;
  closure_date: string;
  expected_cash: number | null;
  counted_cash: number | null;
  difference: number | null;
  notes?: string | null;
  created_at?: string | null;
};

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

function money(value?: number | null) {
  return Number(value || 0).toFixed(2);
}

function todayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function normalizeMovementType(type?: string | null) {
  if (type === "cxc_pago") return "Cobro CxC";
  if (type === "venta") return "Venta";
  return type || "Movimiento";
}

function normalizeMethod(method?: string | null) {
  if (!method) return "Sin método";
  if (method === "efectivo") return "Efectivo";
  if (method === "tarjeta") return "Tarjeta";
  if (method === "transferencia") return "Transferencia";
  return method;
}

export default function CajaPage() {
  const supabase = getSupabaseClient();

  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dateFrom, setDateFrom] = useState(todayDateString());
  const [dateTo, setDateTo] = useState(todayDateString());

  const [countedCash, setCountedCash] = useState("");
  const [closureNotes, setClosureNotes] = useState("");
  const [todayClosure, setTodayClosure] = useState<CashClosure | null>(null);

  useEffect(() => {
    loadData();
  }, [dateFrom, dateTo]);

  async function loadData() {
    setLoading(true);
    await Promise.all([loadMovements(), loadTodayClosure()]);
    setLoading(false);
  }

  async function loadMovements() {
   const start = new Date(`${dateFrom}T00:00:00`).toISOString();
    const end = new Date(`${dateTo}T23:59:59`).toISOString();

    const { data, error } = await supabase
      .from("cash_movements")
      .select("*")
      .gte("created_at", start)
      .lte("created_at", end)
      .order("created_at", { ascending: false });

    if (error) {
      console.log(error);
      alert("No se pudo cargar el corte");
      return;
    }

    setMovements((data as Movement[]) || []);
  }

  async function loadTodayClosure() {
    const today = todayDateString();

    const { data, error } = await supabase
      .from("cash_closures")
      .select("*")
      .eq("closure_date", today)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.log(error);
      return;
    }

    const closure = (data as CashClosure | null) || null;
    setTodayClosure(closure);

    if (closure) {
      setCountedCash(String(Number(closure.counted_cash || 0)));
      setClosureNotes(closure.notes || "");
    }
  }

  const stats = useMemo(() => {
    const ventas = movements.filter((m) => m.type === "venta");
    const cxc = movements.filter((m) => m.type === "cxc_pago");

    const ventasEfectivo = ventas
      .filter((m) => m.payment_method === "efectivo")
      .reduce((acc, m) => acc + Number(m.amount || 0), 0);

    const ventasTarjeta = ventas
      .filter((m) => m.payment_method === "tarjeta")
      .reduce((acc, m) => acc + Number(m.amount || 0), 0);

    const ventasTransferencia = ventas
      .filter((m) => m.payment_method === "transferencia")
      .reduce((acc, m) => acc + Number(m.amount || 0), 0);

    const cxcEfectivo = cxc
      .filter((m) => m.payment_method === "efectivo")
      .reduce((acc, m) => acc + Number(m.amount || 0), 0);

    const cxcTarjeta = cxc
      .filter((m) => m.payment_method === "tarjeta")
      .reduce((acc, m) => acc + Number(m.amount || 0), 0);

    const cxcTransferencia = cxc
      .filter((m) => m.payment_method === "transferencia")
      .reduce((acc, m) => acc + Number(m.amount || 0), 0);

    const totalVentas = ventasEfectivo + ventasTarjeta + ventasTransferencia;
    const totalCxc = cxcEfectivo + cxcTarjeta + cxcTransferencia;

    const totalEfectivoEsperado = ventasEfectivo + cxcEfectivo;
    const totalTarjeta = ventasTarjeta + cxcTarjeta;
    const totalTransferencia = ventasTransferencia + cxcTransferencia;
    const totalGeneral = totalEfectivoEsperado + totalTarjeta + totalTransferencia;

    return {
      ventasEfectivo,
      ventasTarjeta,
      ventasTransferencia,
      cxcEfectivo,
      cxcTarjeta,
      cxcTransferencia,
      totalVentas,
      totalCxc,
      totalEfectivoEsperado,
      totalTarjeta,
      totalTransferencia,
      totalGeneral,
      totalMovements: movements.length,
    };
  }, [movements]);

  const difference = useMemo(() => {
    return Number((Number(countedCash || 0) - Number(stats.totalEfectivoEsperado || 0)).toFixed(2));
  }, [countedCash, stats.totalEfectivoEsperado]);

  async function saveClosure() {
    const counted = Number(countedCash || 0);

    if (countedCash === "" || isNaN(counted) || counted < 0) {
      alert("Captura un efectivo contado válido");
      return;
    }

    setSaving(true);

    const payload = {
      closure_date: todayDateString(),
      expected_cash: Number(stats.totalEfectivoEsperado.toFixed(2)),
      counted_cash: Number(counted.toFixed(2)),
      difference: Number(difference.toFixed(2)),
      notes: closureNotes.trim() || null,
    };

    if (todayClosure?.id) {
      const { error } = await supabase
        .from("cash_closures")
        .update(payload)
        .eq("id", todayClosure.id);

      if (error) {
        console.log(error);
        alert("No se pudo actualizar el cierre");
        setSaving(false);
        return;
      }
    } else {
      const { error } = await supabase
        .from("cash_closures")
        .insert([payload]);

      if (error) {
        console.log(error);
        alert("No se pudo guardar el cierre");
        setSaving(false);
        return;
      }
    }

    alert("Cierre de caja guardado");
    await loadTodayClosure();
    setSaving(false);
  }

  if (loading) {
    return (
      <div style={loadingPageStyle}>
        <div style={loadingCardStyle}>Cargando corte...</div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={glowTopLeft} />
      <div style={glowTopRight} />

      <div style={shellStyle}>
        <div style={topBarStyle}>
          <div>
            <h1 style={{ margin: 0, color: COLORS.text }}>Caja</h1>
            <p style={{ margin: "6px 0 0 0", color: COLORS.muted }}>
              Corte diario, efectivo esperado y cierre de caja
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/" style={secondaryButtonStyle}>
              Inicio
            </Link>
            <Link href="/cobranza" style={secondaryButtonStyle}>
              Cobranza
            </Link>
            <Link href="/admin/cxc/pagos" style={secondaryButtonStyle}>
              Pagos CxC
            </Link>
            <Link href="/admin/dashboard" style={secondaryButtonStyle}>
              Dashboard
            </Link>
          </div>
        </div>

        <div style={filtersCardStyle}>
          <div style={filtersGridStyle}>
            <div>
              <div style={fieldLabelStyle}>Desde</div>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <div style={fieldLabelStyle}>Hasta</div>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>
        </div>

        <div style={heroGridStyle}>
          <div style={heroCardStrongStyle}>
            <div style={heroLabelStrongStyle}>💵 Efectivo esperado en caja</div>
            <div style={heroValueStrongStyle}>${money(stats.totalEfectivoEsperado)}</div>
            <div style={heroMetaStrongStyle}>
              Esto es lo que deben entregar físicamente
            </div>
          </div>

          <div style={heroCardStyle}>
            <div style={heroLabelStyle}>💳 Total tarjeta</div>
            <div style={heroValueStyle}>${money(stats.totalTarjeta)}</div>
            <div style={heroMetaStyle}>Ventas + cobros CxC</div>
          </div>

          <div style={heroCardStyle}>
            <div style={heroLabelStyle}>🔄 Total transferencia</div>
            <div style={heroValueStyle}>${money(stats.totalTransferencia)}</div>
            <div style={heroMetaStyle}>Ventas + cobros CxC</div>
          </div>

          <div style={heroCardStyle}>
            <div style={heroLabelStyle}>💰 Total general</div>
            <div style={heroValueStyle}>${money(stats.totalGeneral)}</div>
            <div style={heroMetaStyle}>
              {stats.totalMovements} movimiento{stats.totalMovements === 1 ? "" : "s"}
            </div>
          </div>
        </div>

        <div style={sectionGridStyle}>
          <div style={panelStyle}>
            <div style={panelHeaderStyle}>
              <div>
                <h2 style={panelTitleStyle}>Ventas</h2>
                <p style={panelSubtitleStyle}>Ingresos por venta normal del día</p>
              </div>
            </div>

            <div style={breakdownGridStyle}>
              <div style={miniCardStyle}>
                <div style={miniLabelStyle}>Efectivo</div>
                <div style={miniValueStyle}>${money(stats.ventasEfectivo)}</div>
              </div>

              <div style={miniCardStyle}>
                <div style={miniLabelStyle}>Tarjeta</div>
                <div style={miniValueStyle}>${money(stats.ventasTarjeta)}</div>
              </div>

              <div style={miniCardStyle}>
                <div style={miniLabelStyle}>Transferencia</div>
                <div style={miniValueStyle}>${money(stats.ventasTransferencia)}</div>
              </div>

              <div style={miniCardStyleStrong}>
                <div style={miniLabelStrongStyle}>Total ventas</div>
                <div style={miniValueStrongStyle}>${money(stats.totalVentas)}</div>
              </div>
            </div>
          </div>

          <div style={panelStyle}>
            <div style={panelHeaderStyle}>
              <div>
                <h2 style={panelTitleStyle}>Cobros CxC</h2>
                <p style={panelSubtitleStyle}>Pagos de clientes con adeudo</p>
              </div>
            </div>

            <div style={breakdownGridStyle}>
              <div style={miniCardStyle}>
                <div style={miniLabelStyle}>Efectivo</div>
                <div style={miniValueStyle}>${money(stats.cxcEfectivo)}</div>
              </div>

              <div style={miniCardStyle}>
                <div style={miniLabelStyle}>Tarjeta</div>
                <div style={miniValueStyle}>${money(stats.cxcTarjeta)}</div>
              </div>

              <div style={miniCardStyle}>
                <div style={miniLabelStyle}>Transferencia</div>
                <div style={miniValueStyle}>${money(stats.cxcTransferencia)}</div>
              </div>

              <div style={miniCardStyleStrong}>
                <div style={miniLabelStrongStyle}>Total CxC</div>
                <div style={miniValueStrongStyle}>${money(stats.totalCxc)}</div>
              </div>
            </div>
          </div>
        </div>

        <div style={closureGridStyle}>
          <div style={closureCardStyle}>
            <div style={panelHeaderStyle}>
              <div>
                <h2 style={panelTitleStyle}>Cierre de caja</h2>
                <p style={panelSubtitleStyle}>
                  Captura lo contado físicamente y compara contra sistema
                </p>
              </div>
            </div>

            <div style={closureSummaryBoxStyle}>
              <div style={summaryRowStyle}>
                <span>Efectivo esperado</span>
                <b>${money(stats.totalEfectivoEsperado)}</b>
              </div>

              <div style={summaryRowStyle}>
                <span>Efectivo contado</span>
                <b>${money(Number(countedCash || 0))}</b>
              </div>

              <div style={summaryRowStyle}>
                <span>Diferencia</span>
                <b
                  style={{
                    color:
                      difference === 0
                        ? COLORS.success
                        : difference > 0
                        ? COLORS.info
                        : COLORS.danger,
                  }}
                >
                  ${money(difference)}
                </b>
              </div>
            </div>

            <div style={formGridStyle}>
              <div>
                <div style={fieldLabelStyle}>Efectivo contado</div>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={countedCash}
                  onChange={(e) => setCountedCash(e.target.value)}
                  style={inputStyle}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div style={fieldLabelStyle}>Notas del cierre</div>
            <textarea
              value={closureNotes}
              onChange={(e) => setClosureNotes(e.target.value)}
              style={textareaStyle}
              placeholder="Observaciones, faltantes, sobrantes, incidencias..."
            />

            <div style={buttonRowStyle}>
              <button onClick={saveClosure} disabled={saving} style={primaryButtonStyle}>
                {saving
                  ? "Guardando..."
                  : todayClosure
                  ? "Actualizar cierre"
                  : "Guardar cierre"}
              </button>
            </div>

            {todayClosure ? (
              <div style={savedClosureBoxStyle}>
                <div style={savedClosureTitleStyle}>Último cierre guardado hoy</div>
                <div style={movementMetaStyle}>
                  Fecha: <b>{todayClosure.closure_date}</b>
                </div>
                <div style={movementMetaStyle}>
                  Esperado: <b>${money(todayClosure.expected_cash)}</b>
                </div>
                <div style={movementMetaStyle}>
                  Contado: <b>${money(todayClosure.counted_cash)}</b>
                </div>
                <div style={movementMetaStyle}>
                  Diferencia: <b>${money(todayClosure.difference)}</b>
                </div>
                {todayClosure.created_at ? (
                  <div style={movementMetaStyle}>
                    Guardado: <b>{formatDateTime(todayClosure.created_at)}</b>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <div style={panelStyle}>
          <div style={panelHeaderStyle}>
            <div>
              <h2 style={panelTitleStyle}>Movimientos del rango</h2>
              <p style={panelSubtitleStyle}>
                Aquí ves ventas y cobros CxC registrados en caja
              </p>
            </div>
          </div>

          {movements.length === 0 ? (
            <div style={emptyBoxStyle}>No hay movimientos en ese rango</div>
          ) : (
            <div style={movementsListStyle}>
              {movements.map((movement) => (
                <div key={movement.id} style={movementCardStyle}>
                  <div style={movementHeaderStyle}>
                    <div style={{ minWidth: 0 }}>
                      <div style={movementTitleStyle}>
                        {normalizeMovementType(movement.type)}
                      </div>
                      <div style={movementMetaStyle}>
                        Método: <b>{normalizeMethod(movement.payment_method)}</b>
                      </div>
                      <div style={movementMetaStyle}>
                        Fecha: <b>{formatDateTime(movement.created_at)}</b>
                      </div>
                    </div>

                    <div
                      style={{
                        ...amountBadgeStyle,
                        background:
                          movement.payment_method === "efectivo"
                            ? COLORS.success
                            : movement.payment_method === "tarjeta"
                            ? COLORS.info
                            : COLORS.warning,
                      }}
                    >
                      ${money(movement.amount)}
                    </div>
                  </div>

                  <div style={pillsWrapStyle}>
                    <span style={pillStyle}>
                      Tipo: <b>{normalizeMovementType(movement.type)}</b>
                    </span>

                    <span style={pillStyle}>
                      Origen: <b>{movement.source || "Sin origen"}</b>
                    </span>

                    <span style={pillStyle}>
                      Método: <b>{normalizeMethod(movement.payment_method)}</b>
                    </span>

                    {movement.reference_id ? (
                      <span style={pillStyle}>
                        Ref: <b>{movement.reference_id.slice(0, 8)}</b>
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const loadingPageStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: `linear-gradient(180deg, ${COLORS.bgSoft} 0%, ${COLORS.bg} 100%)`,
  fontFamily: "Arial, sans-serif",
};

const loadingCardStyle: React.CSSProperties = {
  padding: "18px 22px",
  borderRadius: 18,
  background: COLORS.cardStrong,
  border: `1px solid ${COLORS.border}`,
  boxShadow: COLORS.shadow,
  color: COLORS.text,
};

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: `linear-gradient(180deg, ${COLORS.bgSoft} 0%, ${COLORS.bg} 100%)`,
  padding: 16,
  position: "relative",
  overflow: "hidden",
  fontFamily: "Arial, sans-serif",
};

const glowTopLeft: React.CSSProperties = {
  position: "absolute",
  top: -120,
  left: -100,
  width: 300,
  height: 300,
  borderRadius: "50%",
  background: "rgba(123, 34, 24, 0.08)",
  filter: "blur(45px)",
};

const glowTopRight: React.CSSProperties = {
  position: "absolute",
  top: -80,
  right: -60,
  width: 280,
  height: 280,
  borderRadius: "50%",
  background: "rgba(217, 201, 163, 0.35)",
  filter: "blur(45px)",
};

const shellStyle: React.CSSProperties = {
  maxWidth: 1450,
  margin: "0 auto",
  position: "relative",
  zIndex: 2,
};

const topBarStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  flexWrap: "wrap",
  marginBottom: 20,
};

const filtersCardStyle: React.CSSProperties = {
  background: COLORS.cardStrong,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 24,
  padding: 18,
  boxShadow: COLORS.shadow,
  marginBottom: 20,
};

const filtersGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 14,
};

const fieldLabelStyle: React.CSSProperties = {
  color: COLORS.muted,
  fontSize: 14,
  marginBottom: 8,
  fontWeight: 700,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 14,
  borderRadius: 16,
  border: `1px solid ${COLORS.border}`,
  boxSizing: "border-box",
  outline: "none",
  background: "rgba(255,255,255,0.82)",
  color: COLORS.text,
  fontSize: 15,
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 110,
  padding: 14,
  borderRadius: 16,
  border: `1px solid ${COLORS.border}`,
  boxSizing: "border-box",
  outline: "none",
  background: "rgba(255,255,255,0.82)",
  color: COLORS.text,
  fontSize: 15,
  resize: "vertical",
};

const heroGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 16,
  marginBottom: 20,
};

const heroCardStyle: React.CSSProperties = {
  background: COLORS.cardStrong,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 22,
  padding: 18,
  boxShadow: COLORS.shadow,
};

const heroCardStrongStyle: React.CSSProperties = {
  background: `linear-gradient(180deg, ${COLORS.success} 0%, #16603d 100%)`,
  border: "none",
  borderRadius: 22,
  padding: 18,
  boxShadow: "0 12px 26px rgba(31, 122, 77, 0.24)",
};

const heroLabelStyle: React.CSSProperties = {
  color: COLORS.muted,
  fontSize: 14,
  marginBottom: 8,
};

const heroLabelStrongStyle: React.CSSProperties = {
  color: "rgba(255,255,255,0.88)",
  fontSize: 14,
  marginBottom: 8,
};

const heroValueStyle: React.CSSProperties = {
  color: COLORS.text,
  fontSize: 32,
  fontWeight: 800,
  lineHeight: 1.1,
};

const heroValueStrongStyle: React.CSSProperties = {
  color: "white",
  fontSize: 34,
  fontWeight: 800,
  lineHeight: 1.1,
};

const heroMetaStyle: React.CSSProperties = {
  color: COLORS.muted,
  fontSize: 13,
  marginTop: 8,
};

const heroMetaStrongStyle: React.CSSProperties = {
  color: "rgba(255,255,255,0.88)",
  fontSize: 13,
  marginTop: 8,
};

const sectionGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: 20,
  marginBottom: 20,
};

const panelStyle: React.CSSProperties = {
  background: COLORS.card,
  backdropFilter: "blur(10px)",
  border: `1px solid ${COLORS.border}`,
  borderRadius: 24,
  padding: 18,
  boxShadow: COLORS.shadow,
};

const panelHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  marginBottom: 14,
};

const panelTitleStyle: React.CSSProperties = {
  margin: 0,
  color: COLORS.text,
};

const panelSubtitleStyle: React.CSSProperties = {
  margin: "6px 0 0 0",
  color: COLORS.muted,
  fontSize: 14,
};

const breakdownGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 12,
};

const miniCardStyle: React.CSSProperties = {
  background: COLORS.bgSoft,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 18,
  padding: 14,
};

const miniCardStyleStrong: React.CSSProperties = {
  background: `linear-gradient(180deg, ${COLORS.primary} 0%, ${COLORS.primaryDark} 100%)`,
  border: "none",
  borderRadius: 18,
  padding: 14,
  boxShadow: "0 10px 20px rgba(123, 34, 24, 0.18)",
};

const miniLabelStyle: React.CSSProperties = {
  color: COLORS.muted,
  fontSize: 13,
  marginBottom: 6,
};

const miniLabelStrongStyle: React.CSSProperties = {
  color: "rgba(255,255,255,0.85)",
  fontSize: 13,
  marginBottom: 6,
};

const miniValueStyle: React.CSSProperties = {
  color: COLORS.text,
  fontSize: 24,
  fontWeight: 800,
};

const miniValueStrongStyle: React.CSSProperties = {
  color: "white",
  fontSize: 24,
  fontWeight: 800,
};

const closureGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: 20,
  marginBottom: 20,
};

const closureCardStyle: React.CSSProperties = {
  background: COLORS.cardStrong,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 24,
  padding: 18,
  boxShadow: COLORS.shadow,
};

const closureSummaryBoxStyle: React.CSSProperties = {
  background: COLORS.bgSoft,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 18,
  padding: 14,
  display: "grid",
  gap: 10,
  marginBottom: 14,
};

const summaryRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  color: COLORS.text,
};

const formGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 14,
};

const buttonRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  flexWrap: "wrap",
  marginTop: 14,
};

const savedClosureBoxStyle: React.CSSProperties = {
  marginTop: 16,
  padding: 14,
  borderRadius: 18,
  background: "rgba(31,122,77,0.10)",
  border: `1px solid ${COLORS.border}`,
};

const savedClosureTitleStyle: React.CSSProperties = {
  color: COLORS.text,
  fontWeight: 800,
  fontSize: 18,
  marginBottom: 10,
};

const movementsListStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const movementCardStyle: React.CSSProperties = {
  padding: 16,
  borderRadius: 18,
  background: COLORS.bgSoft,
  border: `1px solid ${COLORS.border}`,
};

const movementHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  marginBottom: 12,
};

const movementTitleStyle: React.CSSProperties = {
  color: COLORS.text,
  fontWeight: 800,
  fontSize: 20,
  lineHeight: 1.2,
};

const movementMetaStyle: React.CSSProperties = {
  color: COLORS.muted,
  fontSize: 14,
  marginTop: 4,
};

const amountBadgeStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 16,
  color: "white",
  fontWeight: 800,
  fontSize: 18,
  whiteSpace: "nowrap",
  flexShrink: 0,
};

const pillsWrapStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const pillStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "8px 12px",
  borderRadius: 999,
  background: "white",
  border: `1px solid ${COLORS.border}`,
  color: COLORS.text,
  fontSize: 13,
};

const emptyBoxStyle: React.CSSProperties = {
  padding: 16,
  borderRadius: 18,
  background: COLORS.bgSoft,
  border: `1px dashed ${COLORS.border}`,
  color: COLORS.muted,
};

const secondaryButtonStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "12px 18px",
  borderRadius: 14,
  border: `1px solid ${COLORS.border}`,
  background: "rgba(255,255,255,0.75)",
  color: COLORS.text,
  textDecoration: "none",
  fontWeight: 700,
};

const primaryButtonStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "12px 18px",
  borderRadius: 14,
  border: "none",
  background: `linear-gradient(180deg, ${COLORS.primary} 0%, ${COLORS.primaryDark} 100%)`,
  color: "white",
  textDecoration: "none",
  fontWeight: 700,
  boxShadow: "0 8px 18px rgba(123, 34, 24, 0.20)",
  cursor: "pointer",
};