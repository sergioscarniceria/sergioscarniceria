"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useCallback } from "react";
import { getSupabaseClient } from "@/lib/supabase";

// ─── Types ─────────────────────────────────────────────────────
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
  total_sales?: number | null;
  total_cxc?: number | null;
  total_card?: number | null;
  total_transfer?: number | null;
  total_general?: number | null;
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

type Tab = "resumen" | "apertura" | "gastos" | "cierre" | "historial" | "reportes";

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
  return Number(v || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function todayStr() {
  const n = new Date();
  return `${n.getFullYear()}-${`${n.getMonth() + 1}`.padStart(2, "0")}-${`${n.getDate()}`.padStart(2, "0")}`;
}

function fmtDateTime(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime()) ? v : d.toLocaleString("es-MX");
}

function fmtDate(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v + "T12:00:00");
  return isNaN(d.getTime()) ? v : d.toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" });
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

  // Closure form
  const [countedCash, setCountedCash] = useState("");
  const [closureNotes, setClosureNotes] = useState("");

  // Opening form
  const [denomDrafts, setDenomDrafts] = useState<Record<string, string>>({});
  const [openingNotes, setOpeningNotes] = useState("");

  // Expense form
  const [expConcept, setExpConcept] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [expCategory, setExpCategory] = useState("varios");
  const [expNotes, setExpNotes] = useState("");

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

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadMovements(), loadTodayClosure(), loadClosureHistory(), loadOpening(), loadExpenses(), loadWeekData()]);
      setLoading(false);
    })();
  }, [dateFrom, dateTo]);

  // ─── Computed stats ────────────────────────────────────────
  const stats = useMemo(() => {
    const ventas = movements.filter((m) => m.type === "venta");
    const cxc = movements.filter((m) => m.type === "cxc_pago");

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

    const totalGastos = expenses.reduce((a, e) => a + Number(e.amount || 0), 0);
    const fondoInicial = todayOpening?.initial_amount || 0;
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
      totalMovements: movements.length,
    };
  }, [movements, expenses, todayOpening]);

  // Week report data
  const weekReport = useMemo(() => {
    const days: Record<string, { ventas: number; cxc: number; efectivo: number; tarjeta: number; transferencia: number; count: number }> = {};
    const endDate = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(endDate.getDate() - i);
      const key = `${d.getFullYear()}-${`${d.getMonth()+1}`.padStart(2,"0")}-${`${d.getDate()}`.padStart(2,"0")}`;
      days[key] = { ventas: 0, cxc: 0, efectivo: 0, tarjeta: 0, transferencia: 0, count: 0 };
    }
    for (const m of weekData) {
      if (!m.created_at) continue;
      const key = m.created_at.slice(0, 10);
      if (!days[key]) continue;
      const amt = Number(m.amount || 0);
      if (m.type === "venta") { days[key].ventas += amt; days[key].count++; }
      if (m.type === "cxc_pago") days[key].cxc += amt;
      if (m.payment_method === "efectivo") days[key].efectivo += amt;
      if (m.payment_method === "tarjeta") days[key].tarjeta += amt;
      if (m.payment_method === "transferencia") days[key].transferencia += amt;
    }
    return Object.entries(days).map(([date, vals]) => ({ date, ...vals, total: vals.ventas + vals.cxc }));
  }, [weekData]);

  const weekMax = useMemo(() => Math.max(...weekReport.map((d) => d.total), 1), [weekReport]);
  const weekTotal = useMemo(() => weekReport.reduce((a, d) => a + d.total, 0), [weekReport]);

  const difference = useMemo(() => {
    return Number((Number(countedCash || 0) - stats.efectivoEsperado).toFixed(2));
  }, [countedCash, stats.efectivoEsperado]);

  // ─── Opening helpers ───────────────────────────────────────
  const openingTotal = useMemo(() => {
    let total = 0;
    for (const d of DENOMINATIONS) {
      total += Number(denomDrafts[d.key] || 0) * d.value;
    }
    return total;
  }, [denomDrafts]);

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
    setSaving(true);

    const payload = {
      closure_date: today,
      expected_cash: Number(stats.efectivoEsperado.toFixed(2)),
      counted_cash: Number(counted.toFixed(2)),
      difference: Number(difference.toFixed(2)),
      notes: closureNotes.trim() || null,
      total_sales: Number(stats.totalVentas.toFixed(2)),
      total_cxc: Number(stats.totalCxc.toFixed(2)),
      total_card: Number(stats.totalTarjeta.toFixed(2)),
      total_transfer: Number(stats.totalTransferencia.toFixed(2)),
      total_general: Number(stats.totalGeneral.toFixed(2)),
    };

    if (todayClosure?.id) {
      const { error } = await supabase.from("cash_closures").update(payload).eq("id", todayClosure.id);
      if (error) { alert("Error al actualizar cierre"); setSaving(false); return; }
    } else {
      const { error } = await supabase.from("cash_closures").insert([payload]);
      if (error) { alert("Error al guardar cierre"); setSaving(false); return; }
    }

    alert("Cierre de caja guardado");
    await loadTodayClosure();
    setSaving(false);
  }

  function exportCSV() {
    const rows = [["Fecha", "Tipo", "Método", "Monto", "Origen", "Referencia"]];
    for (const m of movements) {
      rows.push([
        fmtDateTime(m.created_at),
        typeName(m.type),
        methodName(m.payment_method),
        String(Number(m.amount || 0).toFixed(2)),
        m.source || "",
        m.reference_id?.slice(0, 8) || "",
      ]);
    }
    // Add expenses
    for (const e of expenses) {
      rows.push([
        fmtDateTime(e.created_at),
        "Gasto",
        "Efectivo",
        `-${Number(e.amount || 0).toFixed(2)}`,
        e.category,
        e.concept,
      ]);
    }
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `caja_${dateFrom}_${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ─── Render ────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(180deg, ${C.bgSoft} 0%, ${C.bg} 100%)`, fontFamily: "Arial, sans-serif" }}>
        <div style={{ padding: "18px 22px", borderRadius: 18, background: C.cardStrong, border: `1px solid ${C.border}`, boxShadow: C.shadow, color: C.text }}>Cargando caja...</div>
      </div>
    );
  }

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: "resumen", label: "Resumen", icon: "📊" },
    { id: "apertura", label: "Apertura", icon: "🔓" },
    { id: "gastos", label: "Gastos", icon: "💸" },
    { id: "cierre", label: "Cierre", icon: "🔒" },
    { id: "historial", label: "Historial", icon: "📋" },
    { id: "reportes", label: "Reportes", icon: "📈" },
  ];

  return (
    <div style={pageStyle}>
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
        {(tab === "resumen" || tab === "gastos" || tab === "historial") && (
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
            <Panel title="Movimientos del rango" subtitle={`${movements.length} movimiento${movements.length === 1 ? "" : "s"}`}>
              {movements.length === 0 ? (
                <EmptyBox>No hay movimientos en este rango</EmptyBox>
              ) : (
                <div style={{ display: "grid", gap: 10, maxHeight: 500, overflowY: "auto" }}>
                  {movements.map((m) => (
                    <div key={m.id} style={movCard}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                        <div>
                          <div style={{ fontWeight: 800, color: C.text }}>{typeName(m.type)}</div>
                          <div style={{ color: C.muted, fontSize: 13, marginTop: 2 }}>{methodName(m.payment_method)} — {fmtDateTime(m.created_at)}</div>
                        </div>
                        <div style={{ ...amtBadge, background: m.payment_method === "efectivo" ? C.success : m.payment_method === "tarjeta" ? C.info : C.warning }}>
                          ${money(m.amount)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
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

        {/* ═══ TAB: CIERRE ═══ */}
        {tab === "cierre" && (
          <Panel title="Cierre de caja" subtitle="Captura lo contado físicamente y compara contra sistema">
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

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14, marginBottom: 14 }}>
              <div>
                <div style={fieldLabel}>Efectivo contado</div>
                <input type="number" step="0.01" min="0" value={countedCash} onChange={(e) => setCountedCash(e.target.value)} style={inputSt} placeholder="0.00" />
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={fieldLabel}>Notas del cierre</div>
              <textarea value={closureNotes} onChange={(e) => setClosureNotes(e.target.value)} style={textareaSt} placeholder="Observaciones, faltantes, sobrantes..." />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={saveClosure} disabled={saving} style={btnPri}>
                {saving ? "Guardando..." : todayClosure ? "Actualizar cierre" : "Guardar cierre"}
              </button>
            </div>

            {todayClosure && (
              <div style={{ marginTop: 16, padding: 14, borderRadius: 18, background: "rgba(31,122,77,0.10)", border: `1px solid ${C.border}` }}>
                <div style={{ fontWeight: 800, color: C.text, marginBottom: 8 }}>Último cierre guardado hoy</div>
                <div style={{ color: C.muted, fontSize: 14 }}>Esperado: <b>${money(todayClosure.expected_cash)}</b> — Contado: <b>${money(todayClosure.counted_cash)}</b> — Diferencia: <b>${money(todayClosure.difference)}</b></div>
                <div style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>Guardado: {fmtDateTime(todayClosure.created_at)}</div>
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

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={exportCSV} style={btnPri}>
                Exportar CSV (Excel)
              </button>
            </div>
          </>
        )}
      </div>
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
