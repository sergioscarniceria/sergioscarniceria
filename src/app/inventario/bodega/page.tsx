"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";

type BodegaItem = {
  id: string;
  name: string;
  description: string | null;
  unit: string;
  stock: number;
  min_stock: number;
  cost: number;
  is_active: boolean;
};

type Movement = {
  id: string;
  item_id: string;
  movement_type: string;
  quantity: number;
  previous_stock: number;
  new_stock: number;
  notes: string | null;
  created_by: string | null;
  authorized_by: string | null;
  created_at: string;
};

const C = {
  bg: "#f7f1e8", bgSoft: "#fbf8f3",
  card: "rgba(255,255,255,0.82)", cardStrong: "rgba(255,255,255,0.92)",
  border: "rgba(92, 27, 17, 0.10)", text: "#3b1c16", muted: "#7a5a52",
  primary: "#7b2218", primaryDark: "#5a190f",
  success: "#1f7a4d", warning: "#a66a10", danger: "#b42318",
  shadow: "0 10px 30px rgba(91, 25, 15, 0.08)",
};

function money(v: number) {
  return v.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function InventarioBodegaPage() {
  const supabase = getSupabaseClient();
  const [items, setItems] = useState<BodegaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStock, setFilterStock] = useState<"all" | "low" | "zero">("all");

  // New item modal
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newUnit, setNewUnit] = useState("piezas");
  const [newCost, setNewCost] = useState("");
  const [newMin, setNewMin] = useState("");
  const [newSaving, setNewSaving] = useState(false);

  // Movement modal
  const [modal, setModal] = useState<{ item: BodegaItem; type: "entrada" | "salida" } | null>(null);
  const [movQty, setMovQty] = useState("");
  const [movNotes, setMovNotes] = useState("");
  const [movSaving, setMovSaving] = useState(false);
  const [movAuthName, setMovAuthName] = useState("");
  const [movAuthCode, setMovAuthCode] = useState("");
  const [movAuthError, setMovAuthError] = useState("");

  // Edit min
  const [editMinId, setEditMinId] = useState<string | null>(null);
  const [editMinVal, setEditMinVal] = useState("");

  // History
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);

  // Edit item modal
  const [editItem, setEditItem] = useState<BodegaItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editUnit, setEditUnit] = useState("piezas");
  const [editCost, setEditCost] = useState("");
  const [editMin, setEditMin] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => { loadItems(); }, []);

  async function loadItems() {
    setLoading(true);
    const { data } = await supabase
      .from("bodega_items")
      .select("*")
      .eq("is_active", true)
      .order("name");
    setItems((data as BodegaItem[]) || []);
    setLoading(false);
  }

  async function handleNewItem() {
    if (!newName.trim()) { alert("Escribe el nombre del insumo"); return; }
    setNewSaving(true);
    const { error } = await supabase.from("bodega_items").insert({
      name: newName.trim(),
      description: newDesc.trim() || null,
      unit: newUnit,
      cost: parseFloat(newCost) || 0,
      min_stock: parseInt(newMin) || 0,
      stock: 0,
      is_active: true,
    });
    if (error) { alert("Error: " + error.message); setNewSaving(false); return; }
    setShowNew(false);
    setNewName(""); setNewDesc(""); setNewUnit("piezas"); setNewCost(""); setNewMin("");
    setNewSaving(false);
    loadItems();
  }

  async function handleMovement() {
    if (!modal) return;
    const qty = parseInt(movQty);
    if (!qty || qty <= 0) { alert("Ingresa cantidad válida"); return; }
    if (modal.type === "salida" && qty > modal.item.stock) {
      alert("No hay suficiente stock"); return;
    }

    if (modal.type === "salida") {
      if (!movAuthName.trim() || !movAuthCode.trim()) {
        setMovAuthError("Nombre y código son obligatorios para salidas");
        return;
      }
      const { data: authCheck } = await supabase
        .from("employee_codes")
        .select("name")
        .eq("code", movAuthCode.trim())
        .eq("is_active", true)
        .single();
      if (!authCheck) { setMovAuthError("Código incorrecto"); return; }
    }

    setMovSaving(true);

    // Leer stock actual de BD para evitar race conditions
    const { data: freshItem } = await supabase
      .from("bodega_items")
      .select("stock")
      .eq("id", modal.item.id)
      .single();

    const prev = freshItem?.stock ?? modal.item.stock ?? 0;
    const newStock = modal.type === "entrada" ? prev + qty : prev - qty;

    if (newStock < 0) {
      alert("No hay suficiente stock para esta salida");
      setMovSaving(false);
      return;
    }

    const { error: upErr } = await supabase
      .from("bodega_items")
      .update({ stock: newStock, updated_at: new Date().toISOString() })
      .eq("id", modal.item.id);

    if (upErr) { alert("Error: " + upErr.message); setMovSaving(false); return; }

    await supabase.from("inventory_movements").insert({
      item_type: "bodega",
      item_id: modal.item.id,
      movement_type: modal.type,
      quantity: qty,
      previous_stock: prev,
      new_stock: newStock,
      notes: movNotes.trim() || null,
      created_by: sessionStorage.getItem("pin_role") || "admin",
      authorized_by: modal.type === "salida" ? movAuthName.trim() : null,
      auth_code: modal.type === "salida" ? movAuthCode.trim() : null,
    });

    setModal(null);
    setMovQty(""); setMovNotes(""); setMovAuthName(""); setMovAuthCode(""); setMovAuthError("");
    setMovSaving(false);
    loadItems();
  }

  async function saveMinStock(itemId: string) {
    const val = parseInt(editMinVal) || 0;
    await supabase.from("bodega_items").update({ min_stock: val }).eq("id", itemId);
    setEditMinId(null);
    loadItems();
  }

  function openEdit(item: BodegaItem) {
    setEditItem(item);
    setEditName(item.name || "");
    setEditDesc(item.description || "");
    setEditUnit(item.unit || "piezas");
    setEditCost(String(item.cost || 0));
    setEditMin(String(item.min_stock || 0));
  }

  async function saveEdit() {
    if (!editItem) return;
    if (!editName.trim()) { alert("El nombre no puede estar vacío"); return; }
    setEditSaving(true);
    const { error } = await supabase.from("bodega_items").update({
      name: editName.trim(),
      description: editDesc.trim() || null,
      unit: editUnit,
      cost: parseFloat(editCost) || 0,
      min_stock: parseInt(editMin) || 0,
      updated_at: new Date().toISOString(),
    }).eq("id", editItem.id);
    if (error) { alert("Error: " + error.message); setEditSaving(false); return; }
    setEditItem(null);
    setEditSaving(false);
    loadItems();
  }

  async function deleteItem(item: BodegaItem) {
    if (!confirm(`¿Desactivar "${item.name}"?`)) return;
    await supabase.from("bodega_items").update({ is_active: false }).eq("id", item.id);
    loadItems();
  }

  async function loadHistory(itemId: string) {
    setHistoryId(itemId);
    const { data } = await supabase
      .from("inventory_movements")
      .select("*")
      .eq("item_type", "bodega")
      .eq("item_id", itemId)
      .order("created_at", { ascending: false })
      .limit(20);
    setMovements((data as Movement[]) || []);
  }

  const filtered = items.filter((i) => {
    if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStock === "low" && (i.stock || 0) > (i.min_stock || 0)) return false;
    if (filterStock === "zero" && (i.stock || 0) > 0) return false;
    return true;
  });

  const lowCount = items.filter((i) => (i.min_stock || 0) > 0 && (i.stock || 0) <= (i.min_stock || 0)).length;
  const zeroCount = items.filter((i) => (i.stock || 0) === 0).length;
  const inventoryValue = items.reduce((acc, i) => acc + (i.stock || 0) * (i.cost || 0), 0);

  const inputStyle: React.CSSProperties = {
    padding: "10px 14px", borderRadius: 12, border: `1px solid ${C.border}`,
    outline: "none", background: "rgba(255,255,255,0.85)", color: C.text, fontSize: 15, width: "100%",
  };

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(180deg, ${C.bgSoft} 0%, ${C.bg} 100%)`, padding: 16, fontFamily: "Arial, sans-serif" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <img src="/logo.png" alt="Sergios" style={{ width: 60, height: "auto" }} />
            <div>
              <h1 style={{ margin: 0, color: C.text, fontSize: 24 }}>Inventario Bodega</h1>
              <p style={{ margin: 0, color: C.muted, fontSize: 13 }}>Insumos y materiales — {items.length} items</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setShowNew(true)} style={{
              padding: "10px 18px", borderRadius: 14, border: "none",
              background: `linear-gradient(180deg, ${C.primary} 0%, ${C.primaryDark} 100%)`,
              color: "white", fontWeight: 700, cursor: "pointer", fontSize: 14,
            }}>+ Nuevo insumo</button>
            <Link href="/inventario/complementos" style={{
              padding: "10px 18px", borderRadius: 14, border: `1px solid ${C.border}`,
              background: "white", color: C.text, textDecoration: "none", fontWeight: 700, fontSize: 14,
            }}>Complementos</Link>
            <Link href="/inventario/compras" style={{
              padding: "10px 18px", borderRadius: 14, border: `1px solid ${C.border}`,
              background: "white", color: C.text, textDecoration: "none", fontWeight: 700, fontSize: 14,
            }}>Compras</Link>
            <Link href="/inventario/auditoria" style={{
              padding: "10px 18px", borderRadius: 14, border: `1px solid ${C.border}`,
              background: "white", color: C.text, textDecoration: "none", fontWeight: 700, fontSize: 14,
            }}>Auditoría</Link>
            <Link href="/" style={{
              padding: "10px 18px", borderRadius: 14, border: `1px solid ${C.border}`,
              background: "rgba(255,255,255,0.75)", color: C.text, textDecoration: "none", fontWeight: 700,
            }}>Inicio</Link>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
          <div style={{ background: C.cardStrong, borderRadius: 16, padding: 14, border: `1px solid ${C.border}`, boxShadow: C.shadow }}>
            <div style={{ color: C.muted, fontSize: 12 }}>Total insumos</div>
            <div style={{ color: C.text, fontSize: 26, fontWeight: 800 }}>{items.length}</div>
          </div>
          <div style={{ background: C.cardStrong, borderRadius: 16, padding: 14, border: `1px solid ${C.border}`, boxShadow: C.shadow, cursor: "pointer" }} onClick={() => setFilterStock(filterStock === "low" ? "all" : "low")}>
            <div style={{ color: C.muted, fontSize: 12 }}>Stock bajo</div>
            <div style={{ color: lowCount > 0 ? C.warning : C.success, fontSize: 26, fontWeight: 800 }}>{lowCount}</div>
          </div>
          <div style={{ background: C.cardStrong, borderRadius: 16, padding: 14, border: `1px solid ${C.border}`, boxShadow: C.shadow, cursor: "pointer" }} onClick={() => setFilterStock(filterStock === "zero" ? "all" : "zero")}>
            <div style={{ color: C.muted, fontSize: 12 }}>Sin stock</div>
            <div style={{ color: zeroCount > 0 ? C.danger : C.success, fontSize: 26, fontWeight: 800 }}>{zeroCount}</div>
          </div>
          <div style={{ background: C.cardStrong, borderRadius: 16, padding: 14, border: `1px solid ${C.border}`, boxShadow: C.shadow }}>
            <div style={{ color: C.muted, fontSize: 12 }}>Valor inventario</div>
            <div style={{ color: C.primary, fontSize: 22, fontWeight: 800 }}>${money(inventoryValue)}</div>
          </div>
        </div>

        {/* Search + Filter */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar insumo..." style={{ ...inputStyle, flex: 1, minWidth: 200 }} />
          <div style={{ display: "flex", gap: 4 }}>
            {(["all", "low", "zero"] as const).map((f) => (
              <button key={f} onClick={() => setFilterStock(f)} style={{
                padding: "10px 14px", borderRadius: 12, fontWeight: 700, cursor: "pointer", fontSize: 13,
                border: filterStock === f ? "none" : `1px solid ${C.border}`,
                background: filterStock === f ? `linear-gradient(180deg, ${C.primary} 0%, ${C.primaryDark} 100%)` : "white",
                color: filterStock === f ? "white" : C.text,
              }}>
                {f === "all" ? "Todos" : f === "low" ? "Bajo" : "Agotado"}
              </button>
            ))}
          </div>
        </div>

        {/* Items list */}
        {loading ? (
          <div style={{ padding: 30, textAlign: "center", color: C.muted }}>Cargando...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center", color: C.muted, background: C.cardStrong, borderRadius: 18 }}>
            {items.length === 0 ? "Agrega tu primer insumo con el botón + Nuevo insumo" : "No se encontraron insumos"}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map((item) => {
              const isLow = (item.min_stock || 0) > 0 && (item.stock || 0) <= (item.min_stock || 0);
              const isZero = (item.stock || 0) === 0;
              return (
                <div key={item.id} style={{
                  background: C.cardStrong, border: `1px solid ${C.border}`, borderRadius: 18, padding: 16, boxShadow: C.shadow,
                  borderLeft: `4px solid ${isZero ? C.danger : isLow ? C.warning : C.success}`,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: C.text, fontSize: 16 }}>{item.name}</div>
                      {item.description && <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>{item.description}</div>}
                      {item.cost > 0 && <div style={{ color: C.muted, fontSize: 12 }}>Costo: ${money(item.cost)} / {item.unit}</div>}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 28, fontWeight: 800, color: isZero ? C.danger : isLow ? C.warning : C.text }}>
                          {item.stock || 0}
                        </div>
                        <div style={{ fontSize: 11, color: C.muted }}>{item.unit}</div>
                      </div>

                      <div style={{ textAlign: "center", cursor: "pointer" }} onClick={() => { setEditMinId(item.id); setEditMinVal(String(item.min_stock || 0)); }}>
                        {editMinId === item.id ? (
                          <div style={{ display: "flex", gap: 4 }}>
                            <input value={editMinVal} onChange={(e) => setEditMinVal(e.target.value)} type="number" min="0" style={{ width: 50, padding: "4px 6px", borderRadius: 8, border: `1px solid ${C.border}`, textAlign: "center", fontSize: 14 }} autoFocus onKeyDown={(e) => e.key === "Enter" && saveMinStock(item.id)} />
                            <button onClick={() => saveMinStock(item.id)} style={{ padding: "4px 8px", borderRadius: 8, border: "none", background: C.success, color: "white", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>OK</button>
                          </div>
                        ) : (
                          <>
                            <div style={{ fontSize: 14, fontWeight: 700, color: C.muted }}>{item.min_stock || 0}</div>
                            <div style={{ fontSize: 10, color: C.muted }}>mínimo</div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {isLow && !isZero && (
                    <div style={{ marginTop: 8, padding: "6px 12px", borderRadius: 10, background: "rgba(166,106,16,0.10)", color: C.warning, fontWeight: 700, fontSize: 12 }}>
                      Stock bajo — Mínimo: {item.min_stock} {item.unit}
                    </div>
                  )}
                  {isZero && (
                    <div style={{ marginTop: 8, padding: "6px 12px", borderRadius: 10, background: "rgba(180,35,24,0.10)", color: C.danger, fontWeight: 700, fontSize: 12 }}>
                      AGOTADO — Reabastecer urgente
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                    <button onClick={() => { setModal({ item, type: "entrada" }); setMovQty(""); setMovNotes(""); }} style={{
                      padding: "8px 16px", borderRadius: 12, border: "none", fontWeight: 700, cursor: "pointer", fontSize: 13,
                      background: "rgba(31,122,77,0.12)", color: C.success,
                    }}>+ Entrada</button>
                    <button onClick={() => { setModal({ item, type: "salida" }); setMovQty(""); setMovNotes(""); }} style={{
                      padding: "8px 16px", borderRadius: 12, border: "none", fontWeight: 700, cursor: "pointer", fontSize: 13,
                      background: "rgba(180,35,24,0.10)", color: C.danger,
                    }}>- Salida</button>
                    <button onClick={() => loadHistory(item.id)} style={{
                      padding: "8px 16px", borderRadius: 12, border: `1px solid ${C.border}`, fontWeight: 700, cursor: "pointer", fontSize: 13,
                      background: "white", color: C.muted,
                    }}>Historial</button>
                    <button onClick={() => openEdit(item)} style={{
                      padding: "8px 16px", borderRadius: 12, border: `1px solid ${C.border}`, fontWeight: 700, cursor: "pointer", fontSize: 13,
                      background: "white", color: C.primary,
                    }}>Editar</button>
                    <button onClick={() => deleteItem(item)} style={{
                      padding: "8px 16px", borderRadius: 12, border: `1px solid ${C.border}`, fontWeight: 700, cursor: "pointer", fontSize: 13,
                      background: "white", color: C.danger, marginLeft: "auto",
                    }}>Eliminar</button>
                  </div>

                  {historyId === item.id && (
                    <div style={{ marginTop: 12, background: C.bgSoft, borderRadius: 14, padding: 12, border: `1px solid ${C.border}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: C.text }}>Últimos movimientos</span>
                        <button onClick={() => setHistoryId(null)} style={{ padding: "2px 8px", borderRadius: 8, border: "none", background: "transparent", color: C.muted, cursor: "pointer", fontWeight: 700 }}>X</button>
                      </div>
                      {movements.length === 0 ? (
                        <div style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: 10 }}>Sin movimientos</div>
                      ) : movements.map((m) => (
                        <div key={m.id} style={{ padding: "8px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                            <div>
                              <span style={{ color: m.movement_type === "entrada" ? C.success : C.danger, fontWeight: 700 }}>
                                {m.movement_type === "entrada" ? "+" : "-"}{m.quantity}
                              </span>
                              <span style={{ color: C.muted, marginLeft: 8 }}>{m.previous_stock} → {m.new_stock}</span>
                              {m.notes && <span style={{ color: C.muted, marginLeft: 8, fontStyle: "italic" }}>({m.notes})</span>}
                            </div>
                            <span style={{ color: C.muted, fontSize: 12, whiteSpace: "nowrap" }}>
                              {new Date(m.created_at).toLocaleDateString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Mexico_City" })}
                            </span>
                          </div>
                          {(m.created_by || m.authorized_by) && (
                            <div style={{ marginTop: 4, color: C.muted, fontSize: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                              {m.created_by && <span>Por: <b style={{ color: C.text }}>{m.created_by}</b></span>}
                              {m.authorized_by && <span>Autorizó: <b style={{ color: C.text }}>{m.authorized_by}</b></span>}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* New item modal */}
      {showNew && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => setShowNew(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: C.cardStrong, borderRadius: 22, padding: 24, maxWidth: 440, width: "100%", boxShadow: "0 20px 50px rgba(0,0,0,0.2)" }}>
            <h3 style={{ margin: "0 0 16px", color: C.text, fontSize: 18 }}>Nuevo insumo de bodega</h3>

            <label style={{ color: C.muted, fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>Nombre *</label>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ej: Bolsas grandes" style={{ ...inputStyle, marginBottom: 12 }} autoFocus />

            <label style={{ color: C.muted, fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>Descripción (opcional)</label>
            <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Ej: Bolsa 40x60 para cortes" style={{ ...inputStyle, marginBottom: 12 }} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
              <div>
                <label style={{ color: C.muted, fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>Unidad</label>
                <select value={newUnit} onChange={(e) => setNewUnit(e.target.value)} style={inputStyle}>
                  <option value="piezas">Piezas</option>
                  <option value="rollos">Rollos</option>
                  <option value="paquetes">Paquetes</option>
                  <option value="cajas">Cajas</option>
                  <option value="litros">Litros</option>
                  <option value="kg">Kg</option>
                </select>
              </div>
              <div>
                <label style={{ color: C.muted, fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>Costo unit.</label>
                <input value={newCost} onChange={(e) => setNewCost(e.target.value)} type="number" step="0.5" min="0" placeholder="$0" style={inputStyle} />
              </div>
              <div>
                <label style={{ color: C.muted, fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>Stock mín.</label>
                <input value={newMin} onChange={(e) => setNewMin(e.target.value)} type="number" min="0" placeholder="0" style={inputStyle} />
              </div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowNew(false)} style={{ flex: 1, padding: "12px", borderRadius: 14, border: `1px solid ${C.border}`, background: "white", color: C.text, fontWeight: 700, cursor: "pointer" }}>Cancelar</button>
              <button onClick={handleNewItem} disabled={newSaving} style={{
                flex: 1, padding: "12px", borderRadius: 14, border: "none", fontWeight: 800, cursor: "pointer",
                background: `linear-gradient(180deg, ${C.primary} 0%, ${C.primaryDark} 100%)`,
                color: "white", opacity: newSaving ? 0.7 : 1,
              }}>{newSaving ? "..." : "Guardar insumo"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Movement modal */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => setModal(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: C.cardStrong, borderRadius: 22, padding: 24, maxWidth: 400, width: "100%", boxShadow: "0 20px 50px rgba(0,0,0,0.2)" }}>
            <h3 style={{ margin: "0 0 4px", color: C.text, fontSize: 18 }}>
              {modal.type === "entrada" ? "Entrada" : "Salida"} — {modal.item.name}
            </h3>
            <p style={{ margin: "0 0 16px", color: C.muted, fontSize: 14 }}>Stock actual: {modal.item.stock || 0} {modal.item.unit}</p>

            <label style={{ color: C.muted, fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>Cantidad</label>
            <input value={movQty} onChange={(e) => setMovQty(e.target.value)} type="number" min="1" placeholder="Ej: 50" style={{ ...inputStyle, marginBottom: 12 }} autoFocus />

            <label style={{ color: C.muted, fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>Nota (opcional)</label>
            <input value={movNotes} onChange={(e) => setMovNotes(e.target.value)} placeholder="Ej: Compra semanal" style={{ ...inputStyle, marginBottom: 12 }} />

            {modal.type === "salida" && (
              <div style={{ background: "rgba(180,35,24,0.06)", borderRadius: 12, padding: 12, marginBottom: 12, border: `1px solid rgba(180,35,24,0.15)` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.danger, marginBottom: 8 }}>Autorización requerida para salidas</div>
                <label style={{ color: C.muted, fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>Nombre de quien retira</label>
                <input value={movAuthName} onChange={(e) => { setMovAuthName(e.target.value); setMovAuthError(""); }} placeholder="Ej: Jessi" style={{ ...inputStyle, marginBottom: 8 }} />
                <label style={{ color: C.muted, fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>Código de autorización</label>
                <input value={movAuthCode} onChange={(e) => { setMovAuthCode(e.target.value); setMovAuthError(""); }} type="password" placeholder="Código" style={{ ...inputStyle, letterSpacing: 4 }} />
                {movAuthError && <p style={{ color: C.danger, fontSize: 12, margin: "6px 0 0", fontWeight: 700 }}>{movAuthError}</p>}
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setModal(null)} style={{ flex: 1, padding: "12px", borderRadius: 14, border: `1px solid ${C.border}`, background: "white", color: C.text, fontWeight: 700, cursor: "pointer" }}>Cancelar</button>
              <button onClick={handleMovement} disabled={movSaving} style={{
                flex: 1, padding: "12px", borderRadius: 14, border: "none", fontWeight: 800, cursor: "pointer",
                background: modal.type === "entrada"
                  ? `linear-gradient(180deg, ${C.success} 0%, #156b3d 100%)`
                  : `linear-gradient(180deg, ${C.danger} 0%, #8a1a12 100%)`,
                color: "white", opacity: movSaving ? 0.7 : 1,
              }}>
                {movSaving ? "..." : modal.type === "entrada" ? "Registrar entrada" : "Registrar salida"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit item modal */}
      {editItem && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => setEditItem(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: C.cardStrong, borderRadius: 22, padding: 24, maxWidth: 440, width: "100%", boxShadow: "0 20px 50px rgba(0,0,0,0.2)" }}>
            <h3 style={{ margin: "0 0 4px", color: C.text, fontSize: 18 }}>Editar insumo</h3>
            <p style={{ margin: "0 0 16px", color: C.muted, fontSize: 13 }}>
              Stock actual: {editItem.stock || 0} {editItem.unit} (no se modifica aquí)
            </p>

            <label style={{ color: C.muted, fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>Nombre *</label>
            <input value={editName} onChange={(e) => setEditName(e.target.value)} style={{ ...inputStyle, marginBottom: 12 }} autoFocus />

            <label style={{ color: C.muted, fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>Descripción</label>
            <input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Opcional" style={{ ...inputStyle, marginBottom: 12 }} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
              <div>
                <label style={{ color: C.muted, fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>Unidad</label>
                <select value={editUnit} onChange={(e) => setEditUnit(e.target.value)} style={inputStyle}>
                  <option value="piezas">Piezas</option>
                  <option value="rollos">Rollos</option>
                  <option value="paquetes">Paquetes</option>
                  <option value="cajas">Cajas</option>
                  <option value="litros">Litros</option>
                  <option value="kg">Kg</option>
                </select>
              </div>
              <div>
                <label style={{ color: C.muted, fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>Costo unit.</label>
                <input value={editCost} onChange={(e) => setEditCost(e.target.value)} type="number" step="0.5" min="0" style={inputStyle} />
              </div>
              <div>
                <label style={{ color: C.muted, fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>Stock mín.</label>
                <input value={editMin} onChange={(e) => setEditMin(e.target.value)} type="number" min="0" style={inputStyle} />
              </div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setEditItem(null)} style={{ flex: 1, padding: "12px", borderRadius: 14, border: `1px solid ${C.border}`, background: "white", color: C.text, fontWeight: 700, cursor: "pointer" }}>Cancelar</button>
              <button onClick={saveEdit} disabled={editSaving} style={{
                flex: 1, padding: "12px", borderRadius: 14, border: "none", fontWeight: 800, cursor: "pointer",
                background: `linear-gradient(180deg, ${C.primary} 0%, ${C.primaryDark} 100%)`,
                color: "white", opacity: editSaving ? 0.7 : 1,
              }}>{editSaving ? "..." : "Guardar cambios"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
