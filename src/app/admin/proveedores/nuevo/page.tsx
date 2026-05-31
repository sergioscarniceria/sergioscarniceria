"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";

const COLORS = {
  bg: "#f7f1e8", text: "#3b1c16", muted: "#7a5a52", primary: "#7b2218",
  border: "rgba(92,27,17,0.10)", cardStrong: "rgba(255,255,255,0.92)",
};

function NuevoProveedorInner() {
  const supabase = getSupabaseClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const isEdit = !!editId;
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("puerco");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!editId) return;
    (async () => {
      const { data } = await supabase
        .from("suppliers")
        .select("name, type, phone, notes")
        .eq("id", editId)
        .maybeSingle();
      if (data) {
        setName(data.name || "");
        setType(data.type || "puerco");
        setPhone(data.phone || "");
        setNotes(data.notes || "");
      }
      setLoading(false);
    })();
  }, [editId, supabase]);

  async function handleSave() {
    if (!name.trim()) { alert("El nombre es obligatorio"); return; }
    setSaving(true);

    const payload = {
      name: name.trim(),
      type,
      phone: phone.trim() || null,
      notes: notes.trim() || null,
    };
    let error;
    if (isEdit && editId) {
      ({ error } = await supabase.from("suppliers").update(payload).eq("id", editId));
    } else {
      ({ error } = await supabase.from("suppliers").insert([payload]));
    }

    if (error) {
      alert("Error: " + error.message);
      setSaving(false);
      return;
    }

    router.push(isEdit && editId ? `/admin/proveedores/${editId}` : "/admin/proveedores");
  }

  async function handleDelete() {
    if (!editId) return;
    if (!confirm(`¿Eliminar al proveedor "${name}"?\n\nSolo se eliminará si NO tiene compras, cargos ni pagos registrados.`)) return;
    setSaving(true);
    const [{ count: nPurch }, { count: nExp }, { count: nPay }] = await Promise.all([
      supabase.from("livestock_purchases").select("id", { count: "exact", head: true }).eq("supplier_id", editId),
      supabase.from("supplier_expenses").select("id", { count: "exact", head: true }).eq("supplier_id", editId),
      supabase.from("supplier_payments").select("id", { count: "exact", head: true }).eq("supplier_id", editId),
    ]);
    const total = (nPurch || 0) + (nExp || 0) + (nPay || 0);
    if (total > 0) {
      alert(`No se puede eliminar: el proveedor tiene ${total} movimiento(s) registrado(s). Si ya no trabajas con él, agrega "INACTIVO" en las notas.`);
      setSaving(false);
      return;
    }
    const { error } = await supabase.from("suppliers").delete().eq("id", editId);
    if (error) {
      alert("Error al eliminar: " + error.message);
      setSaving(false);
      return;
    }
    router.push("/admin/proveedores");
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "12px 14px", borderRadius: 12,
    border: `1px solid ${COLORS.border}`, fontSize: 15, boxSizing: "border-box", color: COLORS.text, background: "white", fontWeight: 600,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 13, fontWeight: 600, color: COLORS.text, marginBottom: 4, display: "block",
  };

  if (loading) {
    return <div style={{ padding: 24, textAlign: "center", color: COLORS.muted, background: COLORS.bg, minHeight: "100vh" }}>Cargando…</div>;
  }

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, padding: 16, fontFamily: "Arial, sans-serif" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <a href="/admin/proveedores" style={{ color: COLORS.primary, textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
          ← Proveedores
        </a>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: COLORS.text, margin: "10px 0 20px" }}>
          Nuevo Proveedor
        </h1>

        <div style={{ background: COLORS.cardStrong, borderRadius: 18, padding: 22, border: `1px solid ${COLORS.border}` }}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Nombre *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del proveedor" style={inputStyle} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Tipo de proveedor *</label>
            <div style={{ display: "flex", gap: 8 }}>
              {[
                { value: "interno", label: "Interno / Reembolsos" },
                { value: "puerco", label: "Puerco" },
                { value: "res", label: "Res" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setType(opt.value)}
                  style={{
                    flex: 1, padding: "10px 8px", borderRadius: 10, fontWeight: 600, fontSize: 13,
                    cursor: "pointer",
                    border: type === opt.value ? "none" : `1px solid ${COLORS.border}`,
                    background: type === opt.value ? COLORS.primary : "white",
                    color: type === opt.value ? "white" : COLORS.text,
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Teléfono</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Opcional" style={inputStyle} />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Notas</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas adicionales"
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
            />
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
            {saving ? "Guardando..." : "Guardar proveedor"}
          </button>
        </div>
      </div>
    </div>
  );
}


export default function NuevoProveedorPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24, textAlign: "center" }}>Cargando…</div>}>
      <NuevoProveedorInner />
    </Suspense>
  );
}
