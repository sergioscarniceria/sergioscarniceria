"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";

type Supplier = {
  id: string;
  name: string;
  type: string;
  phone?: string | null;
  notes?: string | null;
};

type Purchase = { supplier_id: string; total_cost: number | null; total_live: number | null };
type Expense = { supplier_id: string; amount: number };
type Payment = { supplier_id: string; amount: number };

const COLORS = {
  bg: "#f7f1e8", bgSoft: "#fbf8f3", card: "rgba(255,255,255,0.82)",
  cardStrong: "rgba(255,255,255,0.92)", border: "rgba(92,27,17,0.10)",
  text: "#3b1c16", muted: "#7a5a52", primary: "#7b2218",
  success: "#1f7a4d", warning: "#a66a10", danger: "#b42318",
  shadow: "0 10px 30px rgba(91,25,15,0.08)",
};

const TYPE_LABELS: Record<string, string> = {
  interno: "Interno / Reembolsos",
  puerco: "Proveedor Puerco",
  res: "Proveedor Res",
};

const TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  interno: { bg: "rgba(53,92,125,0.12)", color: "#355c7d" },
  puerco: { bg: "rgba(166,106,16,0.12)", color: "#a66a10" },
  res: { bg: "rgba(123,34,24,0.10)", color: "#7b2218" },
};

function money(v?: number | null) {
  return Number(v || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ProveedoresPage() {
  const supabase = getSupabaseClient();
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [filter, setFilter] = useState<string>("todos");
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [s, p, e, pay] = await Promise.all([
      supabase.from("suppliers").select("*").order("name"),
      supabase.from("livestock_purchases").select("supplier_id, total_cost, total_live"),
      supabase.from("supplier_expenses").select("supplier_id, amount"),
      supabase.from("supplier_payments").select("supplier_id, amount"),
    ]);
    if (s.data) setSuppliers(s.data);
    if (p.data) setPurchases(p.data);
    if (e.data) setExpenses(e.data);
    if (pay.data) setPayments(pay.data);
    setLoading(false);
  }

  const balances = useMemo(() => {
    const map: Record<string, { cargos: number; pagos: number }> = {};
    for (const s of suppliers) {
      map[s.id] = { cargos: 0, pagos: 0 };
    }
    for (const p of purchases) {
      if (map[p.supplier_id]) map[p.supplier_id].cargos += Number(p.total_cost || p.total_live || 0);
    }
    for (const e of expenses) {
      if (map[e.supplier_id]) map[e.supplier_id].cargos += Number(e.amount || 0);
    }
    for (const p of payments) {
      if (map[p.supplier_id]) map[p.supplier_id].pagos += Number(p.amount || 0);
    }
    return map;
  }, [suppliers, purchases, expenses, payments]);

  const filtered = useMemo(() => {
    return suppliers.filter((s) => {
      if (filter !== "todos" && s.type !== filter) return false;
      if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [suppliers, filter, search]);

  const totalDeuda = useMemo(() => {
    return Object.values(balances).reduce((acc, b) => acc + Math.max(0, b.cargos - b.pagos), 0);
  }, [balances]);

  if (loading) {
    return <div style={{ padding: 24, textAlign: "center", color: COLORS.muted, background: COLORS.bg, minHeight: "100vh" }}>Cargando...</div>;
  }

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, padding: "16px", fontFamily: "Arial, sans-serif" }}>
      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <Link href="/admin/dashboard" style={{ color: COLORS.primary, textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
              ← Dashboard
            </Link>
            <h1 style={{ margin: "8px 0 4px", fontSize: 22, fontWeight: 700, color: COLORS.text }}>
              Proveedores / CxP
            </h1>
          </div>
          <Link
            href="/admin/proveedores/nuevo"
            style={{
              background: COLORS.primary, color: "#fff", padding: "10px 18px",
              borderRadius: 12, textDecoration: "none", fontWeight: 700, fontSize: 14,
            }}
          >
            + Nuevo
          </Link>
        </div>

        {/* Summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
          <div style={{ background: COLORS.cardStrong, borderRadius: 14, padding: "12px 14px", border: `1px solid ${COLORS.border}` }}>
            <div style={{ fontSize: 12, color: COLORS.muted }}>Proveedores</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.text }}>{suppliers.length}</div>
          </div>
          <div style={{ background: COLORS.cardStrong, borderRadius: 14, padding: "12px 14px", border: `1px solid ${COLORS.border}` }}>
            <div style={{ fontSize: 12, color: COLORS.muted }}>Deuda total</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.danger }}>${money(totalDeuda)}</div>
          </div>
          <div style={{ background: COLORS.cardStrong, borderRadius: 14, padding: "12px 14px", border: `1px solid ${COLORS.border}` }}>
            <div style={{ fontSize: 12, color: COLORS.muted }}>Con saldo</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.warning }}>
              {Object.entries(balances).filter(([, b]) => b.cargos - b.pagos > 0.01).length}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
          {["todos", "interno", "puerco", "res"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: "8px 14px", borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: "pointer",
                border: filter === f ? "none" : `1px solid ${COLORS.border}`,
                background: filter === f ? COLORS.primary : "white",
                color: filter === f ? "white" : COLORS.text,
              }}
            >
              {f === "todos" ? "Todos" : TYPE_LABELS[f]?.split("/")[0]?.trim() || f}
            </button>
          ))}
        </div>

        <input
          placeholder="Buscar proveedor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%", padding: "12px 14px", borderRadius: 12,
            border: `1px solid ${COLORS.border}`, marginBottom: 14,
            fontSize: 14, boxSizing: "border-box",
          }}
        />

        {/* Supplier list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: 32, color: COLORS.muted }}>
              No hay proveedores{filter !== "todos" ? " de este tipo" : ""}
            </div>
          ) : (
            filtered.map((s) => {
              const bal = balances[s.id] || { cargos: 0, pagos: 0 };
              const saldo = Math.max(0, bal.cargos - bal.pagos);
              const tc = TYPE_COLORS[s.type] || TYPE_COLORS.interno;
              return (
                <Link
                  key={s.id}
                  href={`/admin/proveedores/${s.id}`}
                  style={{ textDecoration: "none" }}
                >
                  <div
                    style={{
                      background: "white", borderRadius: 16, padding: "16px 18px",
                      border: `1px solid ${COLORS.border}`, boxShadow: COLORS.shadow,
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text }}>{s.name}</div>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6,
                        background: tc.bg, color: tc.color, display: "inline-block", marginTop: 4,
                      }}>
                        {TYPE_LABELS[s.type] || s.type}
                      </span>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{
                        fontSize: 18, fontWeight: 700,
                        color: saldo > 0 ? COLORS.danger : COLORS.success,
                      }}>
                        ${money(saldo)}
                      </div>
                      <div style={{ fontSize: 11, color: COLORS.muted }}>
                        {saldo > 0 ? "por pagar" : "al corriente"}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
