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
  notes?: string;
  created_at?: string;
  butcher_name?: string | null;
  order_items?: OrderItem[];
};

const COLORS = {
  bg: "#f7f1e8",
  bgSoft: "#fbf8f3",
  card: "rgba(255,255,255,0.75)",
  cardStrong: "rgba(255,255,255,0.9)",
  border: "rgba(92, 27, 17, 0.10)",
  text: "#3b1c16",
  muted: "#7a5a52",
  primary: "#7b2218",
  primaryDark: "#5a190f",
  success: "#1f7a4d",
  warning: "#a66a10",
  info: "#355c7d",
  shadow: "0 10px 30px rgba(91, 25, 15, 0.08)",
};

export default function PedidosPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState("todos");
  const [search, setSearch] = useState("");

  async function loadOrders() {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("orders")
      .select(`*, order_items(*)`)
      .order("created_at", { ascending: false });

    if (error) {
      console.log(error);
      alert("No se pudieron cargar los pedidos");
      return;
    }

    setOrders((data as Order[]) || []);
  }

  useEffect(() => {
    loadOrders();
  }, []);

  function total(order: Order) {
    return (order.order_items || []).reduce(
      (acc, i) => acc + Number(i.kilos || 0) * Number(i.price || 0),
      0
    );
  }

  function filteredOrders() {
    let result = orders;

    if (filter !== "todos") {
      result = result.filter((o) => o.status === filter);
    }

    const q = search.toLowerCase().trim();
    if (!q) return result;

    return result.filter((o) => {
      const hayCliente = (o.customer_name || "").toLowerCase().includes(q);
      const hayNotas = (o.notes || "").toLowerCase().includes(q);
      const hayCarnicero = (o.butcher_name || "").toLowerCase().includes(q);
      const hayProducto = (o.order_items || []).some((i) =>
        (i.product || "").toLowerCase().includes(q)
      );

      return hayCliente || hayNotas || hayCarnicero || hayProducto;
    });
  }

  const visibleOrders = useMemo(
    () => filteredOrders(),
    [orders, filter, search]
  );

  function statusStyle(status: string): React.CSSProperties {
    if (status === "nuevo") {
      return {
        background: "rgba(166,106,16,0.12)",
        color: COLORS.warning,
      };
    }

    if (status === "proceso") {
      return {
        background: "rgba(53,92,125,0.12)",
        color: COLORS.info,
      };
    }

    return {
      background: "rgba(31,122,77,0.12)",
      color: COLORS.success,
    };
  }

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
              <h1 style={{ margin: 0, color: COLORS.text }}>Pedidos</h1>
              <p style={{ margin: "6px 0 0 0", color: COLORS.muted }}>
                Control general y seguimiento
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/" style={secondaryButtonStyle}>Inicio</Link>
            <Link href="/produccion" style={secondaryButtonStyle}>Producción</Link>
            <Link href="/admin/dashboard" style={secondaryButtonStyle}>Dashboard</Link>
          </div>
        </div>

        <div style={toolbarCardStyle}>
          <div style={toolbarGridStyle}>
            <input
              placeholder="Buscar cliente, producto, notas o carnicero"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={inputStyle}
            />

            <div style={filtersWrapStyle}>
              {["todos", "nuevo", "proceso", "terminado"].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    ...filterButtonStyle,
                    background: filter === f ? COLORS.primary : "white",
                    color: filter === f ? "white" : COLORS.text,
                    border:
                      filter === f
                        ? "none"
                        : `1px solid ${COLORS.border}`,
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={summaryGridStyle}>
          <div style={summaryCardStyle}>
            <div style={summaryLabelStyle}>Pedidos visibles</div>
            <div style={summaryValueStyle}>{visibleOrders.length}</div>
          </div>

          <div style={summaryCardStyle}>
            <div style={summaryLabelStyle}>Total visible</div>
            <div style={summaryValueStyle}>
              $
              {visibleOrders
                .reduce((acc, order) => acc + total(order), 0)
                .toFixed(2)}
            </div>
          </div>
        </div>

        {visibleOrders.length === 0 ? (
          <div style={emptyBoxStyle}>No hay pedidos para mostrar</div>
        ) : (
          <div style={gridStyle}>
            {visibleOrders.map((o) => (
              <div key={o.id} style={cardStyle}>
                <div style={cardHeaderStyle}>
                  <div style={{ minWidth: 0 }}>
                    <div style={customerNameStyle}>{o.customer_name}</div>

                    <div
                      style={{
                        ...statusBadgeStyle,
                        ...statusStyle(o.status),
                      }}
                    >
                      {o.status}
                    </div>
                  </div>

                  <div style={totalBadgeStyle}>${total(o).toFixed(2)}</div>
                </div>

                {o.created_at ? (
                  <div style={metaTextStyle}>
                    {new Date(o.created_at).toLocaleString()}
                  </div>
                ) : null}

                {o.butcher_name ? (
                  <div style={metaTextStyle}>Carnicero: {o.butcher_name}</div>
                ) : null}

                <div style={itemsBoxStyle}>
                  {(o.order_items || []).map((i) => (
                    <div key={i.id} style={itemStyle}>
                      <span style={{ color: COLORS.text, fontWeight: 700, minWidth: 0 }}>
                        {i.product}
                      </span>
                      <span style={{ color: COLORS.muted, flexShrink: 0 }}>
                        {i.kilos} kg
                      </span>
                    </div>
                  ))}
                </div>

                {o.notes ? (
                  <div style={notesStyle}>
                    <b>Notas:</b> {o.notes}
                  </div>
                ) : null}
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
  maxWidth: 1320,
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

const toolbarCardStyle: React.CSSProperties = {
  background: COLORS.cardStrong,
  backdropFilter: "blur(10px)",
  border: `1px solid ${COLORS.border}`,
  borderRadius: 24,
  padding: 18,
  boxShadow: COLORS.shadow,
  marginBottom: 16,
};

const toolbarGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(280px, 1fr)",
  gap: 14,
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

const filtersWrapStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const filterButtonStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  cursor: "pointer",
  fontWeight: 700,
};

const summaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 16,
  marginBottom: 18,
};

const summaryCardStyle: React.CSSProperties = {
  background: COLORS.cardStrong,
  backdropFilter: "blur(10px)",
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
  fontSize: 30,
  fontWeight: 800,
  lineHeight: 1.1,
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
  gap: 16,
};

const cardStyle: React.CSSProperties = {
  background: COLORS.card,
  backdropFilter: "blur(10px)",
  border: `1px solid ${COLORS.border}`,
  borderRadius: 24,
  padding: 18,
  boxShadow: COLORS.shadow,
};

const cardHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  marginBottom: 12,
};

const customerNameStyle: React.CSSProperties = {
  color: COLORS.text,
  fontWeight: 800,
  fontSize: 22,
  lineHeight: 1.2,
  marginBottom: 8,
};

const statusBadgeStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "6px 10px",
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
  flexShrink: 0,
};

const metaTextStyle: React.CSSProperties = {
  color: COLORS.muted,
  fontSize: 13,
  marginBottom: 8,
};

const itemsBoxStyle: React.CSSProperties = {
  background: COLORS.bgSoft,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 18,
  padding: 14,
  marginTop: 10,
};

const itemStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "10px 0",
  borderBottom: `1px solid ${COLORS.border}`,
};

const notesStyle: React.CSSProperties = {
  marginTop: 12,
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
<Link href="/admin/nuevo-pedido" style={secondaryButtonStyle}>
  Nuevo pedido
</Link>