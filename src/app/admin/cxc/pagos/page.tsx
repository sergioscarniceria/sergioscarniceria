"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";

type Payment = {
  id: string;
  customer_id: string;
  customer_name: string;
  payment_date: string;
  amount: number;
  payment_method?: string | null;
  reference?: string | null;
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

function normalizeDateOnly(value?: string | null) {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

function formatDate(value?: string | null) {
  const normalized = normalizeDateOnly(value);
  if (!normalized) return "Sin fecha";
  const date = new Date(`${normalized}T12:00:00`);
  if (isNaN(date.getTime())) return normalized;
  return date.toLocaleDateString();
}

function todayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthStartString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  return `${year}-${month}-01`;
}

export default function CxcPagosPage() {
  const supabase = getSupabaseClient();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState(monthStartString());
  const [dateTo, setDateTo] = useState(todayDateString());

  useEffect(() => {
    loadPayments();
  }, [dateFrom, dateTo]);

  async function loadPayments() {
    setLoading(true);

    let query = supabase
      .from("cxc_payments")
      .select("*")
      .order("payment_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (dateFrom) {
      query = query.gte("payment_date", dateFrom);
    }

    if (dateTo) {
      query = query.lte("payment_date", dateTo);
    }

    const { data, error } = await query;

    if (error) {
      console.log(error);
      alert("No se pudieron cargar los pagos");
      setLoading(false);
      return;
    }

    setPayments((data as Payment[]) || []);
    setLoading(false);
  }

  const filteredPayments = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return payments;

    return payments.filter((payment) => {
      return (
        (payment.customer_name || "").toLowerCase().includes(q) ||
        (payment.payment_method || "").toLowerCase().includes(q) ||
        (payment.reference || "").toLowerCase().includes(q) ||
        (payment.notes || "").toLowerCase().includes(q)
      );
    });
  }, [payments, search]);

  const stats = useMemo(() => {
    const totalCollected = filteredPayments.reduce(
      (acc, payment) => acc + Number(payment.amount || 0),
      0
    );

    const totalPayments = filteredPayments.length;

    const customers = new Set(
      filteredPayments.map((payment) => payment.customer_id).filter(Boolean)
    ).size;

    const averagePayment =
      totalPayments > 0 ? totalCollected / totalPayments : 0;

    return {
      totalCollected,
      totalPayments,
      customers,
      averagePayment,
    };
  }, [filteredPayments]);

  if (loading) {
    return (
      <div style={loadingPageStyle}>
        <div style={loadingCardStyle}>Cargando pagos...</div>
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
            <h1 style={{ margin: 0, color: COLORS.text }}>Pagos CxC</h1>
            <p style={{ margin: "6px 0 0 0", color: COLORS.muted }}>
              Registro y consulta de abonos de clientes a crédito
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/admin/cxc" style={secondaryButtonStyle}>Volver a CxC</Link>
            <Link href="/admin/dashboard" style={secondaryButtonStyle}>Dashboard</Link>
            <Link href="/admin/cxc/pagos/nuevo" style={primaryButtonStyle}>
              + Registrar pago
            </Link>
          </div>
        </div>

        <div style={summaryGridStyle}>
          <div style={summaryCardStyle}>
            <div style={summaryLabelStyle}>Cobrado en el rango</div>
            <div style={summaryValueStyle}>${stats.totalCollected.toFixed(2)}</div>
          </div>

          <div style={summaryCardStyle}>
            <div style={summaryLabelStyle}>Pagos registrados</div>
            <div style={summaryValueStyle}>{stats.totalPayments}</div>
          </div>

          <div style={summaryCardStyle}>
            <div style={summaryLabelStyle}>Clientes que abonaron</div>
            <div style={summaryValueStyle}>{stats.customers}</div>
          </div>

          <div style={summaryCardStyle}>
            <div style={summaryLabelStyle}>Promedio por pago</div>
            <div style={summaryValueStyle}>${stats.averagePayment.toFixed(2)}</div>
          </div>
        </div>

        <div style={toolbarCardStyle}>
          <div style={toolbarGridStyle}>
            <input
              placeholder="Buscar cliente, método, referencia o notas"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={inputStyle}
            />

            <div style={datesWrapStyle}>
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
        </div>

        <div style={panelStyle}>
          <div style={panelHeaderStyle}>
            <div>
              <h2 style={panelTitleStyle}>Pagos recientes</h2>
              <p style={panelSubtitleStyle}>
                Historial de pagos registrados en el sistema
              </p>
            </div>
          </div>

          {filteredPayments.length === 0 ? (
            <div style={emptyBoxStyle}>No hay pagos para mostrar</div>
          ) : (
            <div style={paymentsListStyle}>
              {filteredPayments.map((payment) => (
                <div key={payment.id} style={paymentCardStyle}>
                  <div style={paymentHeaderStyle}>
                    <div style={{ minWidth: 0 }}>
                      <div style={customerNameStyle}>{payment.customer_name}</div>
                      <div style={metaTextStyle}>
                        Fecha de pago: <b>{formatDate(payment.payment_date)}</b>
                      </div>
                    </div>

                    <div style={amountBadgeStyle}>
                      ${Number(payment.amount || 0).toFixed(2)}
                    </div>
                  </div>

                  <div style={metaGridStyle}>
                    <div style={metaPillStyle}>
                      Método: <b>{payment.payment_method || "No definido"}</b>
                    </div>

                    {payment.reference ? (
                      <div style={metaPillStyle}>
                        Referencia: <b>{payment.reference}</b>
                      </div>
                    ) : null}

                    {payment.created_at ? (
                      <div style={metaPillStyle}>
                        Capturado: <b>{new Date(payment.created_at).toLocaleString()}</b>
                      </div>
                    ) : null}
                  </div>

                  {payment.notes ? (
                    <div style={notesStyle}>
                      <b>Notas:</b> {payment.notes}
                    </div>
                  ) : null}
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

const summaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 16,
  marginBottom: 20,
};

const summaryCardStyle: React.CSSProperties = {
  background: COLORS.cardStrong,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 22,
  padding: 18,
  boxShadow: COLORS.shadow,
};

const summaryLabelStyle: React.CSSProperties = {
  color: COLORS.muted,
  fontSize: 14,
  marginBottom: 8,
};

const summaryValueStyle: React.CSSProperties = {
  color: COLORS.text,
  fontSize: 32,
  fontWeight: 800,
};

const toolbarCardStyle: React.CSSProperties = {
  background: COLORS.cardStrong,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 24,
  padding: 18,
  boxShadow: COLORS.shadow,
  marginBottom: 20,
};

const toolbarGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(280px, 1fr)",
  gap: 14,
};

const datesWrapStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: 12,
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

const paymentsListStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const paymentCardStyle: React.CSSProperties = {
  padding: 16,
  borderRadius: 18,
  background: COLORS.bgSoft,
  border: `1px solid ${COLORS.border}`,
};

const paymentHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  marginBottom: 12,
};

const customerNameStyle: React.CSSProperties = {
  color: COLORS.text,
  fontWeight: 800,
  fontSize: 20,
  lineHeight: 1.2,
  marginBottom: 6,
};

const amountBadgeStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 16,
  background: COLORS.success,
  color: "white",
  fontWeight: 800,
  fontSize: 18,
  whiteSpace: "nowrap",
  flexShrink: 0,
};

const metaGridStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginBottom: 10,
};

const metaPillStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "8px 12px",
  borderRadius: 999,
  background: "white",
  border: `1px solid ${COLORS.border}`,
  color: COLORS.text,
  fontSize: 13,
};

const metaTextStyle: React.CSSProperties = {
  color: COLORS.muted,
  fontSize: 14,
  marginTop: 4,
};

const notesStyle: React.CSSProperties = {
  marginTop: 10,
  padding: 14,
  borderRadius: 16,
  background: "rgba(255,255,255,0.7)",
  border: `1px solid ${COLORS.border}`,
  color: COLORS.text,
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
};