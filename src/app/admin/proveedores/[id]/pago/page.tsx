"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";

const COLORS = {
  bg: "#f7f1e8", text: "#3b1c16", muted: "#7a5a52", primary: "#7b2218",
  border: "rgba(92,27,17,0.10)", cardStrong: "rgba(255,255,255,0.92)",
  success: "#1f7a4d", danger: "#b42318",
};

function money(v?: number | null) {
  return Number(v || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function PagoProveedorPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = getSupabaseClient();
  const supplierId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [supplierName, setSupplierName] = useState("");
  const [saldoActual, setSaldoActual] = useState(0);

  const [date, setDate] = useState(todayStr());
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<string>("efectivo");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    loadData();
  }, [supplierId]);

  async function loadData() {
    setLoading(true);
    const [s, pur, exp, pay] = await Promise.all([
      supabase.from("suppliers").select("name, type").eq("id", supplierId).single(),
      supabase.from("livestock_purchases").select("total_cost, total_live").eq("supplier_id", supplierId),
      supabase.from("supplier_expenses").select("amount").eq("supplier_id", supplierId),
      supabase.from("supplier_payments").select("amount").eq("supplier_id", supplierId),
    ]);

    if (s.data) setSupplierName(s.data.name);

    const cargos = (pur.data || []).reduce((a, p) => a + Number(p.total_cost || p.total_live || 0), 0)
      + (exp.data || []).reduce((a, e) => a + Number(e.amount || 0), 0);
    const pagos = (pay.data || []).reduce((a, p) => a + Number(p.amount || 0), 0);
    setSaldoActual(Math.max(0, cargos - pagos));
    setLoading(false);
  }

  async function generateFolio() {
    const { data } = await supabase
      .from("supplier_payments")
      .select("folio")
      .ilike("folio", "PAGO-%")
      .order("folio", { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      const num = parseInt(data[0].folio.split("-")[1] || "0", 10);
      return `PAGO-${String(num + 1).padStart(4, "0")}`;
    }
    return "PAGO-0001";
  }

  async function handleSave() {
    if (!amount || Number(amount) <= 0) { alert("El monto debe ser mayor a 0"); return; }
    setSaving(true);

    const folio = await generateFolio();
    const { error } = await supabase.from("supplier_payments").insert([{
      folio,
      supplier_id: supplierId,
      date,
      amount: Number(amount),
      payment_method: method,
      reference: reference.trim() || null,
      notes: notes.trim() || null,
    }]);

    if (error) {
      alert("Error: " + error.message);
      setSaving(false);
      return;
    }

    router.push(`/admin/proveedores/${supplierId}`);
  }

  const saldoResultante = Math.max(0, saldoActual - (Number(amount) || 0));

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "12px 14px", borderRadius: 12,
    border: `1px solid ${COLORS.border}`, fontSize: 15, boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 13, fontWeight: 600, color: COLORS.text, marginBottom: 4, display: "block",
  };

  if (loading) {
    return <div style={{ padding: 24, textAlign: "center", color: COLORS.muted, background: COLORS.bg, minHeight: "100vh" }}>Cargando...</div>;
  }

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, padding: 16, fontFamily: "Arial, sans-serif" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <a href={`/admin/proveedores/${supplierId}`} style={{ color: COLORS.primary, textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
          ← {supplierName}
        </a>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: COLORS.text, margin: "10px 0 6px" }}>Registrar pago</h1>
        <p style={{ fontSize: 13, color: COLORS.muted, margin: "0 0 18px" }}>Pago a: {supplierName}</p>

        {/* Saldo card */}
        <div style={{
          background: COLORS.cardStrong, borderRadius: 14, padding: "12px 16px", marginBottom: 16,
          border: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div style={{ fontSize: 12, color: COLORS.muted }}>Saldo actual</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: saldoActual > 0 ? COLORS.danger : COLORS.success }}>
              ${money(saldoActual)}
            </div>
          </div>
          {Number(amount) > 0 && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12, color: COLORS.muted }}>Saldo después del pago</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: saldoResultante > 0 ? COLORS.danger : COLORS.success }}>
                ${money(saldoResultante)}
              </div>
            </div>
          )}
        </div>

        <div style={{ background: COLORS.cardStrong, borderRadius: 18, padding: 22, border: `1px solid ${COLORS.border}` }}>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Fecha</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Monto *</label>
            <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="$0.00" style={inputStyle} />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Método de pago</label>
            <div style={{ display: "flex", gap: 8 }}>
              {[
                { value: "efectivo", label: "Efectivo" },
                { value: "transferencia", label: "Transferencia" },
                { value: "otro", label: "Otro" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setMethod(opt.value)}
                  style={{
                    flex: 1, padding: "10px 8px", borderRadius: 10, fontWeight: 600, fontSize: 13,
                    cursor: "pointer",
                    border: method === opt.value ? "none" : `1px solid ${COLORS.border}`,
                    background: method === opt.value ? COLORS.primary : "white",
                    color: method === opt.value ? "white" : COLORS.text,
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Referencia</label>
            <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Número de transferencia, recibo, etc." style={inputStyle} />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Notas</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas adicionales" rows={2} style={{ ...inputStyle, resize: "vertical" }} />
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              width: "100%", padding: "14px 16px", borderRadius: 14, border: "none",
              background: COLORS.success, color: "white", fontWeight: 700, fontSize: 15,
              cursor: saving ? "default" : "pointer",
            }}
          >
            {saving ? "Guardando..." : "Registrar pago"}
          </button>
        </div>
      </div>
    </div>
  );
}
