"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type OrderItem = {
  id: string;
  product: string;
  kilos: number;
  price: number;
};

type Order = {
  id: string;
  customer_name: string | null;
  status: string | null;
  butcher_name?: string | null;
  created_at?: string;
  order_items?: OrderItem[];
};

type ProductStats = {
  product: string;
  revenue: number;
  kilos: number;
  times: number;
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
  accent: "#d9c9a3",
  success: "#1f7a4d",
  warning: "#a66a10",
  danger: "#b42318",
  info: "#355c7d",
  shadow: "0 10px 30px rgba(91, 25, 15, 0.08)",
};

export default function AdminDashboardPage() {
  const supabase = getSupabaseClient();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date();
  const todayStr = toDateInputValue(today);
  const firstDayMonthStr = toDateInputValue(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );

  const [dateFrom, setDateFrom] = useState(firstDayMonthStr);
  const [dateTo, setDateTo] = useState(todayStr);

  useEffect(() => {
    loadDashboard();
  }, [dateFrom, dateTo]);

  async function loadDashboard() {
    setLoading(true);

    let query = supabase
      .from("orders")
      .select(`
        *,
        order_items (*)
      `)
      .order("created_at", { ascending: false });

    if (dateFrom) {
      query = query.gte("created_at", `${dateFrom}T00:00:00`);
    }

    if (dateTo) {
      query = query.lte("created_at", `${dateTo}T23:59:59`);
    }

    const { data, error } = await query;

    if (error) {
      console.log(error);
      alert("No se pudo cargar el dashboard");
      setLoading(false);
      return;
    }

    setOrders((data as Order[]) || []);
    setLoading(false);
  }

  function orderTotal(order: Order) {
    return (order.order_items || []).reduce((acc, item) => {
      return acc + Number(item.kilos || 0) * Number(item.price || 0);
    }, 0);
  }

  function orderKilos(order: Order) {
    return (order.order_items || []).reduce((acc, item) => {
      return acc + Number(item.kilos || 0);
    }, 0);
  }

  function isSameDay(date: Date, now: Date) {
    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate()
    );
  }

  function isSameMonth(date: Date, now: Date) {
    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth()
    );
  }

  function isSameYear(date: Date, now: Date) {
    return date.getFullYear() === now.getFullYear();
  }

  const now = new Date();

  const totalSales = useMemo(
    () => orders.reduce((acc, order) => acc + orderTotal(order), 0),
    [orders]
  );

  const totalOrders = orders.length;

  const totalKilos = useMemo(
    () => orders.reduce((acc, order) => acc + orderKilos(order), 0),
    [orders]
  );

  const averageTicket = totalOrders > 0 ? totalSales / totalOrders : 0;

  const ordersToday = useMemo(
    () =>
      orders.filter((order) => {
        if (!order.created_at) return false;
        return isSameDay(new Date(order.created_at), now);
      }).length,
    [orders]
  );

  const ordersThisMonth = useMemo(
    () =>
      orders.filter((order) => {
        if (!order.created_at) return false;
        return isSameMonth(new Date(order.created_at), now);
      }).length,
    [orders]
  );

  const ordersThisYear = useMemo(
    () =>
      orders.filter((order) => {
        if (!order.created_at) return false;
        return isSameYear(new Date(order.created_at), now);
      }).length,
    [orders]
  );

  const salesToday = useMemo(
    () =>
      orders.reduce((acc, order) => {
        if (!order.created_at) return acc;
        const d = new Date(order.created_at);
        return isSameDay(d, now) ? acc + orderTotal(order) : acc;
      }, 0),
    [orders]
  );

  const salesThisMonth = useMemo(
    () =>
      orders.reduce((acc, order) => {
        if (!order.created_at) return acc;
        const d = new Date(order.created_at);
        return isSameMonth(d, now) ? acc + orderTotal(order) : acc;
      }, 0),
    [orders]
  );

  const salesThisYear = useMemo(
    () =>
      orders.reduce((acc, order) => {
        if (!order.created_at) return acc;
        const d = new Date(order.created_at);
        return isSameYear(d, now) ? acc + orderTotal(order) : acc;
      }, 0),
    [orders]
  );

  const topCustomers = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const order of orders) {
      const name = order.customer_name || "Sin nombre";
      totals[name] = (totals[name] || 0) + orderTotal(order);
    }
    return Object.entries(totals)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [orders]);

  const butcherStats = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const order of orders) {
      const butcher = order.butcher_name || "Sin asignar";
      counts[butcher] = (counts[butcher] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [orders]);

  const productStats = useMemo(() => {
    const totals: Record<string, ProductStats> = {};

    for (const order of orders) {
      for (const item of order.order_items || []) {
        const key = item.product || "Sin nombre";
        if (!totals[key]) {
          totals[key] = { product: key, revenue: 0, kilos: 0, times: 0 };
        }
        totals[key].revenue += Number(item.kilos || 0) * Number(item.price || 0);
        totals[key].kilos += Number(item.kilos || 0);
        totals[key].times += 1;
      }
    }

    return Object.values(totals).sort((a, b) => b.revenue - a.revenue);
  }, [orders]);

  const salesByDay = useMemo(() => {
    const map: Record<string, { date: string; sales: number; orders: number }> = {};

    for (const order of orders) {
      if (!order.created_at) continue;
      const d = new Date(order.created_at);
      const key = d.toISOString().slice(0, 10);

      if (!map[key]) {
        map[key] = { date: key, sales: 0, orders: 0 };
      }

      map[key].sales += orderTotal(order);
      map[key].orders += 1;
    }

    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  }, [orders]);

  const recentOrders = orders.slice(0, 10);

  function setTodayFilter() {
    setDateFrom(todayStr);
    setDateTo(todayStr);
  }

  function setMonthFilter() {
    setDateFrom(firstDayMonthStr);
    setDateTo(todayStr);
  }

  function setYearFilter() {
    setDateFrom(`${today.getFullYear()}-01-01`);
    setDateTo(todayStr);
  }

  function clearFilter() {
    setDateFrom("");
    setDateTo("");
  }

  if (loading) {
    return (
      <div style={loadingPageStyle}>
        <div style={loadingCardStyle}>Cargando dashboard...</div>
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
              <h1 style={{ margin: 0, color: COLORS.text }}>Dashboard</h1>
              <p style={{ color: COLORS.muted, margin: "6px 0 0 0" }}>
                Resumen visual del negocio
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/" style={secondaryButtonStyle}>Inicio</Link>
            <Link href="/pedidos" style={secondaryButtonStyle}>Pedidos</Link>
            <Link href="/produccion" style={secondaryButtonStyle}>Producción</Link>
            <Link href="/admin/clientes" style={secondaryButtonStyle}>Clientes</Link>
          </div>
        </div>

        <div style={filterCardStyle}>
          <div style={filterGridStyle}>
            <div>
              <label style={labelStyle}>Desde</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={inputStyle} />
            </div>

            <div>
              <label style={labelStyle}>Hasta</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={inputStyle} />
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" }}>
              <button onClick={setTodayFilter} style={lightMiniButtonStyle}>Hoy</button>
              <button onClick={setMonthFilter} style={lightMiniButtonStyle}>Este mes</button>
              <button onClick={setYearFilter} style={lightMiniButtonStyle}>Este año</button>
              <button onClick={clearFilter} style={darkMiniButtonStyle}>Quitar filtro</button>
            </div>
          </div>
        </div>

        <div style={statsGridStyle}>
          <div style={heroCardStyle}>
            <div style={smallLabelStyle}>Ventas del rango</div>
            <div style={heroValueStyle}>${totalSales.toFixed(2)}</div>
          </div>

          <div style={heroCardStyle}>
            <div style={smallLabelStyle}>Pedidos del rango</div>
            <div style={heroValueStyle}>{totalOrders}</div>
          </div>

          <div style={heroCardStyle}>
            <div style={smallLabelStyle}>Kilos vendidos</div>
            <div style={heroValueStyle}>{totalKilos.toFixed(2)}</div>
          </div>

          <div style={heroCardStyle}>
            <div style={smallLabelStyle}>Ticket promedio</div>
            <div style={heroValueStyle}>${averageTicket.toFixed(2)}</div>
          </div>

          <div style={heroCardStyle}>
            <div style={smallLabelStyle}>Pedidos hoy</div>
            <div style={heroValueStyle}>{ordersToday}</div>
            <div style={heroMetaStyle}>${salesToday.toFixed(2)}</div>
          </div>

          <div style={heroCardStyle}>
            <div style={smallLabelStyle}>Pedidos este mes</div>
            <div style={heroValueStyle}>{ordersThisMonth}</div>
            <div style={heroMetaStyle}>${salesThisMonth.toFixed(2)}</div>
          </div>

          <div style={heroCardStyle}>
            <div style={smallLabelStyle}>Pedidos este año</div>
            <div style={heroValueStyle}>{ordersThisYear}</div>
            <div style={heroMetaStyle}>${salesThisYear.toFixed(2)}</div>
          </div>

          <div style={heroCardStyle}>
            <div style={smallLabelStyle}>Ventas hoy</div>
            <div style={heroValueStyle}>${salesToday.toFixed(2)}</div>
          </div>

          <div style={heroCardStyle}>
            <div style={smallLabelStyle}>Ventas este año</div>
            <div style={heroValueStyle}>${salesThisYear.toFixed(2)}</div>
          </div>
        </div>

        <div style={panelStyle}>
          <h2 style={panelTitleStyle}>Ventas por día</h2>
          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer>
              <LineChart data={salesByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(92,27,17,0.08)" />
                <XAxis dataKey="date" tick={{ fill: COLORS.muted, fontSize: 12 }} />
                <YAxis tick={{ fill: COLORS.muted, fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="sales" stroke={COLORS.primary} strokeWidth={3} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={{ ...panelStyle, marginTop: 20 }}>
          <h2 style={panelTitleStyle}>Pedidos por día</h2>
          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer>
              <LineChart data={salesByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(92,27,17,0.08)" />
                <XAxis dataKey="date" tick={{ fill: COLORS.muted, fontSize: 12 }} />
                <YAxis tick={{ fill: COLORS.muted, fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="orders" stroke={COLORS.success} strokeWidth={3} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={doubleGridStyle}>
          <div style={panelStyle}>
            <h2 style={panelTitleStyle}>Clientes que más compran</h2>
            {topCustomers.length === 0 ? (
              <div style={emptyBoxStyle}>No hay datos</div>
            ) : (
              topCustomers.map((customer, index) => (
                <div key={customer.name} style={rowStyle}>
                  <div style={{ minWidth: 0 }}>#{index + 1} <b>{customer.name}</b></div>
                  <div style={{ fontWeight: 700, color: COLORS.text, flexShrink: 0 }}>
                    ${customer.total.toFixed(2)}
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={panelStyle}>
            <h2 style={panelTitleStyle}>Carniceros con más pedidos</h2>
            {butcherStats.length === 0 ? (
              <div style={emptyBoxStyle}>No hay datos</div>
            ) : (
              butcherStats.map((butcher, index) => (
                <div key={butcher.name} style={rowStyle}>
                  <div style={{ minWidth: 0 }}>#{index + 1} <b>{butcher.name}</b></div>
                  <div style={{ fontWeight: 700, color: COLORS.text, flexShrink: 0 }}>
                    {butcher.count}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div style={{ ...panelStyle, marginTop: 20 }}>
          <h2 style={panelTitleStyle}>Ventas por producto</h2>

          {productStats.length === 0 ? (
            <div style={emptyBoxStyle}>No hay datos</div>
          ) : (
            productStats.map((product, index) => (
              <div key={product.product} style={productRowStyle}>
                <div style={{ flex: 2, color: COLORS.text, minWidth: 0 }}>
                  #{index + 1} <b>{product.product}</b>
                </div>
                <div style={{ flex: 1, textAlign: "right", color: COLORS.muted }}>
                  {product.kilos.toFixed(2)} kg
                </div>
                <div style={{ flex: 1, textAlign: "right", color: COLORS.muted }}>
                  {product.times} veces
                </div>
                <div style={{ flex: 1, textAlign: "right", fontWeight: 700, color: COLORS.text }}>
                  ${product.revenue.toFixed(2)}
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{ ...panelStyle, marginTop: 20 }}>
          <h2 style={panelTitleStyle}>Pedidos recientes</h2>

          {recentOrders.length === 0 ? (
            <div style={emptyBoxStyle}>No hay pedidos</div>
          ) : (
            recentOrders.map((order) => (
              <div key={order.id} style={recentOrderRowStyle}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: COLORS.text }}>
                    {order.customer_name || "Sin nombre"}
                  </div>
                  <div style={{ color: COLORS.muted, marginTop: 4 }}>
                    Estado: {order.status || "Sin estado"} · Carnicero: {order.butcher_name || "Sin asignar"}
                  </div>
                  {order.created_at ? (
                    <div style={{ color: COLORS.muted, marginTop: 4, fontSize: 13 }}>
                      {new Date(order.created_at).toLocaleString()}
                    </div>
                  ) : null}
                </div>

                <div style={{ fontWeight: 800, fontSize: 18, color: COLORS.primary, flexShrink: 0 }}>
                  ${orderTotal(order).toFixed(2)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
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

const filterCardStyle: React.CSSProperties = {
  background: COLORS.cardStrong,
  backdropFilter: "blur(10px)",
  border: `1px solid ${COLORS.border}`,
  borderRadius: 24,
  padding: 18,
  boxShadow: COLORS.shadow,
  marginBottom: 20,
};

const filterGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 16,
  alignItems: "end",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 6,
  fontSize: 14,
  color: COLORS.muted,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 12,
  borderRadius: 14,
  border: `1px solid ${COLORS.border}`,
  boxSizing: "border-box",
  outline: "none",
  background: "rgba(255,255,255,0.82)",
  color: COLORS.text,
};

const statsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
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
  fontSize: 32,
  fontWeight: 800,
  color: COLORS.text,
  marginBottom: 6,
  lineHeight: 1.1,
};

const heroMetaStyle: React.CSSProperties = {
  color: COLORS.muted,
  fontSize: 14,
};

const panelStyle: React.CSSProperties = {
  background: COLORS.card,
  backdropFilter: "blur(10px)",
  border: `1px solid ${COLORS.border}`,
  borderRadius: 24,
  padding: 18,
  boxShadow: COLORS.shadow,
};

const panelTitleStyle: React.CSSProperties = {
  marginTop: 0,
  marginBottom: 16,
  color: COLORS.text,
};

const doubleGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: 20,
  marginTop: 20,
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: "12px 0",
  borderBottom: `1px solid ${COLORS.border}`,
};

const productRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "2fr 1fr 1fr 1fr",
  gap: 12,
  alignItems: "center",
  padding: "12px 0",
  borderBottom: `1px solid ${COLORS.border}`,
};

const recentOrderRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: 14,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 18,
  marginBottom: 10,
  background: COLORS.bgSoft,
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

const lightMiniButtonStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: `1px solid ${COLORS.border}`,
  background: "white",
  color: COLORS.text,
  cursor: "pointer",
  fontWeight: 700,
};

const darkMiniButtonStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "none",
  background: COLORS.primary,
  color: "white",
  cursor: "pointer",
  fontWeight: 700,
};