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

type DraftLine = {
  key: string;
  item_id: string;
  item_name: string;
  item_type: ItemType;
  unit: string;
  quantity: string;
  unit_cost: string;
};

type PurchaseOrder = {
  id: string;
  order_number: string | null;
  supplier: string | null;
  purchase_date: string;
  total_amount: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

type PurchaseItem = {
  id: string;
  purchase_order_id: string;
  item_type: ItemType;
  item_id: string;
  item_name: string;
  quantity: number;
  unit: string | null;
  unit_cost: number;
  line_total: number;
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
  return dateStr.slice(0, 7); // YYYY-MM
}

function monthLabel(key: string) {
  const [y, m] = key.split("-");
  const months = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  return `${months[Number(m) - 1]} ${y}`;
}

export default function ComprasPage() {
  const supabase = getSupabaseClient();
  const [loading, setLoading] = useState(true);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [orderItemsMap, setOrderItemsMap] = useState<Record<string, PurchaseItem[]>>({});
  const [loadingItems, setLoadingItems] = useState<string | null>(null);

  // Filtro mes
  const [monthFilter, setMonthFilter] = useState<string>("todos");

  // Modal nueva orden
  const [showNew, setShowNew] = useState(false);
  const [newSupplier, setNewSupplier] = useState("");
  const [newDate, setNewDate] = useState(todayStr());
  const [newNotes, setNewNotes] = useState("");
  const [newLines, setNewLines] = useState<DraftLine[]>([]);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerType, setPickerType] = useState<"all" | ItemType>("all");
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);

    const [bodegaRes, productsRes, ordersRes] = await Promise.all([
      supabase.from("bodega_items").select("id, name, unit, stock, cost").eq("is_active", true).order("name"),
      supabase.from("products").select("id, name, stock, purchase_price, category, fixed_piece_price, is_active").eq("is_active", true).order("name"),
      supabase.from("purchase_orders").select("*").order("purchase_date", { ascending: false }).order("created_at", { ascending: false }),
    ]);

    const bodegaItems: CatalogItem[] = ((bodegaRes.data as any[]) || []).map((b) => ({
      id: b.id,
      name: b.name,
      type: "bodega" as ItemType,
      unit: b.unit || "piezas",
      current_cost: Number(b.cost || 0),
      stock: Number(b.stock || 0),
    }));

    const complementos = ((productsRes.data as any[]) || []).filter(
      (p) => p.category === "Complementos" || (p.fixed_piece_price !== null && Number(p.fixed_piece_price) > 0)
    );
    const complementoItems: CatalogItem[] = complementos.map((p) => ({
      id: p.id,
      name: p.name,
      type: "complemento" as ItemType,
      unit: "piezas",
      current_cost: Number(p.purchase_price || 0),
      stock: Number(p.stock || 0),
    }));

    setCatalog([...bodegaItems, ...complementoItems]);
    setOrders((ordersRes.data as PurchaseOrder[]) || []);
    setLoading(false);
  }

  async function loadOrderItems(orderId: string) {
    if (orderItemsMap[orderId]) return;
    setLoadingItems(orderId);
    const { data } = await supabase
      .from("purchase_order_items")
      .select("*")
      .eq("purchase_order_id", orderId);
    setOrderItemsMap((prev) => ({ ...prev, [orderId]: (data as PurchaseItem[]) || [] }));
    setLoadingItems(null);
  }

  function toggleExpandOrder(id: string) {
    if (expandedOrderId === id) {
      setExpandedOrderId(null);
    } else {
      setExpandedOrderId(id);
      loadOrderItems(id);
    }
  }

  function addLine(item: CatalogItem) {
    if (newLines.some((l) => l.item_id === item.id)) {
      alert("Ya está agregado");
      return;
    }
    setNewLines((prev) => [...prev, {
      key: `${item.type}-${item.id}-${Date.now()}`,
      item_id: item.id,
      item_name: item.name,
      item_type: item.type,
      unit: item.unit,
      quantity: "",
      unit_cost: String(item.current_cost || ""),
    }]);
    setPickerSearch("");
  }

  function updateLine(key: string, field: "quantity" | "unit_cost", value: string) {
    setNewLines((prev) => prev.map((l) => l.key === key ? { ...l, [field]: value } : l));
  }

  function removeLine(key: string) {
    setNewLines((prev) => prev.filter((l) => l.key !== key));
  }

  const draftTotal = useMemo(() => {
    return newLines.reduce((acc, l) => {
      const q = parseFloat(l.quantity) || 0;
      const c = parseFloat(l.unit_cost) || 0;
      return acc + q * c;
    }, 0);
  }, [newLines]);

  async function saveOrder() {
    if (newLines.length === 0) { alert("Agrega al menos un producto"); return; }
    for (const l of newLines) {
      const q = parseFloat(l.quantity);
      if (!q || q <= 0) { alert(`Cantidad inválida en ${l.item_name}`); return; }
    }

    setSaving(true);
    const creator = typeof window !== "undefined" ? (sessionStorage.getItem("pin_role") || "admin") : "admin";
    const orderNumber = `OC-${Date.now().toString().slice(-6)}`;

    const { data: inserted, error: oErr } = await supabase.from("purchase_orders").insert({
      order_number: orderNumber,
      supplier: newSupplier.trim() || null,
      purchase_date: newDate,
      total_amount: draftTotal,
      notes: newNotes.trim() || null,
      created_by: creator,
      applied: true,
    }).select("id").single();

    if (oErr || !inserted) {
      alert("Error creando orden: " + (oErr?.message || "desconocido"));
      setSaving(false);
      return;
    }

    const orderId = (inserted as any).id;

    const itemsPayload = newLines.map((l) => {
      const q = parseFloat(l.quantity) || 0;
      const c = parseFloat(l.unit_cost) || 0;
      return {
        purchase_order_id: orderId,
        item_type: l.item_type,
        item_id: l.item_id,
        item_name: l.item_name,
        quantity: q,
        unit: l.unit,
        unit_cost: c,
        line_total: Number((q * c).toFixed(2)),
      };
    });

    const { error: iErr } = await supabase.from("purchase_order_items").insert(itemsPayload);
    if (iErr) {
      alert("La orden se guardó, pero fallaron los renglones: " + iErr.message);
      setSaving(false);
      return;
    }

    // Aplicar entradas de inventario + actualizar costo
    for (const l of newLines) {
      const q = parseFloat(l.quantity) || 0;
      const c = parseFloat(l.unit_cost) || 0;
      const catalogEntry = catalog.find((x) => x.id === l.item_id && x.type === l.item_type);
      const prev = catalogEntry ? catalogEntry.stock : 0;
      const newStock = prev + q;

      if (l.item_type === "bodega") {
        await supabase.from("bodega_items").update({
          stock: newStock,
          cost: c,
          updated_at: new Date().toISOString(),
        }).eq("id", l.item_id);
      } else {
        await supabase.from("products").update({
          stock: newStock,
          purchase_price: c,
        }).eq("id", l.item_id);
      }

      await supabase.from("inventory_movements").insert({
        item_type: l.item_type,
        item_id: l.item_id,
        movement_type: "entrada",
        quantity: q,
        previous_stock: prev,
        new_stock: newStock,
        notes: `Compra ${orderNumber}${newSupplier ? ` — ${newSupplier}` : ""}`,
        created_by: creator,
      });
    }

    // Reset + recargar
    setShowNew(false);
    setNewLines([]);
    setNewSupplier("");
    setNewDate(todayStr());
    setNewNotes("");
    setSaving(false);
    alert(`Orden ${orderNumber} guardada. Inventario actualizado.`);
    loadAll();
  }

  // Filtrado por mes
  const filteredOrders = useMemo(() => {
    if (monthFilter === "todos") return orders;
    return orders.filter((o) => monthKey(o.purchase_date) === monthFilter);
  }, [orders, monthFilter]);

  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    for (const o of orders) set.add(monthKey(o.purchase_date));
    return Array.from(set).sort().reverse();
  }, [orders]);

  const monthSummary = useMemo(() => {
    const map: Record<string, { count: number; total: number }> = {};
    for (const o of orders) {
      const k = monthKey(o.purchase_date);
      if (!map[k]) map[k] = { count: 0, total: 0 };
      map[k].count += 1;
      map[k].total += Number(o.total_amount || 0);
    }
    return map;
  }, [orders]);

  const filteredStats = useMemo(() => {
    const count = filteredOrders.length;
    const total = filteredOrders.reduce((acc, o) => acc + Number(o.total_amount || 0), 0);
    return { count, total };
  }, [filteredOrders]);

  // Catálogo filtrado para el picker
  const visibleCatalog = useMemo(() => {
    const q = pickerSearch.toLowerCase().trim();
    return catalog.filter((c) => {
      if (pickerType !== "all" && c.type !== pickerType) return false;
      if (q && !c.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [catalog, pickerSearch, pickerType]);

  const inputStyle: React.CSSProperties = {
    padding: "10px 14px", borderRadius: 12, border: `1px solid ${C.border}`,
    outline: "none", background: "rgba(255,255,255,0.85)", color: C.text, fontSize: 15, width: "100%", boxSizing: "border-box",
  };

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(180deg, ${C.bgSoft} 0%, ${C.bg} 100%)`, padding: 16, fontFamily: "Arial, sans-serif" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <img src="/logo.png" alt="Sergios" style={{ width: 60, height: "auto" }} />
            <div>
              <h1 style={{ margin: 0, color: C.text, fontSize: 24 }}>Órdenes de compra</h1>
              <p style={{ margin: 0, color: C.muted, fontSize: 13 }}>Registra compras a proveedores y actualiza inventario automáticamente</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={() => setShowNew(true)} style={{
              padding: "10px 18px", borderRadius: 14, border: "none",
              background: `linear-gradient(180deg, ${C.primary} 0%, ${C.primaryDark} 100%)`,
              color: "white", fontWeight: 700, cursor: "pointer", fontSize: 14,
            }}>+ Nueva orden</button>
            <Link href="/admin/inventario/bodega" style={{
              padding: "10px 18px", borderRadius: 14, border: `1px solid ${C.border}`,
              background: "white", color: C.text, textDecoration: "none", fontWeight: 700, fontSize: 14,
            }}>Bodega</Link>
            <Link href="/admin/inventario/complementos" style={{
              padding: "10px 18px", borderRadius: 14, border: `1px solid ${C.border}`,
              background: "white", color: C.text, textDecoration: "none", fontWeight: 700, fontSize: 14,
            }}>Complementos</Link>
            <Link href="/admin/inventario/auditoria" style={{
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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
          <div style={{ background: C.cardStrong, borderRadius: 16, padding: 14, border: `1px solid ${C.border}`, boxShadow: C.shadow }}>
            <div style={{ color: C.muted, fontSize: 12 }}>{monthFilter === "todos" ? "Órdenes totales" : `Órdenes ${monthLabel(monthFilter)}`}</div>
            <div style={{ color: C.text, fontSize: 26, fontWeight: 800 }}>{filteredStats.count}</div>
          </div>
          <div style={{ background: C.cardStrong, borderRadius: 16, padding: 14, border: `1px solid ${C.border}`, boxShadow: C.shadow }}>
            <div style={{ color: C.muted, fontSize: 12 }}>{monthFilter === "todos" ? "Comprado (total)" : `Comprado ${monthLabel(monthFilter)}`}</div>
            <div style={{ color: C.primary, fontSize: 22, fontWeight: 800 }}>${money(filteredStats.total)}</div>
          </div>
          <div style={{ background: C.cardStrong, borderRadius: 16, padding: 14, border: `1px solid ${C.border}`, boxShadow: C.shadow }}>
            <div style={{ color: C.muted, fontSize: 12 }}>Meses con actividad</div>
            <div style={{ color: C.text, fontSize: 26, fontWeight: 800 }}>{availableMonths.length}</div>
          </div>
        </div>

        {/* Filtros mes */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <button onClick={() => setMonthFilter("todos")} style={{
            padding: "8px 14px", borderRadius: 12, fontWeight: 700, cursor: "pointer", fontSize: 13,
            border: monthFilter === "todos" ? "none" : `1px solid ${C.border}`,
            background: monthFilter === "todos" ? `linear-gradient(180deg, ${C.primary} 0%, ${C.primaryDark} 100%)` : "white",
            color: monthFilter === "todos" ? "white" : C.text,
          }}>Todos</button>
          {availableMonths.map((k) => (
            <button key={k} onClick={() => setMonthFilter(k)} style={{
              padding: "8px 14px", borderRadius: 12, fontWeight: 700, cursor: "pointer", fontSize: 13,
              border: monthFilter === k ? "none" : `1px solid ${C.border}`,
              background: monthFilter === k ? `linear-gradient(180deg, ${C.primary} 0%, ${C.primaryDark} 100%)` : "white",
              color: monthFilter === k ? "white" : C.text,
            }}>
              {monthLabel(k)} <span style={{ opacity: 0.7, fontSize: 11 }}>· ${money(monthSummary[k]?.total || 0)}</span>
            </button>
          ))}
        </div>

        {/* Lista de órdenes */}
        {loading ? (
          <div style={{ padding: 30, textAlign: "center", color: C.muted }}>Cargando...</div>
        ) : filteredOrders.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center", color: C.muted, background: C.cardStrong, borderRadius: 18, border: `1px dashed ${C.border}` }}>
            No hay órdenes en este periodo. Crea una con el botón + Nueva orden.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filteredOrders.map((o) => {
              const isExpanded = expandedOrderId === o.id;
              const items = orderItemsMap[o.id];
              return (
                <div key={o.id} style={{
                  background: C.cardStrong, border: `1px solid ${C.border}`, borderRadius: 18, padding: 16, boxShadow: C.shadow,
                  borderLeft: `4px solid ${C.success}`,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, color: C.text, fontSize: 16 }}>
                        {o.order_number || "(sin folio)"}
                        {o.supplier && <span style={{ color: C.muted, fontWeight: 600 }}> — {o.supplier}</span>}
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                        <span style={pillStyle}>Fecha: <b>{o.purchase_date}</b></span>
                        <span style={pillStyle}>Total: <b>${money(Number(o.total_amount || 0))}</b></span>
                        {o.created_by && <span style={pillStyle}>Por: <b>{o.created_by}</b></span>}
                      </div>
                      {o.notes && <div style={{ color: C.muted, fontSize: 13, marginTop: 6, fontStyle: "italic" }}>{o.notes}</div>}
                    </div>
                    <button onClick={() => toggleExpandOrder(o.id)} style={{
                      padding: "10px 16px", borderRadius: 12, border: `1px solid ${C.border}`,
                      background: isExpanded ? C.primary : "white",
                      color: isExpanded ? "white" : C.text,
                      fontWeight: 700, cursor: "pointer", fontSize: 13, flexShrink: 0,
                    }}>
                      {isExpanded ? "Ocultar ▴" : "Ver artículos ▾"}
                    </button>
                  </div>

                  {isExpanded && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px dashed ${C.border}` }}>
                      {!items ? (
                        <div style={{ color: C.muted, fontSize: 13 }}>
                          {loadingItems === o.id ? "Cargando..." : ""}
                        </div>
                      ) : items.length === 0 ? (
                        <div style={{ color: C.muted, fontSize: 13 }}>Esta orden no tiene renglones</div>
                      ) : (
                        <div style={{ display: "grid", gap: 6 }}>
                          {items.map((it) => (
                            <div key={it.id} style={itemRowStyle}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>
                                  {it.item_name}
                                  <span style={{
                                    marginLeft: 8, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
                                    background: it.item_type === "bodega" ? "rgba(53,92,125,0.12)" : "rgba(166,106,16,0.12)",
                                    color: it.item_type === "bodega" ? C.info : C.warning,
                                  }}>{it.item_type === "bodega" ? "Bodega" : "Complemento"}</span>
                                </div>
                                <div style={{ color: C.muted, fontSize: 12 }}>
                                  {Number(it.quantity)} {it.unit || ""} × ${money(Number(it.unit_cost || 0))}
                                </div>
                              </div>
                              <div style={{ color: C.text, fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                                ${money(Number(it.line_total || 0))}
                              </div>
                            </div>
                          ))}
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

      {/* Modal nueva orden */}
      {showNew && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => !saving && setShowNew(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: C.cardStrong, borderRadius: 22, padding: 22, maxWidth: 820, width: "100%", maxHeight: "92vh", overflow: "auto", boxShadow: "0 20px 50px rgba(0,0,0,0.2)" }}>
            <h3 style={{ margin: "0 0 12px", color: C.text, fontSize: 20 }}>Nueva orden de compra</h3>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10, marginBottom: 10 }}>
              <div>
                <label style={labelStyle}>Proveedor</label>
                <input value={newSupplier} onChange={(e) => setNewSupplier(e.target.value)} placeholder="Ej: Frigorífico ABC" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Fecha</label>
                <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} style={inputStyle} />
              </div>
            </div>

            <label style={labelStyle}>Notas (opcional)</label>
            <input value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="Referencia de factura, etc." style={{ ...inputStyle, marginBottom: 14 }} />

            {/* Picker */}
            <div style={{ background: C.bgSoft, border: `1px solid ${C.border}`, borderRadius: 14, padding: 12, marginBottom: 12 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                <input placeholder="Buscar producto o insumo..." value={pickerSearch} onChange={(e) => setPickerSearch(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: 200 }} />
                {(["all", "bodega", "complemento"] as const).map((t) => (
                  <button key={t} onClick={() => setPickerType(t)} style={{
                    padding: "8px 12px", borderRadius: 10, fontWeight: 700, cursor: "pointer", fontSize: 12,
                    border: pickerType === t ? "none" : `1px solid ${C.border}`,
                    background: pickerType === t ? C.primary : "white",
                    color: pickerType === t ? "white" : C.text,
                  }}>
                    {t === "all" ? "Todos" : t === "bodega" ? "Bodega" : "Complementos"}
                  </button>
                ))}
              </div>

              {pickerSearch && (
                <div style={{ maxHeight: 180, overflow: "auto", display: "grid", gap: 4 }}>
                  {visibleCatalog.slice(0, 30).map((c) => (
                    <button key={`${c.type}-${c.id}`} onClick={() => addLine(c)} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "8px 12px", borderRadius: 10, border: `1px solid ${C.border}`, background: "white",
                      cursor: "pointer", fontSize: 13, textAlign: "left",
                    }}>
                      <span style={{ color: C.text, fontWeight: 600 }}>
                        {c.name}
                        <span style={{ marginLeft: 8, fontSize: 10, padding: "2px 6px", borderRadius: 999,
                          background: c.type === "bodega" ? "rgba(53,92,125,0.12)" : "rgba(166,106,16,0.12)",
                          color: c.type === "bodega" ? C.info : C.warning,
                        }}>{c.type === "bodega" ? "Bodega" : "Compl."}</span>
                      </span>
                      <span style={{ color: C.muted, fontSize: 12 }}>
                        Stock: {c.stock} {c.unit} · Costo: ${money(c.current_cost)}
                      </span>
                    </button>
                  ))}
                  {visibleCatalog.length === 0 && <div style={{ color: C.muted, fontSize: 13, padding: 8 }}>Sin resultados</div>}
                </div>
              )}
            </div>

            {/* Líneas */}
            {newLines.length === 0 ? (
              <div style={{ padding: 16, textAlign: "center", color: C.muted, border: `1px dashed ${C.border}`, borderRadius: 12, fontSize: 13 }}>
                Busca productos arriba y agrégalos a la orden
              </div>
            ) : (
              <div style={{ display: "grid", gap: 6 }}>
                {newLines.map((l) => {
                  const q = parseFloat(l.quantity) || 0;
                  const c = parseFloat(l.unit_cost) || 0;
                  const subtotal = q * c;
                  return (
                    <div key={l.key} style={{
                      display: "grid", gridTemplateColumns: "1.5fr 90px 110px 90px 32px",
                      gap: 8, alignItems: "center", padding: 10, borderRadius: 12, background: C.bgSoft, border: `1px solid ${C.border}`,
                    }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: C.text, fontSize: 13 }}>{l.item_name}</div>
                        <div style={{ fontSize: 10, color: C.muted }}>{l.item_type === "bodega" ? "Bodega" : "Complemento"} · {l.unit}</div>
                      </div>
                      <input type="number" step="0.001" min="0" value={l.quantity} onChange={(e) => updateLine(l.key, "quantity", e.target.value)} placeholder="Cant" style={{ ...inputStyle, padding: "6px 10px", fontSize: 13 }} />
                      <input type="number" step="0.01" min="0" value={l.unit_cost} onChange={(e) => updateLine(l.key, "unit_cost", e.target.value)} placeholder="Costo" style={{ ...inputStyle, padding: "6px 10px", fontSize: 13 }} />
                      <div style={{ color: C.primary, fontWeight: 700, fontSize: 13, textAlign: "right" }}>${money(subtotal)}</div>
                      <button onClick={() => removeLine(l.key)} style={{ background: "transparent", border: "none", color: C.danger, cursor: "pointer", fontWeight: 800, fontSize: 16 }}>×</button>
                    </div>
                  );
                })}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 14, padding: "10px 4px", fontWeight: 800, color: C.text, fontSize: 16 }}>
                  Total: <span style={{ color: C.primary }}>${money(draftTotal)}</span>
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button onClick={() => setShowNew(false)} disabled={saving} style={{ flex: 1, padding: "12px", borderRadius: 14, border: `1px solid ${C.border}`, background: "white", color: C.text, fontWeight: 700, cursor: "pointer" }}>Cancelar</button>
              <button onClick={saveOrder} disabled={saving || newLines.length === 0} style={{
                flex: 1, padding: "12px", borderRadius: 14, border: "none", fontWeight: 800, cursor: "pointer",
                background: `linear-gradient(180deg, ${C.primary} 0%, ${C.primaryDark} 100%)`,
                color: "white", opacity: (saving || newLines.length === 0) ? 0.6 : 1,
              }}>{saving ? "Guardando..." : "Guardar orden y aplicar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  color: "#7a5a52", fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4,
};

const pillStyle: React.CSSProperties = {
  display: "inline-block", padding: "4px 10px", borderRadius: 999,
  background: "white", border: "1px solid rgba(92, 27, 17, 0.10)", color: "#3b1c16", fontSize: 12,
};

const itemRowStyle: React.CSSProperties = {
  display: "flex", justifyContent: "space-between", alignItems: "center",
  gap: 10, padding: "8px 12px", borderRadius: 10, background: "rgba(255,255,255,0.7)",
  border: "1px solid rgba(92, 27, 17, 0.10)",
};
