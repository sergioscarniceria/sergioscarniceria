"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase";

/** Formato contable: $1,234.56 (sin el $, solo el número) */
function fmt(n: number, decimals = 2): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
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
  delivery_status?: string | null;
  delivery_driver?: string | null;
  delivery_started_at?: string | null;
  delivered_at?: string | null;
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

  // Inventory data
  const [bodegaItems, setBodegaItems] = useState<{ name: string; stock: number; cost: number; unit: string }[]>([]);
  const [complementos, setComplementos] = useState<{ name: string; stock: number; purchase_price: number }[]>([]);

  // Utilidades data
  const [showUtilities, setShowUtilities] = useState(false);
  const [ownerExpenses, setOwnerExpenses] = useState<{ expense_date: string; amount: number; category: string }[]>([]);
  const [prevMonthExpenses, setPrevMonthExpenses] = useState<{ expense_date: string; amount: number; category: string }[]>([]);
  const [prevYearExpenses, setPrevYearExpenses] = useState<{ expense_date: string; amount: number; category: string }[]>([]);
  const [prevMonthOrders, setPrevMonthOrders] = useState<{ created_at: string; order_items: { kilos: number; price: number }[] }[]>([]);
  const [prevYearOrders, setPrevYearOrders] = useState<{ created_at: string; order_items: { kilos: number; price: number }[] }[]>([]);
  const [cxcNotes, setCxcNotes] = useState<{ customer_name: string; total_amount: number; balance_due: number; status: string; due_date: string }[]>([]);
  const [supplierDebt, setSupplierDebt] = useState<{ name: string; debt: number }[]>([]);

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

    // Load inventory data
    const { data: bodData } = await supabase
      .from("bodega_items")
      .select("name, stock, cost, unit")
      .eq("is_active", true);
    setBodegaItems((bodData as any[]) || []);

    const { data: prodData } = await supabase
      .from("products")
      .select("name, stock, purchase_price, fixed_piece_price, category")
      .eq("is_active", true);
    const compData = (prodData || []).filter(
      (p: any) => p.category === "Complementos" || (p.fixed_piece_price !== null && p.fixed_piece_price > 0)
    );
    setComplementos(compData as any[]);

    // ─── Utilidades: gastos externos del mes actual ───
    const currentMonth = new Date();
    const cmFirst = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, "0")}-01`;
    const cmLast = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    const cmLastStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, "0")}-${String(cmLast.getDate()).padStart(2, "0")}`;

    const { data: oeData } = await supabase
      .from("owner_expenses")
      .select("expense_date, amount, category")
      .gte("expense_date", cmFirst)
      .lte("expense_date", cmLastStr);
    setOwnerExpenses((oeData as any[]) || []);

    // Mes anterior
    const prevMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
    const pmFirst = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}-01`;
    const pmLast = new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0);
    const pmLastStr = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}-${String(pmLast.getDate()).padStart(2, "0")}`;

    const { data: pmOeData } = await supabase
      .from("owner_expenses")
      .select("expense_date, amount, category")
      .gte("expense_date", pmFirst)
      .lte("expense_date", pmLastStr);
    setPrevMonthExpenses((pmOeData as any[]) || []);

    const { data: pmOrders } = await supabase
      .from("orders")
      .select("created_at, order_items(kilos, price)")
      .gte("created_at", `${pmFirst}T00:00:00`)
      .lte("created_at", `${pmLastStr}T23:59:59`);
    setPrevMonthOrders((pmOrders as any[]) || []);

    // Mismo mes del año anterior
    const prevYear = new Date(currentMonth.getFullYear() - 1, currentMonth.getMonth(), 1);
    const pyFirst = `${prevYear.getFullYear()}-${String(prevYear.getMonth() + 1).padStart(2, "0")}-01`;
    const pyLast = new Date(prevYear.getFullYear(), prevYear.getMonth() + 1, 0);
    const pyLastStr = `${prevYear.getFullYear()}-${String(prevYear.getMonth() + 1).padStart(2, "0")}-${String(pyLast.getDate()).padStart(2, "0")}`;

    const { data: pyOeData } = await supabase
      .from("owner_expenses")
      .select("expense_date, amount, category")
      .gte("expense_date", pyFirst)
      .lte("expense_date", pyLastStr);
    setPrevYearExpenses((pyOeData as any[]) || []);

    const { data: pyOrders } = await supabase
      .from("orders")
      .select("created_at, order_items(kilos, price)")
      .gte("created_at", `${pyFirst}T00:00:00`)
      .lte("created_at", `${pyLastStr}T23:59:59`);
    setPrevYearOrders((pyOrders as any[]) || []);

    // CxC abiertas
    const { data: cxcData } = await supabase
      .from("cxc_notes")
      .select("customer_name, total_amount, balance_due, status, due_date")
      .eq("status", "abierta");
    setCxcNotes((cxcData as any[]) || []);

    // Deuda a proveedores (lo que yo debo)
    const [suppRes, purchRes, suppExpRes, suppPayRes] = await Promise.all([
      supabase.from("suppliers").select("id, name"),
      supabase.from("livestock_purchases").select("supplier_id, total_cost, total_live"),
      supabase.from("supplier_expenses").select("supplier_id, amount"),
      supabase.from("supplier_payments").select("supplier_id, amount"),
    ]);
    const suppList = (suppRes.data || []) as { id: string; name: string }[];
    const suppMap: Record<string, { name: string; cargos: number; pagos: number }> = {};
    for (const s of suppList) suppMap[s.id] = { name: s.name, cargos: 0, pagos: 0 };
    for (const p of (purchRes.data || []) as any[]) {
      if (suppMap[p.supplier_id]) suppMap[p.supplier_id].cargos += Number(p.total_cost || p.total_live || 0);
    }
    for (const e of (suppExpRes.data || []) as any[]) {
      if (suppMap[e.supplier_id]) suppMap[e.supplier_id].cargos += Number(e.amount || 0);
    }
    for (const p of (suppPayRes.data || []) as any[]) {
      if (suppMap[p.supplier_id]) suppMap[p.supplier_id].pagos += Number(p.amount || 0);
    }
    const debts = Object.values(suppMap)
      .map((s) => ({ name: s.name, debt: Math.max(0, s.cargos - s.pagos) }))
      .filter((s) => s.debt > 0)
      .sort((a, b) => b.debt - a.debt);
    setSupplierDebt(debts);

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

  // ─── Inventory Value ─────────────────────────────────────
  const inventoryStats = useMemo(() => {
    const bodegaValue = bodegaItems.reduce((acc, i) => acc + (i.stock || 0) * (i.cost || 0), 0);
    const complementosValue = complementos.reduce((acc, p) => acc + (p.stock || 0) * (p.purchase_price || 0), 0);
    const totalValue = bodegaValue + complementosValue;
    const bodegaCount = bodegaItems.length;
    const complementosCount = complementos.length;
    const bodegaLow = bodegaItems.filter((i: any) => (i.min_stock || 0) > 0 && (i.stock || 0) <= (i.min_stock || 0)).length;
    const complementosLow = complementos.filter((p: any) => (p.min_stock || 0) > 0 && (p.stock || 0) <= (p.min_stock || 0)).length;
    return { bodegaValue, complementosValue, totalValue, bodegaCount, complementosCount, bodegaLow, complementosLow };
  }, [bodegaItems, complementos]);

  // ─── Utilidades del Mes ─────────────────────────────────
  const utilityStats = useMemo(() => {
    const calcOrdersTotal = (ords: any[]) =>
      ords.reduce((acc: number, o: any) =>
        acc + (o.order_items || []).reduce((s: number, i: any) => s + Number(i.kilos || 0) * Number(i.price || 0), 0), 0);

    const currentSales = salesThisMonth;
    const currentExpenses = ownerExpenses.reduce((s, e) => s + Number(e.amount), 0);
    const currentUtility = currentSales - currentExpenses;
    const currentMargin = currentSales > 0 ? (currentUtility / currentSales) * 100 : 0;

    const prevMSales = calcOrdersTotal(prevMonthOrders);
    const prevMExpenses = prevMonthExpenses.reduce((s, e) => s + Number(e.amount), 0);
    const prevMUtility = prevMSales - prevMExpenses;
    const prevMMargin = prevMSales > 0 ? (prevMUtility / prevMSales) * 100 : 0;

    const prevYSales = calcOrdersTotal(prevYearOrders);
    const prevYExpenses = prevYearExpenses.reduce((s, e) => s + Number(e.amount), 0);
    const prevYUtility = prevYSales - prevYExpenses;
    const prevYMargin = prevYSales > 0 ? (prevYUtility / prevYSales) * 100 : 0;

    // CxC
    const totalCxC = cxcNotes.reduce((s, n) => s + Number(n.balance_due || 0), 0);
    const cxcCount = cxcNotes.length;
    const cxcVencidas = cxcNotes.filter((n) => n.due_date && new Date(n.due_date) < new Date()).length;

    // Desglose por categoría gastos actuales
    const byCategory: Record<string, number> = {};
    ownerExpenses.forEach((e) => {
      byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount);
    });

    const categories = Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, total]) => ({ category: cat, total }));

    const monthNames = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
    const cm = new Date();
    const pm = new Date(cm.getFullYear(), cm.getMonth() - 1, 1);
    const py = new Date(cm.getFullYear() - 1, cm.getMonth(), 1);

    const totalDebt = supplierDebt.reduce((s, d) => s + d.debt, 0);

    return {
      current: { sales: currentSales, expenses: currentExpenses, utility: currentUtility, margin: currentMargin, label: monthNames[cm.getMonth()] },
      prevMonth: { sales: prevMSales, expenses: prevMExpenses, utility: prevMUtility, margin: prevMMargin, label: monthNames[pm.getMonth()] },
      prevYear: { sales: prevYSales, expenses: prevYExpenses, utility: prevYUtility, margin: prevYMargin, label: `${monthNames[py.getMonth()]} ${py.getFullYear()}` },
      cxc: { total: totalCxC, count: cxcCount, vencidas: cxcVencidas },
      debt: { total: totalDebt, count: supplierDebt.length },
      categories,
    };
  }, [salesThisMonth, ownerExpenses, prevMonthOrders, prevMonthExpenses, prevYearOrders, prevYearExpenses, cxcNotes, supplierDebt]);

  // ─── Delivery KPIs ──────────────────────────────────────
  const deliveryStats = useMemo(() => {
    const withDelivery = orders.filter((o) => o.delivery_status);
    const entregados = withDelivery.filter((o) => o.delivery_status === "entregado");
    const enCamino = withDelivery.filter((o) => o.delivery_status === "en_camino");
    const noEntregados = withDelivery.filter((o) => o.delivery_status === "no_entregado");
    const pendientes = orders.filter((o) => o.status === "terminado" && (!o.delivery_status || o.delivery_status === "pendiente"));

    // Tiempo promedio de entrega (minutos)
    const times = entregados
      .map((o) => {
        if (!o.delivery_started_at || !o.delivered_at) return null;
        const diff = new Date(o.delivered_at).getTime() - new Date(o.delivery_started_at).getTime();
        return diff > 0 ? Math.round(diff / 60000) : null;
      })
      .filter((t): t is number => t !== null);
    const avgMinutes = times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null;

    // Tasa de entrega exitosa
    const totalFinished = entregados.length + noEntregados.length;
    const successRate = totalFinished > 0 ? Math.round((entregados.length / totalFinished) * 100) : null;

    // Entregas por repartidor
    const byDriver: Record<string, { entregados: number; noEntregados: number }> = {};
    for (const o of withDelivery) {
      const d = o.delivery_driver || "Sin asignar";
      if (!byDriver[d]) byDriver[d] = { entregados: 0, noEntregados: 0 };
      if (o.delivery_status === "entregado") byDriver[d].entregados++;
      if (o.delivery_status === "no_entregado") byDriver[d].noEntregados++;
    }
    const driverRanking = Object.entries(byDriver)
      .map(([name, stats]) => ({ name, ...stats, total: stats.entregados + stats.noEntregados }))
      .sort((a, b) => b.entregados - a.entregados);

    return {
      total: withDelivery.length,
      entregados: entregados.length,
      enCamino: enCamino.length,
      noEntregados: noEntregados.length,
      pendientes: pendientes.length,
      avgMinutes,
      successRate,
      driverRanking,
    };
  }, [orders]);

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
            <button
              onClick={() => setShowUtilities(!showUtilities)}
              style={{
                ...secondaryButtonStyle,
                background: showUtilities ? COLORS.primary : COLORS.cardStrong,
                color: showUtilities ? "white" : COLORS.text,
                border: `1px solid ${showUtilities ? COLORS.primary : COLORS.border}`,
              }}
            >
              {showUtilities ? "Cerrar Utilidades" : "Utilidades"}
            </button>
            <Link href="/" style={secondaryButtonStyle}>Inicio</Link>
            <Link href="/pedidos" style={secondaryButtonStyle}>Pedidos</Link>
            <Link href="/produccion" style={secondaryButtonStyle}>Producción</Link>
            <Link href="/admin/clientes" style={secondaryButtonStyle}>Clientes</Link>
            <Link href="/admin/productos" style={secondaryButtonStyle}>Productos</Link>
            <Link href="/admin/caja" style={secondaryButtonStyle}>Caja</Link>
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
            <div style={heroValueStyle}>${fmt(totalSales)}</div>
          </div>

          <div style={heroCardStyle}>
            <div style={smallLabelStyle}>Pedidos del rango</div>
            <div style={heroValueStyle}>{totalOrders}</div>
          </div>

          <div style={heroCardStyle}>
            <div style={smallLabelStyle}>Kilos vendidos</div>
            <div style={heroValueStyle}>{fmt(totalKilos)}</div>
          </div>

          <div style={heroCardStyle}>
            <div style={smallLabelStyle}>Ticket promedio</div>
            <div style={heroValueStyle}>${fmt(averageTicket)}</div>
          </div>

          <div style={heroCardStyle}>
            <div style={smallLabelStyle}>Pedidos hoy</div>
            <div style={heroValueStyle}>{ordersToday}</div>
            <div style={heroMetaStyle}>${fmt(salesToday)}</div>
          </div>

          <div style={heroCardStyle}>
            <div style={smallLabelStyle}>Pedidos este mes</div>
            <div style={heroValueStyle}>{ordersThisMonth}</div>
            <div style={heroMetaStyle}>${fmt(salesThisMonth)}</div>
          </div>

          <div style={heroCardStyle}>
            <div style={smallLabelStyle}>Pedidos este año</div>
            <div style={heroValueStyle}>{ordersThisYear}</div>
            <div style={heroMetaStyle}>${fmt(salesThisYear)}</div>
          </div>

          <div style={heroCardStyle}>
            <div style={smallLabelStyle}>Ventas hoy</div>
            <div style={heroValueStyle}>${fmt(salesToday)}</div>
          </div>

          <div style={heroCardStyle}>
            <div style={smallLabelStyle}>Ventas este año</div>
            <div style={heroValueStyle}>${fmt(salesThisYear)}</div>
          </div>
        </div>

        {/* ─── Entregas KPIs ─── */}
        {deliveryStats.total > 0 && (
          <>
            <div style={{ marginBottom: 8, marginTop: 8 }}>
              <h2 style={{ margin: 0, color: COLORS.text, fontSize: 20 }}>Entregas</h2>
              <p style={{ margin: "4px 0 0", color: COLORS.muted, fontSize: 14 }}>Métricas de reparto en el rango seleccionado</p>
            </div>
            <div style={statsGridStyle}>
              <div style={heroCardStyle}>
                <div style={smallLabelStyle}>Entregados</div>
                <div style={{ ...heroValueStyle, color: COLORS.success }}>{deliveryStats.entregados}</div>
              </div>
              <div style={heroCardStyle}>
                <div style={smallLabelStyle}>En camino</div>
                <div style={{ ...heroValueStyle, color: COLORS.warning }}>{deliveryStats.enCamino}</div>
              </div>
              <div style={heroCardStyle}>
                <div style={smallLabelStyle}>No entregados</div>
                <div style={{ ...heroValueStyle, color: COLORS.danger }}>{deliveryStats.noEntregados}</div>
              </div>
              <div style={heroCardStyle}>
                <div style={smallLabelStyle}>Pendientes</div>
                <div style={heroValueStyle}>{deliveryStats.pendientes}</div>
              </div>
              <div style={heroCardStyle}>
                <div style={smallLabelStyle}>Tiempo promedio</div>
                <div style={heroValueStyle}>
                  {deliveryStats.avgMinutes !== null
                    ? deliveryStats.avgMinutes < 60
                      ? `${deliveryStats.avgMinutes} min`
                      : `${Math.floor(deliveryStats.avgMinutes / 60)}h ${deliveryStats.avgMinutes % 60}m`
                    : "—"}
                </div>
              </div>
              <div style={heroCardStyle}>
                <div style={smallLabelStyle}>Tasa de éxito</div>
                <div style={{ ...heroValueStyle, color: deliveryStats.successRate !== null && deliveryStats.successRate >= 90 ? COLORS.success : COLORS.warning }}>
                  {deliveryStats.successRate !== null ? `${deliveryStats.successRate}%` : "—"}
                </div>
              </div>
            </div>

            {deliveryStats.driverRanking.length > 0 && (
              <div style={{ ...panelStyle, marginBottom: 18 }}>
                <h2 style={panelTitleStyle}>Entregas por repartidor</h2>
                <div style={{ display: "grid", gap: 8 }}>
                  {deliveryStats.driverRanking.map((d) => (
                    <div key={d.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 14, background: COLORS.bgSoft, border: `1px solid ${COLORS.border}` }}>
                      <div style={{ fontWeight: 700, color: COLORS.text }}>{d.name}</div>
                      <div style={{ display: "flex", gap: 12, fontSize: 14 }}>
                        <span style={{ color: COLORS.success, fontWeight: 700 }}>{d.entregados} entregados</span>
                        {d.noEntregados > 0 && (
                          <span style={{ color: COLORS.danger, fontWeight: 700 }}>{d.noEntregados} fallidos</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ─── Inventario KPIs ─── */}
        <div style={{ marginBottom: 8, marginTop: 8 }}>
          <h2 style={{ margin: 0, color: COLORS.text, fontSize: 20 }}>Inventario</h2>
          <p style={{ margin: "4px 0 0", color: COLORS.muted, fontSize: 14 }}>Valor del inventario en bodega y complementos</p>
        </div>
        <div style={statsGridStyle}>
          <div style={heroCardStyle}>
            <div style={smallLabelStyle}>Valor total inventario</div>
            <div style={{ ...heroValueStyle, color: COLORS.primary }}>${fmt(inventoryStats.totalValue)}</div>
          </div>
          <div style={heroCardStyle}>
            <div style={smallLabelStyle}>Bodega (insumos)</div>
            <div style={heroValueStyle}>${fmt(inventoryStats.bodegaValue)}</div>
            <div style={heroMetaStyle}>{inventoryStats.bodegaCount} items</div>
          </div>
          <div style={heroCardStyle}>
            <div style={smallLabelStyle}>Complementos</div>
            <div style={heroValueStyle}>${fmt(inventoryStats.complementosValue)}</div>
            <div style={heroMetaStyle}>{inventoryStats.complementosCount} items</div>
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
                    ${fmt(customer.total)}
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
                  {fmt(product.kilos)} kg
                </div>
                <div style={{ flex: 1, textAlign: "right", color: COLORS.muted }}>
                  {product.times} veces
                </div>
                <div style={{ flex: 1, textAlign: "right", fontWeight: 700, color: COLORS.text }}>
                  ${fmt(product.revenue)}
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
                      {new Date(order.created_at).toLocaleString("es-MX", { timeZone: "America/Mexico_City" })}
                    </div>
                  ) : null}
                </div>

                <div style={{ fontWeight: 800, fontSize: 18, color: COLORS.primary, flexShrink: 0 }}>
                  ${fmt(orderTotal(order))}
                </div>
              </div>
            ))
          )}
        </div>
        {/* ─── Panel de Utilidades ─── */}
        {showUtilities && <div style={panelStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
            <div>
              <h2 style={panelTitleStyle}>Utilidades del Mes</h2>
              <p style={{ fontSize: 13, color: COLORS.muted, margin: 0 }}>Resumen financiero — {utilityStats.current.label} {new Date().getFullYear()}</p>
            </div>
            <Link href="/admin/gastos" style={{ padding: "8px 16px", borderRadius: 14, border: `1px solid ${COLORS.border}`, background: "rgba(255,255,255,0.75)", color: COLORS.text, fontWeight: 700, cursor: "pointer", fontSize: 13, textDecoration: "none" }}>
              Registrar gastos
            </Link>
          </div>

          {/* KPIs principales */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 16 }}>
            <div style={heroCardStyle}>
              <div style={smallLabelStyle}>Ventas del mes</div>
              <div style={{ ...heroValueStyle, color: COLORS.success }}>${fmt(utilityStats.current.sales)}</div>
            </div>
            <div style={heroCardStyle}>
              <div style={smallLabelStyle}>Gastos externos</div>
              <div style={{ ...heroValueStyle, color: COLORS.danger }}>${fmt(utilityStats.current.expenses)}</div>
            </div>
            <div style={heroCardStyle}>
              <div style={smallLabelStyle}>Utilidad</div>
              <div style={{ ...heroValueStyle, color: utilityStats.current.utility >= 0 ? COLORS.success : COLORS.danger }}>
                ${fmt(utilityStats.current.utility)}
              </div>
            </div>
            <div style={heroCardStyle}>
              <div style={smallLabelStyle}>Margen EBITDA</div>
              <div style={{ ...heroValueStyle, color: utilityStats.current.margin >= 10 ? COLORS.success : COLORS.warning }}>
                {utilityStats.current.margin.toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Comparativas */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            {/* vs Mes anterior */}
            <div style={{ background: "rgba(255,255,255,0.6)", borderRadius: 16, padding: 14, border: `1px solid ${COLORS.border}` }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.muted, marginBottom: 8 }}>vs {utilityStats.prevMonth.label} (mes anterior)</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 11, color: COLORS.muted }}>Ventas</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: COLORS.text }}>${fmt(utilityStats.prevMonth.sales)}</div>
                  {utilityStats.prevMonth.sales > 0 && (
                    <div style={{ fontSize: 11, color: utilityStats.current.sales >= utilityStats.prevMonth.sales ? COLORS.success : COLORS.danger, fontWeight: 700 }}>
                      {utilityStats.current.sales >= utilityStats.prevMonth.sales ? "▲" : "▼"} {Math.abs(((utilityStats.current.sales - utilityStats.prevMonth.sales) / utilityStats.prevMonth.sales) * 100).toFixed(1)}%
                    </div>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 11, color: COLORS.muted }}>Utilidad</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: utilityStats.prevMonth.utility >= 0 ? COLORS.success : COLORS.danger }}>${fmt(utilityStats.prevMonth.utility)}</div>
                  <div style={{ fontSize: 11, color: COLORS.muted }}>Margen: {utilityStats.prevMonth.margin.toFixed(1)}%</div>
                </div>
              </div>
            </div>

            {/* vs Mismo mes año anterior */}
            <div style={{ background: "rgba(255,255,255,0.6)", borderRadius: 16, padding: 14, border: `1px solid ${COLORS.border}` }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.muted, marginBottom: 8 }}>vs {utilityStats.prevYear.label}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 11, color: COLORS.muted }}>Ventas</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: COLORS.text }}>${fmt(utilityStats.prevYear.sales)}</div>
                  {utilityStats.prevYear.sales > 0 && (
                    <div style={{ fontSize: 11, color: utilityStats.current.sales >= utilityStats.prevYear.sales ? COLORS.success : COLORS.danger, fontWeight: 700 }}>
                      {utilityStats.current.sales >= utilityStats.prevYear.sales ? "▲" : "▼"} {Math.abs(((utilityStats.current.sales - utilityStats.prevYear.sales) / utilityStats.prevYear.sales) * 100).toFixed(1)}%
                    </div>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 11, color: COLORS.muted }}>Utilidad</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: utilityStats.prevYear.utility >= 0 ? COLORS.success : COLORS.danger }}>${fmt(utilityStats.prevYear.utility)}</div>
                  <div style={{ fontSize: 11, color: COLORS.muted }}>Margen: {utilityStats.prevYear.margin.toFixed(1)}%</div>
                </div>
              </div>
            </div>
          </div>

          {/* CxC + Lo que debo + Desglose gastos */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
            {/* Lo que me deben */}
            <div style={{ background: "rgba(255,255,255,0.6)", borderRadius: 16, padding: 14, border: `1px solid ${COLORS.border}` }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, marginBottom: 8 }}>Lo que me deben (CxC)</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: COLORS.warning, marginBottom: 4 }}>${fmt(utilityStats.cxc.total)}</div>
              <div style={{ fontSize: 12, color: COLORS.muted }}>
                {utilityStats.cxc.count} notas abiertas
                {utilityStats.cxc.vencidas > 0 && (
                  <span style={{ color: COLORS.danger, fontWeight: 700 }}> — {utilityStats.cxc.vencidas} vencidas</span>
                )}
              </div>
              {cxcNotes.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  {cxcNotes.slice(0, 5).map((n, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0", borderBottom: `1px solid ${COLORS.border}` }}>
                      <span style={{ color: COLORS.text }}>{n.customer_name}</span>
                      <span style={{ fontWeight: 700, color: new Date(n.due_date) < new Date() ? COLORS.danger : COLORS.text }}>${fmt(n.balance_due)}</span>
                    </div>
                  ))}
                  {cxcNotes.length > 5 && <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 4 }}>y {cxcNotes.length - 5} más...</div>}
                </div>
              )}
            </div>

            {/* Lo que yo debo */}
            <div style={{ background: "rgba(255,255,255,0.6)", borderRadius: 16, padding: 14, border: `1px solid ${COLORS.border}` }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, marginBottom: 8 }}>Lo que yo debo (Proveedores)</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: COLORS.danger, marginBottom: 4 }}>${fmt(utilityStats.debt.total)}</div>
              <div style={{ fontSize: 12, color: COLORS.muted }}>{utilityStats.debt.count} proveedores con saldo</div>
              {supplierDebt.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  {supplierDebt.slice(0, 5).map((s, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0", borderBottom: `1px solid ${COLORS.border}` }}>
                      <span style={{ color: COLORS.text }}>{s.name}</span>
                      <span style={{ fontWeight: 700, color: COLORS.danger }}>${fmt(s.debt)}</span>
                    </div>
                  ))}
                  {supplierDebt.length > 5 && <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 4 }}>y {supplierDebt.length - 5} más...</div>}
                </div>
              )}
            </div>
          </div>

          {/* Balance neto */}
          <div style={{ marginTop: 12, background: "rgba(255,255,255,0.6)", borderRadius: 16, padding: 14, border: `1px solid ${COLORS.border}`, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, textAlign: "center" }}>
            <div>
              <div style={{ fontSize: 12, color: COLORS.muted }}>Me deben</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: COLORS.success }}>${fmt(utilityStats.cxc.total)}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: COLORS.muted }}>Yo debo</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: COLORS.danger }}>${fmt(utilityStats.debt.total)}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: COLORS.muted }}>Balance neto</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: (utilityStats.cxc.total - utilityStats.debt.total) >= 0 ? COLORS.success : COLORS.danger }}>
                ${fmt(utilityStats.cxc.total - utilityStats.debt.total)}
              </div>
            </div>
          </div>

          {/* Desglose de gastos */}
            <div style={{ background: "rgba(255,255,255,0.6)", borderRadius: 16, padding: 14, border: `1px solid ${COLORS.border}` }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, marginBottom: 8 }}>Desglose gastos externos</div>
              {utilityStats.categories.length === 0 ? (
                <div style={{ fontSize: 13, color: COLORS.muted, padding: 10 }}>Sin gastos registrados este mes</div>
              ) : (
                utilityStats.categories.map((cat, i) => {
                  const catLabels: Record<string, string> = {
                    compras_ganado: "Compras ganado", pagos_proveedores: "Pagos proveedores", renta: "Renta",
                    gas: "Gas", insumos: "Insumos", vehiculos: "Vehículos", publicidad: "Publicidad",
                    servicios: "Servicios", sueldos_extra: "Sueldos extra", otros: "Otros",
                  };
                  const pct = utilityStats.current.expenses > 0 ? (cat.total / utilityStats.current.expenses) * 100 : 0;
                  return (
                    <div key={i} style={{ marginBottom: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 2 }}>
                        <span style={{ color: COLORS.text, fontWeight: 600 }}>{catLabels[cat.category] || cat.category}</span>
                        <span style={{ fontWeight: 700, color: COLORS.text }}>${fmt(cat.total)} ({pct.toFixed(0)}%)</span>
                      </div>
                      <div style={{ height: 6, background: "#eee", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: COLORS.primary, borderRadius: 3 }} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>}

        {/* Panel de salud del sistema */}
        <SystemHealthPanel />
      </div>
    </div>
  );
}

function SystemHealthPanel() {
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);

  async function checkHealth() {
    setLoading(true);
    setShow(true);
    try {
      const res = await fetch("/api/health?secret=sergios2026");
      const data = await res.json();
      setHealth(data);
    } catch {
      setHealth({ status: "error", database: { usage_percent: -1 } });
    }
    setLoading(false);
  }

  const statusColor = health?.status === "ok" ? COLORS.success : health?.status === "warning" ? COLORS.warning : COLORS.danger;

  return (
    <div style={{ background: COLORS.cardStrong, border: `1px solid ${COLORS.border}`, borderRadius: 24, padding: 18, boxShadow: COLORS.shadow, marginTop: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          <h2 style={{ margin: 0, color: COLORS.text }}>Salud del sistema</h2>
          <p style={{ margin: "4px 0 0", color: COLORS.muted, fontSize: 14 }}>Base de datos, almacenamiento y backups</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={checkHealth} disabled={loading} style={{ padding: "10px 16px", borderRadius: 14, border: `1px solid ${COLORS.border}`, background: "rgba(255,255,255,0.75)", color: COLORS.text, fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
            {loading ? "Verificando..." : "Verificar ahora"}
          </button>
          <a href="/api/backup?secret=sergios2026" target="_blank" rel="noopener" style={{ padding: "10px 16px", borderRadius: 14, border: "none", background: `linear-gradient(180deg, ${COLORS.primary} 0%, ${COLORS.primaryDark} 100%)`, color: "white", fontWeight: 700, cursor: "pointer", fontSize: 14, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
            Descargar backup
          </a>
        </div>
      </div>

      {show && health && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <div style={{ background: health.database?.can_write ? "rgba(31,122,77,0.10)" : "rgba(180,35,24,0.10)", border: `1px solid ${COLORS.border}`, borderRadius: 18, padding: 14 }}>
            <div style={{ color: COLORS.muted, fontSize: 12, marginBottom: 4 }}>Estado</div>
            <div style={{ color: statusColor, fontSize: 20, fontWeight: 800 }}>
              {health.status === "ok" ? "OK" : health.status === "warning" ? "Atención" : "Problema"}
            </div>
            <div style={{ color: COLORS.muted, fontSize: 11, marginTop: 2 }}>
              {health.database?.can_write ? "Escritura activa" : "SOLO LECTURA"}
            </div>
          </div>

          <div style={{ background: COLORS.bgSoft, border: `1px solid ${COLORS.border}`, borderRadius: 18, padding: 14 }}>
            <div style={{ color: COLORS.muted, fontSize: 12, marginBottom: 4 }}>Registros totales</div>
            <div style={{ color: COLORS.text, fontSize: 20, fontWeight: 800 }}>{health.database?.total_rows?.toLocaleString() || "—"}</div>
          </div>

          <div style={{ background: COLORS.bgSoft, border: `1px solid ${COLORS.border}`, borderRadius: 18, padding: 14 }}>
            <div style={{ color: COLORS.muted, fontSize: 12, marginBottom: 4 }}>Uso estimado</div>
            <div style={{ color: (health.database?.usage_percent || 0) > 50 ? COLORS.danger : COLORS.text, fontSize: 20, fontWeight: 800 }}>
              {health.database?.estimated_size_mb || 0} MB / 500 MB
            </div>
            <div style={{ color: COLORS.muted, fontSize: 11, marginTop: 2 }}>{health.database?.usage_percent || 0}%</div>
          </div>

          <div style={{ background: COLORS.bgSoft, border: `1px solid ${COLORS.border}`, borderRadius: 18, padding: 14 }}>
            <div style={{ color: COLORS.muted, fontSize: 12, marginBottom: 4 }}>Tablas</div>
            <div style={{ fontSize: 12, color: COLORS.muted, maxHeight: 120, overflowY: "auto" }}>
              {health.tables && Object.entries(health.tables).map(([t, c]: [string, any]) => (
                <div key={t} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
                  <span>{t}</span>
                  <b style={{ color: COLORS.text }}>{c}</b>
                </div>
              ))}
            </div>
          </div>

          {health.recommendations && health.recommendations.length > 0 && (
            <div style={{ gridColumn: "1 / -1", background: "rgba(166,106,16,0.08)", border: `1px solid ${COLORS.border}`, borderRadius: 18, padding: 14 }}>
              <div style={{ color: COLORS.warning, fontWeight: 800, marginBottom: 6 }}>Recomendaciones</div>
              {health.recommendations.map((r: string, i: number) => (
                <div key={i} style={{ color: COLORS.text, fontSize: 13, marginTop: 4 }}>• {r}</div>
              ))}
            </div>
          )}
        </div>
      )}
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