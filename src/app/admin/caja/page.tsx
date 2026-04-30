"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useCallback } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import * as XLSX from "xlsx";
import { printCashCut, type CashCutData } from "@/lib/printer";
import PrinterButton from "@/components/PrinterButton";
import { moneyRound } from "@/lib/money";
import { jsPDF } from "jspdf";

// ─── Types ─────────────────────────────────────────────────────
type Movement = {
  id: string;
  type: string | null;
  source: string | null;
  amount: number | null;
  payment_method: string | null;
  created_at: string | null;
  reference_id?: string | null;
  cashier_name?: string | null;
  is_cancelled?: boolean | null;
  cancel_reason?: string | null;
  cancelled_by?: string | null;
  cancelled_at?: string | null;
};

type OrderItem = {
  id: string;
  product: string;
  kilos?: number | null;
  price?: number | null;
  quantity?: number | null;
  sale_type?: string | null;
  prepared_kilos?: number | null;
};

type CashClosure = {
  id: string;
  closure_date: string;
  expected_cash: number | null;
  counted_cash: number | null;
  difference: number | null;
  notes?: string | null;
  created_at?: string | null;
  total_sales?: number | null;
  total_cxc?: number | null;
  total_card?: number | null;
  total_transfer?: number | null;
  total_general?: number | null;
  // Denominaciones (Fase 1)
  bills_1000?: number | null;
  bills_500?: number | null;
  bills_200?: number | null;
  bills_100?: number | null;
  bills_50?: number | null;
  bills_20?: number | null;
  coins_20?: number | null;
  coins_10?: number | null;
  coins_5?: number | null;
  coins_2?: number | null;
  coins_1?: number | null;
  coins_050?: number | null;
  total_expenses?: number | null;
  initial_amount?: number | null;
  closed_by?: string | null;
};

type CashOpening = {
  id: string;
  opening_date: string;
  initial_amount: number;
  bills_1000: number;
  bills_500: number;
  bills_200: number;
  bills_100: number;
  bills_50: number;
  bills_20: number;
  coins_20: number;
  coins_10: number;
  coins_5: number;
  coins_2: number;
  coins_1: number;
  coins_050: number;
  notes?: string | null;
};

type CashExpense = {
  id: string;
  expense_date: string;
  concept: string;
  amount: number;
  category: string;
  notes?: string | null;
  created_at?: string | null;
};

type Tab = "resumen" | "apertura" | "gastos" | "reconteo" | "cierre" | "historial" | "reportes";

// ─── Colors ────────────────────────────────────────────────────
const C = {
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

// ─── Helpers ───────────────────────────────────────────────────
function money(v?: number | null) {
  return String(Math.ceil(Number(v || 0)));
}

function todayStr() {
  const n = new Date();
  return `${n.getFullYear()}-${`${n.getMonth() + 1}`.padStart(2, "0")}-${`${n.getDate()}`.padStart(2, "0")}`;
}

function fmtDateTime(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime()) ? v : d.toLocaleString("es-MX", { timeZone: "America/Mexico_City" });
}

function fmtDate(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v + "T12:00:00");
  return isNaN(d.getTime()) ? v : d.toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short", timeZone: "America/Mexico_City" });
}

function typeName(t?: string | null) {
  if (t === "cxc_pago") return "Cobro CxC";
  if (t === "venta") return "Venta";
  if (t === "gasto") return "Gasto";
  return t || "Movimiento";
}

function methodName(m?: string | null) {
  if (!m) return "—";
  if (m === "efectivo") return "Efectivo";
  if (m === "tarjeta") return "Tarjeta";
  if (m === "transferencia") return "Transferencia";
  return m;
}

const EXPENSE_CATS = [
  { value: "materia_prima", label: "Materia prima", desc: "Carne, pollo, especias, etc." },
  { value: "sueldos", label: "Sueldos / Nómina", desc: "Pago a empleados" },
  { value: "proveedor", label: "Pago a proveedor", desc: "Abono o liquidación a proveedores" },
  { value: "insumos", label: "Insumos operativos", desc: "Bolsas, papel, charolas, gas" },
  { value: "limpieza", label: "Limpieza", desc: "Productos y servicio de limpieza" },
  { value: "comida", label: "Comida empleados", desc: "Refrescos, comida del personal" },
  { value: "transporte", label: "Transporte / Fletes", desc: "Gasolina, envíos, fletes" },
  { value: "servicios", label: "Servicios", desc: "Luz, agua, teléfono, internet" },
  { value: "reparacion", label: "Reparación / Mantenimiento", desc: "Equipo, instalaciones" },
  { value: "impuestos", label: "Impuestos / Trámites", desc: "SAT, permisos, licencias" },
  { value: "varios", label: "Varios", desc: "Otros gastos no clasificados" },
];

const DENOMINATIONS = [
  { key: "bills_1000", label: "$1,000", value: 1000 },
  { key: "bills_500", label: "$500", value: 500 },
  { key: "bills_200", label: "$200", value: 200 },
  { key: "bills_100", label: "$100", value: 100 },
  { key: "bills_50", label: "$50", value: 50 },
  { key: "bills_20", label: "$20", value: 20 },
  { key: "coins_20", label: "$20 m", value: 20 },
  { key: "coins_10", label: "$10", value: 10 },
  { key: "coins_5", label: "$5", value: 5 },
  { key: "coins_2", label: "$2", value: 2 },
  { key: "coins_1", label: "$1", value: 1 },
  { key: "coins_050", label: "$0.50", value: 0.5 },
] as const;

// ─── Component ─────────────────────────────────────────────────
export default function CajaPage() {
  const supabase = getSupabaseClient();
  const today = todayStr();

  // Role check
  const [userRole, setUserRole] = useState<string>("");
  useEffect(() => {
    try { setUserRole(sessionStorage.getItem("pin_role") || ""); } catch {}
  }, []);

  // State
  const [tab, setTab] = useState<Tab>("resumen");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);

  // Data
  const [movements, setMovements] = useState<Movement[]>([]);
  const [todayClosure, setTodayClosure] = useState<CashClosure | null>(null);
  const [closureHistory, setClosureHistory] = useState<CashClosure[]>([]);
  const [todayOpening, setTodayOpening] = useState<CashOpening | null>(null);
  const [expenses, setExpenses] = useState<CashExpense[]>([]);
  const [weekData, setWeekData] = useState<Movement[]>([]);
  const [weekExpenses, setWeekExpenses] = useState<CashExpense[]>([]);

  // Closure form
  const [countedCash, setCountedCash] = useState("");
  const [closureNotes, setClosureNotes] = useState("");
  const [closureDenoms, setClosureDenoms] = useState<Record<string, string>>({});
  const [useDenoms, setUseDenoms] = useState(true); // modo conteo por denominaciones (default)

  // Reconteo a medio turno
  const [reconteoDenoms, setReconteoDenoms] = useState<Record<string, string>>({});
  const [reconteoNotes, setReconteoNotes] = useState("");
  const [reconteoSaved, setReconteoSaved] = useState(false);

  // Opening form
  const [denomDrafts, setDenomDrafts] = useState<Record<string, string>>({});
  const [openingNotes, setOpeningNotes] = useState("");

  // Expense form
  const [expConcept, setExpConcept] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [expCategory, setExpCategory] = useState("varios");
  const [expNotes, setExpNotes] = useState("");

  // Desglose modal
  const [desgloseMovement, setDesgloseMovement] = useState<Movement | null>(null);
  const [desgloseItems, setDesgloseItems] = useState<OrderItem[]>([]);
  const [desgloseLoading, setDesgloseLoading] = useState(false);
  const [desgloseEditInfo, setDesgloseEditInfo] = useState<{ edited_at: string; edited_by: string; original_items: OrderItem[] } | null>(null);
  const [editedOrderIds, setEditedOrderIds] = useState<Set<string>>(new Set());

  // Cancel modal
  const [cancelMovement, setCancelMovement] = useState<Movement | null>(null);
  const [cancelCode, setCancelCode] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [cancelSaving, setCancelSaving] = useState(false);
  const [cancelError, setCancelError] = useState("");

  // Cancelled view
  const [showCancelled, setShowCancelled] = useState(false);
  const [showCancelPanel, setShowCancelPanel] = useState(false);

  // Fase 2 — Filtros de turno/cajera
  const [filterCashier, setFilterCashier] = useState<string>("__all__");
  const [filterTimeFrom, setFilterTimeFrom] = useState<string>(""); // "HH:MM"
  const [filterTimeTo, setFilterTimeTo] = useState<string>("");
  const [showPartialTicket, setShowPartialTicket] = useState(false);

  useEffect(() => {
    const onAfter = () => setShowPartialTicket(false);
    window.addEventListener("afterprint", onAfter);
    return () => window.removeEventListener("afterprint", onAfter);
  }, []);

  // ─── Loaders ───────────────────────────────────────────────
  const loadMovements = useCallback(async () => {
    const start = new Date(`${dateFrom}T00:00:00`).toISOString();
    const end = new Date(`${dateTo}T23:59:59`).toISOString();
    const { data } = await supabase
      .from("cash_movements")
      .select("*")
      .gte("created_at", start)
      .lte("created_at", end)
      .order("created_at", { ascending: false });
    setMovements((data as Movement[]) || []);

    // Cargar IDs de órdenes editadas en el mismo rango
    const { data: editedOrders } = await supabase
      .from("orders")
      .select("id")
      .not("edited_at", "is", null)
      .gte("created_at", start)
      .lte("created_at", end);
    setEditedOrderIds(new Set((editedOrders || []).map((o: { id: string }) => o.id)));
  }, [dateFrom, dateTo]);

  const loadTodayClosure = useCallback(async () => {
    const { data } = await supabase
      .from("cash_closures")
      .select("*")
      .eq("closure_date", today)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const c = (data as CashClosure | null) || null;
    setTodayClosure(c);
    if (c) {
      setCountedCash(String(Number(c.counted_cash || 0)));
      setClosureNotes(c.notes || "");
      // Precargar denominaciones si existen
      const drafts: Record<string, string> = {};
      let anyDenom = false;
      for (const d of DENOMINATIONS) {
        const val = Number((c as any)[d.key] || 0);
        if (val > 0) { drafts[d.key] = String(val); anyDenom = true; }
      }
      setClosureDenoms(drafts);
      setUseDenoms(anyDenom || true);
    }
  }, [today]);

  const loadClosureHistory = useCallback(async () => {
    const { data } = await supabase
      .from("cash_closures")
      .select("*")
      .order("closure_date", { ascending: false })
      .limit(30);
    setClosureHistory((data as CashClosure[]) || []);
  }, []);

  const loadOpening = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("cash_openings")
        .select("*")
        .eq("opening_date", today)
        .maybeSingle();
      const op = (data as CashOpening | null) || null;
      setTodayOpening(op);
      if (op) {
        const drafts: Record<string, string> = {};
        for (const d of DENOMINATIONS) {
          const val = (op as any)[d.key] || 0;
          if (val > 0) drafts[d.key] = String(val);
        }
        setDenomDrafts(drafts);
        setOpeningNotes(op.notes || "");
      }
    } catch {
      // Table may not exist yet
    }
  }, [today]);

  const loadExpenses = useCallback(async () => {
    try {
      const start = new Date(`${dateFrom}T00:00:00`).toISOString();
      const end = new Date(`${dateTo}T23:59:59`).toISOString();
      const { data } = await supabase
        .from("cash_expenses")
        .select("*")
        .gte("created_at", start)
        .lte("created_at", end)
        .order("created_at", { ascending: false });
      setExpenses((data as CashExpense[]) || []);
    } catch {
      // Table may not exist yet
    }
  }, [dateFrom, dateTo]);

  async function openDesglose(m: Movement) {
    if (!m.reference_id) {
      alert("Este movimiento no tiene ticket asociado");
      return;
    }
    setDesgloseMovement(m);
    setDesgloseLoading(true);
    setDesgloseItems([]);
    setDesgloseEditInfo(null);

    const { data } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", m.reference_id);

    setDesgloseItems((data as OrderItem[]) || []);

    // Traer info de edición de la orden
    const { data: orderData } = await supabase
      .from("orders")
      .select("edited_at, edited_by, original_items")
      .eq("id", m.reference_id)
      .maybeSingle();

    if (orderData?.edited_at) {
      setDesgloseEditInfo({
        edited_at: orderData.edited_at,
        edited_by: orderData.edited_by || "cajera",
        original_items: (orderData.original_items as OrderItem[]) || [],
      });
    }

    setDesgloseLoading(false);
  }

  async function cancelMovement_fn() {
    if (!cancelMovement) return;
    if (!cancelCode.trim()) {
      setCancelError("Ingresa el código de cajera");
      return;
    }
    if (!cancelReason.trim()) {
      setCancelError("Escribe el motivo de cancelación");
      return;
    }

    setCancelSaving(true);
    setCancelError("");

    // Verify cajera code
    const { data: emp } = await supabase
      .from("employee_codes")
      .select("name, code")
      .eq("code", cancelCode.trim())
      .eq("role", "cajera")
      .eq("is_active", true)
      .maybeSingle();

    if (!emp) {
      setCancelError("Código de cajera incorrecto");
      setCancelSaving(false);
      return;
    }

    // Update cash_movement as cancelled
    const { error } = await supabase
      .from("cash_movements")
      .update({
        is_cancelled: true,
        cancel_reason: cancelReason.trim(),
        cancelled_by: emp.name,
        cancelled_at: new Date().toISOString(),
      })
      .eq("id", cancelMovement.id);

    if (error) {
      console.error(error);
      setCancelError("No se pudo cancelar. Verifica que las columnas existan en la base de datos.");
      setCancelSaving(false);
      return;
    }

    // If there's an associated order, mark it as cancelled too
    if (cancelMovement.reference_id) {
      await supabase
        .from("orders")
        .update({ status: "cancelado", payment_status: "cancelado" })
        .eq("id", cancelMovement.reference_id);
    }

    alert(`Movimiento cancelado por ${emp.name}. Motivo: ${cancelReason.trim()}`);

    // Refresh
    setCancelMovement(null);
    setCancelCode("");
    setCancelReason("");
    setCancelSaving(false);
    await loadMovements();
  }

  const cancelledMovements = useMemo(() => {
    return movements.filter((m) => m.is_cancelled);
  }, [movements]);

  const loadWeekData = useCallback(async () => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 6);
    const start = new Date(`${startDate.getFullYear()}-${`${startDate.getMonth()+1}`.padStart(2,"0")}-${`${startDate.getDate()}`.padStart(2,"0")}T00:00:00`).toISOString();
    const end = new Date(`${endDate.getFullYear()}-${`${endDate.getMonth()+1}`.padStart(2,"0")}-${`${endDate.getDate()}`.padStart(2,"0")}T23:59:59`).toISOString();
    const { data } = await supabase
      .from("cash_movements")
      .select("*")
      .gte("created_at", start)
      .lte("created_at", end)
      .order("created_at", { ascending: true });
    setWeekData((data as Movement[]) || []);
  }, []);

  const loadWeekExpenses = useCallback(async () => {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 6);
      const start = new Date(`${startDate.getFullYear()}-${`${startDate.getMonth()+1}`.padStart(2,"0")}-${`${startDate.getDate()}`.padStart(2,"0")}T00:00:00`).toISOString();
      const end = new Date(`${endDate.getFullYear()}-${`${endDate.getMonth()+1}`.padStart(2,"0")}-${`${endDate.getDate()}`.padStart(2,"0")}T23:59:59`).toISOString();
      const { data } = await supabase
        .from("cash_expenses")
        .select("*")
        .gte("created_at", start)
        .lte("created_at", end)
        .order("created_at", { ascending: true });
      setWeekExpenses((data as CashExpense[]) || []);
    } catch {}
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadMovements(), loadTodayClosure(), loadClosureHistory(), loadOpening(), loadExpenses(), loadWeekData(), loadWeekExpenses()]);
      setLoading(false);
    })();
  }, [dateFrom, dateTo]);

  // ─── Computed stats ────────────────────────────────────────
  // Si ya hay un corte de hoy, solo contar movimientos DESPUÉS de ese corte
  const activeMovements = useMemo(() => {
    const all = movements.filter((m) => !m.is_cancelled);
    if (todayClosure?.created_at) {
      const cutoff = todayClosure.created_at;
      return all.filter((m) => m.created_at && m.created_at > cutoff);
    }
    return all;
  }, [movements, todayClosure]);

  const stats = useMemo(() => {
    const active = activeMovements;
    const ventas = active.filter((m) => m.type === "venta");
    const cxc = active.filter((m) => m.type === "cxc_pago");

    const sum = (arr: Movement[], method: string) =>
      arr.filter((m) => m.payment_method === method).reduce((a, m) => a + Number(m.amount || 0), 0);

    const ventasEfectivo = sum(ventas, "efectivo");
    const ventasTarjeta = sum(ventas, "tarjeta");
    const ventasTransferencia = sum(ventas, "transferencia");
    const cxcEfectivo = sum(cxc, "efectivo");
    const cxcTarjeta = sum(cxc, "tarjeta");
    const cxcTransferencia = sum(cxc, "transferencia");

    const totalVentas = ventasEfectivo + ventasTarjeta + ventasTransferencia;
    const totalCxc = cxcEfectivo + cxcTarjeta + cxcTransferencia;
    const totalEfectivoIngreso = ventasEfectivo + cxcEfectivo;
    const totalTarjeta = ventasTarjeta + cxcTarjeta;
    const totalTransferencia = ventasTransferencia + cxcTransferencia;
    const totalGeneral = totalEfectivoIngreso + totalTarjeta + totalTransferencia;

    // Filtrar gastos posteriores al último corte (si existe)
    const activeExpenses = todayClosure?.created_at
      ? expenses.filter((e) => e.created_at && e.created_at > todayClosure.created_at!)
      : expenses;
    const totalGastos = activeExpenses.reduce((a, e) => a + Number(e.amount || 0), 0);
    // Si ya hay un corte previo, el fondo inicial del siguiente periodo es el contado del corte anterior
    const fondoInicial = todayClosure?.counted_cash != null ? Number(todayClosure.counted_cash) : (todayOpening?.initial_amount || 0);
    const efectivoEsperado = fondoInicial + totalEfectivoIngreso - totalGastos;

    const ticketCount = ventas.length;
    const ticketPromedio = ticketCount > 0 ? totalVentas / ticketCount : 0;

    return {
      ventasEfectivo, ventasTarjeta, ventasTransferencia,
      cxcEfectivo, cxcTarjeta, cxcTransferencia,
      totalVentas, totalCxc,
      totalEfectivoIngreso, totalTarjeta, totalTransferencia, totalGeneral,
      totalGastos, fondoInicial, efectivoEsperado,
      ticketCount, ticketPromedio,
      totalMovements: active.length,
      cancelledCount: movements.filter((m) => m.is_cancelled).length,
    };
  }, [activeMovements, expenses, todayOpening, todayClosure]);

  // Fase 2 — Lista de cajeras únicas que han movido caja en el rango
  const cashiersInRange = useMemo(() => {
    const set = new Set<string>();
    for (const m of movements) {
      if (m.cashier_name && m.cashier_name.trim()) set.add(m.cashier_name.trim());
    }
    return Array.from(set).sort();
  }, [movements]);

  // Fase 2 — Movimientos filtrados por turno (cajera + horas)
  const turnMovements = useMemo(() => {
    return movements.filter((m) => {
      if (m.is_cancelled) return false;
      if (filterCashier !== "__all__" && (m.cashier_name || "") !== filterCashier) return false;
      if (filterTimeFrom || filterTimeTo) {
        if (!m.created_at) return false;
        const d = new Date(m.created_at);
        const hhmm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
        if (filterTimeFrom && hhmm < filterTimeFrom) return false;
        if (filterTimeTo && hhmm > filterTimeTo) return false;
      }
      return true;
    });
  }, [movements, filterCashier, filterTimeFrom, filterTimeTo]);

  // Stats del turno filtrado (para corte parcial)
  const turnStats = useMemo(() => {
    const sum = (arr: Movement[], method?: string) =>
      arr.filter((m) => !method || m.payment_method === method).reduce((a, m) => a + Number(m.amount || 0), 0);
    const ventas = turnMovements.filter((m) => m.type === "venta");
    const cxc = turnMovements.filter((m) => m.type === "cxc_pago");
    const ventasEfectivo = sum(ventas, "efectivo");
    const ventasTarjeta = sum(ventas, "tarjeta");
    const ventasTransferencia = sum(ventas, "transferencia");
    const cxcEfectivo = sum(cxc, "efectivo");
    const cxcTarjeta = sum(cxc, "tarjeta");
    const cxcTransferencia = sum(cxc, "transferencia");
    const totalEfectivo = ventasEfectivo + cxcEfectivo;
    const totalTarjeta = ventasTarjeta + cxcTarjeta;
    const totalTransferencia = ventasTransferencia + cxcTransferencia;
    const totalVentas = ventasEfectivo + ventasTarjeta + ventasTransferencia;
    const totalCxc = cxcEfectivo + cxcTarjeta + cxcTransferencia;
    const total = totalEfectivo + totalTarjeta + totalTransferencia;
    return {
      count: turnMovements.length,
      ventas: ventas.length,
      totalVentas, totalCxc,
      totalEfectivo, totalTarjeta, totalTransferencia, total,
      ventasEfectivo, ventasTarjeta, ventasTransferencia,
      cxcEfectivo, cxcTarjeta, cxcTransferencia,
    };
  }, [turnMovements]);

  const hasTurnFilter = filterCashier !== "__all__" || filterTimeFrom !== "" || filterTimeTo !== "";

  // Week report data
  const weekReport = useMemo(() => {
    const days: Record<string, { ventas: number; cxc: number; efectivo: number; tarjeta: number; transferencia: number; count: number; gastos: number; cancelaciones: number; montoCancelado: number }> = {};
    const endDate = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(endDate.getDate() - i);
      const key = `${d.getFullYear()}-${`${d.getMonth()+1}`.padStart(2,"0")}-${`${d.getDate()}`.padStart(2,"0")}`;
      days[key] = { ventas: 0, cxc: 0, efectivo: 0, tarjeta: 0, transferencia: 0, count: 0, gastos: 0, cancelaciones: 0, montoCancelado: 0 };
    }
    for (const m of weekData) {
      if (!m.created_at) continue;
      const key = m.created_at.slice(0, 10);
      if (!days[key]) continue;
      const amt = Number(m.amount || 0);
      if (m.is_cancelled) {
        days[key].cancelaciones++;
        days[key].montoCancelado += amt;
        continue;
      }
      if (m.type === "venta") { days[key].ventas += amt; days[key].count++; }
      if (m.type === "cxc_pago") days[key].cxc += amt;
      if (m.payment_method === "efectivo") days[key].efectivo += amt;
      if (m.payment_method === "tarjeta") days[key].tarjeta += amt;
      if (m.payment_method === "transferencia") days[key].transferencia += amt;
    }
    // Add expenses from weekExpenses
    for (const e of weekExpenses) {
      if (!e.created_at) continue;
      const key = e.created_at.slice(0, 10);
      if (days[key]) days[key].gastos += Number(e.amount || 0);
    }
    return Object.entries(days).map(([date, vals]) => ({ date, ...vals, total: vals.ventas + vals.cxc }));
  }, [weekData, weekExpenses]);

  const weekMax = useMemo(() => Math.max(...weekReport.map((d) => d.total), 1), [weekReport]);
  const weekTotal = useMemo(() => weekReport.reduce((a, d) => a + d.total, 0), [weekReport]);

  const difference = useMemo(() => {
    return Math.ceil(Number(countedCash || 0)) - Math.ceil(stats.efectivoEsperado);
  }, [countedCash, stats.efectivoEsperado]);

  // ─── Opening helpers ───────────────────────────────────────
  const openingTotal = useMemo(() => {
    let total = 0;
    for (const d of DENOMINATIONS) {
      total += Number(denomDrafts[d.key] || 0) * d.value;
    }
    return total;
  }, [denomDrafts]);

  // ─── Closure denominations total ───────────────────────────
  const closureDenomTotal = useMemo(() => {
    let total = 0;
    for (const d of DENOMINATIONS) {
      total += Number(closureDenoms[d.key] || 0) * d.value;
    }
    return total;
  }, [closureDenoms]);

  // Si está activo el modo denominaciones, countedCash se sincroniza automáticamente
  useEffect(() => {
    if (useDenoms) {
      setCountedCash(String(Number(closureDenomTotal.toFixed(2))));
    }
  }, [closureDenomTotal, useDenoms]);

  // Reconteo: total por denominaciones
  const reconteoDenomTotal = useMemo(() => {
    let total = 0;
    for (const d of DENOMINATIONS) {
      total += Number(reconteoDenoms[d.key] || 0) * d.value;
    }
    return total;
  }, [reconteoDenoms]);

  const reconteoDifference = useMemo(() => {
    return Math.ceil(reconteoDenomTotal) - Math.ceil(stats.efectivoEsperado);
  }, [reconteoDenomTotal, stats.efectivoEsperado]);

  async function saveReconteo() {
    setSaving(true);
    const now = new Date();
    const hora = now.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });

    // Guardar como movimiento de tipo "reconteo" para registro
    const { error } = await supabase.from("cash_movements").insert([{
      type: "reconteo",
      source: "caja",
      amount: reconteoDenomTotal,
      payment_method: "efectivo",
      cashier_name: reconteoNotes ? `Reconteo ${hora}: ${reconteoNotes}` : `Reconteo ${hora}`,
      reference_id: null,
    }]);

    if (error) {
      alert("Error al guardar reconteo");
      console.log(error);
      setSaving(false);
      return;
    }

    setReconteoSaved(true);
    setSaving(false);
    alert(`Reconteo guardado: $${money(reconteoDenomTotal)} (diferencia: ${reconteoDifference >= 0 ? "+" : ""}$${money(reconteoDifference)})`);
  }

  function resetReconteo() {
    setReconteoDenoms({});
    setReconteoNotes("");
    setReconteoSaved(false);
  }

  // ─── Actions ───────────────────────────────────────────────
  async function saveOpening() {
    setSaving(true);
    const payload: any = {
      opening_date: today,
      initial_amount: Number(openingTotal.toFixed(2)),
      notes: openingNotes.trim() || null,
    };
    for (const d of DENOMINATIONS) {
      payload[d.key] = Number(denomDrafts[d.key] || 0);
    }

    if (todayOpening?.id) {
      const { error } = await supabase.from("cash_openings").update(payload).eq("id", todayOpening.id);
      if (error) { alert("Error al actualizar apertura"); console.log(error); setSaving(false); return; }
    } else {
      const { error } = await supabase.from("cash_openings").insert([payload]);
      if (error) { alert("Error al guardar apertura. Verifica que las tablas existan."); console.log(error); setSaving(false); return; }
    }
    alert("Apertura de caja guardada");
    await loadOpening();
    setSaving(false);
  }

  async function saveExpense() {
    if (!expConcept.trim()) { alert("Escribe el concepto del gasto"); return; }
    const amt = Number(expAmount);
    if (!amt || amt <= 0) { alert("Escribe un monto válido"); return; }

    setSaving(true);
    const { error } = await supabase.from("cash_expenses").insert([{
      expense_date: today,
      concept: expConcept.trim(),
      amount: Number(amt.toFixed(2)),
      category: expCategory,
      notes: expNotes.trim() || null,
    }]);

    if (error) { alert("Error al guardar gasto"); console.log(error); setSaving(false); return; }

    setExpConcept("");
    setExpAmount("");
    setExpCategory("varios");
    setExpNotes("");
    alert("Gasto registrado");
    await loadExpenses();
    setSaving(false);
  }

  async function deleteExpense(id: string) {
    if (!confirm("¿Eliminar este gasto?")) return;
    await supabase.from("cash_expenses").delete().eq("id", id);
    await loadExpenses();
  }

  async function saveClosure() {
    const counted = Number(countedCash || 0);
    if (countedCash === "" || isNaN(counted) || counted < 0) {
      alert("Captura un efectivo contado válido");
      return;
    }

    // Bloquear cierre si hay tickets preparados sin cobrar (anti-robo)
    const todayStart = new Date(`${today}T00:00:00`).toISOString();
    const todayEnd = new Date(`${today}T23:59:59`).toISOString();
    const { data: uncollected } = await supabase
      .from("orders")
      .select("id, customer_name, created_at, status, source")
      .in("payment_status", ["pendiente", null as any])
      .gte("created_at", todayStart)
      .lte("created_at", todayEnd);

    // Solo bloquear por tickets YA preparados (terminado) o de mostrador
    const blocking = (uncollected || []).filter((o: any) =>
      o.status === "terminado" || o.source === "mostrador"
    );

    if (blocking.length > 0) {
      const list = blocking.slice(0, 10).map((o: any) =>
        `• TK-${o.id.slice(0, 6)} — ${o.customer_name || "Mostrador"}`
      ).join("\n");
      alert(
        `No puedes cerrar caja. Hay ${blocking.length} ticket(s) preparados sin cobrar:\n\n${list}\n\n` +
        `Cobra o cancela estos tickets antes de hacer el cierre.`
      );
      return;
    }

    setSaving(true);

    const closedBy = (() => {
      try { return sessionStorage.getItem("pin_name") || sessionStorage.getItem("pin_role") || null; }
      catch { return null; }
    })();

    const payload: any = {
      closure_date: today,
      expected_cash: Math.ceil(stats.efectivoEsperado),
      counted_cash: Math.ceil(counted),
      difference: difference,
      notes: closureNotes.trim() || null,
      total_sales: Math.ceil(stats.totalVentas),
      total_cxc: Math.ceil(stats.totalCxc),
      total_card: Math.ceil(stats.totalTarjeta),
      total_transfer: Math.ceil(stats.totalTransferencia),
      total_general: Math.ceil(stats.totalGeneral),
      total_expenses: Math.ceil(stats.totalGastos),
      initial_amount: Number(stats.fondoInicial.toFixed(2)),
      closed_by: closedBy,
    };
    // Denominaciones del cierre (si el usuario las capturó)
    for (const d of DENOMINATIONS) {
      payload[d.key] = Number(closureDenoms[d.key] || 0);
    }

    // Siempre insertar un nuevo registro de cierre (cada corte es independiente)
    const { error } = await supabase.from("cash_closures").insert([payload]);
    if (error) { alert("Error al guardar cierre"); console.log(error); setSaving(false); return; }

    alert("Cierre de caja guardado");
    // Recargar para que el siguiente corte solo cuente movimientos nuevos
    await Promise.all([loadTodayClosure(), loadClosureHistory()]);
    // Limpiar formulario para el siguiente corte
    setCountedCash("");
    setClosureNotes("");
    setClosureDenoms({});
    setSaving(false);
  }

  // ─── Exportar cierre a PDF ─────────────────────────────────
  async function exportClosurePDF(closure?: CashClosure | null) {
    const supabaseRef = supabase;
    const cl = closure || todayClosure;
    // Si no hay cierre, usar stats en vivo
    const useLive = !cl;
    const closureDate = cl?.closure_date || today;
    const closureTime = cl?.created_at ? fmtDateTime(cl.created_at) : fmtDateTime(new Date().toISOString());
    const closedBy = cl?.closed_by || "";

    const totalVentas = cl ? Number(cl.total_sales || 0) : stats.totalVentas;
    const totalCxc = cl ? Number(cl.total_cxc || 0) : stats.totalCxc;
    const totalTarjeta = cl ? Number(cl.total_card || 0) : stats.totalTarjeta;
    const totalTransfer = cl ? Number(cl.total_transfer || 0) : stats.totalTransferencia;
    const totalGeneral = cl ? Number(cl.total_general || 0) : stats.totalGeneral;
    const totalGastos = cl ? Number(cl.total_expenses || 0) : stats.totalGastos;
    const fondoIni = cl ? Number(cl.initial_amount || 0) : stats.fondoInicial;
    const esperado = cl ? Number(cl.expected_cash || 0) : stats.efectivoEsperado;
    const contado = cl ? Number(cl.counted_cash || 0) : 0;
    const diferencia = cl ? Number(cl.difference || 0) : 0;

    // Obtener datos extra del día
    const dayStart = new Date(`${closureDate}T00:00:00`).toISOString();
    const dayEnd = new Date(`${closureDate}T23:59:59`).toISOString();

    const [movRes, expRes, creditRes] = await Promise.all([
      supabaseRef.from("cash_movements").select("*").gte("created_at", dayStart).lte("created_at", dayEnd).order("created_at", { ascending: true }),
      supabaseRef.from("cash_expenses").select("*").gte("created_at", dayStart).lte("created_at", dayEnd).order("created_at", { ascending: true }),
      supabaseRef.from("orders").select("id, customer_name, created_at, payment_method").eq("payment_method", "credito").gte("created_at", dayStart).lte("created_at", dayEnd),
    ]);

    const dayMovements = (movRes.data || []) as Movement[];
    const dayExpenses = (expRes.data || []) as CashExpense[];
    const creditOrders = creditRes.data || [];

    const cancelled = dayMovements.filter((m: any) => m.is_cancelled);
    const active = dayMovements.filter((m: any) => !m.is_cancelled);
    const creditoNuevo = creditOrders.reduce((a: number, o: any) => a + Number(o.total || 0), 0);

    // ─── Generar PDF ───
    const doc = new jsPDF({ unit: "mm", format: "letter" });
    const W = doc.internal.pageSize.getWidth();
    let y = 18;
    const marginL = 16;
    const marginR = W - 16;
    const colW = marginR - marginL;

    function addPage() { doc.addPage(); y = 18; }
    function checkPage(need: number) { if (y + need > 270) addPage(); }

    // Header
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("SERGIO'S CARNICERIA", W / 2, y, { align: "center" });
    y += 8;
    doc.setFontSize(14);
    doc.text("REPORTE DE CIERRE DE CAJA", W / 2, y, { align: "center" });
    y += 8;
    doc.setDrawColor(123, 34, 24);
    doc.setLineWidth(0.8);
    doc.line(marginL, y, marginR, y);
    y += 7;

    // Info general
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Fecha: ${fmtDate(closureDate)}`, marginL, y);
    doc.text(`Registrado: ${closureTime}`, marginR, y, { align: "right" });
    y += 5;
    if (closedBy) { doc.text(`Cerrado por: ${closedBy}`, marginL, y); y += 5; }
    y += 3;

    // ── Sección helper ──
    function sectionTitle(title: string) {
      checkPage(12);
      doc.setFillColor(123, 34, 24);
      doc.rect(marginL, y, colW, 7, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(title, marginL + 3, y + 5);
      doc.setTextColor(0, 0, 0);
      y += 10;
    }

    function row(label: string, value: string, bold = false) {
      checkPage(6);
      doc.setFontSize(9);
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.text(label, marginL + 2, y);
      doc.text(value, marginR - 2, y, { align: "right" });
      y += 5;
    }

    function separator() {
      checkPage(4);
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
      doc.line(marginL, y, marginR, y);
      y += 3;
    }

    // ═══ RESUMEN GENERAL ═══
    sectionTitle("RESUMEN GENERAL");
    row("Fondo inicial", `$${money(fondoIni)}`);
    row("Total ventas (contado)", `$${money(totalVentas)}`, true);
    row("Cobros CxC (abonos)", `$${money(totalCxc)}`);
    row("Crédito nuevo del día", `$${money(creditoNuevo)}`);
    separator();
    row("Total general", `$${money(totalGeneral)}`, true);
    y += 3;

    // ═══ DESGLOSE POR MÉTODO ═══
    sectionTitle("DESGLOSE POR METODO DE PAGO");
    const ventasEf = active.filter((m: any) => m.type === "venta" && m.payment_method === "efectivo").reduce((a: number, m: any) => a + Number(m.amount || 0), 0);
    const ventasTj = active.filter((m: any) => m.type === "venta" && m.payment_method === "tarjeta").reduce((a: number, m: any) => a + Number(m.amount || 0), 0);
    const ventasTr = active.filter((m: any) => m.type === "venta" && m.payment_method === "transferencia").reduce((a: number, m: any) => a + Number(m.amount || 0), 0);
    const cxcEf = active.filter((m: any) => m.type === "cxc_pago" && m.payment_method === "efectivo").reduce((a: number, m: any) => a + Number(m.amount || 0), 0);
    const cxcTj = active.filter((m: any) => m.type === "cxc_pago" && m.payment_method === "tarjeta").reduce((a: number, m: any) => a + Number(m.amount || 0), 0);
    const cxcTr = active.filter((m: any) => m.type === "cxc_pago" && m.payment_method === "transferencia").reduce((a: number, m: any) => a + Number(m.amount || 0), 0);

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("", marginL + 2, y);
    doc.text("Efectivo", marginL + 70, y, { align: "right" });
    doc.text("Tarjeta", marginL + 110, y, { align: "right" });
    doc.text("Transf.", marginR - 2, y, { align: "right" });
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.text("Ventas", marginL + 2, y);
    doc.text(`$${money(ventasEf)}`, marginL + 70, y, { align: "right" });
    doc.text(`$${money(ventasTj)}`, marginL + 110, y, { align: "right" });
    doc.text(`$${money(ventasTr)}`, marginR - 2, y, { align: "right" });
    y += 5;
    doc.text("Cobros CxC", marginL + 2, y);
    doc.text(`$${money(cxcEf)}`, marginL + 70, y, { align: "right" });
    doc.text(`$${money(cxcTj)}`, marginL + 110, y, { align: "right" });
    doc.text(`$${money(cxcTr)}`, marginR - 2, y, { align: "right" });
    y += 5;
    separator();
    doc.setFont("helvetica", "bold");
    doc.text("Total", marginL + 2, y);
    doc.text(`$${money(ventasEf + cxcEf)}`, marginL + 70, y, { align: "right" });
    doc.text(`$${money(ventasTj + cxcTj)}`, marginL + 110, y, { align: "right" });
    doc.text(`$${money(ventasTr + cxcTr)}`, marginR - 2, y, { align: "right" });
    y += 8;

    // ═══ GASTOS ═══
    sectionTitle("GASTOS / SALIDAS");
    if (dayExpenses.length === 0) {
      doc.setFontSize(9); doc.setFont("helvetica", "italic");
      doc.text("Sin gastos registrados", marginL + 2, y); y += 5;
    } else {
      for (const e of dayExpenses) {
        checkPage(6);
        row(e.concept || e.category, `-$${money(e.amount)}`);
      }
      separator();
      row("Total gastos", `-$${money(totalGastos)}`, true);
    }
    y += 3;

    // ═══ CANCELACIONES ═══
    if (cancelled.length > 0) {
      sectionTitle("CANCELACIONES");
      const montoCancel = cancelled.reduce((a: number, m: any) => a + Number(m.amount || 0), 0);
      row("Tickets cancelados", String(cancelled.length));
      row("Monto total cancelado", `$${money(montoCancel)}`, true);
      y += 2;
      for (const m of cancelled) {
        checkPage(10);
        doc.setFontSize(8); doc.setFont("helvetica", "normal");
        const hora = m.created_at ? new Date(m.created_at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) : "";
        doc.text(`${hora} — $${money(m.amount)} — ${m.cashier_name || "—"} — ${(m as any).cancel_reason || "Sin motivo"}`, marginL + 2, y);
        y += 4;
      }
      y += 3;
    }

    // ═══ ARQUEO DE CAJA ═══
    if (cl) {
      sectionTitle("ARQUEO DE CAJA");
      row("Efectivo esperado", `$${money(esperado)}`);
      row("Efectivo contado", `$${money(contado)}`);
      const sign = diferencia >= 0 ? "+" : "";
      row("Diferencia", `${sign}$${money(diferencia)}`, true);

      // Denominaciones
      const hasDenoms = DENOMINATIONS.some((d) => Number((cl as any)[d.key] || 0) > 0);
      if (hasDenoms) {
        y += 2;
        doc.setFontSize(8); doc.setFont("helvetica", "bold");
        doc.text("Denominaciones:", marginL + 2, y); y += 4;
        doc.setFont("helvetica", "normal");
        for (const d of DENOMINATIONS) {
          const cant = Number((cl as any)[d.key] || 0);
          if (cant > 0) {
            checkPage(5);
            doc.text(`${d.label} x ${cant} = $${money(cant * d.value)}`, marginL + 4, y);
            y += 4;
          }
        }
      }
      y += 3;
    }

    // ═══ MOVIMIENTOS DEL DÍA ═══
    sectionTitle("DETALLE DE MOVIMIENTOS (" + active.length + ")");
    doc.setFontSize(7); doc.setFont("helvetica", "bold");
    doc.text("Hora", marginL + 2, y);
    doc.text("Tipo", marginL + 22, y);
    doc.text("Metodo", marginL + 55, y);
    doc.text("Cajera", marginL + 85, y);
    doc.text("Monto", marginR - 2, y, { align: "right" });
    y += 4;
    doc.setFont("helvetica", "normal");

    for (const m of active) {
      checkPage(5);
      const hora = m.created_at ? new Date(m.created_at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) : "";
      doc.text(hora, marginL + 2, y);
      doc.text(typeName(m.type), marginL + 22, y);
      doc.text(methodName(m.payment_method), marginL + 55, y);
      doc.text((m.cashier_name || "").slice(0, 12), marginL + 85, y);
      doc.text(`$${money(m.amount)}`, marginR - 2, y, { align: "right" });
      y += 4;
    }

    // ═══ NOTAS ═══
    const notes = cl?.notes || "";
    if (notes) {
      y += 3;
      checkPage(12);
      doc.setFontSize(9); doc.setFont("helvetica", "italic");
      doc.text(`Notas: ${notes}`, marginL + 2, y, { maxWidth: colW - 4 });
      y += 8;
    }

    // Footer
    checkPage(15);
    y += 5;
    doc.setDrawColor(123, 34, 24);
    doc.setLineWidth(0.5);
    doc.line(marginL, y, marginR, y);
    y += 5;
    doc.setFontSize(8); doc.setFont("helvetica", "normal");
    doc.text("Sergio's Carniceria — Reporte generado automaticamente", W / 2, y, { align: "center" });
    y += 4;
    doc.text(new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City" }), W / 2, y, { align: "center" });

    // Guardar
    const fname = `Cierre_Caja_${closureDate}.pdf`;
    doc.save(fname);
  }

  function buildExportRows() {
    const rows: (string | number)[][] = [
      ["Fecha", "Tipo", "Método", "Monto", "Cajera", "Origen", "Referencia", "Cancelado"],
    ];
    for (const m of movements) {
      rows.push([
        fmtDateTime(m.created_at),
        typeName(m.type),
        methodName(m.payment_method),
        Number(Number(m.amount || 0).toFixed(2)),
        m.cashier_name || "",
        m.source || "",
        m.reference_id?.slice(0, 8) || "",
        m.is_cancelled ? "Sí" : "",
      ]);
    }
    for (const e of expenses) {
      rows.push([
        fmtDateTime(e.created_at),
        "Gasto",
        "Efectivo",
        Number(-Math.abs(Number(e.amount || 0)).toFixed(2)),
        "",
        e.category,
        e.concept,
        "",
      ]);
    }
    return rows;
  }

  function exportCSV() {
    const rows = buildExportRows();
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `caja_${dateFrom}_${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportXLSX() {
    const rows = buildExportRows();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    // Anchos de columna razonables
    (ws as any)["!cols"] = [
      { wch: 20 }, { wch: 12 }, { wch: 14 }, { wch: 12 },
      { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 10 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Movimientos");

    // Hoja de resumen
    const resumen = [
      ["Caja — Resumen del rango"],
      ["Del", dateFrom, "al", dateTo],
      [],
      ["Métrica", "Monto"],
      ["Fondo inicial", Number(stats.fondoInicial.toFixed(2))],
      ["Ventas efectivo", Number(stats.ventasEfectivo.toFixed(2))],
      ["Ventas tarjeta", Number(stats.ventasTarjeta.toFixed(2))],
      ["Ventas transferencia", Number(stats.ventasTransferencia.toFixed(2))],
      ["Total ventas", Number(stats.totalVentas.toFixed(2))],
      ["Cobros CxC efectivo", Number(stats.cxcEfectivo.toFixed(2))],
      ["Cobros CxC tarjeta", Number(stats.cxcTarjeta.toFixed(2))],
      ["Cobros CxC transferencia", Number(stats.cxcTransferencia.toFixed(2))],
      ["Total CxC", Number(stats.totalCxc.toFixed(2))],
      ["Gastos del día", Number(stats.totalGastos.toFixed(2))],
      ["Efectivo esperado", Number(stats.efectivoEsperado.toFixed(2))],
      ["Total general", Number(stats.totalGeneral.toFixed(2))],
      ["Tickets", stats.ticketCount],
      ["Ticket promedio", Number(stats.ticketPromedio.toFixed(2))],
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(resumen);
    (ws2 as any)["!cols"] = [{ wch: 30 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, ws2, "Resumen");

    XLSX.writeFile(wb, `caja_${dateFrom}_${dateTo}.xlsx`);
  }

  // ─── Render ────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(180deg, ${C.bgSoft} 0%, ${C.bg} 100%)`, fontFamily: "Arial, sans-serif" }}>
        <div style={{ padding: "18px 22px", borderRadius: 18, background: C.cardStrong, border: `1px solid ${C.border}`, boxShadow: C.shadow, color: C.text }}>Cargando caja...</div>
      </div>
    );
  }

  const isAdmin = userRole === "admin";

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: "resumen", label: "Resumen", icon: "📊" },
    { id: "apertura", label: "Apertura", icon: "🔓" },
    { id: "gastos", label: "Gastos", icon: "💸" },
    { id: "reconteo", label: "Reconteo", icon: "🔄" },
    { id: "cierre", label: "Cierre", icon: "🔒" },
    { id: "historial", label: "Historial", icon: "📋" },
    ...(isAdmin ? [{ id: "reportes" as Tab, label: "Reportes", icon: "📈" }] : []),
  ];

  return (
    <div style={pageStyle}>
      {/* Estilos de impresión — oculta todo menos el ticket activo */}
      <style jsx global>{`
        @media print {
          body * { visibility: hidden !important; }
          .ticket-print-active, .ticket-print-active * { visibility: visible !important; }
          .ticket-print-active { position: absolute !important; left: 0; top: 0; width: 100%; padding: 20px; }
          @page { size: 80mm auto; margin: 6mm; }
        }
      `}</style>

      <div style={glowTL} />
      <div style={glowTR} />

      <div style={shell}>
        {/* Header */}
        <div style={topBar}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <img src="/logo.png" alt="Sergios" style={{ width: 80, height: "auto" }} />
            <div>
              <h1 style={{ margin: 0, color: C.text }}>Caja</h1>
              <p style={{ margin: "4px 0 0", color: C.muted, fontSize: 14 }}>
                Apertura, gastos, corte y reportes
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/" style={btnSec}>Inicio</Link>
            <Link href="/cobranza" style={btnSec}>Cobranza</Link>
            <Link href="/admin/dashboard" style={btnSec}>Dashboard</Link>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: "10px 16px",
                borderRadius: 14,
                border: tab === t.id ? "none" : `1px solid ${C.border}`,
                background: tab === t.id ? `linear-gradient(180deg, ${C.primary} 0%, ${C.primaryDark} 100%)` : "rgba(255,255,255,0.75)",
                color: tab === t.id ? "white" : C.text,
                fontWeight: 700,
                cursor: "pointer",
                fontSize: 14,
                boxShadow: tab === t.id ? "0 6px 14px rgba(123, 34, 24, 0.20)" : "none",
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Date filter - show on resumen, gastos, historial, reportes */}
        {(tab === "resumen" || tab === "gastos" || tab === "historial" || tab === "reportes") && (
          <div style={filterCard}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
              <div>
                <div style={fieldLabel}>Desde</div>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={inputSt} />
              </div>
              <div>
                <div style={fieldLabel}>Hasta</div>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={inputSt} />
              </div>
            </div>
          </div>
        )}

        {/* ═══ TAB: RESUMEN ═══ */}
        {tab === "resumen" && (
          <>
            {/* Arqueo en vivo — solo si el rango es hoy */}
            {dateFrom === today && dateTo === today && (
              <div style={{
                marginBottom: 18,
                padding: 18,
                borderRadius: 22,
                background: `linear-gradient(135deg, ${C.primary} 0%, ${C.primaryDark} 100%)`,
                boxShadow: "0 10px 24px rgba(91, 25, 15, 0.18)",
                color: "white",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, opacity: 0.85 }}>⚡ Arqueo en vivo</div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>Efectivo que debe haber en caja ahora</div>
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>
                    {todayClosure ? `Último corte: ${fmtDateTime(todayClosure.created_at)} · dif ${Number(todayClosure.difference || 0) >= 0 ? "+" : ""}$${money(todayClosure.difference)}` : "Sin cierre aún"}
                  </div>
                </div>
                <div style={{ fontSize: 46, fontWeight: 800, lineHeight: 1, marginBottom: 12 }}>
                  ${money(stats.efectivoEsperado)}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, fontSize: 13 }}>
                  <div style={{ background: "rgba(255,255,255,0.15)", padding: "8px 12px", borderRadius: 12 }}>
                    <div style={{ opacity: 0.75, fontSize: 11 }}>Fondo inicial</div>
                    <div style={{ fontWeight: 800 }}>${money(stats.fondoInicial)}</div>
                  </div>
                  <div style={{ background: "rgba(255,255,255,0.15)", padding: "8px 12px", borderRadius: 12 }}>
                    <div style={{ opacity: 0.75, fontSize: 11 }}>+ Ingresos efectivo</div>
                    <div style={{ fontWeight: 800 }}>${money(stats.totalEfectivoIngreso)}</div>
                  </div>
                  <div style={{ background: "rgba(255,255,255,0.15)", padding: "8px 12px", borderRadius: 12 }}>
                    <div style={{ opacity: 0.75, fontSize: 11 }}>− Gastos</div>
                    <div style={{ fontWeight: 800 }}>−${money(stats.totalGastos)}</div>
                  </div>
                  <div style={{ background: "rgba(255,255,255,0.22)", padding: "8px 12px", borderRadius: 12 }}>
                    <div style={{ opacity: 0.75, fontSize: 11 }}>{stats.ticketCount} ticket{stats.ticketCount === 1 ? "" : "s"}</div>
                    <div style={{ fontWeight: 800 }}>prom. ${money(stats.ticketPromedio)}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Filtro por turno/cajera */}
            <div style={{
              marginBottom: 18, padding: 14, borderRadius: 18,
              background: C.cardStrong, border: `1px solid ${C.border}`, boxShadow: C.shadow,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                <div style={{ fontWeight: 800, color: C.text, fontSize: 15 }}>🕑 Corte por turno / cajera</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button onClick={exportXLSX} style={{ ...btnSec, background: "rgba(31,122,77,0.12)", color: C.success }}>📊 Exportar Excel</button>
                  <button onClick={exportCSV} style={btnSec}>📄 CSV</button>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
                <div>
                  <div style={fieldLabel}>Cajera</div>
                  <select value={filterCashier} onChange={(e) => setFilterCashier(e.target.value)} style={inputSt}>
                    <option value="__all__">Todas las cajeras</option>
                    {cashiersInRange.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div style={fieldLabel}>Desde (hora)</div>
                  <input type="time" value={filterTimeFrom} onChange={(e) => setFilterTimeFrom(e.target.value)} style={inputSt} />
                </div>
                <div>
                  <div style={fieldLabel}>Hasta (hora)</div>
                  <input type="time" value={filterTimeTo} onChange={(e) => setFilterTimeTo(e.target.value)} style={inputSt} />
                </div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
                  <button
                    onClick={() => { setFilterCashier("__all__"); setFilterTimeFrom(""); setFilterTimeTo(""); }}
                    style={{ ...btnSec, flex: 1 }}
                    disabled={!hasTurnFilter}
                  >
                    Limpiar
                  </button>
                </div>
              </div>
              {hasTurnFilter && (
                <div style={{ marginTop: 12, padding: 12, borderRadius: 14, background: C.bgSoft, border: `1px solid ${C.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                    <div style={{ fontSize: 13, color: C.muted }}>
                      <b style={{ color: C.text }}>{turnStats.count} movimiento{turnStats.count === 1 ? "" : "s"}</b> · {turnStats.ventas} venta{turnStats.ventas === 1 ? "" : "s"} · Total: <b style={{ color: C.text }}>${money(turnStats.total)}</b>
                    </div>
                    <button onClick={() => { setShowPartialTicket(true); setTimeout(() => window.print(), 50); }} style={btnPri}>
                      🖨️ Corte parcial e imprimir
                    </button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8, fontSize: 12 }}>
                    <DetailCell label="Efectivo" value={`$${money(turnStats.totalEfectivo)}`} />
                    <DetailCell label="Tarjeta" value={`$${money(turnStats.totalTarjeta)}`} />
                    <DetailCell label="Transfer." value={`$${money(turnStats.totalTransferencia)}`} />
                    <DetailCell label="Ventas" value={`$${money(turnStats.totalVentas)}`} />
                    <DetailCell label="CxC" value={`$${money(turnStats.totalCxc)}`} />
                  </div>
                </div>
              )}
            </div>

            {/* Hero cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 18 }}>
              <HeroCard label="Fondo inicial" value={`$${money(stats.fondoInicial)}`} meta={todayOpening ? "Registrado hoy" : "Sin apertura"} accent />
              <HeroCard label="Efectivo esperado" value={`$${money(stats.efectivoEsperado)}`} meta="Fondo + ingresos - gastos" green />
              <HeroCard label="Tarjeta" value={`$${money(stats.totalTarjeta)}`} meta="Ventas + CxC" />
              <HeroCard label="Transferencia" value={`$${money(stats.totalTransferencia)}`} meta="Ventas + CxC" />
              <HeroCard label="Gastos del día" value={`$${money(stats.totalGastos)}`} meta={`${expenses.length} gasto${expenses.length === 1 ? "" : "s"}`} />
              <HeroCard label="Total general" value={`$${money(stats.totalGeneral)}`} meta={`${stats.totalMovements} mov.`} />
            </div>

            {/* Desglose ventas / CxC */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 18, marginBottom: 18 }}>
              <Panel title="Ventas" subtitle="Ingresos por venta">
                <MiniGrid>
                  <MiniCard label="Efectivo" value={`$${money(stats.ventasEfectivo)}`} />
                  <MiniCard label="Tarjeta" value={`$${money(stats.ventasTarjeta)}`} />
                  <MiniCard label="Transferencia" value={`$${money(stats.ventasTransferencia)}`} />
                  <MiniCard label="Total ventas" value={`$${money(stats.totalVentas)}`} strong />
                </MiniGrid>
                <div style={{ marginTop: 10, color: C.muted, fontSize: 13 }}>
                  {stats.ticketCount} ticket{stats.ticketCount === 1 ? "" : "s"} — promedio: ${money(stats.ticketPromedio)}
                </div>
              </Panel>

              <Panel title="Cobros CxC" subtitle="Pagos de clientes con adeudo">
                <MiniGrid>
                  <MiniCard label="Efectivo" value={`$${money(stats.cxcEfectivo)}`} />
                  <MiniCard label="Tarjeta" value={`$${money(stats.cxcTarjeta)}`} />
                  <MiniCard label="Transferencia" value={`$${money(stats.cxcTransferencia)}`} />
                  <MiniCard label="Total CxC" value={`$${money(stats.totalCxc)}`} strong />
                </MiniGrid>
              </Panel>
            </div>

            {/* Movimientos */}
            <Panel title={showCancelled ? "Tickets cancelados" : "Movimientos del rango"} subtitle={showCancelled ? `${cancelledMovements.length} cancelado${cancelledMovements.length === 1 ? "" : "s"}` : `${activeMovements.length} movimiento${activeMovements.length === 1 ? "" : "s"}`}>
              <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                <button
                  onClick={() => setShowCancelled(false)}
                  style={{ ...tabBtnSt, background: !showCancelled ? C.primary : "transparent", color: !showCancelled ? "white" : C.text }}
                >
                  Activos ({activeMovements.length})
                </button>
                <button
                  onClick={() => setShowCancelled(true)}
                  style={{ ...tabBtnSt, background: showCancelled ? C.danger : "transparent", color: showCancelled ? "white" : C.text, borderColor: showCancelled ? C.danger : C.border }}
                >
                  Cancelados ({cancelledMovements.length})
                </button>
              </div>

              {!showCancelled ? (
                activeMovements.length === 0 ? (
                  <EmptyBox>No hay movimientos en este rango</EmptyBox>
                ) : (
                  <div style={{ display: "grid", gap: 10, maxHeight: 500, overflowY: "auto" }}>
                    {activeMovements.map((m) => (
                      <div key={m.id} style={movCard}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 800, color: C.text }}>
                              {typeName(m.type)}
                              {m.reference_id && editedOrderIds.has(m.reference_id) && (
                                <span style={{ marginLeft: 8, display: "inline-block", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: "rgba(180,35,24,0.12)", color: C.danger }}>Editado</span>
                              )}
                            </div>
                            <div style={{ color: C.muted, fontSize: 13, marginTop: 2 }}>
                              {methodName(m.payment_method)} — {fmtDateTime(m.created_at)}
                              {m.cashier_name && <span> — {m.cashier_name}</span>}
                            </div>
                          </div>
                          <div style={{ ...amtBadge, background: m.payment_method === "efectivo" ? C.success : m.payment_method === "tarjeta" ? C.info : C.warning }}>
                            ${money(m.amount)}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                          {m.reference_id && (
                            <button onClick={() => openDesglose(m)} style={desgloseBtnSt}>
                              Ver desglose
                            </button>
                          )}
                          <button onClick={() => { setCancelMovement(m); setCancelCode(""); setCancelReason(""); setCancelError(""); }} style={cancelBtnSt}>
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                cancelledMovements.length === 0 ? (
                  <EmptyBox>No hay tickets cancelados en este rango</EmptyBox>
                ) : (
                  <div style={{ display: "grid", gap: 10, maxHeight: 500, overflowY: "auto" }}>
                    {cancelledMovements.map((m) => (
                      <div key={m.id} style={{ ...movCard, borderLeft: `4px solid ${C.danger}`, opacity: 0.85 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 800, color: C.danger }}>CANCELADO — {typeName(m.type)}</div>
                            <div style={{ color: C.muted, fontSize: 13, marginTop: 2 }}>
                              {methodName(m.payment_method)} — {fmtDateTime(m.created_at)}
                            </div>
                            <div style={{ color: C.danger, fontSize: 13, marginTop: 4, fontWeight: 700 }}>
                              Motivo: {m.cancel_reason || "Sin motivo"}
                            </div>
                            <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>
                              Canceló: <b>{m.cancelled_by || "—"}</b> — {fmtDateTime(m.cancelled_at)}
                            </div>
                          </div>
                          <div style={{ ...amtBadge, background: C.danger, textDecoration: "line-through" }}>
                            ${money(m.amount)}
                          </div>
                        </div>
                        {m.reference_id && (
                          <div style={{ marginTop: 8 }}>
                            <button onClick={() => openDesglose(m)} style={desgloseBtnSt}>
                              Ver desglose
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )
              )}
            </Panel>

            {/* Panel de cancelaciones detalladas (colapsable) */}
            {cancelledMovements.length > 0 && (() => {
              const totalMontoCancelado = cancelledMovements.reduce((a, m) => a + Number(m.amount || 0), 0);
              return (
                <div style={{ marginTop: 18 }}>
                  <button
                    onClick={() => setShowCancelPanel(!showCancelPanel)}
                    style={{
                      width: "100%", padding: "14px 18px", borderRadius: 18,
                      border: `1px solid rgba(180,35,24,0.18)`, background: "rgba(180,35,24,0.06)",
                      cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center",
                    }}
                  >
                    <span style={{ fontWeight: 800, color: C.danger, fontSize: 15 }}>
                      Cancelaciones del rango ({cancelledMovements.length})
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontWeight: 800, color: C.danger, fontSize: 16 }}>-${money(totalMontoCancelado)}</span>
                      <span style={{ fontSize: 18, color: C.muted }}>{showCancelPanel ? "▲" : "▼"}</span>
                    </span>
                  </button>
                  {showCancelPanel && (
                    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderTop: "none", borderRadius: "0 0 18px 18px", padding: 14 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 14 }}>
                        <div style={{ background: "rgba(180,35,24,0.08)", borderRadius: 14, padding: 12 }}>
                          <div style={{ color: C.muted, fontSize: 12 }}>Total cancelaciones</div>
                          <div style={{ color: C.danger, fontSize: 22, fontWeight: 800 }}>{cancelledMovements.length}</div>
                        </div>
                        <div style={{ background: "rgba(180,35,24,0.08)", borderRadius: 14, padding: 12 }}>
                          <div style={{ color: C.muted, fontSize: 12 }}>Monto total</div>
                          <div style={{ color: C.danger, fontSize: 22, fontWeight: 800 }}>-${money(totalMontoCancelado)}</div>
                        </div>
                      </div>
                      <div style={{ display: "grid", gap: 10, maxHeight: 400, overflowY: "auto" }}>
                        {cancelledMovements.map((m) => (
                          <div key={m.id} style={{ padding: 12, borderRadius: 14, background: C.bgSoft, border: `1px solid ${C.border}`, borderLeft: `4px solid ${C.danger}` }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 700, color: C.text, fontSize: 14 }}>
                                  {typeName(m.type)} — {methodName(m.payment_method)}
                                </div>
                                <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>
                                  {fmtDateTime(m.created_at)}
                                  {m.cashier_name && <span> — {m.cashier_name}</span>}
                                </div>
                                <div style={{ color: C.danger, fontSize: 13, marginTop: 4, fontWeight: 700 }}>
                                  Motivo: {m.cancel_reason || "Sin motivo"}
                                </div>
                                <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>
                                  Cancelo: <b>{m.cancelled_by || "—"}</b> — {fmtDateTime(m.cancelled_at)}
                                </div>
                              </div>
                              <div style={{ ...amtBadge, background: C.danger, fontSize: 14, textDecoration: "line-through" }}>
                                ${money(m.amount)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </>
        )}

        {/* ═══ TAB: APERTURA ═══ */}
        {tab === "apertura" && (
          <Panel title="Apertura de caja" subtitle="Registra el fondo inicial contando billetes y monedas">
            {todayOpening && (
              <div style={{ padding: 14, borderRadius: 16, background: "rgba(31,122,77,0.10)", border: `1px solid ${C.border}`, marginBottom: 16 }}>
                <b style={{ color: C.success }}>Apertura registrada hoy:</b> ${money(todayOpening.initial_amount)}
                {todayOpening.notes && <div style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>{todayOpening.notes}</div>}
              </div>
            )}

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 800, color: C.text, fontSize: 18, marginBottom: 4 }}>Billetes</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
                {DENOMINATIONS.filter((d) => d.key.startsWith("bills")).map((d) => (
                  <div key={d.key} style={{ background: C.bgSoft, border: `1px solid ${C.border}`, borderRadius: 16, padding: 12 }}>
                    <div style={{ color: C.muted, fontSize: 12, marginBottom: 4 }}>{d.label}</div>
                    <input
                      type="number"
                      min="0"
                      value={denomDrafts[d.key] || ""}
                      onChange={(e) => setDenomDrafts((p) => ({ ...p, [d.key]: e.target.value }))}
                      placeholder="0"
                      style={{ ...inputSt, padding: 10, fontSize: 16, fontWeight: 700 }}
                    />
                    <div style={{ color: C.text, fontSize: 12, marginTop: 4, fontWeight: 700 }}>
                      = ${money(Number(denomDrafts[d.key] || 0) * d.value)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 800, color: C.text, fontSize: 18, marginBottom: 4 }}>Monedas</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
                {DENOMINATIONS.filter((d) => d.key.startsWith("coins")).map((d) => (
                  <div key={d.key} style={{ background: C.bgSoft, border: `1px solid ${C.border}`, borderRadius: 16, padding: 12 }}>
                    <div style={{ color: C.muted, fontSize: 12, marginBottom: 4 }}>{d.label}</div>
                    <input
                      type="number"
                      min="0"
                      value={denomDrafts[d.key] || ""}
                      onChange={(e) => setDenomDrafts((p) => ({ ...p, [d.key]: e.target.value }))}
                      placeholder="0"
                      style={{ ...inputSt, padding: 10, fontSize: 16, fontWeight: 700 }}
                    />
                    <div style={{ color: C.text, fontSize: 12, marginTop: 4, fontWeight: 700 }}>
                      = ${money(Number(denomDrafts[d.key] || 0) * d.value)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ padding: 16, borderRadius: 18, background: `linear-gradient(180deg, ${C.primary} 0%, ${C.primaryDark} 100%)`, marginBottom: 14 }}>
              <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 14 }}>Total fondo inicial</div>
              <div style={{ color: "white", fontSize: 34, fontWeight: 800 }}>${money(openingTotal)}</div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={fieldLabel}>Notas (opcional)</div>
              <textarea value={openingNotes} onChange={(e) => setOpeningNotes(e.target.value)} style={textareaSt} placeholder="Observaciones de la apertura..." />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button onClick={saveOpening} disabled={saving} style={btnPri}>
                {saving ? "Guardando..." : todayOpening ? "Actualizar apertura" : "Guardar apertura"}
              </button>
            </div>
          </Panel>
        )}

        {/* ═══ TAB: GASTOS ═══ */}
        {tab === "gastos" && (
          <GastosTab
            expenses={expenses}
            totalGastos={stats.totalGastos}
            saving={saving}
            expConcept={expConcept}
            setExpConcept={setExpConcept}
            expAmount={expAmount}
            setExpAmount={setExpAmount}
            expCategory={expCategory}
            setExpCategory={setExpCategory}
            expNotes={expNotes}
            setExpNotes={setExpNotes}
            saveExpense={saveExpense}
            deleteExpense={deleteExpense}
          />
        )}

        {/* ═══ TAB: RECONTEO ═══ */}
        {tab === "reconteo" && (
          <Panel title="Reconteo a medio turno" subtitle="Verifica que el efectivo cuadre sin cerrar la caja">
            <div style={{ background: C.bgSoft, border: `1px solid ${C.border}`, borderRadius: 18, padding: 14, display: "grid", gap: 10, marginBottom: 14 }}>
              <SummaryRow label="Fondo inicial" value={`$${money(stats.fondoInicial)}`} />
              <SummaryRow label="(+) Ingresos efectivo" value={`$${money(stats.totalEfectivoIngreso)}`} />
              <SummaryRow label="(-) Gastos del día" value={`-$${money(stats.totalGastos)}`} color={C.danger} />
              <div style={{ borderTop: `2px solid ${C.border}`, paddingTop: 10 }}>
                <SummaryRow label="= Efectivo esperado" value={`$${money(stats.efectivoEsperado)}`} bold />
              </div>
              <SummaryRow label="Efectivo contado" value={`$${money(reconteoDenomTotal)}`} />
              <SummaryRow
                label="Diferencia"
                value={`${reconteoDifference >= 0 ? "+" : ""}$${money(reconteoDifference)}`}
                color={reconteoDifference === 0 ? C.success : reconteoDifference > 0 ? C.info : C.danger}
                bold
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 800, color: C.text, fontSize: 18, marginBottom: 4 }}>Billetes</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
                {DENOMINATIONS.filter((d) => d.key.startsWith("bills")).map((d) => (
                  <div key={d.key} style={{ background: C.bgSoft, border: `1px solid ${C.border}`, borderRadius: 16, padding: 12 }}>
                    <div style={{ color: C.muted, fontSize: 12, marginBottom: 4 }}>{d.label}</div>
                    <input
                      type="number" min="0"
                      value={reconteoDenoms[d.key] || ""}
                      onChange={(e) => setReconteoDenoms((p) => ({ ...p, [d.key]: e.target.value }))}
                      placeholder="0"
                      style={{ ...inputSt, padding: 10, fontSize: 16, fontWeight: 700 }}
                    />
                    <div style={{ color: C.text, fontSize: 12, marginTop: 4, fontWeight: 700 }}>
                      = ${money(Number(reconteoDenoms[d.key] || 0) * d.value)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 800, color: C.text, fontSize: 18, marginBottom: 4 }}>Monedas</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
                {DENOMINATIONS.filter((d) => d.key.startsWith("coins")).map((d) => (
                  <div key={d.key} style={{ background: C.bgSoft, border: `1px solid ${C.border}`, borderRadius: 16, padding: 12 }}>
                    <div style={{ color: C.muted, fontSize: 12, marginBottom: 4 }}>{d.label}</div>
                    <input
                      type="number" min="0"
                      value={reconteoDenoms[d.key] || ""}
                      onChange={(e) => setReconteoDenoms((p) => ({ ...p, [d.key]: e.target.value }))}
                      placeholder="0"
                      style={{ ...inputSt, padding: 10, fontSize: 16, fontWeight: 700 }}
                    />
                    <div style={{ color: C.text, fontSize: 12, marginTop: 4, fontWeight: 700 }}>
                      = ${money(Number(reconteoDenoms[d.key] || 0) * d.value)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ padding: 16, borderRadius: 18, background: `linear-gradient(180deg, ${C.primary} 0%, ${C.primaryDark} 100%)`, marginBottom: 14 }}>
              <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 14 }}>Total contado</div>
              <div style={{ color: "white", fontSize: 34, fontWeight: 800 }}>${money(reconteoDenomTotal)}</div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ color: C.muted, fontWeight: 700, fontSize: 14, marginBottom: 6 }}>Notas del reconteo</div>
              <textarea value={reconteoNotes} onChange={(e) => setReconteoNotes(e.target.value)} style={{ width: "100%", minHeight: 80, padding: 14, borderRadius: 16, border: `1px solid ${C.border}`, boxSizing: "border-box" as const, outline: "none", background: "rgba(255,255,255,0.82)", color: C.text, fontSize: 15, resize: "vertical" as const }} placeholder="Observaciones..." />
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={saveReconteo} disabled={saving} style={{ padding: "16px 24px", borderRadius: 16, border: "none", background: `linear-gradient(180deg, ${C.primary} 0%, ${C.primaryDark} 100%)`, color: "white", fontWeight: 800, fontSize: 16, cursor: "pointer" }}>
                {saving ? "Guardando..." : "Guardar reconteo"}
              </button>
              <button onClick={resetReconteo} style={{ padding: "16px 24px", borderRadius: 16, border: `1px solid ${C.border}`, background: "white", color: C.text, fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
                Limpiar
              </button>
            </div>

            {reconteoSaved && (
              <div style={{ marginTop: 14, padding: 14, borderRadius: 18, background: "rgba(31,122,77,0.10)", border: `1px solid ${C.border}` }}>
                <div style={{ fontWeight: 800, color: C.text }}>Reconteo registrado</div>
                <div style={{ color: C.muted, fontSize: 14, marginTop: 4 }}>
                  Contado: <b>${money(reconteoDenomTotal)}</b> — Esperado: <b>${money(stats.efectivoEsperado)}</b> — Diferencia: <b>{reconteoDifference >= 0 ? "+" : ""}${money(reconteoDifference)}</b>
                </div>
              </div>
            )}
          </Panel>
        )}

        {/* ═══ TAB: CIERRE ═══ */}
        {tab === "cierre" && (
          <Panel title="Cierre de caja" subtitle="Cuenta billete por billete y compara contra sistema">
            <div style={{ background: C.bgSoft, border: `1px solid ${C.border}`, borderRadius: 18, padding: 14, display: "grid", gap: 10, marginBottom: 14 }}>
              <SummaryRow label="Fondo inicial" value={`$${money(stats.fondoInicial)}`} />
              <SummaryRow label="(+) Ingresos efectivo" value={`$${money(stats.totalEfectivoIngreso)}`} />
              <SummaryRow label="(-) Gastos del día" value={`-$${money(stats.totalGastos)}`} color={C.danger} />
              <div style={{ borderTop: `2px solid ${C.border}`, paddingTop: 10 }}>
                <SummaryRow label="= Efectivo esperado" value={`$${money(stats.efectivoEsperado)}`} bold />
              </div>
              <SummaryRow label="Efectivo contado" value={`$${money(Number(countedCash || 0))}`} />
              <SummaryRow
                label="Diferencia"
                value={`${difference >= 0 ? "+" : ""}$${money(difference)}`}
                color={difference === 0 ? C.success : difference > 0 ? C.info : C.danger}
                bold
              />
            </div>

            {/* Selector de modo */}
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <button onClick={() => setUseDenoms(true)} style={{
                flex: 1, padding: "10px 14px", borderRadius: 12,
                border: `1px solid ${useDenoms ? C.primary : C.border}`,
                background: useDenoms ? C.primary : "white",
                color: useDenoms ? "white" : C.text,
                fontWeight: 700, fontSize: 14, cursor: "pointer",
              }}>Contar billetes y monedas</button>
              <button onClick={() => setUseDenoms(false)} style={{
                flex: 1, padding: "10px 14px", borderRadius: 12,
                border: `1px solid ${!useDenoms ? C.primary : C.border}`,
                background: !useDenoms ? C.primary : "white",
                color: !useDenoms ? "white" : C.text,
                fontWeight: 700, fontSize: 14, cursor: "pointer",
              }}>Capturar total manual</button>
            </div>

            {useDenoms ? (
              <>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 800, color: C.text, fontSize: 18, marginBottom: 4 }}>Billetes</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
                    {DENOMINATIONS.filter((d) => d.key.startsWith("bills")).map((d) => (
                      <div key={d.key} style={{ background: C.bgSoft, border: `1px solid ${C.border}`, borderRadius: 16, padding: 12 }}>
                        <div style={{ color: C.muted, fontSize: 12, marginBottom: 4 }}>{d.label}</div>
                        <input
                          type="number" min="0"
                          value={closureDenoms[d.key] || ""}
                          onChange={(e) => setClosureDenoms((p) => ({ ...p, [d.key]: e.target.value }))}
                          placeholder="0"
                          style={{ ...inputSt, padding: 10, fontSize: 16, fontWeight: 700 }}
                        />
                        <div style={{ color: C.text, fontSize: 12, marginTop: 4, fontWeight: 700 }}>
                          = ${money(Number(closureDenoms[d.key] || 0) * d.value)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 800, color: C.text, fontSize: 18, marginBottom: 4 }}>Monedas</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
                    {DENOMINATIONS.filter((d) => d.key.startsWith("coins")).map((d) => (
                      <div key={d.key} style={{ background: C.bgSoft, border: `1px solid ${C.border}`, borderRadius: 16, padding: 12 }}>
                        <div style={{ color: C.muted, fontSize: 12, marginBottom: 4 }}>{d.label}</div>
                        <input
                          type="number" min="0"
                          value={closureDenoms[d.key] || ""}
                          onChange={(e) => setClosureDenoms((p) => ({ ...p, [d.key]: e.target.value }))}
                          placeholder="0"
                          style={{ ...inputSt, padding: 10, fontSize: 16, fontWeight: 700 }}
                        />
                        <div style={{ color: C.text, fontSize: 12, marginTop: 4, fontWeight: 700 }}>
                          = ${money(Number(closureDenoms[d.key] || 0) * d.value)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ padding: 16, borderRadius: 18, background: `linear-gradient(180deg, ${C.primary} 0%, ${C.primaryDark} 100%)`, marginBottom: 14 }}>
                  <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 14 }}>Total contado</div>
                  <div style={{ color: "white", fontSize: 34, fontWeight: 800 }}>${money(closureDenomTotal)}</div>
                </div>
              </>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14, marginBottom: 14 }}>
                <div>
                  <div style={fieldLabel}>Efectivo contado</div>
                  <input type="number" step="0.01" min="0" value={countedCash} onChange={(e) => setCountedCash(e.target.value)} style={inputSt} placeholder="0.00" />
                </div>
              </div>
            )}

            <div style={{ marginBottom: 14 }}>
              <div style={fieldLabel}>Notas del cierre</div>
              <textarea value={closureNotes} onChange={(e) => setClosureNotes(e.target.value)} style={textareaSt} placeholder="Observaciones, faltantes, sobrantes..." />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
              {todayClosure && (
                <button
                  onClick={async () => {
                    // Consultar crédito nuevo del rango (orders con payment_method=credito)
                    const start = new Date(`${dateFrom}T00:00:00`).toISOString();
                    const end = new Date(`${dateTo}T23:59:59`).toISOString();
                    const { data: creditOrders } = await supabase
                      .from("orders")
                      .select("id, order_items(kilos, price, quantity, sale_type, prepared_kilos, is_fixed_price_piece)")
                      .eq("payment_method", "credito")
                      .gte("created_at", start)
                      .lte("created_at", end);
                    let creditoNuevo = 0;
                    for (const ord of (creditOrders || [])) {
                      for (const it of (ord.order_items || [])) {
                        const itAny = it as any;
                        if (itAny.sale_type === "pieza" && itAny.is_fixed_price_piece) {
                          creditoNuevo += (Number(itAny.quantity) || 0) * (Number(itAny.price) || 0);
                        } else {
                          const kg = Number(itAny.prepared_kilos || itAny.kilos || 0);
                          creditoNuevo += kg * (Number(itAny.price) || 0);
                        }
                      }
                    }

                    const now = new Date();
                    const cutData: CashCutData = {
                      type: "cierre",
                      cashier: todayClosure.closed_by || undefined,
                      date: now.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" }),
                      time: now.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }),
                      totalSales: stats.totalVentas,
                      totalCash: stats.totalEfectivoIngreso,
                      totalCard: stats.totalTarjeta,
                      totalTransfer: stats.totalTransferencia,
                      totalCxC: stats.totalCxc,
                      totalExpenses: stats.totalGastos,
                      expectedCash: stats.efectivoEsperado,
                      countedCash: Number(todayClosure.counted_cash || 0),
                      difference: Number(todayClosure.difference || 0),
                      ticketCount: stats.ticketCount,
                      creditoNuevo: moneyRound(creditoNuevo),
                      cobrosCxC: stats.totalCxc,
                      cancelaciones: cancelledMovements.length,
                      montoCancelado: cancelledMovements.reduce((a, m) => a + Number(m.amount || 0), 0),
                      expensesList: expenses.map((e) => ({ concept: e.concept, amount: Number(e.amount || 0) })),
                      fondoInicial: stats.fondoInicial,
                    };
                    const ok = await printCashCut(cutData);
                    if (!ok) alert("No se pudo imprimir. Verifica la conexión de la impresora.");
                  }}
                  style={btnSec}
                >
                  🖨️ Imprimir ticket de cierre
                </button>
              )}
              <button onClick={() => exportClosurePDF()} style={btnSec}>
                📄 Exportar PDF
              </button>
              <button onClick={saveClosure} disabled={saving} style={btnPri}>
                {saving ? "Guardando..." : todayClosure ? "Nuevo corte de caja" : "Guardar cierre"}
              </button>
            </div>

            {todayClosure && (
              <div style={{ marginTop: 16, padding: 14, borderRadius: 18, background: "rgba(31,122,77,0.10)", border: `1px solid ${C.border}` }}>
                <div style={{ fontWeight: 800, color: C.text, marginBottom: 8 }}>Último cierre guardado hoy</div>
                <div style={{ color: C.muted, fontSize: 14 }}>Esperado: <b>${money(todayClosure.expected_cash)}</b> — Contado: <b>${money(todayClosure.counted_cash)}</b> — Diferencia: <b>${money(todayClosure.difference)}</b></div>
                <div style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>Guardado: {fmtDateTime(todayClosure.created_at)}{todayClosure.closed_by ? ` · Por ${todayClosure.closed_by}` : ""}</div>
              </div>
            )}
          </Panel>
        )}

        {/* ═══ TAB: HISTORIAL ═══ */}
        {tab === "historial" && (
          <Panel title="Historial de cierres" subtitle="Últimos 30 cierres registrados">
            {closureHistory.length === 0 ? (
              <EmptyBox>No hay cierres registrados</EmptyBox>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {closureHistory.map((cl) => {
                  const d = Number(cl.difference || 0);
                  const dc = d === 0 ? C.success : d > 0 ? C.info : C.danger;
                  return (
                    <div key={cl.id} style={movCard}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
                        <div>
                          <div style={{ fontWeight: 800, color: C.text, fontSize: 18 }}>{fmtDate(cl.closure_date)}</div>
                          <div style={{ color: C.muted, fontSize: 13 }}>Registrado: {fmtDateTime(cl.created_at)}</div>
                        </div>
                        <div style={{ ...amtBadge, background: dc }}>{d >= 0 ? "+" : ""}${money(d)}</div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
                        <DetailCell label="Esperado" value={`$${money(cl.expected_cash)}`} />
                        <DetailCell label="Contado" value={`$${money(cl.counted_cash)}`} />
                        <DetailCell label="Ventas" value={`$${money(cl.total_sales)}`} />
                        <DetailCell label="CxC" value={`$${money(cl.total_cxc)}`} />
                        <DetailCell label="Tarjeta" value={`$${money(cl.total_card)}`} />
                        <DetailCell label="Transfer." value={`$${money(cl.total_transfer)}`} />
                        <DetailCell label="Total" value={`$${money(cl.total_general)}`} bold />
                      </div>
                      {cl.notes && <div style={{ marginTop: 8, padding: 8, borderRadius: 10, background: "rgba(166,106,16,0.08)", color: C.muted, fontSize: 12, fontStyle: "italic" }}>{cl.notes}</div>}
                      <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
                        <button onClick={() => exportClosurePDF(cl)} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 10, padding: "5px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600, color: C.primary }}>
                          📄 Exportar PDF
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        )}

        {/* ═══ TAB: REPORTES ═══ */}
        {tab === "reportes" && (
          <>
            <Panel title="Ventas últimos 7 días" subtitle="Gráfica de ingresos diarios">
              <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 200, padding: "10px 0" }}>
                {weekReport.map((d) => {
                  const pct = (d.total / weekMax) * 100;
                  const dayLabel = fmtDate(d.date);
                  return (
                    <div key={d.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <div style={{ fontSize: 11, color: C.text, fontWeight: 700 }}>${money(d.total)}</div>
                      <div style={{ width: "100%", maxWidth: 50, height: `${Math.max(pct, 4)}%`, borderRadius: 8, background: d.date === today ? `linear-gradient(180deg, ${C.primary} 0%, ${C.primaryDark} 100%)` : `linear-gradient(180deg, rgba(123,34,24,0.25) 0%, rgba(123,34,24,0.12) 100%)`, transition: "height 0.3s" }} />
                      <div style={{ fontSize: 10, color: C.muted, textAlign: "center", lineHeight: 1.2 }}>{dayLabel}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ textAlign: "center", color: C.text, fontWeight: 800, fontSize: 18, marginTop: 8 }}>
                Total semana: ${money(weekTotal)}
              </div>
            </Panel>

            <div style={{ height: 18 }} />

            <Panel title="Desglose semanal" subtitle="Por método de pago">
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr>
                      {["Día", "Ventas", "CxC", "Efectivo", "Tarjeta", "Transf.", "Total", "Tickets"].map((h) => (
                        <th key={h} style={{ padding: "10px 8px", textAlign: "left", borderBottom: `2px solid ${C.border}`, color: C.muted, fontSize: 12, fontWeight: 700 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {weekReport.map((d) => (
                      <tr key={d.date} style={{ background: d.date === today ? "rgba(123,34,24,0.06)" : "transparent" }}>
                        <td style={tdSt}><b>{fmtDate(d.date)}</b></td>
                        <td style={tdSt}>${money(d.ventas)}</td>
                        <td style={tdSt}>${money(d.cxc)}</td>
                        <td style={tdSt}>${money(d.efectivo)}</td>
                        <td style={tdSt}>${money(d.tarjeta)}</td>
                        <td style={tdSt}>${money(d.transferencia)}</td>
                        <td style={{ ...tdSt, fontWeight: 800 }}>${money(d.total)}</td>
                        <td style={tdSt}>{d.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>

            <div style={{ height: 18 }} />

            {/* Comparativo entre dias */}
            <Panel title="Comparativo entre dias" subtitle="Ventas, gastos, credito, cancelaciones y diferencia">
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr>
                      {["Dia", "Ventas", "Gastos", "CxC", "Cancel.", "Monto cancel.", "Diferencia (V-G)"].map((h) => (
                        <th key={h} style={{ padding: "10px 8px", textAlign: "left", borderBottom: `2px solid ${C.border}`, color: C.muted, fontSize: 12, fontWeight: 700 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {weekReport.map((d) => {
                      const diff = d.ventas - d.gastos;
                      return (
                        <tr key={d.date + "-comp"} style={{ background: d.date === today ? "rgba(123,34,24,0.06)" : "transparent" }}>
                          <td style={tdSt}><b>{fmtDate(d.date)}</b></td>
                          <td style={tdSt}>${money(d.ventas)}</td>
                          <td style={{ ...tdSt, color: C.danger }}>{d.gastos > 0 ? `-$${money(d.gastos)}` : "$0"}</td>
                          <td style={tdSt}>${money(d.cxc)}</td>
                          <td style={tdSt}>{d.cancelaciones}</td>
                          <td style={{ ...tdSt, color: d.montoCancelado > 0 ? C.danger : C.text }}>{d.montoCancelado > 0 ? `-$${money(d.montoCancelado)}` : "$0"}</td>
                          <td style={{ ...tdSt, fontWeight: 800, color: diff >= 0 ? C.success : C.danger }}>{diff >= 0 ? "+" : "-"}${money(Math.abs(diff))}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>

            <div style={{ height: 18 }} />

            {/* Grafica de barras: ventas vs gastos */}
            <Panel title="Ventas vs Gastos por dia" subtitle="Barras comparativas (ultimos 7 dias)">
              {(() => {
                const maxVal = Math.max(...weekReport.map((d) => Math.max(d.ventas, d.gastos)), 1);
                return (
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 220, padding: "10px 0" }}>
                    {weekReport.map((d) => {
                      const ventasPct = (d.ventas / maxVal) * 100;
                      const gastosPct = (d.gastos / maxVal) * 100;
                      const dayLabel = fmtDate(d.date);
                      return (
                        <div key={d.date + "-bar"} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                          <div style={{ fontSize: 10, color: C.success, fontWeight: 700 }}>${money(d.ventas)}</div>
                          <div style={{ display: "flex", gap: 2, alignItems: "flex-end", width: "100%", justifyContent: "center", height: 160 }}>
                            <div style={{
                              width: "40%", maxWidth: 28,
                              height: `${Math.max(ventasPct, 3)}%`,
                              borderRadius: "6px 6px 0 0",
                              background: d.date === today
                                ? `linear-gradient(180deg, ${C.success} 0%, #16603d 100%)`
                                : `linear-gradient(180deg, rgba(31,122,77,0.5) 0%, rgba(31,122,77,0.25) 100%)`,
                              transition: "height 0.3s",
                            }} />
                            <div style={{
                              width: "40%", maxWidth: 28,
                              height: `${Math.max(gastosPct, 3)}%`,
                              borderRadius: "6px 6px 0 0",
                              background: d.date === today
                                ? `linear-gradient(180deg, ${C.danger} 0%, #8b1a12 100%)`
                                : `linear-gradient(180deg, rgba(180,35,24,0.5) 0%, rgba(180,35,24,0.25) 100%)`,
                              transition: "height 0.3s",
                            }} />
                          </div>
                          <div style={{ fontSize: 10, color: C.danger, fontWeight: 700 }}>{d.gastos > 0 ? `-$${money(d.gastos)}` : ""}</div>
                          <div style={{ fontSize: 10, color: C.muted, textAlign: "center", lineHeight: 1.2 }}>{dayLabel}</div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
              <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 8, fontSize: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 14, height: 14, borderRadius: 4, background: C.success }} />
                  <span style={{ color: C.text, fontWeight: 600 }}>Ventas</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 14, height: 14, borderRadius: 4, background: C.danger }} />
                  <span style={{ color: C.text, fontWeight: 600 }}>Gastos</span>
                </div>
              </div>
            </Panel>

            <div style={{ height: 18 }} />

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={exportCSV} style={btnPri}>
                Exportar CSV (Excel)
              </button>
              <button onClick={exportXLSX} style={btnSec}>
                📊 Exportar XLSX
              </button>
            </div>
          </>
        )}
      </div>

      {/* ═══ MODAL: DESGLOSE ═══ */}
      {desgloseMovement && (
        <div style={modalOverlay}>
          <div style={modalCard}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, color: C.text, fontSize: 20 }}>Desglose del ticket</h2>
              <button onClick={() => setDesgloseMovement(null)} style={closeBtn}>✕</button>
            </div>

            <div style={{ padding: 12, borderRadius: 14, background: C.bgSoft, border: `1px solid ${C.border}`, marginBottom: 14 }}>
              <div style={{ color: C.muted, fontSize: 13 }}>
                {typeName(desgloseMovement.type)} — {methodName(desgloseMovement.payment_method)} — {fmtDateTime(desgloseMovement.created_at)}
              </div>
              {desgloseMovement.cashier_name && (
                <div style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>Cajera: <b>{desgloseMovement.cashier_name}</b></div>
              )}
              <div style={{ color: C.text, fontWeight: 800, fontSize: 22, marginTop: 6 }}>${money(desgloseMovement.amount)}</div>
            </div>

            {desgloseLoading ? (
              <div style={{ padding: 16, textAlign: "center", color: C.muted }}>Cargando...</div>
            ) : desgloseItems.length === 0 ? (
              <div style={{ padding: 16, borderRadius: 14, background: C.bgSoft, border: `1px dashed ${C.border}`, color: C.muted }}>No se encontraron artículos para este ticket</div>
            ) : (
              <div style={{ display: "grid", gap: 6 }}>
                {desgloseItems.map((item) => {
                  const qty = item.sale_type === "pieza" ? Number(item.quantity || 0) : Number(item.kilos || 0);
                  const unit = item.sale_type === "pieza" ? "pz" : "kg";
                  const subtotal = qty * Number(item.price || 0);
                  return (
                    <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: 12, background: "white", border: `1px solid ${C.border}` }}>
                      <div>
                        <div style={{ fontWeight: 700, color: C.text }}>{item.product}</div>
                        <div style={{ color: C.muted, fontSize: 13 }}>{qty} {unit} × ${Math.ceil(Number(item.price || 0))}</div>
                      </div>
                      <div style={{ fontWeight: 800, color: C.text }}>${Math.ceil(subtotal)}</div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Sección: Ticket fue editado */}
            {desgloseEditInfo && (
              <div style={{ marginTop: 16, padding: 14, borderRadius: 14, background: "rgba(180,35,24,0.06)", border: "1px solid rgba(180,35,24,0.15)" }}>
                <div style={{ fontWeight: 800, color: C.danger, fontSize: 15, marginBottom: 6 }}>
                  Ticket editado
                </div>
                <div style={{ color: C.muted, fontSize: 13, marginBottom: 10 }}>
                  Por: <b>{desgloseEditInfo.edited_by}</b> — {new Date(desgloseEditInfo.edited_at).toLocaleString("es-MX", { timeZone: "America/Mexico_City" })}
                </div>

                {desgloseEditInfo.original_items.length > 0 && (
                  <>
                    <div style={{ fontWeight: 700, color: C.text, fontSize: 13, marginBottom: 6 }}>Items originales (antes de edición):</div>
                    <div style={{ display: "grid", gap: 4 }}>
                      {desgloseEditInfo.original_items.map((item, i) => {
                        const qty = Number(item.prepared_kilos || item.kilos || 0);
                        const subtotal = qty * Number(item.price || 0);
                        return (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", borderRadius: 8, background: "rgba(180,35,24,0.04)", fontSize: 13 }}>
                            <span style={{ color: C.text }}>{item.product} — {qty} kg × ${Math.ceil(Number(item.price || 0))}</span>
                            <span style={{ fontWeight: 700, color: C.danger, textDecoration: "line-through" }}>${Math.ceil(subtotal)}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ marginTop: 8, fontWeight: 800, color: C.danger, fontSize: 14, textAlign: "right" }}>
                      Total original: ${Math.ceil(desgloseEditInfo.original_items.reduce((s, i) => s + Number(i.prepared_kilos || i.kilos || 0) * Number(i.price || 0), 0))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ MODAL: CANCELAR ═══ */}
      {cancelMovement && (
        <div style={modalOverlay}>
          <div style={modalCard}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, color: C.danger, fontSize: 20 }}>Cancelar movimiento</h2>
              <button onClick={() => setCancelMovement(null)} style={closeBtn}>✕</button>
            </div>

            <div style={{ padding: 12, borderRadius: 14, background: "rgba(180,35,24,0.06)", border: "1px solid rgba(180,35,24,0.12)", marginBottom: 14 }}>
              <div style={{ color: C.text, fontWeight: 700 }}>{typeName(cancelMovement.type)} — ${money(cancelMovement.amount)}</div>
              <div style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>{methodName(cancelMovement.payment_method)} — {fmtDateTime(cancelMovement.created_at)}</div>
            </div>

            {cancelError && (
              <div style={{ padding: 12, borderRadius: 12, background: "rgba(180,35,24,0.08)", border: "1px solid rgba(180,35,24,0.15)", color: C.danger, fontSize: 14, fontWeight: 600, marginBottom: 14 }}>
                {cancelError}
              </div>
            )}

            <div style={{ marginBottom: 14 }}>
              <div style={fieldLabel}>Código de cajera *</div>
              <input
                type="password"
                value={cancelCode}
                onChange={(e) => setCancelCode(e.target.value)}
                placeholder="Ingresa tu código"
                style={inputSt}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={fieldLabel}>Motivo de cancelación *</div>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Escribe por qué se cancela este cobro..."
                style={{ ...textareaSt, minHeight: 80 }}
              />
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={cancelMovement_fn}
                disabled={cancelSaving}
                style={{ ...btnDanger, flex: 1, opacity: cancelSaving ? 0.65 : 1 }}
              >
                {cancelSaving ? "Cancelando..." : "Confirmar cancelación"}
              </button>
              <button onClick={() => setCancelMovement(null)} style={{ ...btnSec, flex: 1 }}>
                Volver
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ TICKET DE CIERRE IMPRIMIBLE ═══ */}
      {todayClosure && (
        <div id="ticket-cierre-print" className={showPartialTicket ? "" : "ticket-print-active"} style={{ display: "none" }}>
          <div style={{ fontFamily: "monospace", color: "#000", fontSize: 12, lineHeight: 1.4 }}>
            <div style={{ textAlign: "center", marginBottom: 10 }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>SERGIO&apos;S CARNICERÍA</div>
              <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4 }}>CIERRE DE CAJA</div>
              <div style={{ fontSize: 11 }}>{fmtDate(todayClosure.closure_date)}</div>
              <div style={{ fontSize: 10 }}>Impreso: {new Date().toLocaleString("es-MX")}</div>
              {todayClosure.closed_by && <div style={{ fontSize: 10 }}>Cerró: {todayClosure.closed_by}</div>}
            </div>

            <div style={{ borderTop: "1px dashed #000", borderBottom: "1px dashed #000", padding: "6px 0", marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Fondo inicial:</span><span>${money(todayClosure.initial_amount ?? stats.fondoInicial)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Ventas:</span><span>${money(todayClosure.total_sales)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Cobros CxC:</span><span>${money(todayClosure.total_cxc)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Gastos:</span><span>-${money(todayClosure.total_expenses ?? stats.totalGastos)}</span>
              </div>
            </div>

            <div style={{ fontWeight: 700, marginBottom: 6 }}>POR MÉTODO DE PAGO:</div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Efectivo (ventas+CxC):</span><span>${money(stats.totalEfectivoIngreso)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Tarjeta:</span><span>${money(todayClosure.total_card)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Transferencia:</span><span>${money(todayClosure.total_transfer)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, borderTop: "1px dashed #000", paddingTop: 3, marginTop: 3 }}>
                <span>TOTAL GENERAL:</span><span>${money(todayClosure.total_general)}</span>
              </div>
            </div>

            {/* Denominaciones */}
            {DENOMINATIONS.some((d) => Number((todayClosure as any)[d.key] || 0) > 0) && (
              <>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>DESGLOSE EFECTIVO CONTADO:</div>
                <div style={{ marginBottom: 8 }}>
                  {DENOMINATIONS.map((d) => {
                    const cant = Number((todayClosure as any)[d.key] || 0);
                    if (cant === 0) return null;
                    return (
                      <div key={d.key} style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>{d.label} × {cant}</span><span>${money(cant * d.value)}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            <div style={{ borderTop: "2px solid #000", paddingTop: 6, marginBottom: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
                <span>Efectivo esperado:</span><span>${money(todayClosure.expected_cash)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
                <span>Efectivo contado:</span><span>${money(todayClosure.counted_cash)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 14, marginTop: 4 }}>
                <span>DIFERENCIA:</span><span>{Number(todayClosure.difference || 0) >= 0 ? "+" : ""}${money(todayClosure.difference)}</span>
              </div>
            </div>

            {todayClosure.notes && (
              <div style={{ borderTop: "1px dashed #000", paddingTop: 6, marginBottom: 6, fontStyle: "italic", fontSize: 11 }}>
                Notas: {todayClosure.notes}
              </div>
            )}

            <div style={{ textAlign: "center", marginTop: 14, fontSize: 10 }}>
              _______________________<br />
              Firma cajera<br /><br />
              _______________________<br />
              Firma supervisor
            </div>
          </div>
        </div>
      )}

      {/* ═══ TICKET DE CORTE PARCIAL (POR TURNO/CAJERA) ═══ */}
      {showPartialTicket && hasTurnFilter && (
        <div id="ticket-turno-print" className="ticket-print-active" style={{ display: "none" }}>
          <div style={{ fontFamily: "monospace", color: "#000", fontSize: 12, lineHeight: 1.4 }}>
            <div style={{ textAlign: "center", marginBottom: 10 }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>SERGIO&apos;S CARNICERÍA</div>
              <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4 }}>CORTE PARCIAL</div>
              <div style={{ fontSize: 11 }}>{fmtDate(dateFrom)}{dateFrom !== dateTo ? ` — ${fmtDate(dateTo)}` : ""}</div>
              <div style={{ fontSize: 10 }}>Impreso: {new Date().toLocaleString("es-MX")}</div>
            </div>

            <div style={{ borderTop: "1px dashed #000", borderBottom: "1px dashed #000", padding: "6px 0", marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Cajera:</span><span><b>{filterCashier === "__all__" ? "Todas" : filterCashier}</b></span>
              </div>
              {(filterTimeFrom || filterTimeTo) && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Horario:</span><span>{filterTimeFrom || "—"} a {filterTimeTo || "—"}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Movimientos:</span><span>{turnStats.count}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Tickets de venta:</span><span>{turnStats.ventas}</span>
              </div>
            </div>

            <div style={{ fontWeight: 700, marginBottom: 4 }}>VENTAS:</div>
            <div style={{ marginBottom: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Efectivo:</span><span>${money(turnStats.ventasEfectivo)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Tarjeta:</span><span>${money(turnStats.ventasTarjeta)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Transferencia:</span><span>${money(turnStats.ventasTransferencia)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, borderTop: "1px dashed #000", paddingTop: 3, marginTop: 3 }}>
                <span>Total ventas:</span><span>${money(turnStats.totalVentas)}</span>
              </div>
            </div>

            <div style={{ fontWeight: 700, marginBottom: 4 }}>COBROS CxC:</div>
            <div style={{ marginBottom: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Efectivo:</span><span>${money(turnStats.cxcEfectivo)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Tarjeta:</span><span>${money(turnStats.cxcTarjeta)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Transferencia:</span><span>${money(turnStats.cxcTransferencia)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, borderTop: "1px dashed #000", paddingTop: 3, marginTop: 3 }}>
                <span>Total CxC:</span><span>${money(turnStats.totalCxc)}</span>
              </div>
            </div>

            <div style={{ borderTop: "2px solid #000", paddingTop: 6, marginBottom: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Total efectivo:</span><span>${money(turnStats.totalEfectivo)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Total tarjeta:</span><span>${money(turnStats.totalTarjeta)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Total transferencia:</span><span>${money(turnStats.totalTransferencia)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 14, marginTop: 4 }}>
                <span>TOTAL TURNO:</span><span>${money(turnStats.total)}</span>
              </div>
            </div>

            <div style={{ textAlign: "center", marginTop: 14, fontSize: 10 }}>
              _______________________<br />
              Firma cajera<br /><br />
              _______________________<br />
              Firma supervisor
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Gastos Tab (extracted for clarity) ──────────────────────
function GastosTab({
  expenses, totalGastos, saving,
  expConcept, setExpConcept, expAmount, setExpAmount,
  expCategory, setExpCategory, expNotes, setExpNotes,
  saveExpense, deleteExpense,
}: {
  expenses: CashExpense[];
  totalGastos: number;
  saving: boolean;
  expConcept: string;
  setExpConcept: (v: string) => void;
  expAmount: string;
  setExpAmount: (v: string) => void;
  expCategory: string;
  setExpCategory: (v: string) => void;
  expNotes: string;
  setExpNotes: (v: string) => void;
  saveExpense: () => void;
  deleteExpense: (id: string) => void;
}) {
  // Group expenses by category
  const grouped = useMemo(() => {
    const map: Record<string, { items: CashExpense[]; total: number }> = {};
    for (const e of expenses) {
      const cat = e.category || "varios";
      if (!map[cat]) map[cat] = { items: [], total: 0 };
      map[cat].items.push(e);
      map[cat].total += Number(e.amount || 0);
    }
    return Object.entries(map)
      .map(([cat, data]) => ({
        cat,
        label: EXPENSE_CATS.find((c) => c.value === cat)?.label || cat,
        ...data,
      }))
      .sort((a, b) => b.total - a.total);
  }, [expenses]);

  return (
    <>
      {/* Form */}
      <Panel title="Registrar gasto / salida de caja" subtitle="Todo lo que sale de la caja: materia prima, sueldos, insumos, etc.">
        {/* Category quick-select */}
        <div style={{ marginBottom: 14 }}>
          <div style={fieldLabel}>Tipo de gasto</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {EXPENSE_CATS.map((c) => (
              <button
                key={c.value}
                onClick={() => setExpCategory(c.value)}
                style={{
                  padding: "8px 14px",
                  borderRadius: 12,
                  border: expCategory === c.value ? "none" : `1px solid ${C.border}`,
                  background: expCategory === c.value
                    ? `linear-gradient(180deg, ${C.primary} 0%, ${C.primaryDark} 100%)`
                    : "rgba(255,255,255,0.75)",
                  color: expCategory === c.value ? "white" : C.text,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontSize: 13,
                  boxShadow: expCategory === c.value ? "0 4px 10px rgba(123, 34, 24, 0.18)" : "none",
                }}
                title={c.desc}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div style={{ color: C.muted, fontSize: 12, marginTop: 6 }}>
            {EXPENSE_CATS.find((c) => c.value === expCategory)?.desc || ""}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 14 }}>
          <div>
            <div style={fieldLabel}>Concepto / Descripción</div>
            <input value={expConcept} onChange={(e) => setExpConcept(e.target.value)} style={inputSt} placeholder="Ej: 5 kg de pollo, pago Juan semana 15..." />
          </div>
          <div>
            <div style={fieldLabel}>Monto ($)</div>
            <input type="number" step="0.01" min="0" value={expAmount} onChange={(e) => setExpAmount(e.target.value)} style={inputSt} placeholder="0.00" />
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <div style={fieldLabel}>Notas (opcional)</div>
          <input value={expNotes} onChange={(e) => setExpNotes(e.target.value)} style={inputSt} placeholder="Referencia, recibo, factura..." />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button onClick={saveExpense} disabled={saving} style={btnPri}>
            {saving ? "Guardando..." : "Registrar gasto"}
          </button>
        </div>
      </Panel>

      <div style={{ height: 18 }} />

      {/* Summary by category */}
      {grouped.length > 0 && (
        <>
          <Panel title="Resumen por tipo" subtitle={`Total salidas: $${money(totalGastos)}`}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
              {grouped.map((g) => (
                <div key={g.cat} style={{ background: C.bgSoft, border: `1px solid ${C.border}`, borderRadius: 16, padding: 14 }}>
                  <div style={{ color: C.muted, fontSize: 12, marginBottom: 4 }}>{g.label}</div>
                  <div style={{ color: C.danger, fontSize: 22, fontWeight: 800 }}>-${money(g.total)}</div>
                  <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>{g.items.length} registro{g.items.length === 1 ? "" : "s"}</div>
                </div>
              ))}
            </div>
          </Panel>
          <div style={{ height: 18 }} />
        </>
      )}

      {/* Full list */}
      <Panel title="Detalle de gastos" subtitle={`${expenses.length} gasto${expenses.length === 1 ? "" : "s"}`}>
        {expenses.length === 0 ? (
          <EmptyBox>No hay gastos en este rango</EmptyBox>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {expenses.map((e) => (
              <div key={e.id} style={movCard}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, color: C.text }}>{e.concept}</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                      <span style={{ display: "inline-block", padding: "4px 10px", borderRadius: 999, background: "rgba(180,35,24,0.10)", color: C.danger, fontSize: 12, fontWeight: 700 }}>
                        {EXPENSE_CATS.find((c) => c.value === e.category)?.label || e.category}
                      </span>
                      <span style={{ color: C.muted, fontSize: 13 }}>{fmtDateTime(e.created_at)}</span>
                    </div>
                    {e.notes && <div style={{ color: C.muted, fontSize: 12, marginTop: 4, fontStyle: "italic" }}>{e.notes}</div>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <div style={{ ...amtBadge, background: C.danger }}>-${money(e.amount)}</div>
                    <button onClick={() => deleteExpense(e.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: C.danger, padding: 4 }}>✕</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}

// ─── Sub-components ──────────────────────────────────────────
function HeroCard({ label, value, meta, green, accent }: { label: string; value: string; meta: string; green?: boolean; accent?: boolean }) {
  const bg = green
    ? `linear-gradient(180deg, ${C.success} 0%, #16603d 100%)`
    : accent
    ? `linear-gradient(180deg, ${C.primary} 0%, ${C.primaryDark} 100%)`
    : C.cardStrong;
  const textColor = green || accent ? "white" : C.text;
  const mutedColor = green || accent ? "rgba(255,255,255,0.85)" : C.muted;
  return (
    <div style={{ background: bg, border: green || accent ? "none" : `1px solid ${C.border}`, borderRadius: 22, padding: 18, boxShadow: green || accent ? `0 12px 26px rgba(31, 122, 77, 0.2)` : C.shadow }}>
      <div style={{ color: mutedColor, fontSize: 13, marginBottom: 6 }}>{label}</div>
      <div style={{ color: textColor, fontSize: 28, fontWeight: 800, lineHeight: 1.1 }}>{value}</div>
      <div style={{ color: mutedColor, fontSize: 12, marginTop: 6 }}>{meta}</div>
    </div>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div style={{ background: C.card, backdropFilter: "blur(10px)", border: `1px solid ${C.border}`, borderRadius: 24, padding: 18, boxShadow: C.shadow }}>
      <div style={{ marginBottom: 14 }}>
        <h2 style={{ margin: 0, color: C.text }}>{title}</h2>
        <p style={{ margin: "6px 0 0", color: C.muted, fontSize: 14 }}>{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function MiniGrid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>{children}</div>;
}

function MiniCard({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div style={{
      background: strong ? `linear-gradient(180deg, ${C.primary} 0%, ${C.primaryDark} 100%)` : C.bgSoft,
      border: strong ? "none" : `1px solid ${C.border}`,
      borderRadius: 16, padding: 12,
      boxShadow: strong ? "0 8px 16px rgba(123, 34, 24, 0.16)" : "none",
    }}>
      <div style={{ color: strong ? "rgba(255,255,255,0.85)" : C.muted, fontSize: 12, marginBottom: 4 }}>{label}</div>
      <div style={{ color: strong ? "white" : C.text, fontSize: 22, fontWeight: 800 }}>{value}</div>
    </div>
  );
}

function EmptyBox({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: 16, borderRadius: 18, background: C.bgSoft, border: `1px dashed ${C.border}`, color: C.muted }}>{children}</div>;
}

function SummaryRow({ label, value, color, bold }: { label: string; value: string; color?: string; bold?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, color: C.text }}>
      <span style={{ fontWeight: bold ? 800 : 400 }}>{label}</span>
      <b style={{ color: color || C.text, fontWeight: bold ? 800 : 700 }}>{value}</b>
    </div>
  );
}

function DetailCell({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ background: "white", border: `1px solid ${C.border}`, borderRadius: 12, padding: 8 }}>
      <div style={{ color: C.muted, fontSize: 11, marginBottom: 2 }}>{label}</div>
      <div style={{ color: C.text, fontSize: 14, fontWeight: bold ? 800 : 700 }}>{value}</div>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const pageStyle: React.CSSProperties = { minHeight: "100vh", background: `linear-gradient(180deg, ${C.bgSoft} 0%, ${C.bg} 100%)`, padding: 16, position: "relative", overflow: "hidden", fontFamily: "Arial, sans-serif" };
const glowTL: React.CSSProperties = { position: "absolute", top: -120, left: -100, width: 300, height: 300, borderRadius: "50%", background: "rgba(123, 34, 24, 0.08)", filter: "blur(45px)" };
const glowTR: React.CSSProperties = { position: "absolute", top: -80, right: -60, width: 280, height: 280, borderRadius: "50%", background: "rgba(217, 201, 163, 0.35)", filter: "blur(45px)" };
const shell: React.CSSProperties = { maxWidth: 1450, margin: "0 auto", position: "relative", zIndex: 2 };
const topBar: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 16 };
const filterCard: React.CSSProperties = { background: C.cardStrong, border: `1px solid ${C.border}`, borderRadius: 24, padding: 18, boxShadow: C.shadow, marginBottom: 18 };
const fieldLabel: React.CSSProperties = { color: C.muted, fontSize: 13, marginBottom: 6, fontWeight: 700 };
const inputSt: React.CSSProperties = { width: "100%", padding: 12, borderRadius: 14, border: `1px solid ${C.border}`, boxSizing: "border-box", outline: "none", background: "rgba(255,255,255,0.82)", color: C.text, fontSize: 15 };
const textareaSt: React.CSSProperties = { width: "100%", minHeight: 80, padding: 12, borderRadius: 14, border: `1px solid ${C.border}`, boxSizing: "border-box", outline: "none", background: "rgba(255,255,255,0.82)", color: C.text, fontSize: 15, resize: "vertical" };
const movCard: React.CSSProperties = { padding: 14, borderRadius: 16, background: C.bgSoft, border: `1px solid ${C.border}` };
const amtBadge: React.CSSProperties = { padding: "8px 12px", borderRadius: 14, color: "white", fontWeight: 800, fontSize: 16, whiteSpace: "nowrap", flexShrink: 0 };
const btnSec: React.CSSProperties = { display: "inline-block", padding: "10px 16px", borderRadius: 14, border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.75)", color: C.text, textDecoration: "none", fontWeight: 700, cursor: "pointer", fontSize: 14 };
const btnPri: React.CSSProperties = { display: "inline-block", padding: "12px 20px", borderRadius: 14, border: "none", background: `linear-gradient(180deg, ${C.primary} 0%, ${C.primaryDark} 100%)`, color: "white", fontWeight: 700, boxShadow: "0 8px 18px rgba(123, 34, 24, 0.20)", cursor: "pointer", fontSize: 15 };
const tdSt: React.CSSProperties = { padding: "8px", borderBottom: `1px solid ${C.border}`, color: C.text };
const tabBtnSt: React.CSSProperties = { padding: "10px 16px", borderRadius: 14, border: `1px solid ${C.border}`, fontWeight: 700, cursor: "pointer", fontSize: 14 };
const desgloseBtnSt: React.CSSProperties = { padding: "8px 14px", borderRadius: 12, border: `1px solid ${C.border}`, background: "white", color: C.info, fontWeight: 700, fontSize: 13, cursor: "pointer" };
const cancelBtnSt: React.CSSProperties = { padding: "8px 14px", borderRadius: 12, border: "none", background: "rgba(180,35,24,0.10)", color: C.danger, fontWeight: 700, fontSize: 13, cursor: "pointer" };
const btnDanger: React.CSSProperties = { display: "inline-block", padding: "12px 20px", borderRadius: 14, border: "none", background: `linear-gradient(180deg, ${C.danger} 0%, #8b1a12 100%)`, color: "white", fontWeight: 700, cursor: "pointer", fontSize: 15, boxShadow: "0 8px 18px rgba(180,35,24,0.20)" };
const modalOverlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 16 };
const modalCard: React.CSSProperties = { width: "100%", maxWidth: 520, background: "white", borderRadius: 22, padding: 24, boxShadow: C.shadow, border: `1px solid ${C.border}`, maxHeight: "90vh", overflowY: "auto" };
const closeBtn: React.CSSProperties = { width: 40, height: 40, borderRadius: 999, border: "none", background: "#efe8df", color: C.text, fontWeight: 800, fontSize: 18, cursor: "pointer" };
