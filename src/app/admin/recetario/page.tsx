"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";

type RecipeIngredient = {
  id: string;
  ingredient_name: string;
  quantity_kg: number;
  unit: string;
  unit_price: number;
};

type Recipe = {
  id: string;
  name: string;
  type: string;
  description?: string | null;
  yield_kg?: number | null;
  is_active?: boolean | null;
  created_at?: string | null;
  recipe_ingredients?: RecipeIngredient[];
};

const C = {
  bg: "#f7f1e8", bgSoft: "#fbf8f3",
  card: "rgba(255,255,255,0.82)", cardStrong: "rgba(255,255,255,0.92)",
  border: "rgba(92, 27, 17, 0.10)", text: "#3b1c16", muted: "#7a5a52",
  primary: "#7b2218", primaryDark: "#5a190f",
  success: "#1f7a4d", warning: "#a66a10", danger: "#b42318", info: "#355c7d",
  shadow: "0 10px 30px rgba(91, 25, 15, 0.08)",
};

function money(v: number) {
  return v.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const TYPE_LABELS: Record<string, string> = {
  marinado: "Marinado / Adobo",
  preparacion: "Preparación",
  otro: "Otro",
};

export default function RecetarioPage() {
  const supabase = getSupabaseClient();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => { loadRecipes(); }, []);

  async function loadRecipes() {
    setLoading(true);
    const { data, error } = await supabase
      .from("recipes")
      .select("*, recipe_ingredients (*)")
      .order("name", { ascending: true });

    if (error) {
      console.log(error);
      alert("No se pudieron cargar las recetas. Verifica que las tablas existan.");
      setLoading(false);
      return;
    }
    setRecipes((data as Recipe[]) || []);
    setLoading(false);
  }

  async function toggleActive(recipe: Recipe) {
    await supabase.from("recipes").update({ is_active: !recipe.is_active }).eq("id", recipe.id);
    await loadRecipes();
  }

  async function deleteRecipe(recipe: Recipe) {
    if (!confirm(`¿Eliminar receta "${recipe.name}"? Se borran también sus ingredientes.`)) return;
    await supabase.from("recipes").delete().eq("id", recipe.id);
    await loadRecipes();
  }

  const filtered = useMemo(() => {
    return recipes.filter((r) => {
      if (filterType && r.type !== filterType) return false;
      if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [recipes, filterType, search]);

  const stats = useMemo(() => {
    const total = recipes.length;
    const marinados = recipes.filter((r) => r.type === "marinado").length;
    const preparaciones = recipes.filter((r) => r.type === "preparacion").length;
    return { total, marinados, preparaciones };
  }, [recipes]);

  function recipeCost(r: Recipe) {
    return (r.recipe_ingredients || []).reduce((acc, ing) => acc + ing.quantity_kg * ing.unit_price, 0);
  }

  function costPerKg(r: Recipe) {
    const cost = recipeCost(r);
    const yld = Number(r.yield_kg || 0);
    return yld > 0 ? cost / yld : 0;
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(180deg, ${C.bgSoft} 0%, ${C.bg} 100%)`, fontFamily: "Arial, sans-serif" }}>
        <div style={{ padding: "18px 22px", borderRadius: 18, background: C.cardStrong, border: `1px solid ${C.border}`, boxShadow: C.shadow, color: C.text }}>Cargando recetario...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(180deg, ${C.bgSoft} 0%, ${C.bg} 100%)`, padding: 16, fontFamily: "Arial, sans-serif" }}>
      <div style={{ maxWidth: 1440, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <img src="/logo.png" alt="Sergios" style={{ width: 80, height: "auto" }} />
            <div>
              <h1 style={{ margin: 0, color: C.text }}>Recetario</h1>
              <p style={{ margin: "4px 0 0", color: C.muted, fontSize: 14 }}>Marinados, preparaciones y cálculo de costos</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/admin/recetario/nueva" style={{ padding: "12px 20px", borderRadius: 14, border: "none", background: `linear-gradient(180deg, ${C.primary} 0%, ${C.primaryDark} 100%)`, color: "white", fontWeight: 700, textDecoration: "none", boxShadow: "0 8px 18px rgba(123, 34, 24, 0.20)", fontSize: 15 }}>
              + Nueva receta
            </Link>
            <Link href="/" style={{ padding: "10px 16px", borderRadius: 14, border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.75)", color: C.text, textDecoration: "none", fontWeight: 700 }}>Inicio</Link>
            <Link href="/admin/productos" style={{ padding: "10px 16px", borderRadius: 14, border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.75)", color: C.text, textDecoration: "none", fontWeight: 700 }}>Productos</Link>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 16 }}>
          <div style={{ background: C.cardStrong, border: `1px solid ${C.border}`, borderRadius: 20, padding: 16, boxShadow: C.shadow }}>
            <div style={{ color: C.muted, fontSize: 12, marginBottom: 4 }}>Total recetas</div>
            <div style={{ color: C.text, fontSize: 28, fontWeight: 800 }}>{stats.total}</div>
          </div>
          <div style={{ background: C.cardStrong, border: `1px solid ${C.border}`, borderRadius: 20, padding: 16, boxShadow: C.shadow }}>
            <div style={{ color: C.muted, fontSize: 12, marginBottom: 4 }}>Marinados</div>
            <div style={{ color: C.warning, fontSize: 28, fontWeight: 800 }}>{stats.marinados}</div>
          </div>
          <div style={{ background: C.cardStrong, border: `1px solid ${C.border}`, borderRadius: 20, padding: 16, boxShadow: C.shadow }}>
            <div style={{ color: C.muted, fontSize: 12, marginBottom: 4 }}>Preparaciones</div>
            <div style={{ color: C.success, fontSize: 28, fontWeight: 800 }}>{stats.preparaciones}</div>
          </div>
        </div>

        {/* Filters */}
        <div style={{ background: C.cardStrong, border: `1px solid ${C.border}`, borderRadius: 22, padding: 16, boxShadow: C.shadow, marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar receta..." style={{ flex: "1 1 200px", padding: 12, borderRadius: 14, border: `1px solid ${C.border}`, outline: "none", background: "rgba(255,255,255,0.82)", color: C.text, fontSize: 15 }} />
            <div style={{ display: "flex", gap: 6 }}>
              {[{ v: "", l: "Todos" }, { v: "marinado", l: "Marinados" }, { v: "preparacion", l: "Preparaciones" }, { v: "otro", l: "Otros" }].map((f) => (
                <button key={f.v} onClick={() => setFilterType(f.v)} style={{
                  padding: "8px 14px", borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: "pointer",
                  border: filterType === f.v ? "none" : `1px solid ${C.border}`,
                  background: filterType === f.v ? `linear-gradient(180deg, ${C.primary} 0%, ${C.primaryDark} 100%)` : "white",
                  color: filterType === f.v ? "white" : C.text,
                }}>{f.l}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Recipe cards */}
        {filtered.length === 0 ? (
          <div style={{ padding: 24, borderRadius: 18, background: C.bgSoft, border: `1px dashed ${C.border}`, color: C.muted, textAlign: "center" }}>
            {recipes.length === 0 ? "No hay recetas aún. Crea tu primera receta." : "No hay recetas con ese filtro."}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
            {filtered.map((r) => {
              const cost = recipeCost(r);
              const cpk = costPerKg(r);
              const ingCount = (r.recipe_ingredients || []).length;

              return (
                <div key={r.id} style={{
                  background: C.card, border: `1px solid ${C.border}`, borderRadius: 24, padding: 18, boxShadow: C.shadow,
                  opacity: r.is_active === false ? 0.6 : 1,
                  borderLeft: `4px solid ${r.type === "marinado" ? C.warning : r.type === "preparacion" ? C.success : C.info}`,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: C.text }}>{r.name}</div>
                      <span style={{
                        display: "inline-block", padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, marginTop: 6,
                        background: r.type === "marinado" ? "rgba(166,106,16,0.12)" : "rgba(31,122,77,0.12)",
                        color: r.type === "marinado" ? C.warning : C.success,
                      }}>
                        {TYPE_LABELS[r.type] || r.type}
                      </span>
                    </div>
                    {r.is_active === false && (
                      <span style={{ padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: "rgba(180,35,24,0.10)", color: C.danger }}>Inactiva</span>
                    )}
                  </div>

                  {r.description && (
                    <div style={{ color: C.muted, fontSize: 13, marginBottom: 12 }}>{r.description}</div>
                  )}

                  {/* Cost summary */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
                    <div style={{ background: C.bgSoft, border: `1px solid ${C.border}`, borderRadius: 14, padding: 10 }}>
                      <div style={{ color: C.muted, fontSize: 11 }}>Ingredientes</div>
                      <div style={{ color: C.text, fontSize: 18, fontWeight: 800 }}>{ingCount}</div>
                    </div>
                    <div style={{ background: C.bgSoft, border: `1px solid ${C.border}`, borderRadius: 14, padding: 10 }}>
                      <div style={{ color: C.muted, fontSize: 11 }}>Costo total</div>
                      <div style={{ color: C.primary, fontSize: 18, fontWeight: 800 }}>${money(cost)}</div>
                    </div>
                    <div style={{ background: C.bgSoft, border: `1px solid ${C.border}`, borderRadius: 14, padding: 10 }}>
                      <div style={{ color: C.muted, fontSize: 11 }}>Costo/kg</div>
                      <div style={{ color: C.primary, fontSize: 18, fontWeight: 800 }}>${money(cpk)}</div>
                    </div>
                  </div>

                  {r.yield_kg && (
                    <div style={{ color: C.muted, fontSize: 13, marginBottom: 12 }}>
                      Rinde: <b style={{ color: C.text }}>{r.yield_kg} kg</b>
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Link href={`/admin/recetario/${r.id}`} style={{
                      flex: 1, padding: "10px 14px", borderRadius: 12, border: "none", textAlign: "center",
                      background: `linear-gradient(180deg, ${C.primary} 0%, ${C.primaryDark} 100%)`,
                      color: "white", fontWeight: 700, textDecoration: "none", fontSize: 14,
                    }}>
                      Ver / Editar
                    </Link>
                    <button onClick={() => toggleActive(r)} style={{
                      padding: "10px 14px", borderRadius: 12, border: `1px solid ${C.border}`,
                      background: "white", color: r.is_active === false ? C.success : C.muted, fontWeight: 700, cursor: "pointer", fontSize: 13,
                    }}>
                      {r.is_active === false ? "Activar" : "Desactivar"}
                    </button>
                    <button onClick={() => deleteRecipe(r)} style={{
                      padding: "10px 14px", borderRadius: 12, border: "none",
                      background: "rgba(180,35,24,0.10)", color: C.danger, fontWeight: 700, cursor: "pointer", fontSize: 13,
                    }}>
                      Eliminar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
