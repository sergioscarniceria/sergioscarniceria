"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";

type ItemType = "bodega" | "complemento";

type CatalogItem = {
  id: string;
  name: string;
  type: ItemType;
  unit: string;
  current_cost: number;
  stock: number;
};

type Audit = {
  id: string;
  audit_number: string | null;
  audit_date: string;
  status: "abierta" | "cerrada";
  total_items: number;
  total_difference_units: number;
  total_loss_amount: number;
  total_surplus_amount: number;
  notes: string | null;
  created_by: string | null;
  closed_at: string | null;
  closed_by: string | null;
  created_at: string;
};

type AuditItem = {
  id: string;
  audit_id: string;
  item_type: ItemType;
  item_id: string;
  item_name: string;
  unit: string | null;
  system_stock: number;
  counted_stock: number | null;
  difference: number;
  unit_cost: number;
  loss_amount: number;
};

const C = {
  bg: "#f7f1e8", bgSoft: "#fbf8f3",
  card: "rgba(255,255,255,0.82)", cardStrong: "rgba(255,255,255,0.92)",
  border: "rgba(92, 27, 17, 0.10)", text: "#3b1c16", muted: "#7a5a52",
  primary: "#7b2218", primaryDark: "#5a190f",
  success: "#1f7a4d", warning: "#a66a10", danger: "#b42318",
  info: "#355c7d",
  shadow: "0 10px 30px rgba(91, 25, 15, 0.08)",
};

function money(v: number) {
  return v.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function monthKey(dateStr: string) {
  return dateStr.slice(0, 7);
}

function monthLabel(key: string) {
  const [y, m] = key.split("-");
  const months = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  return `${months[Number(m) - 1]} ${y}`;
}

export default function AuditoriaPage() {
  const supabase = getSupabaseClient();
  const [loading, setLoading] = useState(true);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [audits, setAudits] = useState<Audit[]>([]);

  // Current open audit (if any)
  const [activeAudit, setActiveAudit] = useState<Audit | null>(null);
  const [activeItems, setActiveItems] = useState<AuditItem[]>([]);
  const [countDrafts, setCountDrafts] = useState<Record<string, string>>({});
  const [savingAudit, setSavingAudit] = useState(false);
  const [closingAudit, setClosingAudit] = useState(false);

  // Historial
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [itemsMap, setItemsMap] = useState<Record<string, AuditItem[]>>({});
  const [loadingItems, setLoadingItems] = useState<string | null>(null);
  const [monthFilter, setMonthFilter] = useState<string>("todos");

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);

    const [bodegaRes, productsRes, auditsRes] = await Promise.all([
      supabase.from("bodega_items").select("id, name, unit, stock, cost").eq("is_active", true).order("name"),
      supabase.from("products").select("id, name, stock, purchase_price, category, fixed_piece_price, is_active").eq("is_active", true).order("name"),
      supabase.from("inventory_audits").select("*").order("audit_date", { ascending: false }).order("created_at", { ascending: false }),
    ]);

    const bodegaItems: CatalogItem[] = ((bodegaRes.data as any[]) || []).map((b) => ({
      id: b.id, name: b.name, type: "bodega", unit: b.unit || "piezas",
      current_cost: Number(b.cost || 0), stock: Number(b.stock || 0),
    }));

    const complementos = ((productsRes.data as any[]) || []).filter(
      (p) => p.category === "Complementos" || (p.fixed_piece_price !== null && Number(p.fixed_piece_price) > 0)
    );
    const complementoItems: CatalogItem[] = complementos.map((p) => ({
      id: p.id, name: p.name, type: "complemento", unit: "piezas",
      current_cost: Number(p.purchase_price || 0), stock: Number(p.stock || 0),
    }));

    const fullCatalog = [...bodegaItems, ...complementoItems];
    setCatalog(fullCatalog);

    const allAudits = (auditsRes.data as Audit[]) || [];
    setAudits(allAudits);

    // Si hay una abierta, cargarla
    const open = allAudits.find((a) => a.status === "abierta");
    if (open) {
      await loadActiveAudit(open);
    } else {
      setActiveAudit(null);
      setActiveItems([]);
      setCountDrafts({});
    }

    setLoading(false);
  }

  async function loadActiveAudit(audit: Audit) {
    setActiveAudit(audit);
    const { data } = await supabase
      .from("inventory_audit_items")
      .select("*")
      .eq("audit_id", audit.id)
      .order("item_name");
    const items = (data as AuditItem[]) || [];
    setActiveItems(items);
    const drafts: Record<string, string> = {};
    for (const it of items) {
      drafts[it.id] = it.counted_stock !== null && it.counted_stock !== undefined ? String(it.counted_stock) : "";
    }
    setCountDrafts(drafts);
  }

  async function startNewAudit() {
    if (activeAudit) { alert("Ya hay una auditoría abierta. Ciérrala antes de iniciar otra."); return; }
    if (catalog.length === 0) { alert("No hay productos para auditar"); return; }
    if (!confirm(`¿Iniciar nueva auditoría con ${catalog.length} productos? Se tomará el stock actual como referencia.`)) return;

    setSavingAudit(true);
    const creator = typeof window !== "undefined" ? (sessionStorage.getItem("pin_role") || "admin") : "admin";
    const number = `AUD-${Date.now().toString().slice(-6)}`;

    const { data: inserted, error } = await supabase.from("inventory_audits").insert({
      audit_number: number,
      audit_date: todayStr(),
      status: "abierta",
      total_items: catalog.length,
      created_by: creator,
    }).select("*").single();

    if (error || !inserted) {
      alert("Error creando auditoría: " + (error?.message || "desconocido"));
      setSavingAudit(false);
      return;
    }

    const auditId = (inserted as any).id;
    const payload = catalog.map((c) => ({
      audit_id: auditId,
      item_type: c.type,
      item_id: c.id,
      item_name: c.name,
      unit: c.unit,
      system_stock: c.stock,
      counted_stock: null,
      difference: 0,
      unit_cost: c.current_cost,
      loss_amount: 0,
    }));

    const { error: iErr } = await supabase.from("inventory_audit_items").insert(payload);
    if (iErr) {
      alert("Error insertando renglones: " + iErr.message);
      setSavingAudit(false);
      return;
    }

    setSavingAudit(false);
    await loadAll();
  }

  function setDraft(id: string, value: string) {
    setCountDrafts((prev) => ({ ...prev, [id]: value }));
  }

  async function saveProgress() {
    if (!activeAudit) return;
    setSavingAudit(true);
    for (const it of activeItems) {
      const raw = countDrafts[it.id];
      if (raw === undefined || raw === "") continue;
      const counted = parseFloat(raw);
      if (isNaN(counted) || counted < 0) continue;
      if (counted === it.counted_stock) continue;
      const diff = counted - it.system_stock;
      const loss = diff < 0 ? Math.abs(diff) * it.unit_cost : 0;
      await supabase.from("inventory_audit_items").update({
        counted_stock: counted,
        difference: diff,
        loss_amount: loss,
      }).eq("id", it.id);
    }
    setSavingAudit(false);
    if (activeAudit) {
      const { data } = await supabase.from("inventory_audits").select("*").eq("id", activeAudit.id).single();
      if (data) await loadActiveAudit(data as Audit);
    }
    alert("Progreso guardado");
  }

  async function closeAudit() {
    if (!activeAudit) return;

    // Confirmar cuántas quedaron sin contar
    const uncounted = activeItems.filter((it) => {
      const raw = countDrafts[it.id];
      return raw === undefined || raw === "";
    });

    const msg = uncounted.length > 0
      ? `${uncounted.length} productos no tienen conteo. Se asumirá que su conteo físico coincide con el sistema (diferencia 0). ¿Continuar y cerrar auditoría?`
      : "¿Cerrar auditoría y aplicar todos los ajustes al inventario?";

    if (!confirm(msg)) return;

    setClosingAudit(true);
    const closer = typeof window !== "undefined" ? (sessionStorage.getItem("pin_role") || "admin") : "admin";

    // 1) Guardar drafts pendientes
    for (const it of activeItems) {
      const raw = countDrafts[it.id];
      const counted = raw !== undefined && raw !== "" ? parseFloat(raw) : it.system_stock;
      if (isNaN(counted) || counted < 0) continue;
      const diff = counted - it.system_stock;
      const loss = diff < 0 ? Math.abs(diff) * it.unit_cost : 0;
      await supabase.from("inventory_audit_items").update({
        counted_stock: counted,
        difference: diff,
        loss_amount: loss,
      }).eq("id", it.id);
    }

    // 2) Releer items actualizados
    const { data: updatedItems } = await supabase
      .from("inventory_audit_items")
      .select("*")
      .eq("audit_id", activeAudit.id);

    const finalItems = (updatedItems as AuditItem[]) || [];

    // 3) Aplicar ajustes al stock y registrar movements
    let totalLoss = 0;
    let totalSurplus = 0;
    let totalDiffUnits = 0;

    for (const it of finalItems) {
      const diff = Number(it.difference || 0);
      if (diff === 0) continue;
      totalDiffUnits += diff;
      if (diff < 0) totalLoss += Math.abs(diff) * Number(it.unit_cost || 0);
      else totalSurplus += diff * Number(it.unit_cost || 0);

      const counted = Number(it.counted_stock || 0);
      const prev = Number(it.system_stock || 0);

      if (it.item_type === "bodega") {
        await supabase.from("bodega_items").update({
          stock: counted, updated_at: new Date().toISOString(),
        }).eq("id", it.item_id);
      } else {
        await supabase.from("products").update({ stock: counted }).eq("id", it.item_id);
      }

      await supabase.from("inventory_movements").insert({
        item_type: it.item_type,
        item_id: it.item_id,
        movement_type: diff > 0 ? "entrada" : "salida",
        quantity: Math.abs(diff),
        previous_stock: prev,
        new_stock: counted,
        notes: `Ajuste auditoría ${activeAudit.audit_number || activeAudit.id.slice(0, 8)}`,
        created_by: closer,
      });
    }

    // 4) Cerrar auditoría
    await supabase.from("inventory_audits").update({
      status: "cerrada",
      closed_at: new Date().toISOString(),
      closed_by: closer,
      total_loss_amount: Number(totalLoss.toFixed(2)),
      total_surplus_amount: Number(totalSurplus.toFixed(2)),
      total_difference_units: Number(totalDiffUnits.toFixed(3)),
    }).eq("id", activeAudit.id);

    setClosingAudit(false);
    alert(`Auditoría cerrada.\nPérdidas: $${money(totalLoss)}\nSobrantes: $${money(totalSurplus)}`);
    await loadAll();
  }

  async function cancelAudit() {
    if (!activeAudit) return;
    if (!confirm("¿Cancelar esta auditoría? Se eliminarán todos sus datos y no se harán ajustes.")) return;
    await supabase.from("inventory_audits").delete().eq("id", activeAudit.id);
    await loadAll();
  }

  async function loadAuditItems(id: string) {
    if (itemsMap[id]) return;
    setLoadingItems(id);
    const { data } = await supabase
      .from("inventory_audit_items")
      .select("*")
      .eq("audit_id", id)
      .order("item_name");
    setItemsMap((prev) => ({ ...prev, [id]: (data as AuditItem[]) || [] }));
    setLoadingItems(null);
  }

  function toggleExpand(id: string) {
    if (expandedId === id) setExpandedId(null);
    else { setExpandedId(id); loadAuditItems(id); }
  }

  // Progreso activa
  const activeProgress = useMemo(() => {
    if (!activeAudit || activeItems.length === 0) return { counted: 0, total: 0, loss: 0, surplus: 0 };
    let counted = 0, loss = 0, surplus = 0;
    for (const it of activeItems) {
      const raw = countDrafts[it.id];
      if (raw !== undefined && raw !== "") {
        counted += 1;
        const v = parseFloat(raw);
        if (!isNaN(v)) {
          const diff = v - it.system_stock;
          if (diff < 0) loss += Math.abs(diff) * it.unit_cost;
          else if (diff > 0) surplus += diff * it.unit_cost;
        }
      }
    }
    return { counted, total: activeItems.length, loss, surplus };
  }, [activeAudit, activeItems, countDrafts]);

  // Historial filtros
  const closedAudits = useMemo(() => audits.filter((a) => a.status === "cerrada"), [audits]);

  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    for (const a of closedAudits) set.add(monthKey(a.audit_date));
    return Array.from(set).sort().reverse();
  }, [closedAudits]);

  const filteredHistory = useMemo(() => {
    if (monthFilter === "todos") return closedAudits;
    return closedAudits.filter((a) => monthKey(a.audit_date) === monthFilter);
  }, [closedAudits, monthFilter]);

  const historyStats = useMemo(() => {
    let loss = 0, surplus = 0;
    for (const a of filteredHistory) {
      loss += Number(a.total_loss_amount || 0);
      surplus += Number(a.total_surplus_amount || 0);
    }
    return { count: filteredHistory.length, loss, surplus };
  }, [filteredHistory]);

  const monthSummary = useMemo(() => {
    const map: Record<string, { loss: number; surplus: number }> = {};
    for (const a of closedAudits) {
      const k = monthKey(a.audit_date);
      if (!map[k]) map[k] = { loss: 0, surplus: 0 };
      map[k].loss += Number(a.total_loss_amount || 0);
      map[k].surplus += Number(a.total_surplus_amount || 0);
    }
    return map;
  }, [closedAudits]);

  const inputStyle: React.CSSProperties = {
    padding: "8px 12px", borderRadius: 10, border: `1px solid ${C.border}`,
    outline: "none", background: "rgba(255,255,255,0.85)", color: C.text, fontSize: 14, width: "100%", boxSizing: "border-box",
  };

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(180deg, ${C.bgSoft} 0%, ${C.bg} 100%)`, padding: 16, fontFamily: "Arial, sans-serif" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <img src="/logo.png" alt="Sergios" style={{ width: 60, height: "auto" }} />
            <div>
              <h1 style={{ margin: 0, color: C.text, fontSize: 24 }}>Auditoría de inventario</h1>
              <p style={{ margin: 0, color: C.muted, fontSize: 13 }}>Conteo físico mensual y control de pérdidas</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href="/inventario/bodega" style={{
              padding: "10px 18px", borderRadius: 14, border: `1px solid ${C.border}`,
              background: "white", color: C.text, textDecoration: "none", fontWeight: 700, fontSize: 14,
            }}>Bodega</Link>
            <Link href="/inventario/complementos" style={{
              padding: "10px 18px", borderRadius: 14, border: `1px solid ${C.border}`,
              background: "white", color: C.text, textDecoration: "none", fontWeight: 700, fontSize: 14,
            }}>Complementos</Link>
            <Link href="/inventario/compras" style={{
              padding: "10px 18px", borderRadius: 14, border: `1px solid ${C.border}`,
              background: "white", color: C.text, textDecoration: "none", fontWeight: 700, fontSize: 14,
            }}>Compras</Link>
            <Link href="/" style={{
              padding: "10px 18px", borderRadius: 14, border: `1px solid ${C.border}`,
              background: "rgba(255,255,255,0.75)", color: C.text, textDecoration: "none", fontWeight: 700,
            }}>Inicio</Link>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 30, textAlign: "center", color: C.muted }}>Cargando...</div>
        ) : (
          <>
            {/* AUDITORÍA ACTIVA */}
            {activeAudit ? (
              <div style={{ background: C.cardStrong, borderRadius: 20, padding: 18, border: `1px solid ${C.border}`, boxShadow: C.shadow, marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 11, color: C.warning, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>Auditoría abierta</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: C.text, marginTop: 2 }}>
                      {activeAudit.audit_number} · {activeAudit.audit_date}
                    </div>
                    <div style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>
                      Iniciada por {activeAudit.created_by || "?"} · {activeItems.length} productos
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button onClick={saveProgress} disabled={savingAudit} style={{
                      padding: "10px 16px", borderRadius: 12, border: `1px solid ${C.border}`,
                      background: "white", color: C.text, fontWeight: 700, cursor: "pointer", fontSize: 13,
                      opacity: savingAudit ? 0.7 : 1,
                    }}>{savingAudit ? "..." : "Guardar avance"}</button>
                    <button onClick={closeAudit} disabled={closingAudit} style={{
                      padding: "10px 16px", borderRadius: 12, border: "none",
                      background: `linear-gradient(180deg, ${C.primary} 0%, ${C.primaryDark} 100%)`,
                      color: "white", fontWeight: 800, cursor: "pointer", fontSize: 13,
                      opacity: closingAudit ? 0.7 : 1,
                    }}>{closingAudit ? "Cerrando..." : "Cerrar y ajustar"}</button>
                    <button onClick={cancelAudit} style={{
                      padding: "10px 16px", borderRadius: 12, border: `1px solid ${C.border}`,
                      background: "white", color: C.danger, fontWeight: 700, cursor: "pointer", fontSize: 13,
                    }}>Cancelar</button>
                  </div>
                </div>

                {/* Progress stats */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
                  <div style={progressStatStyle}>
                    <div style={{ color: C.muted, fontSize: 11 }}>Contados</div>
                    <div style={{ color: C.text, fontSize: 20, fontWeight: 800 }}>{activeProgress.counted} / {activeProgress.total}</div>
                  </div>
                  <div style={progressStatStyle}>
                    <div style={{ color: C.muted, fontSize: 11 }}>Pérdida estimada</div>
                    <div style={{ color: activeProgress.loss > 0 ? C.danger : C.success, fontSize: 20, fontWeight: 800 }}>${money(activeProgress.loss)}</div>
                  </div>
                  <div style={progressStatStyle}>
                    <div style={{ color: C.muted, fontSize: 11 }}>Sobrante estimado</div>
                    <div style={{ color: activeProgress.surplus > 0 ? C.info : C.muted, fontSize: 20, fontWeight: 800 }}>${money(activeProgress.surplus)}</div>
                  </div>
                </div>

                {/* Tabla de conteo */}
                <div style={{ border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: 8, padding: "10px 12px", background: C.bgSoft, fontSize: 11, fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    <div>Producto</div>
                    <div style={{ textAlign: "right" }}>Sistema</div>
                    <div style={{ textAlign: "right" }}>Contado</div>
                    <div style={{ textAlign: "right" }}>Diferencia</div>
                    <div style={{ textAlign: "right" }}>Pérdida</div>
                  </div>
                  {activeItems.map((it) => {
                    const raw = countDrafts[it.id];
                    const counted = raw !== undefined && raw !== "" ? parseFloat(raw) : null;
                    const diff = counted !== null && !isNaN(counted) ? counted - it.system_stock : null;
                    const loss = diff !== null && diff < 0 ? Math.abs(diff) * it.unit_cost : 0;
                    return (
                      <div key={it.id} style={{
                        display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: 8, padding: "8px 12px",
                        alignItems: "center", borderTop: `1px solid ${C.border}`,
                        background: diff !== null && diff < 0 ? "rgba(180,35,24,0.04)" : diff !== null && diff > 0 ? "rgba(53,92,125,0.04)" : "white",
                      }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ color: C.text, fontWeight: 700, fontSize: 13 }}>{it.item_name}</div>
                          <div style={{ color: C.muted, fontSize: 11 }}>
                            {it.item_type === "bodega" ? "Bodega" : "Complemento"} · {it.unit || ""} · ${money(it.unit_cost)}
                          </div>
                        </div>
                        <div style={{ color: C.muted, fontSize: 13, textAlign: "right" }}>{Number(it.system_stock)}</div>
                        <input type="number" step="0.001" min="0" value={raw ?? ""} onChange={(e) => setDraft(it.id, e.target.value)} placeholder="—" style={{ ...inputStyle, textAlign: "right" }} />
                        <div style={{ color: diff === null ? C.muted : diff < 0 ? C.danger : diff > 0 ? C.info : C.success, fontWeight: 700, fontSize: 13, textAlign: "right" }}>
                          {diff === null ? "—" : diff > 0 ? `+${diff}` : diff}
                        </div>
                        <div style={{ color: loss > 0 ? C.danger : C.muted, fontWeight: 700, fontSize: 13, textAlign: "right" }}>
                          {loss > 0 ? `$${money(loss)}` : "—"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div style={{ background: C.cardStrong, borderRadius: 20, padding: 24, border: `1px solid ${C.border}`, boxShadow: C.shadow, marginBottom: 20, textAlign: "center" }}>
                <div style={{ fontSize: 44, marginBottom: 10 }}>📋</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 6 }}>No hay auditoría abierta</div>
                <div style={{ color: C.muted, fontSize: 14, marginBottom: 14 }}>
                  Inicia una nueva auditoría para contar físicamente el inventario y detectar faltantes.
                </div>
                <button onClick={startNewAudit} disabled={savingAudit} style={{
                  padding: "12px 24px", borderRadius: 14, border: "none",
                  background: `linear-gradient(180deg, ${C.primary} 0%, ${C.primaryDark} 100%)`,
                  color: "white", fontWeight: 800, cursor: "pointer", fontSize: 15,
                  opacity: savingAudit ? 0.7 : 1,
                }}>{savingAudit ? "Iniciando..." : "Iniciar nueva auditoría"}</button>
              </div>
            )}

            {/* HISTORIAL + REPORTE */}
            <div style={{ background: C.cardStrong, borderRadius: 20, padding: 18, border: `1px solid ${C.border}`, boxShadow: C.shadow }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
                <h2 style={{ margin: 0, color: C.text, fontSize: 18 }}>Auditorías cerradas</h2>
              </div>

              {/* Stats reporte */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
                <div style={reportStatStyle}>
                  <div style={{ color: C.muted, fontSize: 11 }}>{monthFilter === "todos" ? "Auditorías totales" : `Auditorías ${monthLabel(monthFilter)}`}</div>
                  <div style={{ color: C.text, fontSize: 22, fontWeight: 800 }}>{historyStats.count}</div>
                </div>
                <div style={reportStatStyle}>
                  <div style={{ color: C.muted, fontSize: 11 }}>{monthFilter === "todos" ? "Pérdidas totales" : `Pérdidas ${monthLabel(monthFilter)}`}</div>
                  <div style={{ color: historyStats.loss > 0 ? C.danger : C.success, fontSize: 22, fontWeight: 800 }}>${money(historyStats.loss)}</div>
                </div>
                <div style={reportStatStyle}>
                  <div style={{ color: C.muted, fontSize: 11 }}>{monthFilter === "todos" ? "Sobrantes totales" : `Sobrantes ${monthLabel(monthFilter)}`}</div>
                  <div style={{ color: historyStats.surplus > 0 ? C.info : C.muted, fontSize: 22, fontWeight: 800 }}>${money(historyStats.surplus)}</div>
                </div>
              </div>

              {/* Filtro meses */}
              {availableMonths.length > 0 && (
                <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
                  <button onClick={() => setMonthFilter("todos")} style={{
                    padding: "6px 12px", borderRadius: 10, fontWeight: 700, cursor: "pointer", fontSize: 12,
                    border: monthFilter === "todos" ? "none" : `1px solid ${C.border}`,
                    background: monthFilter === "todos" ? C.primary : "white",
                    color: monthFilter === "todos" ? "white" : C.text,
                  }}>Todos</button>
                  {availableMonths.map((k) => (
                    <button key={k} onClick={() => setMonthFilter(k)} style={{
                      padding: "6px 12px", borderRadius: 10, fontWeight: 700, cursor: "pointer", fontSize: 12,
                      border: monthFilter === k ? "none" : `1px solid ${C.border}`,
                      background: monthFilter === k ? C.primary : "white",
                      color: monthFilter === k ? "white" : C.text,
                    }}>
                      {monthLabel(k)} <span style={{ opacity: 0.7, fontSize: 10 }}>· -${money(monthSummary[k]?.loss || 0)}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Lista */}
              {filteredHistory.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", color: C.muted, border: `1px dashed ${C.border}`, borderRadius: 14, fontSize: 14 }}>
                  Aún no hay auditorías cerradas en este periodo
                </div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {filteredHistory.map((a) => {
                    const isExpanded = expandedId === a.id;
                    const items = itemsMap[a.id];
                    const hasLoss = Number(a.total_loss_amount || 0) > 0;
                    return (
                      <div key={a.id} style={{
                        background: C.bgSoft, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14,
                        borderLeft: `4px solid ${hasLoss ? C.danger : C.success}`,
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ color: C.text, fontWeight: 800, fontSize: 15 }}>
                              {a.audit_number} · {a.audit_date}
                            </div>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                              <span style={pillStyle}>Productos: <b>{a.total_items}</b></span>
                              <span style={{ ...pillStyle, color: hasLoss ? C.danger : C.text }}>
                                Pérdidas: <b>${money(Number(a.total_loss_amount || 0))}</b>
                              </span>
                              <span style={{ ...pillStyle }}>
                                Sobrantes: <b>${money(Number(a.total_surplus_amount || 0))}</b>
                              </span>
                              {a.closed_by && <span style={pillStyle}>Cerró: <b>{a.closed_by}</b></span>}
                            </div>
                            {a.notes && <div style={{ color: C.muted, fontSize: 13, marginTop: 6, fontStyle: "italic" }}>{a.notes}</div>}
                          </div>
                          <button onClick={() => toggleExpand(a.id)} style={{
                            padding: "8px 14px", borderRadius: 10, border: `1px solid ${C.border}`,
                            background: isExpanded ? C.primary : "white",
                            color: isExpanded ? "white" : C.text,
                            fontWeight: 700, cursor: "pointer", fontSize: 12, flexShrink: 0,
                          }}>
                            {isExpanded ? "Ocultar ▴" : "Ver detalle ▾"}
                          </button>
                        </div>

                        {isExpanded && (
                          <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${C.border}` }}>
                            {!items ? (
                              <div style={{ color: C.muted, fontSize: 13 }}>
                                {loadingItems === a.id ? "Cargando..." : ""}
                              </div>
                            ) : items.length === 0 ? (
                              <div style={{ color: C.muted, fontSize: 13 }}>Sin renglones</div>
                            ) : (
                              <div style={{ display: "grid", gap: 4 }}>
                                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: 8, padding: "6px 10px", fontSize: 10, fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>
                                  <div>Producto</div>
                                  <div style={{ textAlign: "right" }}>Sistema</div>
                                  <div style={{ textAlign: "right" }}>Contado</div>
                                  <div style={{ textAlign: "right" }}>Dif</div>
                                  <div style={{ textAlign: "right" }}>Pérdida</div>
                                </div>
                                {items
                                  .slice()
                                  .sort((x, y) => Number(x.loss_amount || 0) < Number(y.loss_amount || 0) ? 1 : -1)
                                  .map((it) => {
                                    const diff = Number(it.difference || 0);
                                    const loss = Number(it.loss_amount || 0);
                                    return (
                                      <div key={it.id} style={{
                                        display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: 8, padding: "6px 10px",
                                        borderRadius: 8, background: loss > 0 ? "rgba(180,35,24,0.04)" : "white",
                                        border: `1px solid ${C.border}`,
                                      }}>
                                        <div style={{ color: C.text, fontWeight: 600, fontSize: 12 }}>
                                          {it.item_name}
                                          <span style={{ marginLeft: 6, fontSize: 9, padding: "1px 6px", borderRadius: 999,
                                            background: it.item_type === "bodega" ? "rgba(53,92,125,0.12)" : "rgba(166,106,16,0.12)",
                                            color: it.item_type === "bodega" ? C.info : C.warning,
                                          }}>{it.item_type === "bodega" ? "B" : "C"}</span>
                                        </div>
                                        <div style={{ color: C.muted, fontSize: 12, textAlign: "right" }}>{Number(it.system_stock)}</div>
                                        <div style={{ color: C.text, fontSize: 12, textAlign: "right" }}>{it.counted_stock ?? "—"}</div>
                                        <div style={{ color: diff < 0 ? C.danger : diff > 0 ? C.info : C.muted, fontWeight: 700, fontSize: 12, textAlign: "right" }}>
                                          {diff > 0 ? `+${diff}` : diff}
                                        </div>
                                        <div style={{ color: loss > 0 ? C.danger : C.muted, fontWeight: 700, fontSize: 12, textAlign: "right" }}>
                                          {loss > 0 ? `$${money(loss)}` : "—"}
                                        </div>
                                      </div>
                                    );
                                  })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const progressStatStyle: React.CSSProperties = {
  padding: 12, borderRadius: 12, background: "#fbf8f3", border: "1px solid rgba(92, 27, 17, 0.10)",
};

const reportStatStyle: React.CSSProperties = {
  padding: 12, borderRadius: 12, background: "#fbf8f3", border: "1px solid rgba(92, 27, 17, 0.10)",
};

const pillStyle: React.CSSProperties = {
  display: "inline-block", padding: "4px 10px", borderRadius: 999,
  background: "white", border: "1px solid rgba(92, 27, 17, 0.10)", color: "#3b1c16", fontSize: 12,
};
