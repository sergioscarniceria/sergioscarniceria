"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";

const COLORS = {
  bg: "#f7f1e8", text: "#3b1c16", muted: "#7a5a52", primary: "#7b2218",
  border: "rgba(92,27,17,0.10)", cardStrong: "rgba(255,255,255,0.92)",
  success: "#1f7a4d", warning: "#a66a10",
};

function money(v?: number | null) {
  return Number(v || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function CompraAnimalPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = getSupabaseClient();
  const supplierId = params.id as string;
  const editId = searchParams.get("edit");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [supplierName, setSupplierName] = useState("");
  const [supplierType, setSupplierType] = useState("");

  // Form fields
  const [date, setDate] = useState(todayStr());
  const [animalType, setAnimalType] = useState<string>("puerco");
  const [animalCount, setAnimalCount] = useState("1");
  const [pricePerKg, setPricePerKg] = useState("");
  const [liveWeight, setLiveWeight] = useState("");
  const [canalWeight, setCanalWeight] = useState("");
  const [slaughterCost, setSlaughterCost] = useState("");
  const [freightCost, setFreightCost] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    loadSupplier();
  }, [supplierId, editId]);

  async function loadSupplier() {
    setLoading(true);
    const { data: s } = await supabase.from("suppliers").select("name, type").eq("id", supplierId).single();
    if (s) {
      setSupplierName(s.name);
      setSupplierType(s.type);
      setAnimalType(s.type === "res" ? "res" : "puerco");
    }

    // If editing, load existing purchase
    if (editId) {
      const { data: p } = await supabase.from("livestock_purchases").select("*").eq("id", editId).single();
      if (p) {
        setDate(p.date);
        setAnimalType(p.animal_type);
        setAnimalCount(String(p.animal_count));
        setPricePerKg(String(p.price_per_kg_live));
        setLiveWeight(p.live_weight_kg ? String(p.live_weight_kg) : "");
        setCanalWeight(p.canal_weight_kg ? String(p.canal_weight_kg) : "");
        setSlaughterCost(p.slaughter_cost ? String(p.slaughter_cost) : "");
        setFreightCost(p.freight_cost ? String(p.freight_cost) : "");
        setNotes(p.notes || "");
      }
    }
    setLoading(false);
  }

  // Cálculos en tiempo real
  const lw = Number(liveWeight) || 0;
  const ppk = Number(pricePerKg) || 0;
  const cw = Number(canalWeight) || 0;
  const sc = Number(slaughterCost) || 0;
  const fc = Number(freightCost) || 0;

  const totalLive = lw * ppk;
  const totalCost = totalLive + sc + fc;
  const yieldPct = lw > 0 && cw > 0 ? (cw / lw) * 100 : null;
  const costPerKgCanal = cw > 0 && totalCost > 0 ? totalCost / cw : null;

  // Determinar status
  function calcStatus(): string {
    if (cw > 0 && lw > 0) return "completo";
    if (lw > 0) return "pesado";
    return "pendiente";
  }

  async function generateFolio() {
    const prefix = animalType === "puerco" ? "PUE" : "RES";
    const { data } = await supabase
      .from("livestock_purchases")
      .select("folio")
      .ilike("folio", `${prefix}-%`)
      .order("folio", { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      const last = data[0].folio;
      const num = parseInt(last.split("-")[1] || "0", 10);
      return `${prefix}-${String(num + 1).padStart(4, "0")}`;
    }
    return `${prefix}-0001`;
  }

  async function handleSave() {
    if (!pricePerKg) { alert("El precio por kg en pie es obligatorio"); return; }
    setSaving(true);

    const status = calcStatus();
    const record: Record<string, unknown> = {
      supplier_id: supplierId,
      date,
      animal_type: animalType,
      animal_count: Number(animalCount) || 1,
      status,
      price_per_kg_live: ppk,
      live_weight_kg: lw > 0 ? lw : null,
      total_live: lw > 0 ? totalLive : null,
      canal_weight_kg: cw > 0 ? cw : null,
      slaughter_cost: sc,
      freight_cost: fc,
      total_cost: totalCost > 0 ? totalCost : null,
      yield_pct: yieldPct,
      cost_per_kg_canal: costPerKgCanal,
      notes: notes.trim() || null,
    };

    let error;

    if (editId) {
      // Update existing
      const res = await supabase.from("livestock_purchases").update(record).eq("id", editId);
      error = res.error;
    } else {
      // Insert new
      const folio = await generateFolio();
      const res = await supabase.from("livestock_purchases").insert([{ ...record, folio }]);
      error = res.error;
    }

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

  const calcBoxStyle: React.CSSProperties = {
    padding: "10px 14px", borderRadius: 12, background: "rgba(123,34,24,0.05)",
    border: `1px solid ${COLORS.border}`, marginBottom: 12,
  };

  if (loading) {
    return <div style={{ padding: 24, textAlign: "center", color: COLORS.muted, background: COLORS.bg, minHeight: "100vh" }}>Cargando...</div>;
  }

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, padding: 16, fontFamily: "Arial, sans-serif" }}>
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <a href={`/admin/proveedores/${supplierId}`} style={{ color: COLORS.primary, textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
          ← {supplierName}
        </a>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: COLORS.text, margin: "10px 0 6px" }}>
          {editId ? "Completar compra" : "Nueva compra de animal"}
        </h1>
        <p style={{ fontSize: 13, color: COLORS.muted, margin: "0 0 18px" }}>
          Proveedor: {supplierName}
        </p>

        <div style={{ background: COLORS.cardStrong, borderRadius: 18, padding: 22, border: `1px solid ${COLORS.border}` }}>
          {/* Row: fecha + tipo */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>Fecha</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Tipo de animal</label>
              <select value={animalType} onChange={(e) => setAnimalType(e.target.value)} style={inputStyle}>
                <option value="puerco">Puerco</option>
                <option value="res">Res</option>
              </select>
            </div>
          </div>

          {/* Row: cantidad + precio/kg */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>Cantidad de animales</label>
              <input type="number" min="1" value={animalCount} onChange={(e) => setAnimalCount(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Precio por kg en pie *</label>
              <input type="number" step="0.01" placeholder="$/kg" value={pricePerKg} onChange={(e) => setPricePerKg(e.target.value)} style={inputStyle} />
            </div>
          </div>

          {/* Sección: Peso en pie */}
          <div style={{ borderTop: `1px solid ${COLORS.border}`, margin: "16px 0", paddingTop: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, marginBottom: 10 }}>
              Peso en pie
              <span style={{ fontSize: 11, color: COLORS.muted, fontWeight: 400, marginLeft: 6 }}>
                (cuando el proveedor lo reporte)
              </span>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Peso en pie total (kg)</label>
              <input type="number" step="0.1" placeholder="kg totales en pie" value={liveWeight} onChange={(e) => setLiveWeight(e.target.value)} style={inputStyle} />
            </div>
            {lw > 0 && (
              <div style={calcBoxStyle}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: COLORS.muted, fontSize: 13 }}>Total en pie</span>
                  <span style={{ fontWeight: 700, fontSize: 16, color: COLORS.text }}>${money(totalLive)}</span>
                </div>
                <div style={{ fontSize: 11, color: COLORS.muted }}>{lw.toFixed(1)} kg × ${money(ppk)}/kg</div>
              </div>
            )}
          </div>

          {/* Sección: Canal + costos */}
          <div style={{ borderTop: `1px solid ${COLORS.border}`, margin: "16px 0", paddingTop: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, marginBottom: 10 }}>
              Peso en canal y costos
              <span style={{ fontSize: 11, color: COLORS.muted, fontWeight: 400, marginLeft: 6 }}>
                (después del rastro)
              </span>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Peso en canal total (kg)</label>
              <input type="number" step="0.1" placeholder="kg totales en canal" value={canalWeight} onChange={(e) => setCanalWeight(e.target.value)} style={inputStyle} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={labelStyle}>Costo matanza ($)</label>
                <input type="number" step="0.01" placeholder="$0.00" value={slaughterCost} onChange={(e) => setSlaughterCost(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Costo flete ($)</label>
                <input type="number" step="0.01" placeholder="$0.00" value={freightCost} onChange={(e) => setFreightCost(e.target.value)} style={inputStyle} />
              </div>
            </div>
          </div>

          {/* Cálculos automáticos */}
          {(lw > 0 || totalCost > 0) && (
            <div style={{
              background: "rgba(123,34,24,0.07)", borderRadius: 14, padding: "14px 16px",
              marginBottom: 16, border: `1px solid rgba(123,34,24,0.12)`,
            }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, marginBottom: 8 }}>Resumen de costos</div>

              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 13 }}>
                <span style={{ color: COLORS.muted }}>Total en pie</span>
                <span style={{ fontWeight: 600 }}>${money(totalLive)}</span>
              </div>
              {sc > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 13 }}>
                  <span style={{ color: COLORS.muted }}>+ Matanza</span>
                  <span style={{ fontWeight: 600 }}>${money(sc)}</span>
                </div>
              )}
              {fc > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 13 }}>
                  <span style={{ color: COLORS.muted }}>+ Flete</span>
                  <span style={{ fontWeight: 600 }}>${money(fc)}</span>
                </div>
              )}

              <div style={{ borderTop: `1px solid rgba(123,34,24,0.15)`, margin: "8px 0", paddingTop: 8, display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 700, fontSize: 15, color: COLORS.text }}>Costo total real</span>
                <span style={{ fontWeight: 800, fontSize: 18, color: COLORS.primary }}>${money(totalCost)}</span>
              </div>

              {yieldPct !== null && (
                <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div style={{ background: "white", borderRadius: 10, padding: "8px 12px", textAlign: "center" }}>
                    <div style={{ fontSize: 11, color: COLORS.muted }}>Rendimiento</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: yieldPct >= 75 ? COLORS.success : yieldPct >= 70 ? COLORS.warning : COLORS.primary }}>
                      {yieldPct.toFixed(1)}%
                    </div>
                  </div>
                  <div style={{ background: "white", borderRadius: 10, padding: "8px 12px", textAlign: "center" }}>
                    <div style={{ fontSize: 11, color: COLORS.muted }}>Costo/kg canal</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.text }}>
                      ${costPerKgCanal ? money(costPerKgCanal) : "-"}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Status indicator */}
          <div style={{ marginBottom: 14, padding: "8px 12px", borderRadius: 10, fontSize: 13, fontWeight: 600, textAlign: "center",
            background: calcStatus() === "completo" ? "rgba(31,122,77,0.1)" : calcStatus() === "pesado" ? "rgba(166,106,16,0.1)" : "rgba(53,92,125,0.1)",
            color: calcStatus() === "completo" ? COLORS.success : calcStatus() === "pesado" ? COLORS.warning : "#355c7d",
          }}>
            Estado: {calcStatus() === "completo" ? "Completo — todos los datos registrados" : calcStatus() === "pesado" ? "Pesado en pie — falta peso en canal" : "Pendiente — falta peso en pie"}
          </div>

          <div style={{ marginBottom: 16 }}>
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
            {saving ? "Guardando..." : editId ? "Actualizar compra" : "Registrar compra"}
          </button>
        </div>
      </div>
    </div>
  );
}
