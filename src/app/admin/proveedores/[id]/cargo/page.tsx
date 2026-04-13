"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";

const COLORS = {
  bg: "#f7f1e8", text: "#3b1c16", muted: "#7a5a52", primary: "#7b2218",
  border: "rgba(92,27,17,0.10)", cardStrong: "rgba(255,255,255,0.92)",
};

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function CargoInternoPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = getSupabaseClient();
  const supplierId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [supplierName, setSupplierName] = useState("");
  const [date, setDate] = useState(todayStr());
  const [concept, setConcept] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    supabase.from("suppliers").select("name").eq("id", supplierId).single()
      .then(({ data }) => { if (data) setSupplierName(data.name); setLoading(false); });
  }, [supplierId]);

  async function generateFolio() {
    const { data } = await supabase
      .from("supplier_expenses")
      .select("folio")
      .ilike("folio", "REEM-%")
      .order("folio", { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      const num = parseInt(data[0].folio.split("-")[1] || "0", 10);
      return `REEM-${String(num + 1).padStart(4, "0")}`;
    }
    return "REEM-0001";
  }

  async function handleSave() {
    if (!concept.trim()) { alert("El concepto es obligatorio"); return; }
    if (!amount || Number(amount) <= 0) { alert("El monto debe ser mayor a 0"); return; }
    setSaving(true);

    const folio = await generateFolio();
    const { error } = await supabase.from("supplier_expenses").insert([{
      folio,
      supplier_id: supplierId,
      date,
      concept: concept.trim(),
      amount: Number(amount),
      notes: notes.trim() || null,
    }]);

    if (error) {
      alert("Error: " + error.message);
      setSaving(false);
      return;
    }

    router.push(`/admin/proveedores/${supplierId}`);
  }

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
        <h1 style={{ fontSize: 22, fontWeight: 700, color: COLORS.text, margin: "10px 0 6px" }}>Registrar cargo</h1>
        <p style={{ fontSize: 13, color: COLORS.muted, margin: "0 0 18px" }}>Reembolso / gasto por: {supplierName}</p>

        <div style={{ background: COLORS.cardStrong, borderRadius: 18, padding: 22, border: `1px solid ${COLORS.border}` }}>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Fecha</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Concepto *</label>
            <input value={concept} onChange={(e) => setConcept(e.target.value)} placeholder="Ej: Gasolina, insumos, complementos..." style={inputStyle} />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Monto *</label>
            <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="$0.00" style={inputStyle} />
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
              background: COLORS.primary, color: "white", fontWeight: 700, fontSize: 15,
              cursor: saving ? "default" : "pointer",
            }}
          >
            {saving ? "Guardando..." : "Registrar cargo"}
          </button>
        </div>
      </div>
    </div>
  );
}
