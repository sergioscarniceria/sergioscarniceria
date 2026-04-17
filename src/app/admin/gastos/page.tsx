"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase";

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

const CATEGORIES = [
  { value: "compras_ganado", label: "Compras de ganado" },
  { value: "pagos_proveedores", label: "Pagos a proveedores" },
  { value: "renta", label: "Renta" },
  { value: "gas", label: "Gas" },
  { value: "insumos", label: "Insumos (bolsas, empaques)" },
  { value: "vehiculos", label: "Vehículos" },
  { value: "publicidad", label: "Publicidad" },
  { value: "servicios", label: "Servicios (luz, agua, tel)" },
  { value: "sueldos_extra", label: "Sueldos extra" },
  { value: "otros", label: "Otros" },
];

type Expense = {
  id: string;
  expense_date: string;
  amount: number;
  category: string;
  description: string | null;
  notes: string | null;
  created_at: string;
};

export default function GastosPage() {
  const supabase = getSupabaseClient();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  // Form
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("compras_ganado");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Filters
  const [filterMonth, setFilterMonth] = useState(() => new Date().toISOString().slice(0, 7));

  // Edit
  const [editId, setEditId] = useState<string | null>(null);

  async function loadExpenses() {
    const startDate = `${filterMonth}-01`;
    const endParts = filterMonth.split("-");
    const y = Number(endParts[0]);
    const m = Number(endParts[1]);
    const lastDay = new Date(y, m, 0).getDate();
    const endDate = `${filterMonth}-${String(lastDay).padStart(2, "0")}`;

    const { data } = await supabase
      .from("owner_expenses")
      .select("*")
      .gte("expense_date", startDate)
      .lte("expense_date", endDate)
      .order("expense_date", { ascending: false });

    setExpenses(data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadExpenses();
  }, [filterMonth]);

  async function saveExpense() {
    if (!amount || Number(amount) <= 0) {
      alert("Ingresa un monto válido");
      return;
    }
    setSaving(true);

    if (editId) {
      const { error } = await supabase
        .from("owner_expenses")
        .update({
          expense_date: date,
          amount: Number(Number(amount).toFixed(2)),
          category,
          description: description.trim() || null,
          notes: notes.trim() || null,
        })
        .eq("id", editId);

      if (error) {
        alert("Error al actualizar: " + error.message);
        setSaving(false);
        return;
      }
    } else {
      const { error } = await supabase
        .from("owner_expenses")
        .insert([{
          expense_date: date,
          amount: Number(Number(amount).toFixed(2)),
          category,
          description: description.trim() || null,
          notes: notes.trim() || null,
        }]);

      if (error) {
        alert("Error al guardar: " + error.message);
        setSaving(false);
        return;
      }
    }

    clearForm();
    await loadExpenses();
    setSaving(false);
  }

  async function deleteExpense(id: string) {
    if (!confirm("¿Eliminar este gasto?")) return;
    await supabase.from("owner_expenses").delete().eq("id", id);
    await loadExpenses();
  }

  function startEdit(exp: Expense) {
    setEditId(exp.id);
    setDate(exp.expense_date);
    setAmount(String(exp.amount));
    setCategory(exp.category);
    setDescription(exp.description || "");
    setNotes(exp.notes || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function clearForm() {
    setEditId(null);
    setDate(new Date().toISOString().slice(0, 10));
    setAmount("");
    setCategory("compras_ganado");
    setDescription("");
    setNotes("");
  }

  const totalMonth = useMemo(() => expenses.reduce((s, e) => s + Number(e.amount), 0), [expenses]);

  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach((e) => {
      map[e.category] = (map[e.category] || 0) + Number(e.amount);
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, total]) => ({
        category: cat,
        label: CATEGORIES.find((c) => c.value === cat)?.label || cat,
        total,
        pct: totalMonth > 0 ? ((total / totalMonth) * 100).toFixed(1) : "0",
      }));
  }, [expenses, totalMonth]);

  const monthLabel = (() => {
    const [y, m] = filterMonth.split("-");
    const months = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
    return `${months[Number(m) - 1]} ${y}`;
  })();

  return (
    <div style={pageStyle}>
      <div style={glowTopLeft} />
      <div style={glowTopRight} />
      <div style={shellStyle}>
        {/* Top bar */}
        <div style={topBarStyle}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: COLORS.text, margin: 0 }}>
              Gastos Externos
            </h1>
            <p style={{ fontSize: 13, color: COLORS.muted, margin: "2px 0 0" }}>
              Gastos que no pasan por caja — {monthLabel}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Link href="/admin/dashboard" style={backButtonStyle}>Dashboard</Link>
            <Link href="/" style={backButtonStyle}>Inicio</Link>
          </div>
        </div>

        {/* Form */}
        <div style={cardStyle}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: COLORS.text, margin: "0 0 12px" }}>
            {editId ? "Editar gasto" : "Registrar gasto"}
          </h2>
          <div style={formGridStyle}>
            <div>
              <label style={labelStyle}>Fecha</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Monto</label>
              <input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={inputStyle}
                inputMode="decimal"
              />
            </div>
            <div>
              <label style={labelStyle}>Categoría</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Descripción</label>
              <input
                type="text"
                placeholder="Ej: Toros, Pulpas, Renta local"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <label style={labelStyle}>Notas (opcional)</label>
            <input
              type="text"
              placeholder="Detalles adicionales"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ ...inputStyle, width: "100%" }}
            />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button onClick={saveExpense} disabled={saving} style={primaryButtonStyle}>
              {saving ? "Guardando..." : editId ? "Actualizar" : "Guardar gasto"}
            </button>
            {editId && (
              <button onClick={clearForm} style={secondaryButtonStyle}>Cancelar</button>
            )}
          </div>
        </div>

        {/* Filter */}
        <div style={{ ...cardStyle, marginTop: 16 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <label style={labelStyle}>Mes</label>
              <input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ marginLeft: "auto", textAlign: "right" }}>
              <div style={{ fontSize: 13, color: COLORS.muted }}>Total del mes</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: COLORS.primary }}>${fmt(totalMonth)}</div>
              <div style={{ fontSize: 12, color: COLORS.muted }}>{expenses.length} gastos registrados</div>
            </div>
          </div>
        </div>

        {/* Category breakdown */}
        {byCategory.length > 0 && (
          <div style={{ ...cardStyle, marginTop: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: COLORS.text, margin: "0 0 12px" }}>
              Desglose por categoría
            </h2>
            {byCategory.map((cat) => (
              <div key={cat.category} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>{cat.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>${fmt(cat.total)} ({cat.pct}%)</span>
                  </div>
                  <div style={{ height: 8, background: "#eee", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${cat.pct}%`, background: COLORS.primary, borderRadius: 4, transition: "width 0.3s" }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Table */}
        <div style={{ ...cardStyle, marginTop: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: COLORS.text, margin: "0 0 12px" }}>
            Detalle de gastos
          </h2>
          {loading ? (
            <p style={{ color: COLORS.muted }}>Cargando...</p>
          ) : expenses.length === 0 ? (
            <p style={{ color: COLORS.muted, textAlign: "center", padding: 20 }}>No hay gastos registrados en este mes</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${COLORS.border}` }}>
                    <th style={thStyle}>Fecha</th>
                    <th style={thStyle}>Categoría</th>
                    <th style={thStyle}>Descripción</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Monto</th>
                    <th style={thStyle}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((exp) => (
                    <tr key={exp.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                      <td style={tdStyle}>{new Date(exp.expense_date + "T12:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}</td>
                      <td style={tdStyle}>
                        <span style={badgeStyle}>{CATEGORIES.find((c) => c.value === exp.category)?.label || exp.category}</span>
                      </td>
                      <td style={tdStyle}>
                        {exp.description || "—"}
                        {exp.notes && <span style={{ display: "block", fontSize: 11, color: COLORS.muted }}>{exp.notes}</span>}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700 }}>${fmt(exp.amount)}</td>
                      <td style={tdStyle}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => startEdit(exp)} style={miniButtonStyle}>Editar</button>
                          <button onClick={() => deleteExpense(exp.id)} style={{ ...miniButtonStyle, color: "#c0392b" }}>Borrar</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Styles ── */
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
  shadow: "0 2px 16px rgba(92,27,17,0.06)",
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
  position: "absolute", top: -120, left: -100, width: 300, height: 300,
  borderRadius: "50%", background: "rgba(123, 34, 24, 0.08)", filter: "blur(45px)",
};

const glowTopRight: React.CSSProperties = {
  position: "absolute", top: -80, right: -60, width: 280, height: 280,
  borderRadius: "50%", background: "rgba(217, 201, 163, 0.35)", filter: "blur(45px)",
};

const shellStyle: React.CSSProperties = {
  maxWidth: 1100, margin: "0 auto", position: "relative", zIndex: 2,
};

const topBarStyle: React.CSSProperties = {
  display: "flex", justifyContent: "space-between", alignItems: "center",
  gap: 16, flexWrap: "wrap", marginBottom: 20,
};

const cardStyle: React.CSSProperties = {
  background: COLORS.cardStrong,
  backdropFilter: "blur(10px)",
  border: `1px solid ${COLORS.border}`,
  borderRadius: 20,
  padding: 18,
  boxShadow: COLORS.shadow,
};

const formGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: 12,
};

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 12, fontWeight: 600, color: COLORS.muted, marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px", borderRadius: 12,
  border: `1px solid ${COLORS.border}`, fontSize: 14,
  background: "white", color: COLORS.text, boxSizing: "border-box",
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "10px 24px", borderRadius: 12, border: "none",
  background: COLORS.primary, color: "white", fontSize: 14,
  fontWeight: 700, cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: "10px 24px", borderRadius: 12,
  border: `1px solid ${COLORS.border}`, background: "white",
  color: COLORS.text, fontSize: 14, fontWeight: 600, cursor: "pointer",
};

const backButtonStyle: React.CSSProperties = {
  padding: "8px 16px", borderRadius: 12,
  border: `1px solid ${COLORS.border}`, background: COLORS.cardStrong,
  color: COLORS.text, fontSize: 13, fontWeight: 600, textDecoration: "none",
};

const thStyle: React.CSSProperties = {
  textAlign: "left", padding: "8px 10px", fontSize: 12, fontWeight: 700, color: COLORS.muted,
};

const tdStyle: React.CSSProperties = {
  padding: "10px 10px", fontSize: 13, color: COLORS.text, verticalAlign: "top",
};

const badgeStyle: React.CSSProperties = {
  display: "inline-block", padding: "3px 8px", borderRadius: 8,
  background: COLORS.accent, fontSize: 11, fontWeight: 600, color: COLORS.text,
};

const miniButtonStyle: React.CSSProperties = {
  padding: "4px 10px", borderRadius: 8, border: `1px solid ${COLORS.border}`,
  background: "white", fontSize: 12, fontWeight: 600, cursor: "pointer", color: COLORS.text,
};
