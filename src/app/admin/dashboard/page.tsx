"use client";

import React, { useEffect, useMemo, useState } from "react";
import { itemSubtotal as itemSubtotalLib } from "@/lib/itemSubtotal";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase";
import { getAdminSecret } from "@/lib/admin-secret";

/** Formato contable sin decimales: $1,235 */
function fmt(n: number): string {
  return Math.ceil(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
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
  sale_type?: string | null;
  quantity?: number | null;
  is_fixed_price_piece?: boolean | null;
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
  edited_at?: string | null;
  edited_by?: string | null;
  original_items?: OrderItem[] | null;
  discount_amount?: number | null;
  rounding_amount?: number | null;
  payment_method?: string | null;
  captured_by?: string | null;
};

type ProductStats = {
  product: string;
  revenue: number;
  kilos: number;
  piezas: number;
  times: number;
  isPieza: boolean;
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
  const [historicalDays, setHistoricalDays] = useState<{ date: string; venta: number; total_gastos: number; utilidad_diaria: number }[]>([]);
  const [loading, setLoading] = useState(true);

  // Secciones colapsables
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  // Inventory data
  const [bodegaItems, setBodegaItems] = useState<{ name: string; stock: number; cost: number; unit: string }[]>([]);
  const [complementos, setComplementos] = useState<{ name: string; stock: number; purchase_price: number }[]>([]);

  // Utilidades data
  const [showUtilities, setShowUtilities] = useState(false);
  const [ownerExpenses, setOwnerExpenses] = useState<{ expense_date: string; amount: number; category: string }[]>([]);
  const [opExpenses, setOpExpenses] = useState<{ expense_date: string; amount: number; concept: string; category: string }[]>([]);
  const [supplierExpensesMes, setSupplierExpensesMes] = useState<{ date: string; amount: number; concept: string; is_raw_material?: boolean; kg?: number | null; product_category?: string | null }[]>([]);
  const [livestockPurchasesMes, setLivestockPurchasesMes] = useState<{ date: string; total_cost: number | null; total_live: number | null }[]>([]);
  const [supplierPaymentsMes, setSupplierPaymentsMes] = useState<{ date: string; amount: number; method: string; supplier_id: string }[]>([]);
  const [supplierNameMap, setSupplierNameMap] = useState<Record<string, string>>({});
  const [productsMap, setProductsMap] = useState<Record<string, string>>({}); // name -> category
  const [prevMonthOpExpenses, setPrevMonthOpExpenses] = useState<{ expense_date: string; amount: number; concept: string; category: string }[]>([]);
  const [prevYearOpExpenses, setPrevYearOpExpenses] = useState<{ expense_date: string; amount: number; concept: string; category: string }[]>([]);
  const [prevMonthExpenses, setPrevMonthExpenses] = useState<{ expense_date: string; amount: number; category: string }[]>([]);
  const [prevYearExpenses, setPrevYearExpenses] = useState<{ expense_date: string; amount: number; category: string }[]>([]);
  const [prevMonthOrders, setPrevMonthOrders] = useState<{ created_at: string; order_items: { kilos: number; price: number; sale_type?: string; quantity?: number; is_fixed_price_piece?: boolean }[] }[]>([]);
  const [prevYearOrders, setPrevYearOrders] = useState<{ created_at: string; order_items: { kilos: number; price: number; sale_type?: string; quantity?: number; is_fixed_price_piece?: boolean }[] }[]>([]);
  const [cxcNotes, setCxcNotes] = useState<{ customer_name: string; total_amount: number; balance_due: number; status: string; due_date: string }[]>([]);
  const [supplierDebt, setSupplierDebt] = useState<{ name: string; debt: number }[]>([]);
  const [roundingTotal, setRoundingTotal] = useState(0);
  const [roundingCount, setRoundingCount] = useState(0);
  const [productSearch, setProductSearch] = useState("");
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [cashMovements, setCashMovements] = useState<{ amount: number; type: string; is_cancelled: boolean; payment_method?: string }[]>([]);

  // Market prices
  const [marketPrices, setMarketPrices] = useState<{ id: string; product_name: string; our_price: number; market_avg: number; market_low: number; market_high: number; sources: string; category: string; updated_at: string }[]>([]);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketRefreshResult, setMarketRefreshResult] = useState("");

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
    try {

    // Fetch orders in range (max 2000 to avoid overload)
    let allOrders: any[] = [];
    let page = 0;
    const PAGE_SIZE = 1000;
    const MAX_PAGES = 2;

    while (page < MAX_PAGES) {
      let query = supabase
        .from("orders")
        .select(`
          *,
          order_items (*)
        `)
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (dateFrom) {
        query = query.gte("created_at", `${dateFrom}T00:00:00`);
      }

      if (dateTo) {
        query = query.lte("created_at", `${dateTo}T23:59:59`);
      }

      const { data: pageData, error: pageError } = await query;

      if (pageError) {
        console.log(pageError);
        break;
      }

      allOrders = allOrders.concat(pageData || []);
      if ((pageData || []).length < PAGE_SIZE) break;
      page++;
    }

    setOrders((allOrders as Order[]) || []);

    // ─── Cargar resúmenes diarios históricos (daily_summaries) ───
    {
      let hQuery = supabase
        .from("daily_summaries")
        .select("date, venta, total_gastos, utilidad_diaria")
        .order("date", { ascending: true });

      if (dateFrom) hQuery = hQuery.gte("date", dateFrom);
      if (dateTo) hQuery = hQuery.lte("date", dateTo);

      const { data: hData } = await hQuery;
      setHistoricalDays((hData as any[]) || []);
    }

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

    // Gastos operativos del mes (cash_expenses)
    const { data: opData } = await supabase
      .from("cash_expenses")
      .select("expense_date, amount, concept, category")
      .gte("expense_date", cmFirst)
      .lte("expense_date", cmLastStr);
    setOpExpenses((opData as any[]) || []);

    // Compras a proveedores del rango (animales + cargos) — afectan utilidad pero NO el cajón
    const [{ data: livestockMes }, { data: suppExpMes }] = await Promise.all([
      supabase
        .from("livestock_purchases")
        .select("date, total_cost, total_live")
        .gte("date", cmFirst)
        .lte("date", cmLastStr),
      supabase
        .from("supplier_expenses")
        .select("date, amount, concept, is_raw_material, kg, product_category")
        .gte("date", cmFirst)
        .lte("date", cmLastStr),
    ]);
    setLivestockPurchasesMes((livestockMes as any[]) || []);
    setSupplierExpensesMes((suppExpMes as any[]) || []);

    // Pagos a proveedores hechos en el mes (lo que realmente sale del acumulado)
    const { data: suppPayMes } = await supabase
      .from("supplier_payments")
      .select("date, amount, method, supplier_id")
      .gte("date", cmFirst)
      .lte("date", cmLastStr);
    setSupplierPaymentsMes((suppPayMes as any[]) || []);

    // Cargar nombres de proveedores para mostrar en el desglose
    const { data: allSuppliers } = await supabase
      .from("suppliers")
      .select("id, name");
    const sMap: Record<string, string> = {};
    (allSuppliers || []).forEach((s: any) => { sMap[s.id] = s.name; });
    setSupplierNameMap(sMap);

    // Cargar map nombre→categoria de productos para clasificar ventas por tipo de carne
    const { data: prodList } = await supabase
      .from("products")
      .select("name, category");
    const pMap: Record<string, string> = {};
    (prodList || []).forEach((p: any) => { if (p.name) pMap[p.name] = p.category || ""; });
    setProductsMap(pMap);

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

    const { data: pmOpData } = await supabase
      .from("cash_expenses")
      .select("expense_date, amount, concept, category")
      .gte("expense_date", pmFirst)
      .lte("expense_date", pmLastStr);
    setPrevMonthOpExpenses((pmOpData as any[]) || []);

    const { data: pmOrders } = await supabase
      .from("orders")
      .select("created_at, order_items(kilos, price, sale_type, quantity, is_fixed_price_piece)")
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

    const { data: pyOpData } = await supabase
      .from("cash_expenses")
      .select("expense_date, amount, concept, category")
      .gte("expense_date", pyFirst)
      .lte("expense_date", pyLastStr);
    setPrevYearOpExpenses((pyOpData as any[]) || []);

    const { data: pyOrders } = await supabase
      .from("orders")
      .select("created_at, order_items(kilos, price, sale_type, quantity, is_fixed_price_piece)")
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

    // Cargar total de redondeo (para donación) — con filtro de fecha
    let roundQ = supabase
      .from("cash_movements")
      .select("rounding_amount")
      .gt("rounding_amount", 0);
    if (dateFrom) roundQ = roundQ.gte("created_at", `${dateFrom}T00:00:00`);
    if (dateTo) roundQ = roundQ.lte("created_at", `${dateTo}T23:59:59`);
    const { data: roundingData } = await roundQ;

    if (roundingData) {
      const totalRounding = roundingData.reduce((acc: number, r: { rounding_amount: number }) => acc + Number(r.rounding_amount || 0), 0);
      setRoundingTotal(totalRounding);
      setRoundingCount(roundingData.length);
    }

    // Cargar cash_movements del rango para conciliación
    let cmQ = supabase
      .from("cash_movements")
      .select("amount, type, is_cancelled, payment_method")
      .eq("is_cancelled", false);
    if (dateFrom) cmQ = cmQ.gte("created_at", `${dateFrom}T00:00:00`);
    if (dateTo) cmQ = cmQ.lte("created_at", `${dateTo}T23:59:59`);
    const { data: cmData } = await cmQ;
    setCashMovements((cmData as any[]) || []);

    // Load market prices
    try {
      const mpRes = await fetch("/api/admin/market-prices");
      if (mpRes.ok) {
        const mpData = await mpRes.json();
        setMarketPrices(mpData.prices || []);
      }
    } catch { /* ignore */ }

    } catch (err) {
      console.log("Dashboard load error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function refreshMarketPrices() {
    setMarketLoading(true);
    setMarketRefreshResult("");
    try {
      const secret = getAdminSecret();
      const res = await fetch("/api/admin/market-prices/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMarketRefreshResult(`Listo: ${data.updated} productos actualizados de ${data.scraped_total} precios encontrados`);
        // Reload prices
        const mpRes = await fetch("/api/admin/market-prices");
        if (mpRes.ok) {
          const mpData = await mpRes.json();
          setMarketPrices(mpData.prices || []);
        }
      } else {
        setMarketRefreshResult(data.error || "Error al actualizar");
      }
    } catch {
      setMarketRefreshResult("Error de conexión");
    }
    setMarketLoading(false);
  }

  // itemSubtotal viene de @/lib/itemSubtotal (canonico)
  const itemSubtotal = itemSubtotalLib;

  function orderTotal(order: Order) {
    return (order.order_items || []).reduce((acc, item) => {
      return acc + itemSubtotal(item);
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

  // Ventas históricas (de daily_summaries, sin duplicar con orders del mismo día)
  const historicalSales = useMemo(() => {
    // Obtener fechas que ya tienen orders del sistema para no duplicar
    const orderDates = new Set(
      orders.map((o) => o.created_at ? o.created_at.slice(0, 10) : "")
    );
    return historicalDays
      .filter((d) => !orderDates.has(d.date))
      .reduce((acc, d) => acc + Number(d.venta || 0), 0);
  }, [historicalDays, orders]);

  const historicalDaysCount = useMemo(() => {
    const orderDates = new Set(
      orders.map((o) => o.created_at ? o.created_at.slice(0, 10) : "")
    );
    return historicalDays.filter((d) => !orderDates.has(d.date)).length;
  }, [historicalDays, orders]);

  const ordersSales = useMemo(
    () => orders.reduce((acc, order) => acc + orderTotal(order), 0),
    [orders]
  );

  const totalSales = ordersSales + historicalSales;

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

  const salesThisMonth = useMemo(() => {
    const ordersMonthSales = orders.reduce((acc, order) => {
      if (!order.created_at) return acc;
      const d = new Date(order.created_at);
      return isSameMonth(d, now) ? acc + orderTotal(order) : acc;
    }, 0);
    const orderDates = new Set(
      orders.map((o) => o.created_at ? o.created_at.slice(0, 10) : "")
    );
    const histMonthSales = historicalDays
      .filter((d) => {
        const dt = new Date(d.date + "T12:00:00");
        return isSameMonth(dt, now) && !orderDates.has(d.date);
      })
      .reduce((acc, d) => acc + Number(d.venta || 0), 0);
    return ordersMonthSales + histMonthSales;
  }, [orders, historicalDays]);

  const salesThisYear = useMemo(() => {
    const ordersYearSales = orders.reduce((acc, order) => {
      if (!order.created_at) return acc;
      const d = new Date(order.created_at);
      return isSameYear(d, now) ? acc + orderTotal(order) : acc;
    }, 0);
    // Sumar históricos del mismo año sin duplicar
    const orderDates = new Set(
      orders.map((o) => o.created_at ? o.created_at.slice(0, 10) : "")
    );
    const histYearSales = historicalDays
      .filter((d) => {
        const dYear = new Date(d.date + "T12:00:00").getFullYear();
        return dYear === now.getFullYear() && !orderDates.has(d.date);
      })
      .reduce((acc, d) => acc + Number(d.venta || 0), 0);
    return ordersYearSales + histYearSales;
  }, [orders, historicalDays]);

  // ─── Conciliación Ventas vs Cobros ───────────────────────
  const conciliacion = useMemo(() => {
    const activeOrders = orders.filter((o) => o.status !== "cancelado");
    const cancelledOrders = orders.filter((o) => o.status === "cancelado");

    // ── LADO PEDIDOS ──
    const ventasBruto = activeOrders.reduce((acc, o) => acc + orderTotal(o), 0);
    const totalDescuentos = activeOrders.reduce((acc, o) => acc + Number(o.discount_amount || 0), 0);
    const ventasNetas = ventasBruto - totalDescuentos;

    // Estado de los pedidos
    const cobrados = activeOrders.filter((o) => o.status !== "pendiente" && o.payment_method !== "credito");
    const pendientes = activeOrders.filter((o) => o.status === "pendiente");
    const aCredito = activeOrders.filter((o) => o.payment_method === "credito");

    const totalCobrados = cobrados.reduce((acc, o) => acc + orderTotal(o) - Number(o.discount_amount || 0), 0);
    const totalPendientes = pendientes.reduce((acc, o) => acc + orderTotal(o), 0);
    const totalCredito = aCredito.reduce((acc, o) => acc + orderTotal(o) - Number(o.discount_amount || 0), 0);
    const totalCancelado = cancelledOrders.reduce((acc, o) => acc + orderTotal(o), 0);

    // ── LADO CAJA ──
    const cobradoTickets = cashMovements.filter((m) => m.type === "venta").reduce((acc, m) => acc + Number(m.amount || 0), 0);
    const abonosCxc = cashMovements.filter((m) => m.type === "cxc_pago").reduce((acc, m) => acc + Number(m.amount || 0), 0);
    const totalCaja = cobradoTickets + abonosCxc;

    // Desglose por método de pago
    const porMetodo: Record<string, number> = {};
    cashMovements.filter((m) => m.type === "venta").forEach((m) => {
      const key = m.payment_method || "efectivo";
      porMetodo[key] = (porMetodo[key] || 0) + Number(m.amount || 0);
    });

    // Ajuste = diferencia entre lo cobrado por tickets y lo que calculan los pedidos cobrados
    // Esto incluye: redondeo, ajustes de peso al cobrar, diferencias normales
    const ajuste = cobradoTickets - totalCobrados;

    return {
      ventasBruto, totalDescuentos, ventasNetas,
      totalCobrados, cobradosCount: cobrados.length,
      totalPendientes, pendientesCount: pendientes.length,
      totalCredito, creditCount: aCredito.length,
      totalCancelado, cancelledCount: cancelledOrders.length,
      cobradoTickets, abonosCxc, totalCaja, porMetodo, ajuste,
    };
  }, [orders, cashMovements]);

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
        acc + (o.order_items || []).reduce((s: number, i: any) => s + itemSubtotal(i), 0), 0);

    const currentSales = salesThisMonth;
    // Gastos externos = owner_expenses + PAGOS a proveedores del mes (base efectivo)
    // Solo cuenta lo que YA SE PAGÓ, no lo comprado a crédito.
    // Las compras a proveedores SÍ se siguen contando en el PE (base devengado).
    const currentOwnerExpRaw = ownerExpenses.reduce((s, e) => s + Number(e.amount), 0);
    const currentSupplierPayments = supplierPaymentsMes.reduce(
      (s, p) => s + Number(p.amount || 0),
      0
    );
    const currentOwnerExp = currentOwnerExpRaw + currentSupplierPayments;
    // Excluir préstamos: dinero prestado a terceros no es gasto del negocio (será devuelto)
    const currentOpExp = opExpenses
      .filter((e) => e.category !== "prestamos")
      .reduce((s, e) => s + Number(e.amount), 0);
    const currentPrestamos = opExpenses
      .filter((e) => e.category === "prestamos")
      .reduce((s, e) => s + Number(e.amount), 0);
    const currentExpenses = currentOwnerExp + currentOpExp;
    const currentUtility = currentSales - currentExpenses;
    const currentMargin = currentSales > 0 ? (currentUtility / currentSales) * 100 : 0;

    const prevMSales = calcOrdersTotal(prevMonthOrders);
    const prevMOwnerExp = prevMonthExpenses.reduce((s, e) => s + Number(e.amount), 0);
    const prevMOpExp = prevMonthOpExpenses
      .filter((e) => e.category !== "prestamos")
      .reduce((s, e) => s + Number(e.amount), 0);
    const prevMExpenses = prevMOwnerExp + prevMOpExp;
    const prevMUtility = prevMSales - prevMExpenses;
    const prevMMargin = prevMSales > 0 ? (prevMUtility / prevMSales) * 100 : 0;

    const prevYSales = calcOrdersTotal(prevYearOrders);
    const prevYOwnerExp = prevYearExpenses.reduce((s, e) => s + Number(e.amount), 0);
    const prevYOpExp = prevYearOpExpenses
      .filter((e) => e.category !== "prestamos")
      .reduce((s, e) => s + Number(e.amount), 0);
    const prevYExpenses = prevYOwnerExp + prevYOpExp;
    const prevYUtility = prevYSales - prevYExpenses;
    const prevYMargin = prevYSales > 0 ? (prevYUtility / prevYSales) * 100 : 0;

    // CxC
    const totalCxC = cxcNotes.reduce((s, n) => s + Number(n.balance_due || 0), 0);
    const cxcCount = cxcNotes.length;
    const cxcVencidas = cxcNotes.filter((n) => n.due_date && new Date(n.due_date) < new Date()).length;
    // (variable currentPrestamos disponible para mostrar en panel separado)

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

    // ─── PUNTO DE EQUILIBRIO ───
    // Costos VARIABLES: dependen del volumen de ventas (materia prima, insumos, animales)
    // Costos FIJOS: existen aunque no haya ventas (sueldos, renta, servicios)
    const VARIABLE_CATS = new Set(["materia_prima", "proveedor", "insumos"]);
    const currentOpVariable = opExpenses
      .filter((e) => e.category !== "prestamos" && VARIABLE_CATS.has(e.category))
      .reduce((s, e) => s + Number(e.amount), 0);
    const currentOpFijo = opExpenses
      .filter((e) => e.category !== "prestamos" && !VARIABLE_CATS.has(e.category))
      .reduce((s, e) => s + Number(e.amount), 0);
    // Compras a proveedores del mes (animales + cargos) — costos VARIABLES adicionales.
    // NO entran al flujo de caja diario (esos se pagan acumulados).
    const currentLivestockVar = livestockPurchasesMes.reduce(
      (s, p) => s + Number(p.total_cost || p.total_live || 0),
      0
    );
    const currentSupplierVar = supplierExpensesMes.reduce(
      (s, e) => s + Number(e.amount || 0),
      0
    );
    const currentVariableTotal = currentOpVariable + currentLivestockVar + currentSupplierVar;
    // Los gastos del dueño (owner_expenses) son típicamente fijos (renta, sueldo socio, etc.)
    const currentFixedTotal = currentOpFijo + currentOwnerExp;
    // Margen de contribución = (Ventas - Costos Variables) / Ventas
    const contributionMargin = currentSales > 0 ? (currentSales - currentVariableTotal) / currentSales : 0;
    // Punto de equilibrio en pesos: Costos Fijos / Margen de contribución
    const breakEvenSales = contributionMargin > 0 ? currentFixedTotal / contributionMargin : 0;
    // % alcanzado del PE en lo que va del mes
    const breakEvenPct = breakEvenSales > 0 ? (currentSales / breakEvenSales) * 100 : 0;
    // Falta para alcanzar PE (si aplica)
    const breakEvenGap = Math.max(0, breakEvenSales - currentSales);

    // Desglose gastos operativos por concepto
    const opByConceptMap: Record<string, number> = {};
    opExpenses.forEach((e) => {
      const key = e.concept || "Sin concepto";
      opByConceptMap[key] = (opByConceptMap[key] || 0) + Number(e.amount);
    });
    const opCategories = Object.entries(opByConceptMap)
      .sort((a, b) => b[1] - a[1])
      .map(([concept, total]) => ({ category: concept, total }));

    // Desglose gastos externos por concepto (owner + pagos hechos a proveedores)
    const externalByConceptMap: Record<string, number> = {};
    ownerExpenses.forEach((e) => {
      const key = `${e.category || "Otro"} (dueño)`;
      externalByConceptMap[key] = (externalByConceptMap[key] || 0) + Number(e.amount);
    });
    // Agrupar pagos por proveedor
    const paymentsBySupplier: Record<string, number> = {};
    supplierPaymentsMes.forEach((p) => {
      const supplier = supplierNameMap[p.supplier_id] || `Proveedor desconocido`;
      paymentsBySupplier[supplier] = (paymentsBySupplier[supplier] || 0) + Number(p.amount || 0);
    });
    Object.entries(paymentsBySupplier).forEach(([supplier, total]) => {
      externalByConceptMap[`Pago a ${supplier}`] = total;
    });
    const externalCategories = Object.entries(externalByConceptMap)
      .sort((a, b) => b[1] - a[1])
      .map(([category, total]) => ({ category, total }));

    return {
      current: { sales: currentSales, expenses: currentExpenses, ownerExp: currentOwnerExp, opExp: currentOpExp, utility: currentUtility, margin: currentMargin, label: monthNames[cm.getMonth()] },
      prevMonth: { sales: prevMSales, expenses: prevMExpenses, utility: prevMUtility, margin: prevMMargin, label: monthNames[pm.getMonth()] },
      prevYear: { sales: prevYSales, expenses: prevYExpenses, utility: prevYUtility, margin: prevYMargin, label: `${monthNames[py.getMonth()]} ${py.getFullYear()}` },
      cxc: { total: totalCxC, count: cxcCount, vencidas: cxcVencidas },
      debt: { total: totalDebt, count: supplierDebt.length },
      categories,
      opCategories,
      externalCategories,
      breakEven: {
        variableCost: currentVariableTotal,
        variableBreakdown: {
          gastos: currentOpVariable,
          animales: currentLivestockVar,
          proveedores: currentSupplierVar,
        },
        fixedCost: currentFixedTotal,
        contributionMargin: contributionMargin * 100,
        targetSales: breakEvenSales,
        currentSales,
        pctAchieved: breakEvenPct,
        gap: breakEvenGap,
      },
    };
  }, [salesThisMonth, ownerExpenses, opExpenses, livestockPurchasesMes, supplierExpensesMes, supplierPaymentsMes, supplierNameMap, prevMonthOrders, prevMonthExpenses, prevMonthOpExpenses, prevYearOrders, prevYearExpenses, prevYearOpExpenses, cxcNotes, supplierDebt]);

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
    // Solo contar pedidos YA VENDIDOS (terminado / entregado).
    // Excluir nuevo/proceso/pendiente para no inflar ranking con cosas no cobradas.
    const validStatuses = new Set(["terminado", "entregado"]);
    for (const order of orders) {
      if (!validStatuses.has((order.status || "").toLowerCase())) continue;
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
        const esPieza = item.sale_type === "pieza" || !!item.is_fixed_price_piece;
        if (!totals[key]) {
          totals[key] = { product: key, revenue: 0, kilos: 0, piezas: 0, times: 0, isPieza: esPieza };
        }
        totals[key].revenue += itemSubtotal(item);
        if (esPieza) {
          totals[key].piezas += Number(item.quantity || 1);
        } else {
          totals[key].kilos += Number(item.kilos || 0);
        }
        totals[key].times += 1;
      }
    }

    return Object.values(totals).sort((a, b) => b.revenue - a.revenue);
  }, [orders]);

  const filteredProductStats = useMemo(() => {
    if (!productSearch.trim()) return productStats;
    const q = productSearch.toLowerCase().trim();
    return productStats.filter(p => p.product.toLowerCase().includes(q));
  }, [productStats, productSearch]);

  const bottomProducts = useMemo(() => {
    return [...productStats].sort((a, b) => a.revenue - b.revenue).slice(0, 20);
  }, [productStats]);

  // ─── COMPARATIVA KG POR TIPO DE CARNE (RES/CERDO/POLLO) ───
  // Helper: clasificar nombre de producto + categoria del catalogo a tipo de carne
  function classifyMeatType(productName: string, productCategory: string): string | null {
    const n = (productName || "").toLowerCase();
    const c = (productCategory || "").toLowerCase();

    // 1. Por categoria del producto (admin/productos)
    if (c === "res") return "Res";
    if (c === "cerdo") return "Cerdo";
    if (c === "pollo") return "Pollo";

    // 2. Por keywords explicitas
    if (n.includes("cerdo") || n.includes("puerco")) return "Cerdo";
    if (n.includes("pollo")) return "Pollo";

    // 3. Productos de cerdo identificables
    const cerdoNames = ["chuleta", "tocino", "chicharron", "chorizo argentino", "chorizo español", "chorizo ranchero", "chistorra", "longaniza", "peperoni", "boston but", "pork belly", "espinazo", "panza", "codillo", "buche", "cuero de cerdo", "manteca", "pierna de cerdo", "pata de cerdo", "lonja", "sesos de puerco"];
    if (cerdoNames.some((k) => n.includes(k))) return "Cerdo";

    // 4. Productos de res identificables (cortes y cortes premium)
    const resNames = ["bistec", "arrachera", "molida", "costilla", "rib eye", "tomahawk", "picaña", "new york", "t-bone", "porterhouse", "filete", "medallon", "brisket", "tampiqueña", "discada", "diezmillo", "agua", "aguja", "barbacoa", "birria", "cabeza", "carrillera", "carne para barbacoa", "cecina", "centro de bola", "chambarete", "chamorro", "chuletón", "chuletón", "cowboy", "cuero de res", "falda de res", "flap meat", "hamburguesa", "higado de res", "hueso", "huesos", "lengua", "lomo", "maciza", "milanesa", "molleja", "menudos", "pastor", "pata", "pecho", "pellejos", "pescuezo", "riñones", "roast beef", "sirloin", "suadero", "tartara", "tripa", "tuétano", "tuetano", "medula", "médula", "res en pie", "canal de res", "cochinita", "chunks"];
    if (resNames.some((k) => n.includes(k))) return "Res";

    return null; // No clasificable (complementos, etc)
  }

  const mermaStats = useMemo(() => {
    // Entradas por tipo de carne (Res, Cerdo, Pollo, Otro)
    const entradasByType: Record<string, { kg: number; cost: number; count: number }> = {};
    supplierExpensesMes.forEach((e) => {
      if (!e.is_raw_material || !e.kg || !e.product_category) return;
      const tipo = e.product_category;
      if (!entradasByType[tipo]) entradasByType[tipo] = { kg: 0, cost: 0, count: 0 };
      entradasByType[tipo].kg += Number(e.kg || 0);
      entradasByType[tipo].cost += Number(e.amount || 0);
      entradasByType[tipo].count += 1;
    });

    // Salidas por tipo de carne — solo kilos (no piezas)
    const salidasByType: Record<string, { kg: number; revenue: number }> = {};
    productStats.forEach((p) => {
      if (p.isPieza) return;
      const tipo = classifyMeatType(p.product, productsMap[p.product] || "");
      if (!tipo) return;
      if (!salidasByType[tipo]) salidasByType[tipo] = { kg: 0, revenue: 0 };
      salidasByType[tipo].kg += Number(p.kilos || 0);
      salidasByType[tipo].revenue += Number(p.revenue || 0);
    });

    const allTypes = new Set<string>([
      ...Object.keys(entradasByType),
      ...Object.keys(salidasByType),
    ]);

    // Orden fijo: Res, Cerdo, Pollo, Otro
    const order = ["Res", "Cerdo", "Pollo", "Otro"];
    const sorted = Array.from(allTypes).sort((a, b) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });

    const rows = sorted.map((tipo) => {
      const ent = entradasByType[tipo] || { kg: 0, cost: 0, count: 0 };
      const sal = salidasByType[tipo] || { kg: 0, revenue: 0 };
      const merma_kg = ent.kg - sal.kg;
      const merma_pct = ent.kg > 0 ? (merma_kg / ent.kg) * 100 : 0;
      return {
        cat: tipo,
        entradas_kg: ent.kg,
        entradas_cost: ent.cost,
        entradas_count: ent.count,
        salidas_kg: sal.kg,
        salidas_revenue: sal.revenue,
        merma_kg,
        merma_pct,
      };
    });

    const totalEntradas = rows.reduce((s, r) => s + r.entradas_kg, 0);
    const totalSalidas = rows.reduce((s, r) => s + r.salidas_kg, 0);
    const totalCost = rows.reduce((s, r) => s + r.entradas_cost, 0);
    const totalRevenue = rows.reduce((s, r) => s + r.salidas_revenue, 0);

    return { rows, totalEntradas, totalSalidas, totalCost, totalRevenue };
  }, [supplierExpensesMes, productStats, productsMap]);

  // Detalle de ventas individuales para el producto expandido
  const expandedProductSales = useMemo(() => {
    if (!expandedProduct) return [];
    const rows: {
      orderId: string;
      created_at: string | null;
      customer: string;
      cashier: string;
      butcher: string;
      qty: string;
      subtotal: number;
    }[] = [];
    for (const order of orders) {
      for (const item of order.order_items || []) {
        if (item.product !== expandedProduct) continue;
        const esPieza = item.sale_type === "pieza" || !!item.is_fixed_price_piece;
        const qtyText = esPieza
          ? `${Number(item.quantity || 1)} pza${Number(item.quantity || 1) === 1 ? "" : "s"}`
          : `${Number(item.kilos || 0).toFixed(3)} kg`;
        rows.push({
          orderId: order.id,
          created_at: order.created_at || null,
          customer: order.customer_name || "Mostrador",
          cashier: order.captured_by || "—",
          butcher: order.butcher_name || "—",
          qty: qtyText,
          subtotal: itemSubtotal(item),
        });
      }
    }
    // Ordenar por fecha descendente (más reciente primero)
    rows.sort((a, b) => {
      const da = a.created_at ? new Date(a.created_at).getTime() : 0;
      const db = b.created_at ? new Date(b.created_at).getTime() : 0;
      return db - da;
    });
    return rows;
  }, [expandedProduct, orders]);

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
  function setWeekFilter() {
    const t = new Date();
    const day = t.getDay();
    const diff = day === 0 ? 6 : day - 1; // lunes
    const monday = new Date(t.getFullYear(), t.getMonth(), t.getDate() - diff);
    setDateFrom(toDateInputValue(monday));
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

  function exportUtilitiesPDF() {
    const u = utilityStats;
    const catLabels: Record<string, string> = {
      compras_ganado: "Compras ganado", pagos_proveedores: "Pagos proveedores", renta: "Renta",
      gas: "Gas", insumos: "Insumos", vehiculos: "Vehículos", publicidad: "Publicidad",
      servicios: "Servicios", sueldos_extra: "Sueldos extra", otros: "Otros",
    };

    const cxcRows = cxcNotes.map(n =>
      `<tr><td>${n.customer_name}</td><td style="text-align:right;font-weight:700">$${fmt(n.balance_due)}</td><td style="text-align:center">${n.due_date || "—"}</td></tr>`
    ).join("");

    const debtRows = supplierDebt.map(s =>
      `<tr><td>${s.name}</td><td style="text-align:right;font-weight:700;color:#b42318">$${fmt(s.debt)}</td></tr>`
    ).join("");

    const catRows = u.categories.map(c => {
      const pct = u.current.expenses > 0 ? ((c.total / u.current.expenses) * 100).toFixed(1) : "0";
      return `<tr><td>${catLabels[c.category] || c.category}</td><td style="text-align:right">$${fmt(c.total)}</td><td style="text-align:right">${pct}%</td></tr>`;
    }).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Reporte ${u.current.label} ${new Date().getFullYear()}</title>
<style>
  @page{size:letter;margin:15mm}
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,sans-serif;font-size:12px;color:#333;padding:10mm}
  h1{font-size:20px;color:#7b2218;margin-bottom:4px}
  h2{font-size:14px;color:#7b2218;margin:16px 0 8px;border-bottom:2px solid #7b2218;padding-bottom:4px}
  .subtitle{color:#666;font-size:12px;margin-bottom:16px}
  .grid{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;margin-bottom:16px}
  .card{background:#f9f5ef;border:1px solid #ddd;border-radius:8px;padding:10px}
  .card .label{font-size:10px;color:#666;text-transform:uppercase}
  .card .value{font-size:18px;font-weight:900;margin-top:2px}
  .green{color:#1f7a4d} .red{color:#b42318} .orange{color:#a66a10}
  table{width:100%;border-collapse:collapse;margin-bottom:12px}
  th{text-align:left;font-size:10px;color:#666;border-bottom:2px solid #ddd;padding:4px 6px}
  td{padding:4px 6px;border-bottom:1px solid #eee;font-size:11px}
  .comp-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px}
  .comp{background:#f9f5ef;border:1px solid #ddd;border-radius:8px;padding:10px}
  .comp .title{font-size:11px;font-weight:700;color:#666;margin-bottom:6px}
  .balance{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;text-align:center;background:#f9f5ef;border:1px solid #ddd;border-radius:8px;padding:12px;margin-bottom:16px}
  .balance .label{font-size:10px;color:#666}
  .balance .val{font-size:16px;font-weight:900}
  .footer{text-align:center;font-size:9px;color:#999;margin-top:20px;border-top:1px solid #ddd;padding-top:8px}
</style></head><body>
  <h1>Sergio's Carnicer\u00eda - Reporte de Utilidades</h1>
  <div class="subtitle">${u.current.label} ${new Date().getFullYear()} - Generado el ${new Date().toLocaleDateString("es-MX")}</div>

  <div class="grid">
    <div class="card"><div class="label">Ventas del mes</div><div class="value green">$${fmt(u.current.sales)}</div></div>
    <div class="card"><div class="label">Gastos operación</div><div class="value red">$${fmt(u.current.opExp)}</div></div>
    <div class="card"><div class="label">Gastos externos</div><div class="value red">$${fmt(u.current.ownerExp)}</div></div>
    <div class="card"><div class="label">Total gastos</div><div class="value red">$${fmt(u.current.expenses)}</div></div>
    <div class="card"><div class="label">Utilidad</div><div class="value ${u.current.utility >= 0 ? "green" : "red"}">$${fmt(u.current.utility)}</div></div>
    <div class="card"><div class="label">Margen EBITDA</div><div class="value ${u.current.margin >= 10 ? "green" : "orange"}">${u.current.margin.toFixed(1)}%</div></div>
  </div>

  <h2>Comparativas</h2>
  <div class="comp-grid">
    <div class="comp">
      <div class="title">vs ${u.prevMonth.label} (mes anterior)</div>
      <table>
        <tr><td>Ventas</td><td style="text-align:right;font-weight:700">$${fmt(u.prevMonth.sales)}</td></tr>
        <tr><td>Utilidad</td><td style="text-align:right;font-weight:700" class="${u.prevMonth.utility >= 0 ? "green" : "red"}">$${fmt(u.prevMonth.utility)}</td></tr>
        <tr><td>Margen</td><td style="text-align:right">${u.prevMonth.margin.toFixed(1)}%</td></tr>
        ${u.prevMonth.sales > 0 ? `<tr><td>Cambio ventas</td><td style="text-align:right;font-weight:700" class="${u.current.sales >= u.prevMonth.sales ? "green" : "red"}">${u.current.sales >= u.prevMonth.sales ? "▲" : "▼"} ${Math.abs(((u.current.sales - u.prevMonth.sales) / u.prevMonth.sales) * 100).toFixed(1)}%</td></tr>` : ""}
      </table>
    </div>
    <div class="comp">
      <div class="title">vs ${u.prevYear.label}</div>
      <table>
        <tr><td>Ventas</td><td style="text-align:right;font-weight:700">$${fmt(u.prevYear.sales)}</td></tr>
        <tr><td>Utilidad</td><td style="text-align:right;font-weight:700" class="${u.prevYear.utility >= 0 ? "green" : "red"}">$${fmt(u.prevYear.utility)}</td></tr>
        <tr><td>Margen</td><td style="text-align:right">${u.prevYear.margin.toFixed(1)}%</td></tr>
        ${u.prevYear.sales > 0 ? `<tr><td>Cambio ventas</td><td style="text-align:right;font-weight:700" class="${u.current.sales >= u.prevYear.sales ? "green" : "red"}">${u.current.sales >= u.prevYear.sales ? "▲" : "▼"} ${Math.abs(((u.current.sales - u.prevYear.sales) / u.prevYear.sales) * 100).toFixed(1)}%</td></tr>` : ""}
      </table>
    </div>
  </div>

  <h2>Balance: Me deben vs Yo debo</h2>
  <div class="balance">
    <div><div class="label">Me deben (CxC)</div><div class="val green">$${fmt(u.cxc.total)}</div></div>
    <div><div class="label">Yo debo (Proveedores)</div><div class="val red">$${fmt(u.debt.total)}</div></div>
    <div><div class="label">Balance neto</div><div class="val ${(u.cxc.total - u.debt.total) >= 0 ? "green" : "red"}">$${fmt(u.cxc.total - u.debt.total)}</div></div>
  </div>

  ${cxcNotes.length > 0 ? `
  <h2>Cuentas por cobrar (${u.cxc.count} notas${u.cxc.vencidas > 0 ? `, ${u.cxc.vencidas} vencidas` : ""})</h2>
  <table><thead><tr><th>Cliente</th><th style="text-align:right">Saldo</th><th style="text-align:center">Vence</th></tr></thead><tbody>${cxcRows}</tbody></table>
  ` : ""}

  ${supplierDebt.length > 0 ? `
  <h2>Deuda a proveedores (${u.debt.count})</h2>
  <table><thead><tr><th>Proveedor</th><th style="text-align:right">Saldo</th></tr></thead><tbody>${debtRows}</tbody></table>
  ` : ""}

  ${u.categories.length > 0 ? `
  <h2>Desglose gastos externos</h2>
  <table><thead><tr><th>Categoría</th><th style="text-align:right">Monto</th><th style="text-align:right">%</th></tr></thead><tbody>${catRows}</tbody></table>
  ` : ""}

  <div class="footer">Sergio's Carnicer\u00eda - sergioscarniceria.com - Reporte generado autom\u00e1ticamente</div>
</body></html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (win) {
      win.onload = () => {
        setTimeout(() => win.print(), 300);
      };
    }
  }

  if (loading) {
    return (
      <div style={loadingPageStyle}>
        <div style={loadingCardStyle}>Cargando dashboard...</div>
      </div>
    );
  }

  function toggleSection(key: string) {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function Section({ id, title, count, danger, children }: { id: string; title: string; count?: number; danger?: boolean; children: React.ReactNode }) {
    const isOpen = openSections[id] || false;
    return (
      <div style={{ ...panelStyle, marginTop: 20, ...(danger ? { borderLeft: `4px solid ${COLORS.danger}` } : {}) }}>
        <button
          onClick={() => toggleSection(id)}
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}
        >
          <h2 style={{ ...panelTitleStyle, margin: 0, color: danger ? COLORS.danger : COLORS.text }}>
            {title}{count !== undefined ? ` (${count})` : ""}
          </h2>
          <span style={{ fontSize: 18, color: COLORS.muted, transition: "transform 0.2s", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
            ▼
          </span>
        </button>
        {isOpen && <div style={{ marginTop: 14 }}>{children}</div>}
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

        {/* ─── Panel de Utilidades (arriba, expandible) ─── */}
        {showUtilities && (
        <div style={panelStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
            <div>
              <h2 style={panelTitleStyle}>Utilidades del Mes</h2>
              <p style={{ fontSize: 13, color: COLORS.muted, margin: 0 }}>Resumen financiero — {utilityStats.current.label} {new Date().getFullYear()}</p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={exportUtilitiesPDF}
                style={{ padding: "8px 16px", borderRadius: 14, border: "none", background: `linear-gradient(180deg, ${COLORS.primary} 0%, ${COLORS.primaryDark} 100%)`, color: "white", fontWeight: 700, cursor: "pointer", fontSize: 13 }}
              >
                Exportar PDF
              </button>
              <Link href="/admin/gastos" style={{ padding: "8px 16px", borderRadius: 14, border: `1px solid ${COLORS.border}`, background: "rgba(255,255,255,0.75)", color: COLORS.text, fontWeight: 700, cursor: "pointer", fontSize: 13, textDecoration: "none" }}>
                Registrar gastos
              </Link>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 16 }}>
            <div style={heroCardStyle}>
              <div style={smallLabelStyle}>Ventas del mes</div>
              <div style={{ ...heroValueStyle, color: COLORS.success }}>${fmt(utilityStats.current.sales)}</div>
            </div>
            <div style={heroCardStyle}>
              <div style={smallLabelStyle}>Gastos operación</div>
              <div style={{ ...heroValueStyle, color: COLORS.danger }}>${fmt(utilityStats.current.opExp)}</div>
            </div>
            <div style={heroCardStyle}>
              <div style={smallLabelStyle}>Gastos externos</div>
              <div style={{ ...heroValueStyle, color: COLORS.danger }}>${fmt(utilityStats.current.ownerExp)}</div>
            </div>
            <div style={heroCardStyle}>
              <div style={smallLabelStyle}>Total gastos</div>
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

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
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

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12, marginBottom: 12 }}>
            <div style={{ background: "rgba(255,255,255,0.6)", borderRadius: 16, padding: 14, border: `1px solid ${COLORS.border}` }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, marginBottom: 8 }}>Lo que me deben (CxC)</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: COLORS.warning, marginBottom: 4 }}>${fmt(utilityStats.cxc.total)}</div>
              <div style={{ fontSize: 12, color: COLORS.muted }}>
                {utilityStats.cxc.count} notas abiertas
                {utilityStats.cxc.vencidas > 0 && <span style={{ color: COLORS.danger, fontWeight: 700 }}> — {utilityStats.cxc.vencidas} vencidas</span>}
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
            <div style={{ background: "rgba(255,255,255,0.6)", borderRadius: 16, padding: 14, border: `1px solid ${COLORS.border}` }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, marginBottom: 8 }}>Desglose gastos externos</div>
              {utilityStats.externalCategories.length === 0 ? (
                <div style={{ fontSize: 13, color: COLORS.muted, padding: 10 }}>Sin gastos registrados este mes</div>
              ) : (
                utilityStats.externalCategories.map((cat, i) => {
                  const catLabels: Record<string, string> = {
                    compras_ganado: "Compras ganado", pagos_proveedores: "Pagos proveedores", renta: "Renta",
                    gas: "Gas", insumos: "Insumos", vehiculos: "Vehículos", publicidad: "Publicidad",
                    servicios: "Servicios", sueldos_extra: "Sueldos extra", otros: "Otros",
                  };
                  const pct = utilityStats.current.ownerExp > 0 ? (cat.total / utilityStats.current.ownerExp) * 100 : 0;
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
              <div style={{ fontSize: 12, fontWeight: 800, color: COLORS.danger, textAlign: "right", marginTop: 4 }}>Total: ${fmt(utilityStats.current.ownerExp)}</div>
            </div>
            <div style={{ background: "rgba(255,255,255,0.6)", borderRadius: 16, padding: 14, border: `1px solid ${COLORS.border}` }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, marginBottom: 8 }}>Gastos de operación (caja)</div>
              {utilityStats.opCategories.length === 0 ? (
                <div style={{ fontSize: 13, color: COLORS.muted, padding: 10 }}>Sin gastos de operación este mes</div>
              ) : (
                utilityStats.opCategories.map((cat, i) => {
                  const pct = utilityStats.current.opExp > 0 ? (cat.total / utilityStats.current.opExp) * 100 : 0;
                  return (
                    <div key={i} style={{ marginBottom: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 2 }}>
                        <span style={{ color: COLORS.text, fontWeight: 600 }}>{cat.category}</span>
                        <span style={{ fontWeight: 700, color: COLORS.text }}>${fmt(cat.total)} ({pct.toFixed(0)}%)</span>
                      </div>
                      <div style={{ height: 6, background: "#eee", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: COLORS.warning, borderRadius: 3 }} />
                      </div>
                    </div>
                  );
                })
              )}
              <div style={{ fontSize: 12, fontWeight: 800, color: COLORS.danger, textAlign: "right", marginTop: 4 }}>Total: ${fmt(utilityStats.current.opExp)}</div>
            </div>
          </div>

          <div style={{ background: "rgba(255,255,255,0.6)", borderRadius: 16, padding: 14, border: `1px solid ${COLORS.border}`, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, textAlign: "center" }}>
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
        </div>
        )}

        {/* ═══ Panel Punto de Equilibrio ═══ */}
        <div style={{ ...panelStyle, marginTop: 20 }}>
          <h2 style={panelTitleStyle}>🎯 Punto de equilibrio del mes</h2>
          <p style={{ fontSize: 13, color: COLORS.muted, margin: "4px 0 16px" }}>
            Cuánto necesitas vender en {utilityStats.current.label} para cubrir todos los costos (no perder, no ganar)
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 16 }}>
            <div style={{ background: "rgba(180,35,24,0.08)", borderRadius: 14, padding: 14, border: `1px solid rgba(180,35,24,0.18)` }}>
              <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 6 }}>Necesitas vender</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: COLORS.danger }}>${fmt(utilityStats.breakEven.targetSales)}</div>
              <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>en el mes para no perder</div>
            </div>
            <div style={{ background: "rgba(31,122,77,0.08)", borderRadius: 14, padding: 14, border: `1px solid rgba(31,122,77,0.18)` }}>
              <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 6 }}>Ya vendiste</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: COLORS.success }}>${fmt(utilityStats.breakEven.currentSales)}</div>
              <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>en lo que va del mes</div>
            </div>
            <div style={{ background: utilityStats.breakEven.gap > 0 ? "rgba(166,106,16,0.08)" : "rgba(31,122,77,0.12)", borderRadius: 14, padding: 14, border: `1px solid ${utilityStats.breakEven.gap > 0 ? "rgba(166,106,16,0.25)" : "rgba(31,122,77,0.25)"}` }}>
              <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 6 }}>{utilityStats.breakEven.gap > 0 ? "Te falta vender" : "Ya pasaste el PE"}</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: utilityStats.breakEven.gap > 0 ? COLORS.warning : COLORS.success }}>${fmt(utilityStats.breakEven.gap)}</div>
              <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>{utilityStats.breakEven.gap > 0 ? "para llegar al equilibrio" : "todo lo demás es ganancia"}</div>
            </div>
            <div style={{ background: "rgba(53,92,125,0.08)", borderRadius: 14, padding: 14, border: `1px solid rgba(53,92,125,0.18)` }}>
              <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 6 }}>Progreso</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: utilityStats.breakEven.pctAchieved >= 100 ? COLORS.success : COLORS.info }}>{utilityStats.breakEven.pctAchieved.toFixed(0)}%</div>
              <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>del punto de equilibrio</div>
            </div>
          </div>

          {/* Barra de progreso */}
          <div style={{ height: 12, background: "rgba(0,0,0,0.06)", borderRadius: 6, overflow: "hidden", marginBottom: 12 }}>
            <div style={{
              width: `${Math.min(100, utilityStats.breakEven.pctAchieved)}%`,
              height: "100%",
              background: utilityStats.breakEven.pctAchieved >= 100 ? COLORS.success : COLORS.warning,
              transition: "width 0.3s ease",
            }} />
          </div>

          {/* Desglose del cálculo */}
          <details style={{ background: COLORS.bgSoft, borderRadius: 12, padding: 12, border: `1px solid ${COLORS.border}` }}>
            <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 700, color: COLORS.text }}>Ver cómo se calcula</summary>
            <div style={{ marginTop: 12, fontSize: 13, color: COLORS.text, lineHeight: 1.7 }}>
              <div><b>Costos fijos del mes</b> (renta, sueldos, servicios, mantenimiento...): <b style={{ color: COLORS.danger }}>${fmt(utilityStats.breakEven.fixedCost)}</b></div>
              <div><b>Costos variables del mes</b>: <b style={{ color: COLORS.danger }}>${fmt(utilityStats.breakEven.variableCost)}</b></div>
              <div style={{ paddingLeft: 16, fontSize: 12, color: COLORS.muted }}>
                · Gastos (materia prima, insumos): ${fmt(utilityStats.breakEven.variableBreakdown.gastos)}<br/>
                · Compras de animales (ganado): ${fmt(utilityStats.breakEven.variableBreakdown.animales)}<br/>
                · Cargos a proveedores (compras CxP): ${fmt(utilityStats.breakEven.variableBreakdown.proveedores)}
              </div>
              <div><b>Margen de contribución</b> (% de cada peso vendido que queda libre): <b>{utilityStats.breakEven.contributionMargin.toFixed(1)}%</b></div>
              <div style={{ marginTop: 8, padding: 10, background: "rgba(255,255,255,0.6)", borderRadius: 8, fontFamily: "monospace", fontSize: 12 }}>
                <div>Punto de equilibrio = Costos Fijos ÷ Margen de contribución</div>
                <div>${fmt(utilityStats.breakEven.targetSales)} = ${fmt(utilityStats.breakEven.fixedCost)} ÷ {(utilityStats.breakEven.contributionMargin / 100).toFixed(3)}</div>
              </div>
              <div style={{ marginTop: 8, color: COLORS.muted, fontSize: 12 }}>
                <b>Clasificación:</b> Materia prima, insumos, compras de animales y cargos a proveedores cuentan como variables. Sueldos, servicios, renta, etc. como fijos. <b>Las compras a proveedores NO afectan tu flujo de caja diario</b> (se pagan con el acumulado del mes).
              </div>
            </div>
          </details>
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
            <div style={smallLabelStyle}>Tickets hoy</div>
            <div style={heroValueStyle}>{ordersToday}</div>
            <div style={heroMetaStyle}>{ordersToday === 1 ? "1 persona" : `${ordersToday} personas`} · ${fmt(salesToday)}</div>
          </div>

          <div style={heroCardStyle}>
            <div style={smallLabelStyle}>Tickets este mes</div>
            <div style={heroValueStyle}>{ordersThisMonth}</div>
            <div style={heroMetaStyle}>{ordersThisMonth} personas · ${fmt(salesThisMonth)}</div>
          </div>

          <div style={heroCardStyle}>
            <div style={smallLabelStyle}>Tickets este año</div>
            <div style={heroValueStyle}>{ordersThisYear}</div>
            <div style={heroMetaStyle}>{ordersThisYear} personas · ${fmt(salesThisYear)}</div>
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
          <Section id="entregas" title="Entregas" count={deliveryStats.total}>
            <div></div>
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
          </Section>
        )}

        {/* ─── Inventario KPIs ─── */}
        <Section id="inventario" title="Inventario">
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
        </Section>

        <Section id="graficas" title="Gráficas de ventas y pedidos">
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
        </Section>

        <Section id="rankings" title="Clientes y carniceros">
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
        </Section>

        <Section id="productos" title="Ventas por producto" count={filteredProductStats.length}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 14, alignItems: "center" }}>
            <button onClick={setTodayFilter} style={{ ...secondaryButtonStyle, padding: "6px 14px", fontSize: 13 }}>Hoy</button>
            <button onClick={setWeekFilter} style={{ ...secondaryButtonStyle, padding: "6px 14px", fontSize: 13 }}>Semana</button>
            <button onClick={setMonthFilter} style={{ ...secondaryButtonStyle, padding: "6px 14px", fontSize: 13 }}>Mes</button>
            <button onClick={setYearFilter} style={{ ...secondaryButtonStyle, padding: "6px 14px", fontSize: 13 }}>Año</button>
            <input
              type="text"
              placeholder="Buscar producto (ej: hielo, birria...)"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              style={{ flex: 1, minWidth: 200, padding: "8px 12px", fontSize: 14, border: `1px solid ${COLORS.border}`, borderRadius: 8, background: COLORS.cardStrong, color: COLORS.text }}
            />
            {productSearch && (
              <button onClick={() => setProductSearch("")} style={{ ...secondaryButtonStyle, padding: "6px 12px", fontSize: 13 }}>Limpiar</button>
            )}
          </div>
          <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 10 }}>
            Rango: {dateFrom || "inicio"} → {dateTo || "hoy"} · {filteredProductStats.length} producto{filteredProductStats.length !== 1 ? "s" : ""}
          </div>

          {filteredProductStats.length === 0 ? (
            <div style={emptyBoxStyle}>{productSearch ? `Sin resultados para "${productSearch}"` : "No hay datos"}</div>
          ) : (
            filteredProductStats.map((product, index) => {
              const isOpen = expandedProduct === product.product;
              return (
                <div key={product.product}>
                  <div
                    style={{ ...productRowStyle, cursor: "pointer" }}
                    onClick={() => setExpandedProduct(isOpen ? null : product.product)}
                  >
                    <div style={{ flex: 2, color: COLORS.text, minWidth: 0 }}>
                      <span style={{ marginRight: 6, color: COLORS.muted, fontSize: 11 }}>
                        {isOpen ? "▼" : "▶"}
                      </span>
                      #{index + 1} <b>{product.product}</b>
                    </div>
                    <div style={{ flex: 1, textAlign: "right", color: COLORS.muted }}>
                      {product.isPieza ? `${fmt(product.piezas)} pzas` : `${fmt(product.kilos)} kg`}
                    </div>
                    <div style={{ flex: 1, textAlign: "right", color: COLORS.muted }}>
                      {product.times} veces
                    </div>
                    <div style={{ flex: 1, textAlign: "right", fontWeight: 700, color: COLORS.text }}>
                      ${fmt(product.revenue)}
                    </div>
                  </div>
                  {isOpen && (
                    <div style={{
                      margin: "0 0 10px 0", padding: 12,
                      background: "rgba(123,34,24,0.04)", borderRadius: 10,
                      border: `1px solid ${COLORS.border}`,
                    }}>
                      <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 8, fontWeight: 600 }}>
                        Detalle de ventas ({expandedProductSales.length}):
                      </div>
                      {expandedProductSales.length === 0 ? (
                        <div style={{ color: COLORS.muted, fontSize: 13 }}>Sin movimientos en el rango</div>
                      ) : (
                        <div style={{ display: "grid", gap: 6 }}>
                          {expandedProductSales.map((sale, idx) => (
                            <div
                              key={`${sale.orderId}-${idx}`}
                              style={{
                                display: "grid",
                                gridTemplateColumns: "minmax(120px,1.2fr) minmax(120px,1.4fr) minmax(90px,1fr) minmax(80px,0.8fr) minmax(80px,0.8fr)",
                                gap: 10, padding: "8px 10px", background: "white",
                                borderRadius: 8, fontSize: 12, alignItems: "center",
                                border: `1px solid ${COLORS.border}`,
                              }}
                            >
                              <div style={{ color: COLORS.text, fontWeight: 600 }}>
                                {sale.created_at
                                  ? new Date(sale.created_at).toLocaleString("es-MX", {
                                      timeZone: "America/Mexico_City",
                                      day: "2-digit", month: "short",
                                      hour: "2-digit", minute: "2-digit",
                                    })
                                  : "—"}
                              </div>
                              <div style={{ color: COLORS.text }} title={sale.customer}>
                                👤 {sale.customer}
                              </div>
                              <div style={{ color: COLORS.muted, fontSize: 11 }} title={`Cajera / Carnicero`}>
                                💼 {sale.cashier}
                                {sale.butcher !== "—" && (
                                  <div style={{ fontSize: 10, marginTop: 2 }}>🔪 {sale.butcher}</div>
                                )}
                              </div>
                              <div style={{ textAlign: "right", color: COLORS.muted }}>
                                {sale.qty}
                              </div>
                              <div style={{ textAlign: "right", fontWeight: 700, color: COLORS.text }}>
                                ${fmt(sale.subtotal)}
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
        </Section>

        <Section id="merma" title="Kilos de carne: entradas vs salidas" count={mermaStats.rows.length}>
          <p style={{ color: COLORS.muted, fontSize: 13, marginBottom: 14 }}>
            Compara kilos de RES, CERDO y POLLO comprados este mes vs kilos vendidos.
            Marca las compras como &quot;materia prima&quot; en /admin/proveedores → cargo y elige el tipo de carne.
          </p>

          {mermaStats.rows.length === 0 ? (
            <div style={emptyBoxStyle}>
              Aún no hay compras de carne registradas. Cuando registres un cargo a proveedor (Sergio Vega Marín, Arriola, Feyo, etc), activa el toggle &quot;¿Es materia prima?&quot; y elige Res/Cerdo/Pollo + los kg.
            </div>
          ) : (
            <>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 10, marginBottom: 14,
              }}>
                <div style={{ padding: 12, background: "rgba(123,34,24,0.05)", borderRadius: 10, border: `1px solid ${COLORS.border}` }}>
                  <div style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700 }}>KG ENTRADOS</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.primary }}>{fmt(mermaStats.totalEntradas)} kg</div>
                  <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>Costo: ${fmt(mermaStats.totalCost)}</div>
                </div>
                <div style={{ padding: 12, background: "rgba(31,122,77,0.05)", borderRadius: 10, border: `1px solid ${COLORS.border}` }}>
                  <div style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700 }}>KG VENDIDOS</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.success }}>{fmt(mermaStats.totalSalidas)} kg</div>
                  <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>Ventas: ${fmt(mermaStats.totalRevenue)}</div>
                </div>
                {(() => {
                  const diff = mermaStats.totalEntradas - mermaStats.totalSalidas;
                  const pct = mermaStats.totalEntradas > 0 ? (diff / mermaStats.totalEntradas) * 100 : 0;
                  const isHigh = pct > 10;
                  return (
                    <div style={{
                      padding: 12,
                      background: isHigh ? "rgba(180,35,24,0.08)" : "rgba(166,106,16,0.06)",
                      borderRadius: 10,
                      border: `1px solid ${isHigh ? "rgba(180,35,24,0.25)" : COLORS.border}`,
                    }}>
                      <div style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700 }}>MERMA TEÓRICA</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: isHigh ? COLORS.danger : COLORS.warning }}>
                        {fmt(diff)} kg ({pct.toFixed(1)}%)
                      </div>
                      <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>
                        {isHigh ? "Merma alta — revisar" : "Merma dentro de rango normal"}
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "rgba(123,34,24,0.06)" }}>
                      <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 700, color: COLORS.text, borderBottom: `1px solid ${COLORS.border}` }}>Tipo de carne</th>
                      <th style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: COLORS.text, borderBottom: `1px solid ${COLORS.border}` }}>Entradas (kg)</th>
                      <th style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: COLORS.text, borderBottom: `1px solid ${COLORS.border}` }}>Salidas (kg)</th>
                      <th style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: COLORS.text, borderBottom: `1px solid ${COLORS.border}` }}>Merma</th>
                      <th style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: COLORS.text, borderBottom: `1px solid ${COLORS.border}` }}>%</th>
                      <th style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: COLORS.text, borderBottom: `1px solid ${COLORS.border}` }}>$ costo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mermaStats.rows.map((r) => {
                      const isHigh = r.merma_pct > 15;
                      const isLow = r.merma_pct < -5; // sobra mas de lo comprado (positivo)
                      return (
                        <tr key={r.cat} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                          <td style={{ padding: "10px 12px", color: COLORS.text, fontWeight: 600 }}>{r.cat}</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", color: COLORS.text }}>
                            {fmt(r.entradas_kg)}
                            {r.entradas_count > 0 && (
                              <div style={{ fontSize: 10, color: COLORS.muted }}>
                                {r.entradas_count} compra{r.entradas_count === 1 ? "" : "s"}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "right", color: COLORS.text }}>{fmt(r.salidas_kg)}</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", color: isHigh ? COLORS.danger : (isLow ? COLORS.success : COLORS.text), fontWeight: 700 }}>
                            {fmt(r.merma_kg)}
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "right", color: isHigh ? COLORS.danger : (isLow ? COLORS.success : COLORS.muted), fontWeight: 700 }}>
                            {r.merma_pct.toFixed(1)}%
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "right", color: COLORS.muted }}>
                            ${fmt(r.entradas_cost)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{
                marginTop: 14, padding: 12, background: "rgba(166,106,16,0.06)",
                borderRadius: 10, fontSize: 12, color: COLORS.text,
              }}>
                <b style={{ color: COLORS.warning }}>⚠️ Lectura:</b>{" "}
                Esta merma es teórica — solo compara compras vs ventas. Para tener merma REAL necesitas que al cierre del día tu carnicero pese lo que queda en mostrador y lo capture. Si entradas-salidas-físico no cuadra, hay fuga.
              </div>
            </>
          )}
        </Section>

        <Section id="menos-vendidos" title="Menos vendidos" count={bottomProducts.length}>
          {bottomProducts.length === 0 ? (
            <div style={emptyBoxStyle}>No hay datos</div>
          ) : (
            bottomProducts.map((product, index) => (
              <div key={product.product} style={productRowStyle}>
                <div style={{ flex: 2, color: COLORS.text, minWidth: 0 }}>
                  #{index + 1} <b>{product.product}</b>
                </div>
                <div style={{ flex: 1, textAlign: "right", color: COLORS.muted }}>
                  {product.isPieza ? `${fmt(product.piezas)} pzas` : `${fmt(product.kilos)} kg`}
                </div>
                <div style={{ flex: 1, textAlign: "right", color: COLORS.danger, fontWeight: 600 }}>
                  {product.times} {product.times === 1 ? "vez" : "veces"}
                </div>
                <div style={{ flex: 1, textAlign: "right", fontWeight: 700, color: COLORS.text }}>
                  ${fmt(product.revenue)}
                </div>
              </div>
            ))
          )}
        </Section>

        {/* ═══ PANEL: TICKETS EDITADOS ═══ */}
        {(() => {
          const editedOrders = orders.filter((o) => o.edited_at);
          if (editedOrders.length === 0) return null;
          return (
            <Section id="editados" title="Tickets editados" count={editedOrders.length} danger>
              <p style={{ color: COLORS.muted, fontSize: 13, marginBottom: 14 }}>
                Tickets modificados en caja durante el rango seleccionado
              </p>

              <div style={{ display: "grid", gap: 10 }}>
                {editedOrders.map((order) => {
                  const currentTotal = orderTotal(order);
                  const origItems = (order.original_items || []) as OrderItem[];
                  const originalTotal = origItems.reduce(
                    (s, i) => s + itemSubtotal(i),
                    0
                  );
                  const diff = currentTotal - originalTotal;

                  return (
                    <div key={order.id} style={{ padding: 14, borderRadius: 14, background: "rgba(180,35,24,0.04)", border: "1px solid rgba(180,35,24,0.12)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 800, color: COLORS.text, fontSize: 15 }}>
                            TK-{order.id.slice(0, 6).toUpperCase()} — {order.customer_name || "Mostrador"}
                          </div>
                          <div style={{ color: COLORS.muted, fontSize: 13, marginTop: 4 }}>
                            Editado por: <b style={{ color: COLORS.danger }}>{order.edited_by || "cajera"}</b>
                            {order.edited_at && (
                              <span> — {new Date(order.edited_at).toLocaleString("es-MX", { timeZone: "America/Mexico_City" })}</span>
                            )}
                          </div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div style={{ fontWeight: 800, fontSize: 18, color: COLORS.text }}>${fmt(currentTotal)}</div>
                          {origItems.length > 0 && (
                            <div style={{ fontSize: 13, color: COLORS.danger, textDecoration: "line-through" }}>
                              ${fmt(originalTotal)}
                            </div>
                          )}
                          {origItems.length > 0 && diff !== 0 && (
                            <div style={{ fontSize: 13, fontWeight: 700, color: diff > 0 ? COLORS.success : COLORS.danger, marginTop: 2 }}>
                              {diff > 0 ? "+" : ""}${fmt(diff)}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Detalle de cambios */}
                      {origItems.length > 0 && (
                        <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.danger, marginBottom: 4 }}>ORIGINAL</div>
                            {origItems.map((item, i) => (
                              <div key={i} style={{ fontSize: 12, color: COLORS.muted, padding: "2px 0" }}>
                                {item.product}: {item.kilos} kg × ${Number(item.price || 0).toFixed(2)}
                              </div>
                            ))}
                          </div>
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.success, marginBottom: 4 }}>ACTUAL</div>
                            {(order.order_items || []).map((item, i) => (
                              <div key={i} style={{ fontSize: 12, color: COLORS.text, padding: "2px 0" }}>
                                {item.product}: {item.kilos} kg × ${Number(item.price || 0).toFixed(2)}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Section>
          );
        })()}

        <Section id="recientes" title="Pedidos recientes" count={recentOrders.length}>

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
                    {order.edited_at && (
                      <span style={{ display: "inline-block", marginLeft: 8, padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: "rgba(180,35,24,0.12)", color: COLORS.danger }}>
                        Editado por {order.edited_by || "cajera"}
                      </span>
                    )}
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
        </Section>
        {/* Panel de conciliación ventas vs cobros */}
        <Section id="conciliacion" title="Conciliación ventas vs cobros">
          {(() => {
            const c = conciliacion;
            const headerStyle: React.CSSProperties = {
              padding: "10px 12px", fontWeight: 800, fontSize: 13, color: "white",
              textTransform: "uppercase", letterSpacing: 0.5,
            };
            const rowStyle = (bold?: boolean, color?: string): React.CSSProperties => ({
              display: "flex", justifyContent: "space-between", padding: "8px 12px",
              borderBottom: `1px solid ${COLORS.border}`,
              fontWeight: bold ? 700 : 400,
              fontSize: bold ? 15 : 13,
              color: color || COLORS.text,
            });
            const indentRow = (color?: string): React.CSSProperties => ({
              display: "flex", justifyContent: "space-between", padding: "6px 12px 6px 28px",
              borderBottom: `1px solid ${COLORS.border}`,
              fontSize: 12, color: color || COLORS.muted,
            });
            return (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {/* ── LADO IZQUIERDO: PEDIDOS ── */}
                <div style={{ background: COLORS.cardStrong, borderRadius: 12, border: `1px solid ${COLORS.border}`, overflow: "hidden" }}>
                  <div style={{ ...headerStyle, background: COLORS.primary }}>
                    Lo que se vendió (pedidos)
                  </div>
                  <div style={rowStyle(true)}>
                    <span>Ventas brutas</span>
                    <span>${fmt(c.ventasBruto)}</span>
                  </div>
                  {c.totalDescuentos > 0 && (
                    <div style={indentRow("#b45309")}>
                      <span>− Descuentos</span>
                      <span>−${fmt(c.totalDescuentos)}</span>
                    </div>
                  )}
                  <div style={rowStyle(true, COLORS.primary)}>
                    <span>Ventas netas</span>
                    <span>${fmt(c.ventasNetas)}</span>
                  </div>
                  <div style={{ height: 6, background: COLORS.bg }} />
                  <div style={{ padding: "8px 12px", fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase" }}>
                    Estado de los pedidos
                  </div>
                  <div style={indentRow(COLORS.success)}>
                    <span>Cobrados ({c.cobradosCount})</span>
                    <span>${fmt(c.totalCobrados)}</span>
                  </div>
                  {c.totalPendientes > 0 && (
                    <div style={indentRow("#b45309")}>
                      <span>Pendientes de cobro ({c.pendientesCount})</span>
                      <span>${fmt(c.totalPendientes)}</span>
                    </div>
                  )}
                  {c.totalCredito > 0 && (
                    <div style={indentRow("#7b2218")}>
                      <span>Enviados a crédito ({c.creditCount})</span>
                      <span>${fmt(c.totalCredito)}</span>
                    </div>
                  )}
                  {c.totalCancelado > 0 && (
                    <div style={indentRow("#dc2626")}>
                      <span>Cancelados ({c.cancelledCount})</span>
                      <span>${fmt(c.totalCancelado)}</span>
                    </div>
                  )}
                </div>

                {/* ── LADO DERECHO: CAJA ── */}
                <div style={{ background: COLORS.cardStrong, borderRadius: 12, border: `1px solid ${COLORS.border}`, overflow: "hidden" }}>
                  <div style={{ ...headerStyle, background: COLORS.success }}>
                    Lo que entró a caja (dinero)
                  </div>
                  <div style={rowStyle()}>
                    <span>Cobro de tickets</span>
                    <span>${fmt(c.cobradoTickets)}</span>
                  </div>
                  {c.abonosCxc > 0 && (
                    <div style={rowStyle()}>
                      <span>Abonos CxC</span>
                      <span>${fmt(c.abonosCxc)}</span>
                    </div>
                  )}
                  <div style={rowStyle(true, COLORS.success)}>
                    <span>Total en caja</span>
                    <span>${fmt(c.totalCaja)}</span>
                  </div>
                  <div style={{ height: 6, background: COLORS.bg }} />
                  <div style={{ padding: "8px 12px", fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase" }}>
                    Desglose por método
                  </div>
                  {Object.entries(c.porMetodo).sort((a, b) => b[1] - a[1]).map(([method, total]) => (
                    <div key={method} style={indentRow()}>
                      <span>{method === "efectivo" ? "Efectivo" : method === "tarjeta" ? "Tarjeta" : method === "transferencia" ? "Transferencia" : method === "mixto" ? "Mixto" : method}</span>
                      <span>${fmt(total)}</span>
                    </div>
                  ))}
                  {c.abonosCxc > 0 && (
                    <div style={indentRow(COLORS.success)}>
                      <span>Abonos CxC</span>
                      <span>${fmt(c.abonosCxc)}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Explicación */}
          <div style={{ marginTop: 16, padding: "14px 16px", borderRadius: 12, background: "rgba(123,34,24,0.04)", border: `1px solid ${COLORS.border}` }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: COLORS.text, marginBottom: 8 }}>
              ¿Por qué los números son diferentes?
            </div>
            <div style={{ fontSize: 12, color: COLORS.muted, lineHeight: 1.7 }}>
              <strong>Ventas (izquierda)</strong> = lo que se capturó en pedidos (productos × kilos × precio).
              <strong> Caja (derecha)</strong> = el dinero que realmente pasó por caja.
              Es normal que difieran por: ajustes de peso al cobrar, redondeo,
              tickets pendientes, ventas a crédito, y abonos de deudas anteriores.
              {Math.abs(conciliacion.ajuste) > 100 && (
                <span style={{ display: "block", marginTop: 6, color: "#b45309" }}>
                  Ajuste por redondeo/peso al cobrar: <strong>${fmt(Math.abs(conciliacion.ajuste))}</strong> —
                  esto es la diferencia entre lo calculado en el ticket y lo que se cobró realmente (normal en carnicería).
                </span>
              )}
            </div>
          </div>
        </Section>

        {/* Panel de redondeo para donación */}
        <Section id="precios-mercado" title="Precios de mercado" count={marketPrices.length}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
            <button
              onClick={refreshMarketPrices}
              disabled={marketLoading}
              style={{
                padding: "10px 18px",
                borderRadius: 14,
                border: "none",
                background: marketLoading ? COLORS.muted : `linear-gradient(180deg, ${COLORS.primary} 0%, ${COLORS.primaryDark} 100%)`,
                color: "white",
                fontWeight: 700,
                fontSize: 14,
                cursor: marketLoading ? "not-allowed" : "pointer",
                boxShadow: "0 4px 12px rgba(123,34,24,0.2)",
              }}
            >
              {marketLoading ? "Buscando precios..." : "Actualizar precios"}
            </button>
            {marketRefreshResult && (
              <span style={{ fontSize: 13, color: marketRefreshResult.startsWith("Error") ? COLORS.danger : COLORS.success, fontWeight: 600 }}>
                {marketRefreshResult}
              </span>
            )}
          </div>

          {marketPrices.length === 0 ? (
            <div style={{ color: COLORS.muted, padding: "12px 0" }}>
              No hay datos de precios de mercado todavía. Presiona &quot;Actualizar precios&quot; para buscar.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 10 }}>
                Última actualización: {marketPrices[0]?.updated_at ? new Date(marketPrices[0].updated_at).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" }) : "---"}
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "rgba(123,34,24,0.06)" }}>
                    <th style={mpThStyle}>Producto</th>
                    <th style={{ ...mpThStyle, textAlign: "right" }}>Tu precio</th>
                    <th style={{ ...mpThStyle, textAlign: "right" }}>Mercado prom.</th>
                    <th style={{ ...mpThStyle, textAlign: "right" }}>Rango mercado</th>
                    <th style={{ ...mpThStyle, textAlign: "center" }}>Comparación</th>
                    <th style={mpThStyle}>Fuentes</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    let lastCat = "";
                    return marketPrices.map((mp) => {
                      const diff = mp.our_price - mp.market_avg;
                      const pct = mp.market_avg > 0 ? ((diff / mp.market_avg) * 100) : 0;
                      const showCatHeader = mp.category !== lastCat;
                      lastCat = mp.category;
                      return (
                        <React.Fragment key={mp.id}>
                          {showCatHeader && (
                            <tr>
                              <td colSpan={6} style={{ padding: "10px 8px 4px", fontWeight: 800, fontSize: 13, color: COLORS.primary, borderBottom: `2px solid ${COLORS.border}` }}>
                                {mp.category || "Sin categoría"}
                              </td>
                            </tr>
                          )}
                          <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                            <td style={mpTdStyle}>{mp.product_name}</td>
                            <td style={{ ...mpTdStyle, textAlign: "right", fontWeight: 700 }}>${fmt(mp.our_price)}</td>
                            <td style={{ ...mpTdStyle, textAlign: "right" }}>${fmt(mp.market_avg)}</td>
                            <td style={{ ...mpTdStyle, textAlign: "right", fontSize: 12, color: COLORS.muted }}>${fmt(mp.market_low)} - ${fmt(mp.market_high)}</td>
                            <td style={{ ...mpTdStyle, textAlign: "center" }}>
                              <span style={{
                                display: "inline-block",
                                padding: "3px 10px",
                                borderRadius: 999,
                                fontSize: 12,
                                fontWeight: 700,
                                background: pct > 5 ? "rgba(180,35,24,0.10)" : pct < -5 ? "rgba(31,122,77,0.10)" : "rgba(166,106,16,0.10)",
                                color: pct > 5 ? COLORS.danger : pct < -5 ? COLORS.success : COLORS.warning,
                              }}>
                                {pct > 0 ? "+" : ""}{pct.toFixed(0)}%
                              </span>
                            </td>
                            <td style={{ ...mpTdStyle, fontSize: 11, color: COLORS.muted, maxWidth: 140 }}>{mp.sources}</td>
                          </tr>
                        </React.Fragment>
                      );
                    });
                  })()}
                </tbody>
              </table>
              <div style={{ marginTop: 12, padding: 10, borderRadius: 12, background: "rgba(123,34,24,0.04)", fontSize: 12, color: COLORS.muted }}>
                <b>Leyenda:</b>{" "}
                <span style={{ color: COLORS.danger }}>Rojo = tu precio es mayor al mercado</span>{" | "}
                <span style={{ color: COLORS.success }}>Verde = tu precio es menor</span>{" | "}
                <span style={{ color: COLORS.warning }}>Amarillo = similar (±5%)</span>
              </div>
            </div>
          )}
        </Section>

        <Section id="donacion" title="Redondeo solidario" count={roundingCount}>
          <div style={{ padding: "10px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 13, color: COLORS.muted }}>Total acumulado de redondeo</div>
                <div style={{ fontSize: 32, fontWeight: 800, color: COLORS.success, marginTop: 4 }}>
                  ${fmt(roundingTotal)}
                </div>
                <div style={{ fontSize: 13, color: COLORS.muted, marginTop: 4 }}>
                  De {roundingCount} transaccion{roundingCount !== 1 ? "es" : ""}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 200, background: "rgba(31,122,77,0.08)", borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.success }}>
                  Para causas benéficas
                </div>
                <div style={{ fontSize: 13, color: COLORS.muted, marginTop: 6 }}>
                  Cada venta se redondea al peso superior. La diferencia se acumula aquí para donación.
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* Panel de salud del sistema */}
        <SystemHealthPanel />
      </div>
    </div>
  );
}

function SystemHealthPanel() {
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  async function checkHealth() {
    setLoading(true);
    setShow(true);
    setErrorMsg("");
    try {
      const secret = getAdminSecret();
      const res = await fetch(`/api/health?secret=${encodeURIComponent(secret)}`);
      if (!res.ok) {
        const errText = await res.text();
        setErrorMsg(`Error ${res.status}: ${errText}`);
        setHealth(null);
      } else {
        const data = await res.json();
        if (data.error) {
          setErrorMsg(data.error);
          setHealth(null);
        } else {
          setHealth(data);
        }
      }
    } catch (err) {
      setErrorMsg("No se pudo conectar: " + String(err));
      setHealth(null);
    }
    setLoading(false);
  }

  useEffect(() => {
    checkHealth();
  }, []);

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
          <a href={`/api/backup?secret=${getAdminSecret()}`} target="_blank" rel="noopener" style={{ padding: "10px 16px", borderRadius: 14, border: "none", background: `linear-gradient(180deg, ${COLORS.primary} 0%, ${COLORS.primaryDark} 100%)`, color: "white", fontWeight: 700, cursor: "pointer", fontSize: 14, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
            Descargar backup
          </a>
        </div>
      </div>

      {loading && <div style={{ padding: 16, textAlign: "center", color: COLORS.muted }}>Verificando salud del sistema...</div>}

      {errorMsg && (
        <div style={{ padding: 14, borderRadius: 14, background: "rgba(180,35,24,0.08)", border: "1px solid rgba(180,35,24,0.15)", color: COLORS.danger, fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
          {errorMsg}
        </div>
      )}

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
            <div style={{ color: COLORS.muted, fontSize: 12, marginBottom: 4 }}>Tamaño BD</div>
            <div style={{ color: (health.database?.usage_percent || 0) > 50 ? COLORS.danger : COLORS.text, fontSize: 20, fontWeight: 800 }}>
              {health.database?.real_size_pretty || `${health.database?.estimated_size_mb || 0} MB`}
            </div>
            <div style={{ color: COLORS.muted, fontSize: 11, marginTop: 2 }}>
              de {health.database?.limit_mb ? `${(health.database.limit_mb / 1024).toFixed(0)} GB` : "8 GB"} ({health.database?.usage_percent || 0}%)
            </div>
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

          {health.plan && (
            <>
              <div style={{ gridColumn: "1 / -1", marginTop: 4 }}>
                <div style={{ color: COLORS.muted, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Plan Supabase: {health.plan.plan.toUpperCase()}</div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.5)", border: `1px solid ${COLORS.border}`, borderRadius: 18, padding: 14 }}>
                <div style={{ color: COLORS.muted, fontSize: 12, marginBottom: 4 }}>Egress (transferencia)</div>
                <div style={{ color: COLORS.text, fontSize: 18, fontWeight: 800 }}>{health.plan.egress_quota_gb} GB</div>
                <div style={{ color: COLORS.muted, fontSize: 11, marginTop: 2 }}>incluidos/mes</div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.5)", border: `1px solid ${COLORS.border}`, borderRadius: 18, padding: 14 }}>
                <div style={{ color: COLORS.muted, fontSize: 12, marginBottom: 4 }}>Storage</div>
                <div style={{ color: COLORS.text, fontSize: 18, fontWeight: 800 }}>{health.plan.storage_limit_gb} GB</div>
                <div style={{ color: COLORS.muted, fontSize: 11, marginTop: 2 }}>{health.storage?.bucket_count || 0} buckets activos</div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.5)", border: `1px solid ${COLORS.border}`, borderRadius: 18, padding: 14 }}>
                <div style={{ color: COLORS.muted, fontSize: 12, marginBottom: 4 }}>BD incluida</div>
                <div style={{ color: COLORS.text, fontSize: 18, fontWeight: 800 }}>{health.plan.db_limit_gb} GB</div>
                <div style={{ color: COLORS.muted, fontSize: 11, marginTop: 2 }}>por proyecto</div>
              </div>
            </>
          )}

          {health.nota && (
            <div style={{ gridColumn: "1 / -1", background: "rgba(166,106,16,0.06)", border: `1px solid ${COLORS.border}`, borderRadius: 18, padding: 14 }}>
              <div style={{ color: COLORS.muted, fontSize: 12 }}>
                Egress exacto: <a href="https://supabase.com/dashboard/org/_/usage" target="_blank" rel="noopener" style={{ color: COLORS.primary }}>Ver en Supabase Dashboard</a>
              </div>
            </div>
          )}

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

const mpThStyle: React.CSSProperties = {
  padding: "10px 8px",
  textAlign: "left",
  fontSize: 12,
  fontWeight: 700,
  color: COLORS.muted,
  borderBottom: `2px solid ${COLORS.border}`,
};

const mpTdStyle: React.CSSProperties = {
  padding: "8px 8px",
  fontSize: 14,
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