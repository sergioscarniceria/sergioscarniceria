"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useCallback } from "react";
import { getSupabaseClient } from "@/lib/supabase";

// ─── Types ─────────────────────────────────────────────────────
type Order = {
  id: string;
  customer_name: string | null;
  status: string | null;
  delivery_status: string | null;
  delivery_started_at?: string | null;
  delivered_at?: string | null;
  delivery_address?: string | null;
  delivery_driver?: string | null;
  delivery_date?: string | null;
  delivery_notes?: string | null;
  notes?: string | null;
  created_at?: string | null;
  payment_status?: string | null;
  customers?: { phone?: string | null; address?: string | null } | null;
};

type ViewMode = "todos" | "pendientes" | "en_camino" | "entregados" | "no_entregado";

// ─── Colors ────────────────────────────────────────────────────
const C = {
  bg: "#f7f1e8", bgSoft: "#fbf8f3",
  card: "rgba(255,255,255,0.76)", cardStrong: "rgba(255,255,255,0.92)",
  border: "rgba(92, 27, 17, 0.10)", text: "#3b1c16", muted: "#7a5a52",
  primary: "#7b2218", primaryDark: "#5a190f",
  success: "#1f7a4d", warning: "#a66a10", danger: "#b42318", info: "#355c7d",
  shadow: "0 10px 30px rgba(91, 25, 15, 0.08)",
};

// ─── Helpers ───────────────────────────────────────────────────
function todayStr() {
  const n = new Date();
  return `${n.getFullYear()}-${`${n.getMonth() + 1}`.padStart(2, "0")}-${`${n.getDate()}`.padStart(2, "0")}`;
}

function isToday(v?: string | null) {
  if (!v) return false;
  const d = new Date(v);
  if (isNaN(d.getTime())) return false;
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

function fmtTime(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime()) ? v : d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", timeZone: "America/Mexico_City" });
}

function fmtDateTime(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime()) ? v : d.toLocaleString("es-MX", { timeZone: "America/Mexico_City" });
}

function minutesBetween(from?: string | null, to?: string | null) {
  if (!from || !to) return null;
  const s = new Date(from).getTime(), e = new Date(to).getTime();
  return isNaN(s) || isNaN(e) ? null : Math.round((e - s) / 60000);
}

function currentMinutes(from?: string | null) {
  if (!from) return null;
  const s = new Date(from).getTime();
  return isNaN(s) ? null : Math.round((Date.now() - s) / 60000);
}

function formatMinutes(mins: number | null) {
  if (mins === null) return "—";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

const DEFAULT_DRIVERS = ["Pablo", "Beto", "Don Luis", "Juanito", "Manuel"];

function loadDriversList(): string[] {
  try {
    const stored = localStorage.getItem("repartidores_list");
    if (stored) return JSON.parse(stored);
  } catch {}
  return DEFAULT_DRIVERS;
}

function saveDriversList(list: string[]) {
  try { localStorage.setItem("repartidores_list", JSON.stringify(list)); } catch {}
}

const NO_ENTREGA_REASONS = [
  "No estaba el cliente",
  "Dirección incorrecta",
  "Cliente canceló",
  "Producto dañado",
  "Otro",
];

// ─── Component ─────────────────────────────────────────────────
export default function RepartidoresPage() {
  const supabase = getSupabaseClient();
  const today = todayStr();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [driverName, setDriverName] = useState("");
  const [drivers, setDrivers] = useState<string[]>(DEFAULT_DRIVERS);
  const [showAddDriver, setShowAddDriver] = useState(false);
  const [newDriverName, setNewDriverName] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [clockTick, setClockTick] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("todos");
  const [driverFilter, setDriverFilter] = useState("");

  // No-entrega modal
  const [noEntregaId, setNoEntregaId] = useState<string | null>(null);
  const [noEntregaReason, setNoEntregaReason] = useState("");
  const [noEntregaCustom, setNoEntregaCustom] = useState("");

  // Load drivers from localStorage
  useEffect(() => {
    setDrivers(loadDriversList());
  }, []);

  // Auto-refresh every 15 seconds
  useEffect(() => {
    loadOrders(true);
    const interval = setInterval(() => loadOrders(false), 15000);
    return () => clearInterval(interval);
  }, []);

  // Clock tick for live time display
  useEffect(() => {
    const interval = setInterval(() => setClockTick((p) => p + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  const loadOrders = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true); else setRefreshing(true);

    const { data, error } = await supabase
      .from("orders")
      .select(`
        id, customer_name, status, delivery_status, delivery_started_at,
        delivered_at, delivery_address, delivery_driver, delivery_date,
        delivery_notes, notes, created_at, payment_status,
        customers ( phone, address )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.log(error);
      if (showLoader) alert("No se pudieron cargar los pedidos");
    } else {
      setOrders((data as Order[]) || []);
    }
    setLastUpdated(new Date());
    setLoading(false);
    setRefreshing(false);
  }, []);

  // ─── Actions ───────────────────────────────────────────────
  async function markEnCamino(order: Order) {
    if (!driverName.trim()) {
      alert("Escribe el nombre del repartidor primero");
      return;
    }
    setSavingId(order.id);
    const { error } = await supabase.from("orders").update({
      delivery_status: "en_camino",
      delivery_started_at: new Date().toISOString(),
      delivery_driver: driverName.trim(),
    }).eq("id", order.id);
    if (error) { alert("Error al marcar en camino"); console.log(error); }
    setSavingId(null);
    await loadOrders(false);
  }

  async function markEntregado(order: Order) {
    setSavingId(order.id);
    const { error } = await supabase.from("orders").update({
      delivery_status: "entregado",
      delivered_at: new Date().toISOString(),
    }).eq("id", order.id);
    if (error) { alert("Error al marcar entregado"); console.log(error); }
    setSavingId(null);
    await loadOrders(false);
  }

  async function markNoEntregado() {
    if (!noEntregaId) return;
    const reason = noEntregaReason === "Otro" ? noEntregaCustom.trim() : noEntregaReason;
    if (!reason) { alert("Selecciona o escribe la razón"); return; }

    setSavingId(noEntregaId);
    const { error } = await supabase.from("orders").update({
      delivery_status: "no_entregado",
      delivery_notes: `No entregado: ${reason}`,
      delivered_at: new Date().toISOString(),
    }).eq("id", noEntregaId);
    if (error) { alert("Error al registrar"); console.log(error); }
    setSavingId(null);
    setNoEntregaId(null);
    setNoEntregaReason("");
    setNoEntregaCustom("");
    await loadOrders(false);
  }

  async function returnToPending(order: Order) {
    if (!confirm(`¿Regresar pedido de ${order.customer_name} a pendiente?`)) return;
    setSavingId(order.id);
    await supabase.from("orders").update({
      delivery_status: "pendiente",
      delivery_started_at: null,
      delivered_at: null,
      delivery_driver: null,
      delivery_notes: null,
    }).eq("id", order.id);
    setSavingId(null);
    await loadOrders(false);
  }

  function openMaps(address?: string | null) {
    if (!address) { alert("Sin dirección"); return; }
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, "_blank");
  }

  function openWhatsApp(phone?: string | null, customerName?: string | null) {
    if (!phone) { alert("Sin teléfono registrado"); return; }
    const clean = phone.replace(/\D/g, "");
    const num = clean.startsWith("52") ? clean : `52${clean}`;
    const msg = encodeURIComponent(`Hola ${customerName || ""}, tu pedido de Sergio's Carnicería va en camino.`);
    window.open(`https://wa.me/${num}?text=${msg}`, "_blank");
  }

  async function copyAddress(address?: string | null) {
    if (!address) { alert("Sin dirección"); return; }
    try { await navigator.clipboard.writeText(address); alert("Copiada"); } catch { alert("No se pudo copiar"); }
  }

  // ─── Computed ──────────────────────────────────────────────
  const activeOrders = useMemo(() => orders.filter((o) => {
    const ready = o.status === "terminado" && (!o.delivery_status || o.delivery_status === "pendiente");
    const onWay = o.delivery_status === "en_camino";
    return ready || onWay;
  }), [orders]);

  const deliveredToday = useMemo(() => orders.filter(
    (o) => o.delivery_status === "entregado" && isToday(o.delivered_at)
  ), [orders]);

  const failedToday = useMemo(() => orders.filter(
    (o) => o.delivery_status === "no_entregado" && isToday(o.delivered_at)
  ), [orders]);

  const allDrivers = useMemo(() => {
    const set = new Set<string>();
    for (const o of orders) {
      if (o.delivery_driver) set.add(o.delivery_driver);
    }
    return Array.from(set).sort();
  }, [orders]);

  const stats = useMemo(() => {
    const pendientes = activeOrders.filter((o) => !o.delivery_status || o.delivery_status === "pendiente").length;
    const enCamino = activeOrders.filter((o) => o.delivery_status === "en_camino").length;
    const entregados = deliveredToday.length;
    const noEntregados = failedToday.length;

    // Average delivery time
    const deliveryTimes = deliveredToday
      .map((o) => minutesBetween(o.delivery_started_at, o.delivered_at))
      .filter((t): t is number => t !== null && t > 0);
    const avgTime = deliveryTimes.length > 0
      ? Math.round(deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length)
      : null;

    return { pendientes, enCamino, entregados, noEntregados, avgTime };
  }, [activeOrders, deliveredToday, failedToday]);

  // Filtered view
  const displayOrders = useMemo(() => {
    let list: Order[] = [];
    if (viewMode === "todos") list = [...activeOrders];
    else if (viewMode === "pendientes") list = activeOrders.filter((o) => !o.delivery_status || o.delivery_status === "pendiente");
    else if (viewMode === "en_camino") list = activeOrders.filter((o) => o.delivery_status === "en_camino");
    else if (viewMode === "entregados") list = [...deliveredToday];
    else if (viewMode === "no_entregado") list = [...failedToday];

    if (driverFilter) list = list.filter((o) => o.delivery_driver === driverFilter);
    return list;
  }, [viewMode, activeOrders, deliveredToday, failedToday, driverFilter]);

  // ─── Render ────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(180deg, ${C.bgSoft} 0%, ${C.bg} 100%)`, fontFamily: "Arial, sans-serif" }}>
        <div style={{ padding: "18px 22px", borderRadius: 18, background: C.cardStrong, border: `1px solid ${C.border}`, boxShadow: C.shadow, color: C.text }}>Cargando repartidores...</div>
      </div>
    );
  }

  const STATUS_TABS: { id: ViewMode; label: string; count: number; color: string }[] = [
    { id: "todos", label: "Todos", count: activeOrders.length, color: C.text },
    { id: "pendientes", label: "Pendientes", count: stats.pendientes, color: C.info },
    { id: "en_camino", label: "En camino", count: stats.enCamino, color: C.warning },
    { id: "entregados", label: "Entregados", count: stats.entregados, color: C.success },
    { id: "no_entregado", label: "No entregados", count: stats.noEntregados, color: C.danger },
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
              <h1 style={{ margin: 0, color: C.text }}>Repartidores</h1>
              <p style={{ margin: "4px 0 0", color: C.muted, fontSize: 14 }}>
                {lastUpdated ? `Actualizado: ${fmtTime(lastUpdated.toISOString())}` : "Panel de entregas"}
                {refreshing && " ..."}
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/" style={btnSec}>Inicio</Link>
            <Link href="/pedidos" style={btnSec}>Pedidos</Link>
            <Link href="/produccion" style={btnSec}>Producción</Link>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 16 }}>
          <StatCard label="Pendientes" value={stats.pendientes} color={C.info} />
          <StatCard label="En camino" value={stats.enCamino} color={C.warning} />
          <StatCard label="Entregados hoy" value={stats.entregados} color={C.success} />
          <StatCard label="No entregados" value={stats.noEntregados} color={C.danger} />
          <StatCard label="Tiempo promedio" value={stats.avgTime !== null ? formatMinutes(stats.avgTime) : "—"} color={C.text} />
        </div>

        {/* Driver bar */}
        <div style={{ background: C.cardStrong, border: `1px solid ${C.border}`, borderRadius: 22, padding: 16, boxShadow: C.shadow, marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ flex: "2 1 300px" }}>
              <div style={{ color: C.muted, fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Repartidor</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                {drivers.map((d) => (
                  <button
                    key={d}
                    onClick={() => setDriverName(d)}
                    style={{
                      padding: "8px 14px", borderRadius: 12, border: driverName === d ? "none" : `1px solid ${C.border}`,
                      background: driverName === d ? `linear-gradient(180deg, ${C.primary} 0%, ${C.primaryDark} 100%)` : "white",
                      color: driverName === d ? "white" : C.text, fontWeight: 700, cursor: "pointer", fontSize: 13,
                    }}
                  >
                    {d}
                    {driverName === d && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!confirm(`¿Eliminar a ${d} de la lista de repartidores?`)) return;
                          const updated = drivers.filter((x) => x !== d);
                          setDrivers(updated);
                          saveDriversList(updated);
                          if (driverName === d) setDriverName("");
                        }}
                        style={{ marginLeft: 8, fontSize: 11, opacity: 0.8 }}
                      >
                        ✕
                      </span>
                    )}
                  </button>
                ))}
                {showAddDriver ? (
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input
                      placeholder="Nombre"
                      value={newDriverName}
                      onChange={(e) => setNewDriverName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newDriverName.trim()) {
                          const updated = [...drivers, newDriverName.trim()];
                          setDrivers(updated);
                          saveDriversList(updated);
                          setNewDriverName("");
                          setShowAddDriver(false);
                        }
                      }}
                      autoFocus
                      style={{ ...inputSt, padding: "8px 12px", width: 120, fontSize: 13 }}
                    />
                    <button
                      onClick={() => {
                        if (newDriverName.trim()) {
                          const updated = [...drivers, newDriverName.trim()];
                          setDrivers(updated);
                          saveDriversList(updated);
                          setNewDriverName("");
                        }
                        setShowAddDriver(false);
                      }}
                      style={{ padding: "8px 12px", borderRadius: 12, border: "none", background: C.success, color: "white", fontWeight: 700, cursor: "pointer", fontSize: 13 }}
                    >
                      OK
                    </button>
                    <button
                      onClick={() => { setShowAddDriver(false); setNewDriverName(""); }}
                      style={{ padding: "8px 10px", borderRadius: 12, border: `1px solid ${C.border}`, background: "white", color: C.text, cursor: "pointer", fontSize: 13 }}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowAddDriver(true)}
                    style={{ padding: "8px 14px", borderRadius: 12, border: `1px dashed ${C.border}`, background: "transparent", color: C.muted, fontWeight: 700, cursor: "pointer", fontSize: 13 }}
                  >
                    + Nuevo
                  </button>
                )}
              </div>
            </div>
            <button onClick={() => loadOrders(false)} disabled={refreshing} style={{ ...btnSec, alignSelf: "flex-end" }}>
              {refreshing ? "..." : "Actualizar"}
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {STATUS_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setViewMode(t.id)}
              style={{
                padding: "8px 14px", borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: "pointer",
                border: viewMode === t.id ? "none" : `1px solid ${C.border}`,
                background: viewMode === t.id ? `linear-gradient(180deg, ${C.primary} 0%, ${C.primaryDark} 100%)` : "rgba(255,255,255,0.75)",
                color: viewMode === t.id ? "white" : C.text,
                boxShadow: viewMode === t.id ? "0 4px 10px rgba(123,34,24,0.18)" : "none",
              }}
            >
              {t.label} ({t.count})
            </button>
          ))}

          {allDrivers.length > 0 && (
            <select
              value={driverFilter}
              onChange={(e) => setDriverFilter(e.target.value)}
              style={{ ...inputSt, width: "auto", padding: "8px 12px", fontSize: 13 }}
            >
              <option value="">Todos los repartidores</option>
              {allDrivers.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          )}
        </div>

        {/* Orders grid */}
        {displayOrders.length === 0 ? (
          <div style={{ padding: 20, borderRadius: 18, background: C.bgSoft, border: `1px dashed ${C.border}`, color: C.muted, textAlign: "center" }}>
            No hay pedidos en esta vista
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16 }}>
            {displayOrders.map((o) => {
              const phone = (o.customers as any)?.phone || null;
              const mins = o.delivery_status === "en_camino" ? currentMinutes(o.delivery_started_at) : minutesBetween(o.delivery_started_at, o.delivered_at);
              const isPending = !o.delivery_status || o.delivery_status === "pendiente";
              const isOnWay = o.delivery_status === "en_camino";
              const isDone = o.delivery_status === "entregado";
              const isFailed = o.delivery_status === "no_entregado";

              return (
                <div key={o.id} style={{
                  background: C.card, border: `1px solid ${C.border}`, borderRadius: 24, padding: 18, boxShadow: C.shadow,
                  borderLeft: isOnWay ? `4px solid ${C.warning}` : isDone ? `4px solid ${C.success}` : isFailed ? `4px solid ${C.danger}` : `4px solid ${C.info}`,
                }}>
                  {/* Header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: C.text }}>{o.customer_name || "Sin nombre"}</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                        <Badge text={o.delivery_status || "pendiente"} color={
                          isOnWay ? C.warning : isDone ? C.success : isFailed ? C.danger : C.info
                        } />
                        {o.payment_status && (
                          <Badge text={`pago: ${o.payment_status}`} color={o.payment_status === "pagado" ? C.success : C.warning} />
                        )}
                      </div>
                    </div>
                    {isOnWay && mins !== null && (
                      <div style={{ padding: "8px 14px", borderRadius: 14, background: `linear-gradient(180deg, ${C.warning} 0%, #8a5508 100%)`, color: "white", fontWeight: 800, fontSize: 16, whiteSpace: "nowrap" }}>
                        {formatMinutes(mins)}
                      </div>
                    )}
                    {isDone && mins !== null && (
                      <div style={{ padding: "8px 14px", borderRadius: 14, background: `linear-gradient(180deg, ${C.success} 0%, #16603d 100%)`, color: "white", fontWeight: 800, fontSize: 16, whiteSpace: "nowrap" }}>
                        {formatMinutes(mins)}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ background: C.bgSoft, border: `1px solid ${C.border}`, borderRadius: 16, padding: 12, marginBottom: 12, fontSize: 14 }}>
                    <InfoRow label="Dirección" value={o.delivery_address || "Sin dirección"} />
                    {o.delivery_driver && <InfoRow label="Repartidor" value={o.delivery_driver} />}
                    {phone && <InfoRow label="Teléfono" value={phone} />}
                    {o.delivery_date && <InfoRow label="Fecha entrega" value={o.delivery_date} />}
                    {o.delivery_started_at && <InfoRow label="Salida" value={fmtTime(o.delivery_started_at)} />}
                    {o.delivered_at && (isDone || isFailed) && <InfoRow label={isDone ? "Entregado" : "Registrado"} value={fmtTime(o.delivered_at)} />}
                  </div>

                  {/* Address + contact buttons */}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                    <button onClick={() => openMaps(o.delivery_address)} style={btnAction("rgba(53,92,125,0.12)", C.info)}>
                      Abrir ruta
                    </button>
                    <button onClick={() => copyAddress(o.delivery_address)} style={btnAction("white", C.text, true)}>
                      Copiar
                    </button>
                    {phone && (
                      <button onClick={() => openWhatsApp(phone, o.customer_name)} style={btnAction("rgba(37,211,102,0.12)", "#25D366")}>
                        WhatsApp
                      </button>
                    )}
                    {phone && (
                      <a href={`tel:${phone}`} style={{ ...btnAction("rgba(53,92,125,0.06)", C.info, true), textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
                        Llamar
                      </a>
                    )}
                  </div>

                  {/* Notes */}
                  {o.notes && (
                    <div style={{ padding: 10, borderRadius: 12, background: "rgba(255,255,255,0.7)", border: `1px solid ${C.border}`, color: C.text, fontSize: 13, marginBottom: 12 }}>
                      <b>Notas:</b> {o.notes}
                    </div>
                  )}
                  {o.delivery_notes && (
                    <div style={{ padding: 10, borderRadius: 12, background: "rgba(180,35,24,0.06)", border: `1px solid ${C.border}`, color: C.danger, fontSize: 13, marginBottom: 12 }}>
                      {o.delivery_notes}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {isPending && (
                      <button onClick={() => markEnCamino(o)} disabled={savingId === o.id}
                        style={{ ...btnPrimary(C.warning, "#8a5508"), flex: 1, opacity: savingId === o.id ? 0.6 : 1 }}>
                        En camino
                      </button>
                    )}
                    {isOnWay && (
                      <>
                        <button onClick={() => markEntregado(o)} disabled={savingId === o.id}
                          style={{ ...btnPrimary(C.success, "#16603d"), flex: 1, opacity: savingId === o.id ? 0.6 : 1 }}>
                          Entregado
                        </button>
                        <button onClick={() => { setNoEntregaId(o.id); setNoEntregaReason(""); }}
                          disabled={savingId === o.id}
                          style={{ ...btnAction("rgba(180,35,24,0.10)", C.danger), opacity: savingId === o.id ? 0.6 : 1 }}>
                          No entregado
                        </button>
                      </>
                    )}
                    {(isFailed) && (
                      <button onClick={() => returnToPending(o)} disabled={savingId === o.id}
                        style={{ ...btnAction("rgba(53,92,125,0.12)", C.info), opacity: savingId === o.id ? 0.6 : 1 }}>
                        Regresar a pendiente
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* No-entrega modal */}
        {noEntregaId && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}>
            <div style={{ background: "white", borderRadius: 24, padding: 24, maxWidth: 420, width: "100%", boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }}>
              <h2 style={{ margin: "0 0 12px", color: C.text }}>No entregado</h2>
              <p style={{ color: C.muted, margin: "0 0 16px", fontSize: 14 }}>Selecciona la razón:</p>

              <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
                {NO_ENTREGA_REASONS.map((r) => (
                  <button
                    key={r}
                    onClick={() => setNoEntregaReason(r)}
                    style={{
                      padding: "12px 16px", borderRadius: 14, textAlign: "left", fontSize: 15, fontWeight: 600, cursor: "pointer",
                      border: noEntregaReason === r ? "none" : `1px solid ${C.border}`,
                      background: noEntregaReason === r ? `linear-gradient(180deg, ${C.danger} 0%, #8a1810 100%)` : "white",
                      color: noEntregaReason === r ? "white" : C.text,
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>

              {noEntregaReason === "Otro" && (
                <input
                  value={noEntregaCustom}
                  onChange={(e) => setNoEntregaCustom(e.target.value)}
                  placeholder="Escribe la razón..."
                  style={{ ...inputSt, marginBottom: 16 }}
                />
              )}

              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setNoEntregaId(null)} style={{ ...btnSec, flex: 1 }}>Cancelar</button>
                <button onClick={markNoEntregado} disabled={savingId !== null}
                  style={{ ...btnPrimary(C.danger, "#8a1810"), flex: 1, opacity: savingId ? 0.6 : 1 }}>
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────
function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div style={{ background: C.cardStrong, border: `1px solid ${C.border}`, borderRadius: 20, padding: 16, boxShadow: C.shadow }}>
      <div style={{ color: C.muted, fontSize: 12, marginBottom: 6 }}>{label}</div>
      <div style={{ color, fontSize: 28, fontWeight: 800, lineHeight: 1.1 }}>{value}</div>
    </div>
  );
}

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span style={{
      display: "inline-block", padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700,
      background: `${color}1a`, color, textTransform: "capitalize",
    }}>
      {text.replace(/_/g, " ")}
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "4px 0", borderBottom: `1px solid ${C.border}` }}>
      <span style={{ color: C.muted, fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{label}</span>
      <span style={{ color: C.text, textAlign: "right", wordBreak: "break-word", fontSize: 13 }}>{value}</span>
    </div>
  );
}

// ─── Style helpers ───────────────────────────────────────────
function btnAction(bg: string, color: string, border?: boolean): React.CSSProperties {
  return {
    padding: "8px 14px", borderRadius: 12, border: border ? `1px solid ${C.border}` : "none",
    background: bg, color, fontWeight: 700, cursor: "pointer", fontSize: 13,
  };
}

function btnPrimary(from: string, to: string): React.CSSProperties {
  return {
    padding: "12px 16px", borderRadius: 14, border: "none",
    background: `linear-gradient(180deg, ${from} 0%, ${to} 100%)`,
    color: "white", fontWeight: 700, cursor: "pointer", fontSize: 15,
    boxShadow: `0 6px 14px ${from}33`,
  };
}

// ─── Styles ──────────────────────────────────────────────────
const pageStyle: React.CSSProperties = { minHeight: "100vh", background: `linear-gradient(180deg, ${C.bgSoft} 0%, ${C.bg} 100%)`, padding: 16, position: "relative", overflow: "hidden", fontFamily: "Arial, sans-serif" };
const glowTL: React.CSSProperties = { position: "absolute", top: -120, left: -100, width: 300, height: 300, borderRadius: "50%", background: "rgba(123, 34, 24, 0.08)", filter: "blur(45px)" };
const glowTR: React.CSSProperties = { position: "absolute", top: -80, right: -60, width: 280, height: 280, borderRadius: "50%", background: "rgba(217, 201, 163, 0.35)", filter: "blur(45px)" };
const shell: React.CSSProperties = { maxWidth: 1440, margin: "0 auto", position: "relative", zIndex: 2 };
const topBar: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 16 };
const inputSt: React.CSSProperties = { width: "100%", padding: 12, borderRadius: 14, border: `1px solid ${C.border}`, boxSizing: "border-box", outline: "none", background: "rgba(255,255,255,0.82)", color: C.text, fontSize: 15 };
const btnSec: React.CSSProperties = { display: "inline-block", padding: "10px 16px", borderRadius: 14, border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.75)", color: C.text, textDecoration: "none", fontWeight: 700, cursor: "pointer", fontSize: 14 };
