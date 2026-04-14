"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";

type Product = {
  id: string;
  name: string;
  price: number;
  sell_by_weight: boolean;
};

type IngredientRow = {
  id?: string;
  tempId: string;
  product_id: string | null;
  ingredient_name: string;
  quantity_kg: number;
  unit: string;
  unit_price: number;
  notes: string;
  isNew?: boolean;
};

type Recipe = {
  id: string;
  name: string;
  type: string;
  description?: string | null;
  yield_kg?: number | null;
  instructions?: string | null;
  is_active?: boolean | null;
  recipe_ingredients?: Array<{
    id: string;
    product_id: string | null;
    ingredient_name: string;
    quantity_kg: number;
    unit: string;
    unit_price: number;
    notes: string | null;
  }>;
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

const UNITS = [
  { value: "kg", label: "kg" },
  { value: "g", label: "gramos" },
  { value: "litros", label: "litros" },
  { value: "ml", label: "ml" },
  { value: "piezas", label: "piezas" },
];

const TYPES = [
  { value: "marinado", label: "Marinado / Adobo" },
  { value: "preparacion", label: "Preparación" },
  { value: "otro", label: "Otro" },
];

export default function EditRecetaPage() {
  const supabase = getSupabaseClient();
  const router = useRouter();
  const params = useParams();
  const recipeId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [type, setType] = useState("marinado");
  const [description, setDescription] = useState("");
  const [yieldKg, setYieldKg] = useState("");
  const [instructions, setInstructions] = useState("");
  const [ingredients, setIngredients] = useState<IngredientRow[]>([]);
  const [deletedIngIds, setDeletedIngIds] = useState<string[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  const [prodSearch, setProdSearch] = useState("");
  const [showProdDropdown, setShowProdDropdown] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    const [recipeRes, productsRes] = await Promise.all([
      supabase.from("recipes").select("*, recipe_ingredients (*)").eq("id", recipeId).single(),
      supabase.from("products").select("id, name, price, sell_by_weight").eq("active", true).order("name"),
    ]);

    if (recipeRes.error || !recipeRes.data) {
      alert("No se encontró la receta");
      router.push("/admin/recetario");
      return;
    }

    const r = recipeRes.data as Recipe;
    setName(r.name);
    setType(r.type);
    setDescription(r.description || "");
    setYieldKg(r.yield_kg ? String(r.yield_kg) : "");
    setInstructions(r.instructions || "");
    setIngredients(
      (r.recipe_ingredients || []).map((ing) => ({
        id: ing.id,
        tempId: ing.id,
        product_id: ing.product_id,
        ingredient_name: ing.ingredient_name,
        quantity_kg: ing.quantity_kg,
        unit: ing.unit,
        unit_price: ing.unit_price,
        notes: ing.notes || "",
      }))
    );
    setProducts((productsRes.data as Product[]) || []);
    setLoading(false);
  }

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(prodSearch.toLowerCase())
  );

  function addIngredientFromProduct(product: Product) {
    setIngredients((prev) => [
      ...prev,
      {
        tempId: crypto.randomUUID(),
        product_id: product.id,
        ingredient_name: product.name,
        quantity_kg: 1,
        unit: "kg",
        unit_price: product.price,
        notes: "",
        isNew: true,
      },
    ]);
    setProdSearch("");
    setShowProdDropdown(false);
  }

  function addManualIngredient() {
    setIngredients((prev) => [
      ...prev,
      {
        tempId: crypto.randomUUID(),
        product_id: null,
        ingredient_name: "",
        quantity_kg: 1,
        unit: "kg",
        unit_price: 0,
        notes: "",
        isNew: true,
      },
    ]);
  }

  function updateIngredient(tempId: string, field: keyof IngredientRow, value: string | number) {
    setIngredients((prev) =>
      prev.map((ing) => (ing.tempId === tempId ? { ...ing, [field]: value } : ing))
    );
  }

  function removeIngredient(tempId: string) {
    const ing = ingredients.find((i) => i.tempId === tempId);
    if (ing?.id) {
      setDeletedIngIds((prev) => [...prev, ing.id!]);
    }
    setIngredients((prev) => prev.filter((i) => i.tempId !== tempId));
  }

  const totalCost = ingredients.reduce((acc, ing) => acc + ing.quantity_kg * ing.unit_price, 0);
  const yieldNum = parseFloat(yieldKg) || 0;
  const costPerKg = yieldNum > 0 ? totalCost / yieldNum : 0;

  async function handleSave() {
    if (!name.trim()) { alert("Escribe el nombre de la receta"); return; }
    if (ingredients.length === 0) { alert("Agrega al menos un ingrediente"); return; }

    setSaving(true);
    try {
      // 1. Update recipe
      const { error: recipeErr } = await supabase
        .from("recipes")
        .update({
          name: name.trim(),
          type,
          description: description.trim() || null,
          yield_kg: yieldNum > 0 ? yieldNum : null,
          instructions: instructions.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", recipeId);

      if (recipeErr) {
        alert("Error al actualizar receta: " + recipeErr.message);
        setSaving(false);
        return;
      }

      // 2. Delete removed ingredients
      if (deletedIngIds.length > 0) {
        await supabase.from("recipe_ingredients").delete().in("id", deletedIngIds);
      }

      // 3. Upsert ingredients
      for (const ing of ingredients) {
        const row = {
          recipe_id: recipeId,
          product_id: ing.product_id || null,
          ingredient_name: ing.ingredient_name,
          quantity_kg: ing.quantity_kg,
          unit: ing.unit,
          unit_price: ing.unit_price,
          notes: ing.notes || null,
        };

        if (ing.isNew || !ing.id) {
          await supabase.from("recipe_ingredients").insert(row);
        } else {
          await supabase.from("recipe_ingredients").update(row).eq("id", ing.id);
        }
      }

      setEditing(false);
      setDeletedIngIds([]);
      await loadAll();
    } catch (err) {
      alert("Error inesperado");
      console.error(err);
    }
    setSaving(false);
  }

  const inputStyle: React.CSSProperties = {
    padding: "10px 14px", borderRadius: 12, border: `1px solid ${C.border}`,
    outline: "none", background: "rgba(255,255,255,0.85)", color: C.text, fontSize: 15, width: "100%",
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(180deg, ${C.bgSoft} 0%, ${C.bg} 100%)`, fontFamily: "Arial, sans-serif" }}>
        <div style={{ padding: "18px 22px", borderRadius: 18, background: C.cardStrong, border: `1px solid ${C.border}`, boxShadow: C.shadow, color: C.text }}>Cargando receta...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(180deg, ${C.bgSoft} 0%, ${C.bg} 100%)`, padding: 16, fontFamily: "Arial, sans-serif" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <img src="/logo.png" alt="Sergios" style={{ width: 60, height: "auto" }} />
            <div>
              <h1 style={{ margin: 0, color: C.text, fontSize: 24 }}>{editing ? "Editando receta" : name}</h1>
              <p style={{ margin: 0, color: C.muted, fontSize: 13 }}>
                {editing ? "Modifica ingredientes y datos" : `${TYPES.find((t) => t.value === type)?.label || type}`}
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {!editing && (
              <button onClick={() => setEditing(true)} style={{
                padding: "10px 18px", borderRadius: 14, border: "none",
                background: `linear-gradient(180deg, ${C.primary} 0%, ${C.primaryDark} 100%)`,
                color: "white", fontWeight: 700, cursor: "pointer", fontSize: 14,
              }}>
                Editar
              </button>
            )}
            <Link href="/admin/recetario" style={{
              padding: "10px 18px", borderRadius: 14, border: `1px solid ${C.border}`,
              background: "rgba(255,255,255,0.75)", color: C.text, textDecoration: "none", fontWeight: 700,
            }}>
              Volver
            </Link>
          </div>
        </div>

        {/* Form / View */}
        <div style={{ background: C.cardStrong, border: `1px solid ${C.border}`, borderRadius: 22, padding: 20, boxShadow: C.shadow, marginBottom: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ color: C.muted, fontSize: 12, fontWeight: 700, marginBottom: 4, display: "block" }}>Nombre *</label>
              {editing ? (
                <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
              ) : (
                <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{name}</div>
              )}
            </div>
            <div>
              <label style={{ color: C.muted, fontSize: 12, fontWeight: 700, marginBottom: 4, display: "block" }}>Tipo</label>
              {editing ? (
                <div style={{ display: "flex", gap: 6 }}>
                  {TYPES.map((t) => (
                    <button key={t.value} onClick={() => setType(t.value)} style={{
                      flex: 1, padding: "10px 8px", borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: "pointer",
                      border: type === t.value ? "none" : `1px solid ${C.border}`,
                      background: type === t.value ? `linear-gradient(180deg, ${C.primary} 0%, ${C.primaryDark} 100%)` : "white",
                      color: type === t.value ? "white" : C.text,
                    }}>{t.label}</button>
                  ))}
                </div>
              ) : (
                <span style={{
                  display: "inline-block", padding: "6px 14px", borderRadius: 999, fontSize: 13, fontWeight: 700,
                  background: type === "marinado" ? "rgba(166,106,16,0.12)" : "rgba(31,122,77,0.12)",
                  color: type === "marinado" ? C.warning : C.success,
                }}>{TYPES.find((t) => t.value === type)?.label || type}</span>
              )}
            </div>
            <div>
              <label style={{ color: C.muted, fontSize: 12, fontWeight: 700, marginBottom: 4, display: "block" }}>Rendimiento (kg)</label>
              {editing ? (
                <input value={yieldKg} onChange={(e) => setYieldKg(e.target.value)} type="number" step="0.1" min="0" style={inputStyle} />
              ) : (
                <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{yieldKg ? `${yieldKg} kg` : "—"}</div>
              )}
            </div>
            {(editing || description) && (
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ color: C.muted, fontSize: 12, fontWeight: 700, marginBottom: 4, display: "block" }}>Descripción</label>
                {editing ? (
                  <input value={description} onChange={(e) => setDescription(e.target.value)} style={inputStyle} />
                ) : (
                  <div style={{ color: C.muted, fontSize: 14 }}>{description}</div>
                )}
              </div>
            )}
            {(editing || instructions) && (
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ color: C.muted, fontSize: 12, fontWeight: 700, marginBottom: 4, display: "block" }}>Instrucciones</label>
                {editing ? (
                  <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
                ) : (
                  <div style={{ color: C.text, fontSize: 14, whiteSpace: "pre-wrap", background: C.bgSoft, padding: 12, borderRadius: 12 }}>{instructions}</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Ingredients */}
        <div style={{ background: C.cardStrong, border: `1px solid ${C.border}`, borderRadius: 22, padding: 20, boxShadow: C.shadow, marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h2 style={{ margin: 0, color: C.text, fontSize: 18 }}>Ingredientes ({ingredients.length})</h2>
            {editing && (
              <button onClick={addManualIngredient} style={{
                padding: "8px 14px", borderRadius: 12, border: `1px solid ${C.border}`,
                background: "white", color: C.text, fontWeight: 700, cursor: "pointer", fontSize: 13,
              }}>+ Manual</button>
            )}
          </div>

          {editing && (
            <div style={{ position: "relative", marginBottom: 16 }}>
              <input value={prodSearch}
                onChange={(e) => { setProdSearch(e.target.value); setShowProdDropdown(true); }}
                onFocus={() => setShowProdDropdown(true)}
                placeholder="Buscar producto para agregar..."
                style={inputStyle}
              />
              {showProdDropdown && prodSearch.length > 0 && filteredProducts.length > 0 && (
                <div style={{
                  position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10,
                  background: "white", border: `1px solid ${C.border}`, borderRadius: 14,
                  maxHeight: 220, overflow: "auto", boxShadow: C.shadow, marginTop: 4,
                }}>
                  {filteredProducts.slice(0, 10).map((p) => (
                    <div key={p.id} onClick={() => addIngredientFromProduct(p)} style={{
                      padding: "10px 14px", cursor: "pointer", borderBottom: `1px solid ${C.border}`,
                      display: "flex", justifyContent: "space-between",
                    }}>
                      <span style={{ color: C.text, fontWeight: 600 }}>{p.name}</span>
                      <span style={{ color: C.primary, fontWeight: 700, fontSize: 13 }}>${money(p.price)}/kg</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {ingredients.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: C.muted }}>Sin ingredientes</div>
          ) : editing ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {ingredients.map((ing, idx) => (
                <div key={ing.tempId} style={{
                  background: C.bgSoft, border: `1px solid ${C.border}`, borderRadius: 16, padding: 14,
                  borderLeft: `4px solid ${ing.product_id ? C.success : C.warning}`,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: C.muted, fontWeight: 700 }}>
                      #{idx + 1} {ing.product_id ? "(de productos)" : "(manual)"}
                    </span>
                    <button onClick={() => removeIngredient(ing.tempId)} style={{
                      padding: "4px 10px", borderRadius: 8, border: "none",
                      background: "rgba(180,35,24,0.10)", color: C.danger, fontWeight: 700, cursor: "pointer", fontSize: 12,
                    }}>Quitar</button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 8 }}>
                    <div>
                      <label style={{ color: C.muted, fontSize: 11 }}>Nombre</label>
                      <input value={ing.ingredient_name}
                        onChange={(e) => updateIngredient(ing.tempId, "ingredient_name", e.target.value)}
                        readOnly={!!ing.product_id}
                        style={{ ...inputStyle, fontSize: 13, padding: "8px 10px", background: ing.product_id ? "rgba(240,240,240,0.8)" : "rgba(255,255,255,0.85)" }}
                      />
                    </div>
                    <div>
                      <label style={{ color: C.muted, fontSize: 11 }}>Cantidad</label>
                      <input value={ing.quantity_kg}
                        onChange={(e) => updateIngredient(ing.tempId, "quantity_kg", parseFloat(e.target.value) || 0)}
                        type="number" step="0.1" min="0"
                        style={{ ...inputStyle, fontSize: 13, padding: "8px 10px" }}
                      />
                    </div>
                    <div>
                      <label style={{ color: C.muted, fontSize: 11 }}>Unidad</label>
                      <select value={ing.unit}
                        onChange={(e) => updateIngredient(ing.tempId, "unit", e.target.value)}
                        style={{ ...inputStyle, fontSize: 13, padding: "8px 10px" }}
                      >
                        {UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ color: C.muted, fontSize: 11 }}>Precio/u</label>
                      <input value={ing.unit_price}
                        onChange={(e) => updateIngredient(ing.tempId, "unit_price", parseFloat(e.target.value) || 0)}
                        type="number" step="0.5" min="0"
                        style={{ ...inputStyle, fontSize: 13, padding: "8px 10px" }}
                      />
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                    <input value={ing.notes}
                      onChange={(e) => updateIngredient(ing.tempId, "notes", e.target.value)}
                      placeholder="Notas (opcional)"
                      style={{ ...inputStyle, fontSize: 12, padding: "6px 10px", flex: 1, marginRight: 12 }}
                    />
                    <span style={{ color: C.primary, fontWeight: 800, fontSize: 14, whiteSpace: "nowrap" }}>
                      ${money(ing.quantity_kg * ing.unit_price)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* View mode - table */
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                    <th style={{ textAlign: "left", padding: "8px 10px", color: C.muted, fontSize: 12, fontWeight: 700 }}>#</th>
                    <th style={{ textAlign: "left", padding: "8px 10px", color: C.muted, fontSize: 12, fontWeight: 700 }}>Ingrediente</th>
                    <th style={{ textAlign: "right", padding: "8px 10px", color: C.muted, fontSize: 12, fontWeight: 700 }}>Cantidad</th>
                    <th style={{ textAlign: "right", padding: "8px 10px", color: C.muted, fontSize: 12, fontWeight: 700 }}>Precio/u</th>
                    <th style={{ textAlign: "right", padding: "8px 10px", color: C.muted, fontSize: 12, fontWeight: 700 }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {ingredients.map((ing, idx) => (
                    <tr key={ing.tempId} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: "10px", color: C.muted, fontSize: 13 }}>{idx + 1}</td>
                      <td style={{ padding: "10px" }}>
                        <div style={{ fontWeight: 600, color: C.text, fontSize: 14 }}>{ing.ingredient_name}</div>
                        {ing.notes && <div style={{ color: C.muted, fontSize: 12 }}>{ing.notes}</div>}
                        {ing.product_id && <span style={{ fontSize: 10, color: C.success, fontWeight: 700 }}>Producto</span>}
                      </td>
                      <td style={{ textAlign: "right", padding: "10px", color: C.text, fontWeight: 600 }}>
                        {ing.quantity_kg} {ing.unit}
                      </td>
                      <td style={{ textAlign: "right", padding: "10px", color: C.muted }}>
                        ${money(ing.unit_price)}
                      </td>
                      <td style={{ textAlign: "right", padding: "10px", color: C.primary, fontWeight: 800 }}>
                        ${money(ing.quantity_kg * ing.unit_price)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Cost summary */}
        <div style={{ background: C.cardStrong, border: `1px solid ${C.border}`, borderRadius: 22, padding: 20, boxShadow: C.shadow, marginBottom: 20 }}>
          <h3 style={{ margin: "0 0 12px", color: C.text, fontSize: 16 }}>Resumen de costos</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div style={{ background: C.bgSoft, borderRadius: 14, padding: 14, border: `1px solid ${C.border}` }}>
              <div style={{ color: C.muted, fontSize: 12 }}>Ingredientes</div>
              <div style={{ color: C.text, fontSize: 24, fontWeight: 800 }}>{ingredients.length}</div>
            </div>
            <div style={{ background: C.bgSoft, borderRadius: 14, padding: 14, border: `1px solid ${C.border}` }}>
              <div style={{ color: C.muted, fontSize: 12 }}>Costo total</div>
              <div style={{ color: C.primary, fontSize: 24, fontWeight: 800 }}>${money(totalCost)}</div>
            </div>
            <div style={{ background: C.bgSoft, borderRadius: 14, padding: 14, border: `1px solid ${C.border}` }}>
              <div style={{ color: C.muted, fontSize: 12 }}>Costo por kg</div>
              <div style={{ color: C.primary, fontSize: 24, fontWeight: 800 }}>
                {yieldNum > 0 ? `$${money(costPerKg)}` : "—"}
              </div>
            </div>
          </div>
        </div>

        {/* Save buttons (editing mode) */}
        {editing && (
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <button onClick={() => { setEditing(false); loadAll(); setDeletedIngIds([]); }} style={{
              padding: "14px 24px", borderRadius: 14, border: `1px solid ${C.border}`,
              background: "white", color: C.text, fontWeight: 700, cursor: "pointer", fontSize: 15,
            }}>Cancelar</button>
            <button onClick={handleSave} disabled={saving} style={{
              padding: "14px 28px", borderRadius: 14, border: "none",
              background: `linear-gradient(180deg, ${C.primary} 0%, ${C.primaryDark} 100%)`,
              color: "white", fontWeight: 800, cursor: saving ? "not-allowed" : "pointer", fontSize: 16,
              boxShadow: "0 8px 18px rgba(123, 34, 24, 0.20)", opacity: saving ? 0.7 : 1,
            }}>{saving ? "Guardando..." : "Guardar cambios"}</button>
          </div>
        )}
      </div>
    </div>
  );
}
