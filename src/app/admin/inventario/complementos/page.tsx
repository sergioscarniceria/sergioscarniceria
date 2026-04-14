"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";

type Product = {
  id: string;
  name: string;
  price: number;
  category: string | null;
  fixed_piece_price: number | null;
  stock: number;
  min_stock: number;
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

export default function InventarioComplementosPage() {
  const supabase = getSupabaseClient();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStock, setFilterStock] = useState<"all" | "low" | "zero">("all");

  // Modal state
  const [modal, setModal] = useState<{ product: Product; type: "entrada" | "salida" } | null>(null);
  const [movQty, setMovQty] = useState("");
  const [movNotes, setMovNotes] = useState("");
  const [movSaving, setMovSaving] = useState(false);

  // Edit min_stock
  const [editMinId, setEditMinId] = useState<string | null>(null);
  const [editMinVal, setEditMinVal] = useState("");

  // History
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);

  useEffect(() => { loadProducts(); }, []);

  async function loadProducts() {
    setLoading(true);
    const { data } = await supabase
      .from("products")
      .select("id, name, price, category, fixed_piece_price, stock, min_stock, is_active")
      .eq("is_active", true)
      .order("name");
    // Filter to complementos (by piece)
    const complementos = (data || []).filter(
      (p: any) => p.category === "Complementos" || (p.fixed_piece_price !== null && p.fixed_piece_price > 0)
    );
    setProducts(complementos as Product[]);
    setLoading(false);
  }

  async function handleMovement() {
    if (!modal) return;
    const qty = parseInt(movQty);
    if (!qty || qty <= 0) { alert("Ingresa una cantidad válida"); return; }
    if (modal.type === "salida" && qty > modal.product.stock) {
      alert("No hay suficiente stock"); return;
    }

    setMovSaving(true);
    const prev = modal.product.stock || 0;
    const newStock = modal.type === "entrada" ? prev + qty : prev - qty;

    // Update stock
    const { error: upErr } = await supabase
      .from("products")
      .update({ stock: newStock })
      .eq("id", modal.product.id);

    if (upErr) { alert("Error: " + upErr.message); setMovSaving(false); return; }

    // Record movement
    await supabase.from("inventory_movements").insert({
      item_type: "complemento",
      item_id: modal.product.id,
      movement_type: modal.type,
      quantity: qty,
      previous_stock: prev,
      new_stock: newStock,
      notes: movNotes.trim() || null,
      created_by: sessionStorage.getItem("pin_role") || "admin",
    });

    setModal(null);
    setMovQty("");
    setMovNotes("");
    setMovSaving(false);
    loadProducts();
  }

  async function saveMinStock(productId: string) {
    const val = parseInt(editMinVal) || 0;
    await supabase.from("products").update({ min_stock: val }).eq("id", productId);
    setEditMinId(null);
    loadProducts();
  }

  async function loadHistory(productId: string) {
    setHistoryId(productId);
    const { data } = await supabase
      .from("inventory_movements")
      .select("*")
      .eq("item_type", "complemento")
      .eq("item_id", productId)
      .order("created_at", { ascending: false })
      .limit(20);
    setMovements((data as Movement[]) || []);
  }

  const filtered = products.filter((p) => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStock === "low" && (p.stock || 0) > (p.min_stock || 0)) return false;
    if (filterStock === "zero" && (p.stock || 0) > 0) return false;
    return true;
  });

  const lowCount = products.filter((p) => (p.min_stock || 0) > 0 && (p.stock || 0) <= (p.min_stock || 0)).length;
  const zeroCount = products.filter((p) => (p.stock || 0) === 0).length;

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
              <h1 style={{ margin: 0, color: C.text, fontSize: 24 }}>Inventario Complementos</h1>
              <p style={{ margin: 0, color: C.muted, fontSize: 13 }}>Productos por pieza — {products.length} items</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Link href="/admin/inventario/bodega" style={{
              padding: "10px 18px", borderRadius: 14, border: `1px solid ${C.border}`,
              background: "white", color: C.text, textDecoration: "none", fontWeight: 700, fontSize: 14,
            }}>Bodega</Link>
            <Link href="/" style={{
              padding: "10px 18px", borderRadius: 14, border: `1px solid ${C.border}`,
              background: "rgba(255,255,255,0.75)", color: C.text, textDecoration: "none", fontWeight: 700,
            }}>Inicio</Link>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
          <div style={{ background: C.cardStrong, borderRadius: 16, padding: 14, border: `1px solid ${C.border}`, boxShadow: C.shadow }}>
            <div style={{ color: C.muted, fontSize: 12 }}>Total items</div>
            <div style={{ color: C.text, fontSize: 26, fontWeight: 800 }}>{products.length}</div>
          </div>
          <div style={{ background: C.cardStrong, borderRadius: 16, padding: 14, border: `1px solid ${C.border}`, boxShadow: C.shadow, cursor: "pointer" }} onClick={() => setFilterStock(filterStock === "low" ? "all" : "low")}>
            <div style={{ color: C.muted, fontSize: 12 }}>Stock bajo</div>
            <div style={{ color: lowCount > 0 ? C.warning : C.success, fontSize: 26, fontWeight: 800 }}>{lowCount}</div>
          </div>
          <div style={{ background: C.cardStrong, borderRadius: 16, padding: 14, border: `1px solid ${C.border}`, boxShadow: C.shadow, cursor: "pointer" }} onClick={() => setFilterStock(filterStock === "zero" ? "all" : "zero")}>
            <div style={{ color: C.muted, fontSize: 12 }}>Sin stock</div>
            <div style={{ color: zeroCount > 0 ? C.danger : C.success, fontSize: 26, fontWeight: 800 }}>{zeroCount}</div>
          </div>
        </div>

        {/* Search + Filter */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar producto..." style={{ ...inputStyle, flex: 1, minWidth: 200 }} />
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

        {/* Product list */}
        {loading ? (
          <div style={{ padding: 30, textAlign: "center", color: C.muted }}>Cargando...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center", color: C.muted, background: C.cardStrong, borderRadius: 18 }}>No se encontraron productos</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map((p) => {
              const isLow = (p.min_stock || 0) > 0 && (p.stock || 0) <= (p.min_stock || 0);
              const isZero = (p.stock || 0) === 0;
              return (
                <div key={p.id} style={{
                  background: C.cardStrong, border: `1px solid ${C.border}`, borderRadius: 18, padding: 16, boxShadow: C.shadow,
                  borderLeft: `4px solid ${isZero ? C.danger : isLow ? C.warning : C.success}`,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: C.text, fontSize: 16 }}>{p.name}</div>
                      <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>
                        Precio: ${money(p.fixed_piece_price || p.price)} por pieza
                      </div>
                    </div>

                    {/* Stock display */}
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 28, fontWeight: 800, color: isZero ? C.danger : isLow ? C.warning : C.text }}>
                          {p.stock || 0}
                        </div>
                        <div style={{ fontSize: 11, color: C.muted }}>piezas</div>
                      </div>

                      {/* Min stock badge */}
                      <div style={{ textAlign: "center", cursor: "pointer" }} onClick={() => { setEditMinId(p.id); setEditMinVal(String(p.min_stock || 0)); }}>
                        {editMinId === p.id ? (
                          <div style={{ display: "flex", gap: 4 }}>
                            <input value={editMinVal} onChange={(e) => setEditMinVal(e.target.value)} type="number" min="0" style={{ width: 50, padding: "4px 6px", borderRadius: 8, border: `1px solid ${C.border}`, textAlign: "center", fontSize: 14 }} autoFocus onKeyDown={(e) => e.key === "Enter" && saveMinStock(p.id)} />
                            <button onClick={() => saveMinStock(p.id)} style={{ padding: "4px 8px", borderRadius: 8, border: "none", background: C.success, color: "white", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>OK</button>
                          </div>
                        ) : (
                          <>
                            <div style={{ fontSize: 14, fontWeight: 700, color: C.muted }}>{p.min_stock || 0}</div>
                            <div style={{ fontSize: 10, color: C.muted }}>mínimo</div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Alert */}
                  {isLow && !isZero && (
                    <div style={{ marginTop: 8, padding: "6px 12px", borderRadius: 10, background: "rgba(166,106,16,0.10)", color: C.warning, fontWeight: 700, fontSize: 12 }}>
                      Stock bajo — Mínimo: {p.min_stock} piezas
                    </div>
                  )}
                  {isZero && (
                    <div style={{ marginTop: 8, padding: "6px 12px", borderRadius: 10, background: "rgba(180,35,24,0.10)", color: C.danger, fontWeight: 700, fontSize: 12 }}>
                      AGOTADO — Reabastecer urgente
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                    <button onClick={() => { setModal({ product: p, type: "entrada" }); setMovQty(""); setMovNotes(""); }} style={{
                      padding: "8px 16px", borderRadius: 12, border: "none", fontWeight: 700, cursor: "pointer", fontSize: 13,
                      background: "rgba(31,122,77,0.12)", color: C.success,
                    }}>+ Entrada</button>
                    <button onClick={() => { setModal({ product: p, type: "salida" }); setMovQty(""); setMovNotes(""); }} style={{
                      padding: "8px 16px", borderRadius: 12, border: "none", fontWeight: 700, cursor: "pointer", fontSize: 13,
                      background: "rgba(180,35,24,0.10)", color: C.danger,
                    }}>- Salida</button>
                    <button onClick={() => loadHistory(p.id)} style={{
                      padding: "8px 16px", borderRadius: 12, border: `1px solid ${C.border}`, fontWeight: 700, cursor: "pointer", fontSize: 13,
                      background: "white", color: C.muted,
                    }}>Historial</button>
                  </div>

                  {/* History panel */}
                  {historyId === p.id && (
                    <div style={{ marginTop: 12, background: C.bgSoft, borderRadius: 14, padding: 12, border: `1px solid ${C.border}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: C.text }}>Últimos movimientos</span>
                        <button onClick={() => setHistoryId(null)} style={{ padding: "2px 8px", borderRadius: 8, border: "none", background: "transparent", color: C.muted, cursor: "pointer", fontWeight: 700 }}>X</button>
                      </div>
                      {movements.length === 0 ? (
                        <div style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: 10 }}>Sin movimientos</div>
                      ) : movements.map((m) => (
                        <div key={m.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
                          <div>
                            <span style={{ color: m.movement_type === "entrada" ? C.success : C.danger, fontWeight: 700 }}>
                              {m.movement_type === "entrada" ? "+" : "-"}{m.quantity}
                            </span>
                            <span style={{ color: C.muted, marginLeft: 8 }}>{m.previous_stock} → {m.new_stock}</span>
                            {m.notes && <span style={{ color: C.muted, marginLeft: 8, fontStyle: "italic" }}>({m.notes})</span>}
                          </div>
                          <span style={{ color: C.muted, fontSize: 12 }}>
                            {new Date(m.created_at).toLocaleDateString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </span>
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

      {/* Movement Modal */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => setModal(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: C.cardStrong, borderRadius: 22, padding: 24, maxWidth: 400, width: "100%", boxShadow: "0 20px 50px rgba(0,0,0,0.2)" }}>
            <h3 style={{ margin: "0 0 4px", color: C.text, fontSize: 18 }}>
              {modal.type === "entrada" ? "Entrada de inventario" : "Salida de inventario"}
            </h3>
            <p style={{ margin: "0 0 16px", color: C.muted, fontSize: 14 }}>{modal.product.name} — Stock actual: {modal.product.stock || 0}</p>

            <label style={{ color: C.muted, fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>Cantidad (piezas)</label>
            <input value={movQty} onChange={(e) => setMovQty(e.target.value)} type="number" min="1" placeholder="Ej: 10" style={{ ...inputStyle, marginBottom: 12 }} autoFocus />

            <label style={{ color: C.muted, fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>Nota (opcional)</label>
            <input value={movNotes} onChange={(e) => setMovNotes(e.target.value)} placeholder="Ej: Compra a proveedor X" style={{ ...inputStyle, marginBottom: 16 }} />

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
    </div>
  );
}
