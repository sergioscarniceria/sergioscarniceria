"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";

type OrderItem = {
  id: string;
  product: string;
  kilos: number;
  price: number;
};

type Order = {
  id: string;
  customer_name: string;
  status: string;
  notes: string;
  butcher_name?: string | null;
  prepared_by?: string | null;
  created_at?: string;
  order_items?: OrderItem[];
};

type Butcher = {
  id: string;
  name: string;
  is_active: boolean;
};

const COLORS = {
  bg: "#f7f1e8",
  bgSoft: "#fbf8f3",
  card: "rgba(255,255,255,0.74)",
  cardStrong: "rgba(255,255,255,0.9)",
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

export default function ProduccionPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [butchers, setButchers] = useState<Butcher[]>([]);
  const [changingId, setChangingId] = useState<string | null>(null);

  async function loadData() {
    const supabase = getSupabaseClient();

    const { data: ordersData, error: ordersError } = await supabase
      .from("orders")
      .select(`
        *,
        order_items (*)
      `)
      .order("created_at", { ascending: true });

    const { data: butchersData } = await supabase
      .from("butchers")
      .select("*")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (!ordersError) {
      const activeOrders = ((ordersData as Order[]) || []).filter((o) => {
        const hasItems = (o.order_items || []).length > 0;
        const isActive = o.status !== "terminado";
        return hasItems && isActive;
      });

      setOrders(activeOrders);
    } else {
      console.log(ordersError);
    }

    setButchers((butchersData as Butcher[]) || []);
  }

  useEffect(() => {
    loadData();

    const interval = setInterval(() => {
      loadData();
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  async function updateStatus(id: string, status: string) {
    const supabase = getSupabaseClient();
    setChangingId(id);

    const payload: any = { status };

    if (status === "terminado") {
      payload.prepared_at = new Date().toISOString();
    }

    await supabase.from("orders").update(payload).eq("id", id);

    if (status === "terminado") {
      await supabase.rpc("apply_loyalty_points", { p_order_id: id });
    }

    setChangingId(null);
    loadData();
  }

  async function assignButcher(orderId: string, butcherName: string) {
    const supabase = getSupabaseClient();
    setChangingId(orderId);

    await supabase
      .from("orders")
      .update({
        butcher_name: butcherName,
        prepared_by: butcherName,
        assigned_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    setChangingId(null);
    loadData();
  }

  async function deleteOrder(id: string) {
    const supabase = getSupabaseClient();
    setChangingId(id);

    await supabase.from("orders").delete().eq("id", id);

    setChangingId(null);
    loadData();
  }

  function total(order: Order) {
    return (order.order_items || []).reduce((acc, item) => {
      return acc + Number(item.kilos || 0) * Number(item.price || 0);
    }, 0);
  }

  function statusBadgeStyle(status: string): React.CSSProperties {
    if (status === "nuevo") {
      return {
        background: "rgba(53,92,125,0.12)",
        color: COLORS.info,
      };
    }

    if (status === "proceso") {
      return {
        background: "rgba(166,106,16,0.12)",
        color: COLORS.warning,
      };
    }

    return {
      background: "rgba(31,122,77,0.12)",
      color: COLORS.success,
    };
  }

  const butcherStats = useMemo(() => {
    const counts: Record<string, number> = {};

    for (const b of butchers) {
      counts[b.name] = 0;
    }

    for (const o of orders) {
      const key = o.butcher_name || "Sin asignar";
      counts[key] = (counts[key] || 0) + 1;
    }

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [orders, butchers]);

  return (
    <div style={pageStyle}>
      <div style={glowTopLeft} />
      <div style={glowTopRight} />

      <div style={shellStyle}>
        <div style={topBarStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <img
              src="/logo.png"
              alt="Sergios Carnicería"
              style={{ width: 96, maxWidth: "100%", height: "auto", display: "block" }}
            />
            <div>
              <h1 style={{ margin: 0, color: COLORS.text }}>Producción</h1>
              <p style={{ color: COLORS.muted, margin: "6px 0 0 0" }}>
                Preparación en tiempo real
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/" style={secondaryButtonStyle}>Inicio</Link>
            <Link href="/pedidos" style={secondaryButtonStyle}>Pedidos</Link>
            <Link href="/admin/dashboard" style={secondaryButtonStyle}>Dashboard</Link>
          </div>
        </div>

        <div style={statsWrapStyle}>
          <div style={heroCardStyle}>
            <div style={smallLabelStyle}>Pedidos activos</div>
            <div style={heroValueStyle}>{orders.length}</div>
            <div style={heroMetaStyle}>En preparación o pendientes</div>
          </div>

          <div style={heroCardStyle}>
            <div style={smallLabelStyle}>Conteo por carnicero</div>
            <div style={butcherMiniGridStyle}>
              {butcherStats.map((b) => (
                <div key={b.name} style={butcherMiniCardStyle}>
                  <div style={{ fontWeight: 700, color: COLORS.text }}>{b.name}</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: COLORS.primary }}>
                    {b.count}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {orders.length === 0 ? (
          <div style={emptyBigStyle}>No hay pedidos activos</div>
        ) : (
          <div style={ordersGridStyle}>
            {orders.map((o) => (
              <div key={o.id} style={orderCardStyle}>
                <div style={orderHeaderStyle}>
                  <div style={{ minWidth: 0 }}>
                    <div style={customerNameStyle}>{o.customer_name}</div>
                    <div
                      style={{
                        ...statusPillStyle,
                        ...statusBadgeStyle(o.status),
                      }}
                    >
                      {o.status}
                    </div>
                  </div>

                  <div style={totalBadgeStyle}>${total(o).toFixed(2)}</div>
                </div>

                <div style={itemsBoxStyle}>
                  {(o.order_items || []).map((item) => (
                    <div key={item.id} style={itemRowStyle}>
                      <div style={{ color: COLORS.text, fontWeight: 700, minWidth: 0 }}>
                        {item.product}
                      </div>
                      <div style={{ color: COLORS.muted, flexShrink: 0 }}>
                        {item.kilos} kg
                      </div>
                    </div>
                  ))}
                </div>

                {o.notes ? (
                  <div style={notesBoxStyle}>
                    <b>Notas:</b> {o.notes}
                  </div>
                ) : null}

                <div style={assignedRowStyle}>
                  <span style={{ color: COLORS.muted }}>Carnicero asignado:</span>
                  <b style={{ color: COLORS.text }}>
                    {o.butcher_name || "Sin asignar"}
                  </b>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <div style={subLabelStyle}>Asignar carnicero</div>

                  <div style={butchersWrapStyle}>
                    {butchers.map((b) => (
                      <button
                        key={b.id}
                        onClick={() => assignButcher(o.id, b.name)}
                        disabled={changingId === o.id}
                        style={{
                          ...butcherButtonStyle,
                          background: o.butcher_name === b.name ? COLORS.primary : "white",
                          color: o.butcher_name === b.name ? "white" : COLORS.text,
                          border:
                            o.butcher_name === b.name
                              ? "none"
                              : `1px solid ${COLORS.border}`,
                          opacity: changingId === o.id ? 0.7 : 1,
                        }}
                      >
                        {b.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={actionButtonsWrapStyle}>
                  <button
                    onClick={() => updateStatus(o.id, "proceso")}
                    disabled={changingId === o.id}
                    style={{
                      ...actionButtonStyle,
                      background: "rgba(166,106,16,0.12)",
                      color: COLORS.warning,
                    }}
                  >
                    En proceso
                  </button>

                  <button
                    onClick={() => updateStatus(o.id, "terminado")}
                    disabled={changingId === o.id}
                    style={{
                      ...actionButtonStyle,
                      background: "rgba(31,122,77,0.12)",
                      color: COLORS.success,
                    }}
                  >
                    Terminado
                  </button>

                  <button
                    onClick={() => deleteOrder(o.id)}
                    disabled={changingId === o.id}
                    style={{
                      ...actionButtonStyle,
                      background: "rgba(180,35,24,0.10)",
                      color: COLORS.danger,
                    }}
                  >
                    Borrar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

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
  maxWidth: 1440,
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

const statsWrapStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 16,
  marginBottom: 20,
};

const heroCardStyle: React.CSSProperties = {
  background: COLORS.cardStrong,
  backdropFilter: "blur(10px)",
  border: `1px solid ${COLORS.border}`,
  borderRadius: 24,
  padding: 20,
  boxShadow: COLORS.shadow,
};

const smallLabelStyle: React.CSSProperties = {
  color: COLORS.muted,
  fontSize: 14,
  marginBottom: 10,
};

const heroValueStyle: React.CSSProperties = {
  fontSize: 34,
  fontWeight: 800,
  color: COLORS.text,
  marginBottom: 6,
  lineHeight: 1.1,
};

const heroMetaStyle: React.CSSProperties = {
  color: COLORS.muted,
  fontSize: 14,
};

const butcherMiniGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
  gap: 10,
};

const butcherMiniCardStyle: React.CSSProperties = {
  background: COLORS.bgSoft,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 16,
  padding: 14,
};

const ordersGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: 18,
};

const orderCardStyle: React.CSSProperties = {
  background: COLORS.card,
  backdropFilter: "blur(10px)",
  border: `1px solid ${COLORS.border}`,
  borderRadius: 24,
  padding: 18,
  boxShadow: COLORS.shadow,
};

const orderHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  marginBottom: 14,
};

const customerNameStyle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 800,
  color: COLORS.text,
  marginBottom: 8,
  lineHeight: 1.2,
};

const statusPillStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "6px 12px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  textTransform: "capitalize",
};

const totalBadgeStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 16,
  background: COLORS.primary,
  color: "white",
  fontWeight: 800,
  fontSize: 18,
  whiteSpace: "nowrap",
  flexShrink: 0,
};

const itemsBoxStyle: React.CSSProperties = {
  background: COLORS.bgSoft,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 18,
  padding: 14,
  marginBottom: 14,
};

const itemRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "10px 0",
  borderBottom: `1px solid ${COLORS.border}`,
};

const notesBoxStyle: React.CSSProperties = {
  padding: 14,
  borderRadius: 16,
  background: "rgba(255,255,255,0.7)",
  border: `1px solid ${COLORS.border}`,
  color: COLORS.text,
  marginBottom: 14,
};

const assignedRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  marginBottom: 14,
  padding: "10px 0",
  flexWrap: "wrap",
};

const subLabelStyle: React.CSSProperties = {
  color: COLORS.muted,
  fontSize: 14,
  marginBottom: 8,
};

const butchersWrapStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const butcherButtonStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  cursor: "pointer",
  fontWeight: 700,
};

const actionButtonsWrapStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const actionButtonStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 14,
  border: "none",
  cursor: "pointer",
  fontWeight: 700,
};

const emptyBigStyle: React.CSSProperties = {
  padding: 26,
  borderRadius: 24,
  background: COLORS.cardStrong,
  border: `1px dashed ${COLORS.border}`,
  color: COLORS.muted,
  textAlign: "center",
  boxShadow: COLORS.shadow,
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