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
    const [s, p, e, pay] = await Promise.all([
      supabase.from("suppliers").select("*").eq("id", supplierId).single(),
      supabase.from("livestock_purchases").select("*").eq("supplier_id", supplierId).order("date", { ascending: false }),
      supabase.from("supplier_expenses").select("*").eq("supplier_id", supplierId).order("date", { ascending: false }),
      supabase.from("supplier_payments").select("*").eq("supplier_id", supplierId).order("date", { ascending: false }),
    ]);
    if (s.data) setSupplier(s.data);
    if (p.data) setPurchases(p.data);
    if (e.data) setExpenses(e.data);
    if (pay.data) setPayments(pay.data);
    setLoading(false);
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
        detail: p.status === "completo" && p.yield_pct ? `Rend: ${Number(p.yield_pct).toFixed(1)}%` : undefined,
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
    <div style={{ minHeight: "100vh", background: COLORS.bg, padding: 16, fontFamily: "Arial, sans-serif" }}>
      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        {/* Header */}
        <Link href="/admin/proveedores" style={{ color: COLORS.primary, textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
          ← Proveedores
        </Link>

        <div style={{ background: COLORS.cardStrong, borderRadius: 18, padding: "18px 20px", marginTop: 10, marginBottom: 16, border: `1px solid ${COLORS.border}` }}>
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
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {isAnimal && (
            <Link href={`/admin/proveedores/${supplierId}/compra`}
              style={{ flex: 1, textAlign: "center", padding: "12px 10px", borderRadius: 12, background: COLORS.primary, color: "white", textDecoration: "none", fontWeight: 700, fontSize: 13, minWidth: 120 }}>
              + Compra
            </Link>
          )}
          {isInterno && (
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
          {(["movimientos", ...(isAnimal ? ["compras"] : []), "pagos"] as const).map((t) => (
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

        {tab === "compras" && isAnimal && (
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

                {/* Link to edit/complete purchase */}
                {p.status !== "completo" && (
                  <Link href={`/admin/proveedores/${supplierId}/compra?edit=${p.id}`}
                    style={{ display: "inline-block", marginTop: 8, fontSize: 13, color: COLORS.primary, fontWeight: 600, textDecoration: "none" }}>
                    Completar datos →
                  </Link>
                )}
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
