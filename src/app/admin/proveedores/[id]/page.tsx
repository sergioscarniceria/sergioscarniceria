"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";

type Supplier = { id: string; name: string; type: string; phone?: string | null; notes?: string | null };
type Purchase = {
  id: string; folio: string; date: string; animal_type: string; animal_count: number;
  status: string; price_per_kg_live: number; live_weight_kg: number | null;
  total_live: number | null; canal_weight_kg: number | null; slaughter_cost: number;
  freight_cost: number; total_cost: number | null; yield_pct: number | null;
  cost_per_kg_canal: number | null; notes?: string | null; created_at: string;
};
type Expense = {
  id: string; folio: string; date: string; concept: string; amount: number;
  notes?: string | null; created_at: string;
};
type Payment = {
  id: string; folio: string; date: string; amount: number;
  payment_method: string; reference?: string | null; notes?: string | null; created_at: string;
};

const COLORS = {
  bg: "#f7f1e8", bgSoft: "#fbf8f3", card: "rgba(255,255,255,0.82)",
  cardStrong: "rgba(255,255,255,0.92)", border: "rgba(92,27,17,0.10)",
  text: "#3b1c16", muted: "#7a5a52", primary: "#7b2218",
  success: "#1f7a4d", warning: "#a66a10", danger: "#b42318",
  shadow: "0 10px 30px rgba(91,25,15,0.08)",
};

const TYPE_LABELS: Record<string, string> = {
  interno: "Interno / Reembolsos", puerco: "Proveedor Puerco", res: "Proveedor Res",
};

const STATUS_LABELS: Record<string, string> = {
  pendiente: "Pendiente peso", pesado: "Pesado en pie", completo: "Completo",
};

const METHOD_LABELS: Record<string, string> = {
  efectivo: "Efectivo", transferencia: "Transferencia", otro: "Otro",
};

function money(v?: number | null) {
  return Number(v || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("es-MX", {
    day: "2-digit", month: "short", year: "numeric", timeZone: "America/Mexico_City",
  });
}

export default function ProveedorDetallePage() {
  const params = useParams();
  const supplierId = params.id as string;
  const supabase = getSupabaseClient();

  const [loading, setLoading] = useState(true);
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [tab, setTab] = useState<"movimientos" | "compras" | "pagos">("movimientos");

  useEffect(() => {
    loadData();
  }, [supplierId]);

  async function loadData() {
    setLoading(true);
    try {
      const [s, p, e, pay] = await Promise.all([
        supabase.from("suppliers").select("*").eq("id", supplierId).single(),
        supabase.from("livestock_purchases").select("*").eq("supplier_id", supplierId).order("date", { ascending: false }).limit(500),
        supabase.from("supplier_expenses").select("*").eq("supplier_id", supplierId).order("date", { ascending: false }).limit(500),
        supabase.from("supplier_payments").select("*").eq("supplier_id", supplierId).order("date", { ascending: false }).limit(500),
      ]);
      if (s.error) console.log("Error cargando supplier:", s.error);
      if (p.error) console.log("Error cargando purchases:", p.error);
      if (e.error) console.log("Error cargando expenses:", e.error);
      if (pay.error) console.log("Error cargando payments:", pay.error);
      if (s.data) setSupplier(s.data);
      if (p.data) setPurchases(p.data);
      if (e.data) setExpenses(e.data);
      if (pay.data) setPayments(pay.data);
    } catch (err) {
      console.log("Error en loadData:", err);
    } finally {
      setLoading(false);
    }
  }

  const [avgFrom, setAvgFrom] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [avgTo, setAvgTo] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });

  // Promedio ponderado de precio/kg canal en el rango seleccionado
  const avgPrecioCanal = useMemo(() => {
    const inRange = purchases.filter((p) =>
      p.status === "completo" &&
      p.canal_weight_kg &&
      p.total_cost &&
      p.date >= avgFrom &&
      p.date <= avgTo
    );
    const sumKg = inRange.reduce((acc, p) => acc + Number(p.canal_weight_kg || 0), 0);
    const sumCost = inRange.reduce((acc, p) => acc + Number(p.total_cost || 0), 0);
    return {
      avg: sumKg > 0 ? sumCost / sumKg : 0,
      kg: sumKg,
      cost: sumCost,
      count: inRange.length,
    };
  }, [purchases, avgFrom, avgTo]);

  function setRangeThisMonth() {
    const d = new Date();
    setAvgFrom(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
    setAvgTo(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  }
  function setRangeLastMonth() {
    const d = new Date();
    const y = d.getMonth() === 0 ? d.getFullYear() - 1 : d.getFullYear();
    const m = d.getMonth() === 0 ? 12 : d.getMonth();
    const lastDay = new Date(y, m, 0).getDate();
    setAvgFrom(`${y}-${String(m).padStart(2, "0")}-01`);
    setAvgTo(`${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`);
  }
  function setRangeYear() {
    const d = new Date();
    setAvgFrom(`${d.getFullYear()}-01-01`);
    setAvgTo(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  }

  const totalCargos = useMemo(() => {
    const pc = purchases.reduce((acc, p) => acc + Number(p.total_cost || p.total_live || 0), 0);
    const ec = expenses.reduce((acc, e) => acc + Number(e.amount || 0), 0);
    return pc + ec;
  }, [purchases, expenses]);

  const totalPagos = useMemo(() => {
    return payments.reduce((acc, p) => acc + Number(p.amount || 0), 0);
  }, [payments]);

  const saldo = Math.max(0, totalCargos - totalPagos);

  // Timeline: all movements sorted by date desc
  const timeline = useMemo(() => {
    const items: { date: string; type: string; label: string; amount: number; folio: string; detail?: string; status?: string }[] = [];

    for (const p of purchases) {
      items.push({
        date: p.date, type: "compra", folio: p.folio,
        label: `Compra ${p.animal_type} (${p.animal_count} animal${p.animal_count > 1 ? "es" : ""})`,
        amount: Number(p.total_cost || p.total_live || 0),
        detail: p.status === "completo" && p.yield_pct
          ? `Rend: ${Number(p.yield_pct).toFixed(1)}%${p.cost_per_kg_canal ? ` · $${Number(p.cost_per_kg_canal).toFixed(2)}/kg canal` : ""}`
          : undefined,
        status: p.status,
      });
    }
    for (const e of expenses) {
      items.push({
        date: e.date, type: "cargo", folio: e.folio,
        label: e.concept, amount: Number(e.amount),
      });
    }
    for (const p of payments) {
      items.push({
        date: p.date, type: "pago", folio: p.folio,
        label: `Pago — ${METHOD_LABELS[p.payment_method] || p.payment_method}`,
        amount: -Number(p.amount),
        detail: p.reference || undefined,
      });
    }

    return items.sort((a, b) => b.date.localeCompare(a.date));
  }, [purchases, expenses, payments]);

  if (loading) {
    return <div style={{ padding: 24, textAlign: "center", color: COLORS.muted, background: COLORS.bg, minHeight: "100vh" }}>Cargando...</div>;
  }

  if (!supplier) {
    return <div style={{ padding: 24, textAlign: "center", color: COLORS.danger, background: COLORS.bg, minHeight: "100vh" }}>Proveedor no encontrado</div>;
  }

  const isAnimal = supplier.type === "puerco" || supplier.type === "res";
  const isInterno = supplier.type === "interno";

  return (
    <div style={{
      minHeight: "100vh",
      background: COLORS.bg,
      padding: 0,
      fontFamily: "Arial, sans-serif",
    }}>
      {/* Barra superior STICKY con boton de regresar — siempre visible */}
      <div style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        background: COLORS.bg,
        padding: "12px 16px",
        paddingTop: "max(12px, env(safe-area-inset-top))",
        borderBottom: `1px solid ${COLORS.border}`,
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
      }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          <Link
            href="/admin/proveedores"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              background: "white",
              color: COLORS.primary,
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 700,
              borderRadius: 10,
              border: `1px solid ${COLORS.border}`,
              boxShadow: "0 2px 6px rgba(91,25,15,0.05)",
            }}
          >
            ← Proveedores
          </Link>
        </div>
      </div>

      <div style={{ maxWidth: 700, margin: "0 auto", padding: 16 }}>

        <div style={{ background: COLORS.cardStrong, borderRadius: 18, padding: "18px 20px", marginBottom: 16, border: `1px solid ${COLORS.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: COLORS.text }}>{supplier.name}</h1>
              <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 4 }}>{TYPE_LABELS[supplier.type]}</div>
              {supplier.phone && <div style={{ fontSize: 13, color: COLORS.muted, marginTop: 2 }}>Tel: {supplier.phone}</div>}
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12, color: COLORS.muted }}>Saldo pendiente</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: saldo > 0 ? COLORS.danger : COLORS.success }}>
                ${money(saldo)}
              </div>
            </div>
          </div>

          {/* Summary row */}
          <div style={{ display: "flex", gap: 12, marginTop: 14 }}>
            <div style={{ flex: 1, background: "rgba(180,35,24,0.06)", borderRadius: 10, padding: "8px 12px" }}>
              <div style={{ fontSize: 11, color: COLORS.muted }}>Total cargos</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.danger }}>${money(totalCargos)}</div>
            </div>
            <div style={{ flex: 1, background: "rgba(31,122,77,0.06)", borderRadius: 10, padding: "8px 12px" }}>
              <div style={{ fontSize: 11, color: COLORS.muted }}>Total pagos</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.success }}>${money(totalPagos)}</div>
            </div>
          </div>

          {/* Widget: promedio precio/kg canal con filtro de fechas (solo proveedores de animales) */}
          {isAnimal && (
            <div style={{
              marginTop: 14, padding: "12px 14px",
              background: "linear-gradient(135deg, rgba(123,34,24,0.06) 0%, rgba(123,34,24,0.02) 100%)",
              borderRadius: 12, border: `1px solid ${COLORS.border}`,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3 }}>
                    Promedio precio/kg canal
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: COLORS.primary, marginTop: 2 }}>
                    ${avgPrecioCanal.avg > 0 ? avgPrecioCanal.avg.toFixed(2) : "—"}
                    {avgPrecioCanal.avg > 0 && <span style={{ fontSize: 13, color: COLORS.muted, fontWeight: 600 }}> /kg</span>}
                  </div>
                  <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>
                    {avgPrecioCanal.count} compra{avgPrecioCanal.count === 1 ? "" : "s"} · {avgPrecioCanal.kg.toFixed(1)} kg canal · ${money(avgPrecioCanal.cost)}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                <button onClick={setRangeThisMonth} style={{ padding: "4px 10px", fontSize: 11, fontWeight: 700, background: "white", border: `1px solid ${COLORS.border}`, borderRadius: 8, cursor: "pointer", color: COLORS.text }}>
                  Mes actual
                </button>
                <button onClick={setRangeLastMonth} style={{ padding: "4px 10px", fontSize: 11, fontWeight: 700, background: "white", border: `1px solid ${COLORS.border}`, borderRadius: 8, cursor: "pointer", color: COLORS.text }}>
                  Mes pasado
                </button>
                <button onClick={setRangeYear} style={{ padding: "4px 10px", fontSize: 11, fontWeight: 700, background: "white", border: `1px solid ${COLORS.border}`, borderRadius: 8, cursor: "pointer", color: COLORS.text }}>
                  Año
                </button>
              </div>

              <div style={{ display: "flex", gap: 6, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
                <label style={{ fontSize: 11, color: COLORS.muted, fontWeight: 600 }}>De:</label>
                <input
                  type="date"
                  value={avgFrom}
                  onChange={(e) => setAvgFrom(e.target.value)}
                  style={{ padding: "4px 8px", fontSize: 12, border: `1px solid ${COLORS.border}`, borderRadius: 6, color: COLORS.text, background: "white" }}
                />
                <label style={{ fontSize: 11, color: COLORS.muted, fontWeight: 600 }}>a:</label>
                <input
                  type="date"
                  value={avgTo}
                  onChange={(e) => setAvgTo(e.target.value)}
                  style={{ padding: "4px 8px", fontSize: 12, border: `1px solid ${COLORS.border}`, borderRadius: 6, color: COLORS.text, background: "white" }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {/* Routing inteligente: animal -> /compra (form animal) | otro -> /cargo (form simple) */}
          {isAnimal ? (
            <Link href={`/admin/proveedores/${supplierId}/compra`}
              style={{ flex: 1, textAlign: "center", padding: "12px 10px", borderRadius: 12, background: COLORS.primary, color: "white", textDecoration: "none", fontWeight: 700, fontSize: 13, minWidth: 120 }}>
              + Compra
            </Link>
          ) : (
            <Link href={`/admin/proveedores/${supplierId}/cargo`}
              style={{ flex: 1, textAlign: "center", padding: "12px 10px", borderRadius: 12, background: COLORS.primary, color: "white", textDecoration: "none", fontWeight: 700, fontSize: 13, minWidth: 120 }}>
              + Cargo
            </Link>
          )}
          <Link href={`/admin/proveedores/${supplierId}/pago`}
            style={{ flex: 1, textAlign: "center", padding: "12px 10px", borderRadius: 12, background: COLORS.success, color: "white", textDecoration: "none", fontWeight: 700, fontSize: 13, minWidth: 120 }}>
            + Registrar Pago
          </Link>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
          {(["movimientos", "compras", "pagos"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t as typeof tab)}
              style={{
                padding: "8px 16px", borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: "pointer",
                border: tab === t ? "none" : `1px solid ${COLORS.border}`,
                background: tab === t ? COLORS.primary : "white",
                color: tab === t ? "white" : COLORS.text,
              }}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Content */}
        {tab === "movimientos" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {timeline.length === 0 ? (
              <div style={{ textAlign: "center", padding: 32, color: COLORS.muted }}>Sin movimientos</div>
            ) : timeline.map((m, i) => (
              <div key={i} style={{
                background: "white", borderRadius: 14, padding: "12px 16px",
                border: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text }}>{m.label}</div>
                  <div style={{ fontSize: 12, color: COLORS.muted }}>
                    {m.folio} — {formatDate(m.date)}
                    {m.status && <span style={{ marginLeft: 6, padding: "1px 6px", borderRadius: 4, fontSize: 10, fontWeight: 600, background: m.status === "completo" ? "rgba(31,122,77,0.1)" : "rgba(166,106,16,0.1)", color: m.status === "completo" ? COLORS.success : COLORS.warning }}>
                      {STATUS_LABELS[m.status] || m.status}
                    </span>}
                  </div>
                  {m.detail && <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>{m.detail}</div>}
                </div>
                <div style={{
                  fontSize: 16, fontWeight: 700,
                  color: m.amount >= 0 ? COLORS.danger : COLORS.success,
                }}>
                  {m.amount >= 0 ? "+" : ""}${money(Math.abs(m.amount))}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "compras" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {purchases.length === 0 ? (
              <div style={{ textAlign: "center", padding: 32, color: COLORS.muted }}>Sin compras registradas</div>
            ) : purchases.map((p) => (
              <div key={p.id} style={{
                background: "white", borderRadius: 16, padding: "14px 18px",
                border: `1px solid ${COLORS.border}`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div>
                    <span style={{ fontWeight: 700, color: COLORS.text }}>{p.folio}</span>
                    <span style={{ fontSize: 12, color: COLORS.muted, marginLeft: 8 }}>{formatDate(p.date)}</span>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6,
                    background: p.status === "completo" ? "rgba(31,122,77,0.1)" : p.status === "pesado" ? "rgba(166,106,16,0.1)" : "rgba(53,92,125,0.1)",
                    color: p.status === "completo" ? COLORS.success : p.status === "pesado" ? COLORS.warning : "#355c7d",
                  }}>
                    {STATUS_LABELS[p.status] || p.status}
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 16px", fontSize: 13 }}>
                  <div><span style={{ color: COLORS.muted }}>Animales:</span> {p.animal_count}</div>
                  <div><span style={{ color: COLORS.muted }}>Precio/kg pie:</span> ${money(p.price_per_kg_live)}</div>
                  {p.live_weight_kg && <div><span style={{ color: COLORS.muted }}>Peso pie:</span> {Number(p.live_weight_kg).toFixed(1)} kg</div>}
                  {p.total_live && <div><span style={{ color: COLORS.muted }}>Total pie:</span> ${money(p.total_live)}</div>}
                  {p.canal_weight_kg && <div><span style={{ color: COLORS.muted }}>Peso canal:</span> {Number(p.canal_weight_kg).toFixed(1)} kg</div>}
                  {p.slaughter_cost > 0 && <div><span style={{ color: COLORS.muted }}>Matanza:</span> ${money(p.slaughter_cost)}</div>}
                  {p.freight_cost > 0 && <div><span style={{ color: COLORS.muted }}>Flete:</span> ${money(p.freight_cost)}</div>}
                </div>

                {p.yield_pct && (
                  <div style={{ marginTop: 8, padding: "6px 10px", borderRadius: 8, background: "rgba(123,34,24,0.05)", display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span><b>Rendimiento:</b> {Number(p.yield_pct).toFixed(1)}%</span>
                    <span><b>Costo/kg canal:</b> ${money(p.cost_per_kg_canal)}</span>
                  </div>
                )}

                {p.total_cost && (
                  <div style={{ textAlign: "right", marginTop: 6, fontSize: 17, fontWeight: 800, color: COLORS.primary }}>
                    Total: ${money(p.total_cost)}
                  </div>
                )}

                {/* Editar compra (siempre disponible) */}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                  <Link href={`/admin/proveedores/${supplierId}/compra?edit=${p.id}`}
                    style={{
                      padding: "6px 14px", fontSize: 13, color: COLORS.primary,
                      fontWeight: 700, textDecoration: "none",
                      background: "rgba(123,34,24,0.08)", borderRadius: 8,
                    }}>
                    {p.status === "completo" ? "✏️ Editar" : "Completar datos →"}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "pagos" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {payments.length === 0 ? (
              <div style={{ textAlign: "center", padding: 32, color: COLORS.muted }}>Sin pagos registrados</div>
            ) : payments.map((p) => (
              <div key={p.id} style={{
                background: "white", borderRadius: 14, padding: "12px 16px",
                border: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text }}>{p.folio}</div>
                  <div style={{ fontSize: 12, color: COLORS.muted }}>
                    {formatDate(p.date)} — {METHOD_LABELS[p.payment_method] || p.payment_method}
                    {p.reference && <span> — Ref: {p.reference}</span>}
                  </div>
                  {p.notes && <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>{p.notes}</div>}
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.success }}>
                  ${money(p.amount)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
