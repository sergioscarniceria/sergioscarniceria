"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import NotificationBell from "@/components/NotificationBell";

type OrderItem = {
  id: string;
  product: string;
  kilos: number;
  price: number;
  sale_type?: "kg" | "pieza" | null;
  quantity?: number | null;
  prepared_kilos?: number | null;
  is_ready?: boolean | null;
  is_fixed_price_piece?: boolean | null;
};

type Order = {
  id: string;
  customer_name: string;
  status: string;
  notes?: string;
  created_at?: string;
  butcher_name?: string | null;
  delivery_date?: string | null;
  delivery_status?: string | null;
  payment_status?: string | null;
  payment_method?: string | null;
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
  danger: "#b42318",
  info: "#355c7d",
  shadow: "0 10px 30px rgba(91, 25, 15, 0.08)",
};

function getTodayDateInput() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeDateOnly(value?: string | null) {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? match[1] + "-" + match[2] + "-" + match[3] : null;
}

function formatDeliveryDate(value?: string | null) {
  const normalized = normalizeDateOnly(value);
  if (!normalized) return "Sin fecha";
  const date = new Date(`${normalized}T12:00:00`);
  if (isNaN(date.getTime())) return normalized;
  return date.toLocaleDateString();
}

function isFutureDate(value?: string | null) {
  const normalized = normalizeDateOnly(value);
  if (!normalized) return false;
  return normalized > getTodayDateInput();
}

function isTodayDate(value?: string | null) {
  const normalized = normalizeDateOnly(value);
  if (!normalized) return false;
  return normalized === getTodayDateInput();
}

export default function PedidosPage() {
  const [orders, setOrders] = useState<Order[]>([]);
const [filter, setFilter] = useState("todos");
const [search, setSearch] = useState("");
const [changingId, setChangingId] = useState<string | null>(null);

  async function loadOrders() {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("orders")
      .select(`*, order_items(*)`)
      .order("delivery_date", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      console.log(error);
      alert("No se pudieron cargar los pedidos");
      return;
    }

    setOrders((data as Order[]) || []);
  }

    async function deleteOrder(id: string) {
    const supabase = getSupabaseClient();

    const order = orders.find((o) => o.id === id);

    if (!order) {
      alert("No se encontró el pedido.");
      return;
    }

    if (order.status !== "nuevo") {
      alert("Solo se pueden eliminar pedidos nuevos.");
      return;
    }

    if (order.payment_status === "pagado") {
      alert("No se puede eliminar un pedido que ya fue pagado.");
      return;
    }

    const firstConfirm = window.confirm(
      `¿Seguro que quieres eliminar el pedido de ${order.customer_name}?`
    );

    if (!firstConfirm) return;

    const secondConfirm = window.confirm(
      "Esta acción no se puede deshacer. ¿Eliminar definitivamente el pedido?"
    );

    if (!secondConfirm) return;

    setChangingId(id);

    const { error: itemsError } = await supabase
      .from("order_items")
      .delete()
      .eq("order_id", id);

    if (itemsError) {
      console.log(itemsError);
      alert("No se pudieron borrar los productos del pedido.");
      setChangingId(null);
      return;
    }

    const { error: orderError } = await supabase
      .from("orders")
      .delete()
      .eq("id", id);

    if (orderError) {
      console.log(orderError);
      alert("No se pudo eliminar el pedido.");
      setChangingId(null);
      return;
    }

    setChangingId(null);
    loadOrders();
  }

  async function markAsPaid(id: string) {
    const supabase = getSupabaseClient();
    if (!confirm("¿Confirmar que este pedido ya fue pagado (Mercado Pago)?")) return;

    setChangingId(id);
    const { error } = await supabase
      .from("orders")
      .update({
        payment_status: "pagado",
        payment_method: "mercado_pago",
      })
      .eq("id", id);

    if (error) {
      alert("Error al marcar como pagado: " + error.message);
      console.log(error);
    }

    setChangingId(null);
    loadOrders();
  }

  useEffect(() => {
    loadOrders();
  }, []);

  function total(order: Order) {
  return (order.order_items || []).reduce((acc, i) => {
    if (i.sale_type === "pieza" && i.is_fixed_price_piece) {
      return acc + Number(i.quantity || 0) * Number(i.price || 0);
    }

    if (i.sale_type === "pieza") {
      return acc + Number(i.prepared_kilos || 0) * Number(i.price || 0);
    }

    return acc + Number(i.kilos || 0) * Number(i.price || 0);
  }, 0);
}

  function applyBaseFilters(list: Order[]) {
    let result = list;

    if (filter !== "todos") {
      result = result.filter((o) => o.status === filter);
    }

    const q = search.toLowerCase().trim();
    if (!q) return result;

    return result.filter((o) => {
      const hayCliente = (o.customer_name || "").toLowerCase().includes(q);
      const hayNotas = (o.notes || "").toLowerCase().includes(q);
      const hayCarnicero = (o.butcher_name || "").toLowerCase().includes(q);
      const hayFecha = (o.delivery_date || "").toLowerCase().includes(q);
      const hayProducto = (o.order_items || []).some((i) =>
        (i.product || "").toLowerCase().includes(q)
      );

      return hayCliente || hayNotas || hayCarnicero || hayProducto || hayFecha;
    });
  }

  const todayOrders = useMemo(() => {
    return applyBaseFilters(
      orders.filter((o) => isTodayDate(o.delivery_date))
    );
  }, [orders, filter, search]);

  const futureOrders = useMemo(() => {
    return applyBaseFilters(
      orders.filter((o) => isFutureDate(o.delivery_date))
    );
  }, [orders, filter, search]);

  const overdueOrders = useMemo(() => {
    return applyBaseFilters(
      orders.filter((o) => {
        const n = normalizeDateOnly(o.delivery_date);
        if (!n) return false;
        return n < getTodayDateInput() && o.status !== "terminado" && o.delivery_status !== "entregado";
      })
    );
  }, [orders, filter, search]);

  const noDateOrders = useMemo(() => {
    return applyBaseFilters(
      orders.filter((o) => !normalizeDateOnly(o.delivery_date) && o.status !== "terminado" && o.delivery_status !== "entregado")
    );
  }, [orders, filter, search]);

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

  function renderOrderCard(o: Order) {
    return (
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

            {o.payment_status === "pagado" ? (
              <div style={{
                display: "inline-block",
                padding: "6px 12px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 800,
                background: "rgba(31,122,77,0.15)",
                color: COLORS.success,
                marginTop: 6,
              }}>
                {o.payment_method === "mercado_pago" ? "💳 Pagado con tarjeta" : "✓ Pagado"}
              </div>
            ) : o.payment_status === "credito" || o.payment_status === "credito_autorizado" ? (
              <div style={{
                display: "inline-block",
                padding: "6px 12px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 800,
                background: "rgba(166,106,16,0.12)",
                color: COLORS.warning,
                marginTop: 6,
              }}>
                Crédito
              </div>
            ) : (
              <div style={{
                display: "inline-block",
                padding: "6px 12px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 700,
                background: "rgba(180,35,24,0.08)",
                color: COLORS.danger,
                marginTop: 6,
              }}>
                Pendiente de pago
              </div>
            )}
          </div>

          <div style={totalBadgeStyle}>
            {(o.order_items || []).some(
  (i) =>
    i.sale_type === "pieza" &&
    !i.is_fixed_price_piece &&
    !Number(i.prepared_kilos || 0)
)
  ? "Por pesar"
  : `$${total(o).toFixed(2)}`}
          </div>
        </div>

        <div style={metaGridStyle}>
          {o.delivery_date ? (
            <div style={metaPillStyle}>
              Entrega: <b>{formatDeliveryDate(o.delivery_date)}</b>
            </div>
          ) : (
            <div style={metaPillStyle}>
              Entrega: <b>Hoy</b>
            </div>
          )}

          {o.created_at ? (
            <div style={metaPillStyle}>
              Creado: <b>{new Date(o.created_at).toLocaleString("es-MX", { timeZone: "America/Mexico_City" })}</b>
            </div>
          ) : null}
        </div>

        {o.butcher_name ? (
          <div style={metaTextStyle}>Carnicero: {o.butcher_name}</div>
        ) : null}

               <div style={itemsBoxStyle}>
          {(o.order_items || []).map((i) => (
            <div key={i.id} style={itemStyle}>
              <span style={{ color: COLORS.text, fontWeight: 700, minWidth: 0 }}>
                {i.product}
              </span>

              <span style={{ color: COLORS.muted, flexShrink: 0, textAlign: "right" }}>
                {i.sale_type === "pieza" ? (
  <>
    <div>
      {Number(i.quantity || 0)} pieza{Number(i.quantity || 0) === 1 ? "" : "s"}
    </div>
    <div style={{ fontSize: 12, marginTop: 4 }}>
      {i.is_fixed_price_piece
        ? `Precio fijo: $${Number(i.price || 0).toFixed(2)} c/u`
        : i.prepared_kilos
        ? `${i.prepared_kilos} kg reales`
        : "Pendiente de pesar"}
    </div>
  </>
) : (
  <div>{i.kilos} kg</div>
)}
              </span>
            </div>
          ))}
        </div>

        {o.notes ? (
          <div style={notesStyle}>
            <b>Notas:</b> {o.notes}
          </div>
        ) : null}
                <div style={cardActionsStyle}>
          {o.payment_status !== "pagado" && (
            <button
              onClick={() => markAsPaid(o.id)}
              disabled={changingId === o.id}
              style={{
                padding: "12px 14px",
                borderRadius: 14,
                border: "none",
                fontWeight: 700,
                background: "rgba(31,122,77,0.12)",
                color: COLORS.success,
                cursor: changingId === o.id ? "not-allowed" : "pointer",
                opacity: changingId === o.id ? 0.6 : 1,
              }}
            >
              {changingId === o.id ? "Guardando..." : "💳 Marcar como pagado"}
            </button>
          )}
          <button
            onClick={() => deleteOrder(o.id)}
            disabled={changingId === o.id || o.status !== "nuevo" || o.payment_status === "pagado"}
            style={{
              ...dangerButtonStyle,
              background:
                o.status === "nuevo" && o.payment_status !== "pagado"
                  ? "rgba(180,35,24,0.10)"
                  : "rgba(122,90,82,0.10)",
              color: o.status === "nuevo" && o.payment_status !== "pagado" ? COLORS.danger : COLORS.muted,
              cursor:
                changingId === o.id || o.status !== "nuevo" || o.payment_status === "pagado"
                  ? "not-allowed"
                  : "pointer",
              opacity:
                changingId === o.id || o.status !== "nuevo" || o.payment_status === "pagado" ? 0.6 : 1,
            }}
            title={
              o.payment_status === "pagado"
                ? "No se puede eliminar un pedido pagado"
                : o.status !== "nuevo"
                ? "Solo se pueden eliminar pedidos nuevos"
                : "Eliminar pedido"
            }
          >
            {changingId === o.id ? "Eliminando..." : "Eliminar pedido"}
          </button>
        </div>
      </div>
    );
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

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <NotificationBell />
            <Link href="/" style={secondaryButtonStyle}>Inicio</Link>
            <Link href="/produccion" style={secondaryButtonStyle}>Producción</Link>
            <Link href="/admin/dashboard" style={secondaryButtonStyle}>Dashboard</Link>
            <Link href="/admin/nuevo-pedido" style={primaryHeaderButtonStyle}>
              + Nuevo pedido
            </Link>
          </div>
        </div>

        <div style={toolbarCardStyle}>
          <div style={toolbarGridStyle}>
            <input
              placeholder="Buscar cliente, producto, notas, fecha o carnicero"
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
          {overdueOrders.length > 0 && (
            <div style={{ ...summaryCardStyle, background: "rgba(200,40,40,0.08)", border: "1px solid rgba(200,40,40,0.2)" }}>
              <div style={{ ...summaryLabelStyle, color: "#c42828" }}>Atrasados</div>
              <div style={{ ...summaryValueStyle, color: "#c42828" }}>{overdueOrders.length}</div>
            </div>
          )}

          <div style={summaryCardStyle}>
            <div style={summaryLabelStyle}>Pedidos para hoy</div>
            <div style={summaryValueStyle}>{todayOrders.length}</div>
          </div>

          <div style={summaryCardStyle}>
            <div style={summaryLabelStyle}>Pedidos próximos</div>
            <div style={summaryValueStyle}>{futureOrders.length}</div>
          </div>

          <div style={summaryCardStyle}>
            <div style={summaryLabelStyle}>Total visible hoy</div>
            <div style={summaryValueStyle}>
              $
              {todayOrders
                .reduce((acc, order) => acc + total(order), 0)
                .toFixed(2)}
            </div>
          </div>
        </div>

        {overdueOrders.length > 0 && (
          <div style={sectionWrapStyle}>
            <div style={sectionHeaderStyle}>
              <div>
                <h2 style={{ ...sectionTitleStyle, color: "#c42828" }}>Pedidos atrasados</h2>
                <p style={sectionSubtitleStyle}>
                  Pedidos con fecha pasada que no se han completado
                </p>
              </div>
            </div>
            <div style={gridStyle}>
              {overdueOrders.map((o) => renderOrderCard(o))}
            </div>
          </div>
        )}

        {noDateOrders.length > 0 && (
          <div style={sectionWrapStyle}>
            <div style={sectionHeaderStyle}>
              <div>
                <h2 style={sectionTitleStyle}>Sin fecha asignada</h2>
                <p style={sectionSubtitleStyle}>
                  Pedidos que no tienen fecha de entrega
                </p>
              </div>
            </div>
            <div style={gridStyle}>
              {noDateOrders.map((o) => renderOrderCard(o))}
            </div>
          </div>
        )}

        <div style={sectionWrapStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <h2 style={sectionTitleStyle}>Pedidos para hoy</h2>
              <p style={sectionSubtitleStyle}>
                Esta sección muestra por default solo los pedidos del día actual
              </p>
            </div>
          </div>

          {todayOrders.length === 0 ? (
            <div style={emptyBoxStyle}>No hay pedidos para hoy</div>
          ) : (
            <div style={gridStyle}>
              {todayOrders.map((o) => renderOrderCard(o))}
            </div>
          )}
        </div>

        <div style={sectionWrapStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <h2 style={sectionTitleStyle}>Pedidos próximos</h2>
              <p style={sectionSubtitleStyle}>
                Aquí aparecen los pedidos con fecha futura
              </p>
            </div>
          </div>

          {futureOrders.length === 0 ? (
            <div style={emptyBoxStyle}>No hay pedidos próximos</div>
          ) : (
            <div style={gridStyle}>
              {futureOrders.map((o) => renderOrderCard(o))}
            </div>
          )}
        </div>
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

const sectionWrapStyle: React.CSSProperties = {
  marginBottom: 24,
};

const sectionHeaderStyle: React.CSSProperties = {
  marginBottom: 14,
};

const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  color: COLORS.text,
  fontSize: 26,
};

const sectionSubtitleStyle: React.CSSProperties = {
  margin: "6px 0 0 0",
  color: COLORS.muted,
  fontSize: 14,
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

const metaGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  marginBottom: 8,
};

const metaPillStyle: React.CSSProperties = {
  display: "inline-block",
  width: "fit-content",
  padding: "8px 12px",
  borderRadius: 999,
  background: COLORS.bgSoft,
  border: `1px solid ${COLORS.border}`,
  color: COLORS.text,
  fontSize: 13,
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
const cardActionsStyle: React.CSSProperties = {
  marginTop: 14,
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const dangerButtonStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 14,
  border: "none",
  fontWeight: 700,
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

const primaryHeaderButtonStyle: React.CSSProperties = {
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