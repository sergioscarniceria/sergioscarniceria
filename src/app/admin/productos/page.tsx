"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { exportToExcel } from "@/lib/exportExcel";

type Product = {
  id: string;
  name: string;
  price: number | null;
  fixed_piece_price?: number | null;
  is_active?: boolean | null;
  is_excluded_from_discount?: boolean | null;
  category?: string | null;
  recommended_with?: string[] | null;
  created_at?: string | null;
};

const COLORS = {
  bg: "#f7f1e8",
  bgSoft: "#fbf8f3",
  card: "rgba(255,255,255,0.82)",
  cardStrong: "rgba(255,255,255,0.92)",
  border: "rgba(92, 27, 17, 0.10)",
  text: "#3b1c16",
  muted: "#7a5a52",
  primary: "#7b2218",
  primaryDark: "#5a190f",
  success: "#1f7a4d",
  warning: "#a66a10",
  danger: "#b42318",
  info: "#355c7d",
  shadow: "0 10px 30px rgba(91, 25, 15, 0.08)",
};
const CATEGORY_OPTIONS = [
  "Res",
  "Carne para asar",
  "Cerdo",
  "Embutidos",
  "Preparados",
  "Complementos",
];

export default function AdminProductosPage() {
  const supabase = getSupabaseClient();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("todas");

const [name, setName] = useState("");
const [price, setPrice] = useState("");
const [category, setCategory] = useState("Complementos");
const [fixedPiecePrice, setFixedPiecePrice] = useState("");
const [saleType, setSaleType] = useState<"kg" | "pieza">("kg");
const [isActive, setIsActive] = useState(true);
const [isExcludedFromDiscount, setIsExcludedFromDiscount] = useState(false);
const [recommendedWith, setRecommendedWith] = useState<string[]>([]);
const [recommendSearch, setRecommendSearch] = useState("");

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    setLoading(true);

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      console.log(error);
      alert("No se pudieron cargar los productos");
      setLoading(false);
      return;
    }

    setProducts((data as Product[]) || []);
    setLoading(false);
  }

 function resetForm() {
  setEditingId(null);
  setName("");
  setPrice("");
  setCategory("Complementos");
  setFixedPiecePrice("");
  setSaleType("kg");
  setIsActive(true);
  setIsExcludedFromDiscount(false);
  setRecommendedWith([]);
  setRecommendSearch("");
  setSaving(false);
}

 function startEdit(product: Product) {
  setEditingId(product.id);
  setName(product.name || "");
  setCategory(product.category || "Complementos");
  setIsActive(Boolean(product.is_active));
  setIsExcludedFromDiscount(Boolean(product.is_excluded_from_discount));
  setRecommendedWith(Array.isArray(product.recommended_with) ? product.recommended_with : []);
  setRecommendSearch("");

  // Detectar tipo de venta
  const isPiece = product.fixed_piece_price != null && product.fixed_piece_price > 0;
  setSaleType(isPiece ? "pieza" : "kg");
  if (isPiece) {
    setFixedPiecePrice(String(product.fixed_piece_price));
    setPrice("");
  } else {
    setPrice(product.price !== null && product.price !== undefined ? String(product.price) : "");
    setFixedPiecePrice("");
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
}

  async function saveProduct() {
  const cleanName = name.trim();

  if (!cleanName) {
    alert("Escribe el nombre del producto");
    return;
  }

  if (saleType === "kg") {
    const cleanPrice = Number(price);
    if (price === "" || Number.isNaN(cleanPrice) || cleanPrice < 0) {
      alert("Escribe un precio válido por kg");
      return;
    }
  } else {
    const cleanPiece = Number(fixedPiecePrice);
    if (fixedPiecePrice === "" || Number.isNaN(cleanPiece) || cleanPiece <= 0) {
      alert("Escribe un precio válido por pieza");
      return;
    }
  }

  setSaving(true);

  const payload = {
    name: cleanName,
    price: saleType === "kg" ? Number(Number(price).toFixed(2)) : 0,
    category: category.trim() || "Complementos",
    fixed_piece_price: saleType === "pieza" ? Number(Number(fixedPiecePrice).toFixed(2)) : null,
    is_active: isActive,
    is_excluded_from_discount: isExcludedFromDiscount,
    recommended_with: recommendedWith,
  };

    if (editingId) {
      const { error } = await supabase
        .from("products")
        .update(payload)
        .eq("id", editingId);

      if (error) {
        console.log(error);
        alert("No se pudo actualizar el producto");
        setSaving(false);
        return;
      }

      alert("Producto actualizado");
    } else {
      const { error } = await supabase
        .from("products")
        .insert([payload]);

      if (error) {
        console.log(error);
        alert("No se pudo crear el producto");
        setSaving(false);
        return;
      }

      alert("Producto creado");
    }

    resetForm();
    await loadProducts();
  }

  async function toggleActive(product: Product) {
    const nextValue = !product.is_active;

    const { error } = await supabase
      .from("products")
      .update({ is_active: nextValue })
      .eq("id", product.id);

    if (error) {
      console.log(error);
      alert("No se pudo cambiar el estado");
      return;
    }

    await loadProducts();
  }

  async function toggleExcluded(product: Product) {
    const nextValue = !product.is_excluded_from_discount;

    const { error } = await supabase
      .from("products")
      .update({ is_excluded_from_discount: nextValue })
      .eq("id", product.id);

    if (error) {
      console.log(error);
      alert("No se pudo cambiar la regla de descuento");
      return;
    }

    await loadProducts();
  }

  const filteredProducts = useMemo(() => {
    let filtered = products;

    if (filterCategory !== "todas") {
      filtered = filtered.filter((p) => (p.category || "Complementos") === filterCategory);
    }

    const q = search.toLowerCase().trim();
    if (q) {
      filtered = filtered.filter((p) =>
        (p.name || "").toLowerCase().includes(q) ||
        String(p.price ?? "").toLowerCase().includes(q) ||
        (p.category || "").toLowerCase().includes(q)
      );
    }

    return filtered;
  }, [products, search, filterCategory]);

  const summary = useMemo(() => {
    const active = products.filter((p) => p.is_active).length;
    const inactive = products.filter((p) => !p.is_active).length;
    const excluded = products.filter((p) => p.is_excluded_from_discount).length;

    return { active, inactive, excluded };
  }, [products]);

  if (loading) {
    return (
      <div style={loadingPageStyle}>
        <div style={loadingCardStyle}>Cargando productos...</div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={glowTopLeft} />
      <div style={glowTopRight} />

      <div style={shellStyle}>
        <div style={topBarStyle}>
          <div>
            <h1 style={{ margin: 0, color: COLORS.text }}>Admin productos</h1>
            <p style={{ margin: "6px 0 0 0", color: COLORS.muted }}>
              Crea, edita y controla el catálogo sin tocar código
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={() => {
                const headers = ["Nombre", "Categoría", "Precio/kg", "Precio/pza", "Activo", "Excluido de descuento"];
                const rows = products.map((p) => [
                  p.name,
                  p.category || "",
                  p.price ?? "",
                  p.fixed_piece_price ?? "",
                  p.is_active ? "Sí" : "No",
                  p.is_excluded_from_discount ? "Sí" : "No",
                ]);
                const fecha = new Date().toISOString().slice(0, 10);
                exportToExcel(`productos_${fecha}`, "Productos", headers, rows as any);
              }}
              style={secondaryButtonStyle}
            >
              Exportar Excel
            </button>
            <Link href="/" style={secondaryButtonStyle}>Inicio</Link>
            <Link href="/pedidos" style={secondaryButtonStyle}>Pedidos</Link>
            <Link href="/produccion" style={secondaryButtonStyle}>Producción</Link>
            <Link href="/admin/dashboard" style={secondaryButtonStyle}>Dashboard</Link>
          </div>
        </div>

        <div style={summaryGridStyle}>
          <div style={summaryCardStyle}>
            <div style={summaryLabelStyle}>Activos</div>
            <div style={summaryValueStyle}>{summary.active}</div>
          </div>

          <div style={summaryCardStyle}>
            <div style={summaryLabelStyle}>Inactivos</div>
            <div style={summaryValueStyle}>{summary.inactive}</div>
          </div>

          <div style={summaryCardStyle}>
            <div style={summaryLabelStyle}>Sin descuento</div>
            <div style={summaryValueStyle}>{summary.excluded}</div>
          </div>
        </div>

        <div style={formCardStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <h2 style={sectionTitleStyle}>
                {editingId ? "Editar producto" : "Crear producto"}
              </h2>
              <p style={sectionSubtitleStyle}>
                Este producto aparecerá automáticamente en el catálogo
              </p>
            </div>
          </div>

          <div style={formGridStyle}>
  <div>
    <div style={fieldLabelStyle}>Nombre</div>
    <input
      placeholder="Ejemplo: Rib eye"
      value={name}
      onChange={(e) => setName(e.target.value)}
      style={inputStyle}
    />
  </div>

  <div>
    <div style={fieldLabelStyle}>Categoría</div>
    <select
      value={category}
      onChange={(e) => setCategory(e.target.value)}
      style={inputStyle}
    >
      {CATEGORY_OPTIONS.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  </div>

  <div>
    <div style={fieldLabelStyle}>Tipo de venta</div>
    <select
      value={saleType}
      onChange={(e) => {
        const val = e.target.value as "kg" | "pieza";
        setSaleType(val);
        if (val === "pieza") { setPrice(""); }
        else { setFixedPiecePrice(""); }
      }}
      style={inputStyle}
    >
      <option value="kg">Por kilo</option>
      <option value="pieza">Por pieza (precio fijo)</option>
    </select>
  </div>

  {saleType === "kg" ? (
    <div>
      <div style={fieldLabelStyle}>Precio por kg</div>
      <input
        placeholder="Ejemplo: 289"
        type="number"
        step="0.01"
        min="0"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        style={inputStyle}
      />
    </div>
  ) : (
    <div>
      <div style={fieldLabelStyle}>Precio por pieza</div>
      <input
        placeholder="Ejemplo: 45"
        type="number"
        step="0.01"
        min="0"
        value={fixedPiecePrice}
        onChange={(e) => setFixedPiecePrice(e.target.value)}
        style={inputStyle}
      />
    </div>
  )}
</div>

          <div style={checksWrapStyle}>
            <label style={checkCardStyle}>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              <span>Producto activo</span>
            </label>

            <label style={checkCardStyle}>
              <input
                type="checkbox"
                checked={isExcludedFromDiscount}
                onChange={(e) => setIsExcludedFromDiscount(e.target.checked)}
              />
              <span>Sin descuento</span>
            </label>
          </div>

          {/* Recomendaciones manuales para sugerir al cliente en el carrito */}
          <div style={{ marginTop: 16, padding: 16, background: COLORS.bgSoft, borderRadius: 16, border: `1px solid ${COLORS.border}` }}>
            <div style={fieldLabelStyle}>Recomendar con estos productos (opcional)</div>
            <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 10 }}>
              Cuando el cliente agregue este producto, se le sugerirán los que selecciones aquí.
            </div>
            {recommendedWith.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                {recommendedWith.map((id) => {
                  const p = products.find((x) => x.id === id);
                  if (!p) return null;
                  return (
                    <span key={id} style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "6px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700,
                      background: `linear-gradient(180deg, ${COLORS.primary} 0%, ${COLORS.primaryDark} 100%)`,
                      color: "white",
                    }}>
                      {p.name}
                      <button
                        type="button"
                        onClick={() => setRecommendedWith((prev) => prev.filter((x) => x !== id))}
                        style={{ background: "rgba(255,255,255,0.3)", border: "none", borderRadius: "50%", width: 18, height: 18, color: "white", cursor: "pointer", fontSize: 11, lineHeight: "18px", padding: 0 }}
                      >
                        ✕
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
            <input
              placeholder="Buscar producto para agregar..."
              value={recommendSearch}
              onChange={(e) => setRecommendSearch(e.target.value)}
              style={inputStyle}
            />
            {recommendSearch.trim().length > 0 && (
              <div style={{ marginTop: 8, maxHeight: 220, overflow: "auto", background: "white", border: `1px solid ${COLORS.border}`, borderRadius: 12 }}>
                {products
                  .filter((p) =>
                    p.id !== editingId &&
                    !recommendedWith.includes(p.id) &&
                    (p.name || "").toLowerCase().includes(recommendSearch.toLowerCase())
                  )
                  .slice(0, 15)
                  .map((p) => (
                    <div
                      key={p.id}
                      onClick={() => {
                        setRecommendedWith((prev) => [...prev, p.id]);
                        setRecommendSearch("");
                      }}
                      style={{ padding: "10px 12px", cursor: "pointer", borderBottom: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}
                    >
                      <span style={{ color: COLORS.text, fontWeight: 600 }}>{p.name}</span>
                      <span style={{ color: COLORS.muted, fontSize: 12 }}>
                        {p.category || "Complementos"}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>

          <div style={actionsWrapStyle}>
            <button
              onClick={saveProduct}
              disabled={saving}
              style={primaryButtonStyle}
            >
              {saving
                ? "Guardando..."
                : editingId
                ? "Guardar cambios"
                : "Crear producto"}
            </button>

            <button
              onClick={resetForm}
              disabled={saving}
              style={secondaryActionButtonStyle}
            >
              Limpiar
            </button>
          </div>
        </div>

        <div style={listCardStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <h2 style={sectionTitleStyle}>Catálogo actual</h2>
              <p style={sectionSubtitleStyle}>
                Busca y administra tus productos
              </p>
            </div>
          </div>

          <input
            placeholder="Buscar producto o precio"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={inputStyle}
          />

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
            {["todas", ...CATEGORY_OPTIONS].map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 20,
                  border: `1px solid ${filterCategory === cat ? COLORS.primary : COLORS.border}`,
                  background: filterCategory === cat ? COLORS.primary : "white",
                  color: filterCategory === cat ? "white" : COLORS.text,
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                {cat === "todas" ? "Todas" : cat}
              </button>
            ))}
          </div>

          {filteredProducts.length === 0 ? (
            <div style={emptyBoxStyle}>No hay productos para mostrar</div>
          ) : (
            <div style={productsGridStyle}>
              {filteredProducts.map((product) => (
                <div key={product.id} style={productCardStyle}>
                  <div style={productHeaderStyle}>
                   <div style={{ minWidth: 0 }}>
  <div style={productNameStyle}>{product.name}</div>
  <div style={productCategoryStyle}>
    {product.category || "Complementos"}
  </div>
  {product.fixed_piece_price != null && product.fixed_piece_price > 0 ? (
    <div style={productFixedPiecePriceStyle}>
      ${Number(product.fixed_piece_price).toFixed(2)} / pieza
    </div>
  ) : (
    <div style={productPriceStyle}>
      ${Number(product.price || 0).toFixed(2)} / kg
    </div>
  )}
</div>

                    <div style={badgeColumnStyle}>
                      <span
                        style={{
                          ...statusBadgeStyle,
                          background: product.is_active
                            ? "rgba(31,122,77,0.12)"
                            : "rgba(180,35,24,0.10)",
                          color: product.is_active
                            ? COLORS.success
                            : COLORS.danger,
                        }}
                      >
                        {product.is_active ? "Activo" : "Inactivo"}
                      </span>

                      <span
                        style={{
                          ...statusBadgeStyle,
                          background: product.is_excluded_from_discount
                            ? "rgba(166,106,16,0.12)"
                            : "rgba(53,92,125,0.12)",
                          color: product.is_excluded_from_discount
                            ? COLORS.warning
                            : COLORS.info,
                        }}
                      >
                        {product.is_excluded_from_discount
                          ? "Sin descuento"
                          : "Con descuento"}
                      </span>
                    </div>
                  </div>

                  <div style={productActionsWrapStyle}>
                    <button
                      onClick={() => startEdit(product)}
                      style={editButtonStyle}
                    >
                      Editar
                    </button>

                    <button
                      onClick={() => toggleActive(product)}
                      style={toggleButtonStyle}
                    >
                      {product.is_active ? "Desactivar" : "Activar"}
                    </button>

                    <button
                      onClick={() => toggleExcluded(product)}
                      style={discountButtonStyle}
                    >
                      {product.is_excluded_from_discount
                        ? "Permitir descuento"
                        : "Quitar descuento"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const loadingPageStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: `linear-gradient(180deg, ${COLORS.bgSoft} 0%, ${COLORS.bg} 100%)`,
  fontFamily: "Arial, sans-serif",
};

const loadingCardStyle: React.CSSProperties = {
  padding: "18px 22px",
  borderRadius: 18,
  background: COLORS.cardStrong,
  border: `1px solid ${COLORS.border}`,
  boxShadow: COLORS.shadow,
  color: COLORS.text,
};

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: `linear-gradient(180deg, ${COLORS.bgSoft} 0%, ${COLORS.bg} 100%)`,
  padding: 16,
  position: "relative",
  overflow: "hidden",
  fontFamily: "Arial, sans-serif",
};

const glowTopLeft: React.CSSProperties = {
  position: "absolute",
  top: -120,
  left: -100,
  width: 300,
  height: 300,
  borderRadius: "50%",
  background: "rgba(123, 34, 24, 0.08)",
  filter: "blur(45px)",
};

const glowTopRight: React.CSSProperties = {
  position: "absolute",
  top: -80,
  right: -60,
  width: 280,
  height: 280,
  borderRadius: "50%",
  background: "rgba(217, 201, 163, 0.35)",
  filter: "blur(45px)",
};

const shellStyle: React.CSSProperties = {
  maxWidth: 1400,
  margin: "0 auto",
  position: "relative",
  zIndex: 2,
};

const topBarStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  flexWrap: "wrap",
  marginBottom: 20,
};

const summaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 16,
  marginBottom: 20,
};

const summaryCardStyle: React.CSSProperties = {
  background: COLORS.cardStrong,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 22,
  padding: 18,
  boxShadow: COLORS.shadow,
};

const summaryLabelStyle: React.CSSProperties = {
  color: COLORS.muted,
  fontSize: 14,
  marginBottom: 8,
};

const summaryValueStyle: React.CSSProperties = {
  color: COLORS.text,
  fontSize: 32,
  fontWeight: 800,
};

const formCardStyle: React.CSSProperties = {
  background: COLORS.cardStrong,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 24,
  padding: 18,
  boxShadow: COLORS.shadow,
  marginBottom: 20,
};

const listCardStyle: React.CSSProperties = {
  background: COLORS.cardStrong,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 24,
  padding: 18,
  boxShadow: COLORS.shadow,
};

const sectionHeaderStyle: React.CSSProperties = {
  marginBottom: 16,
};

const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  color: COLORS.text,
};

const sectionSubtitleStyle: React.CSSProperties = {
  margin: "6px 0 0 0",
  color: COLORS.muted,
  fontSize: 14,
};

const formGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 14,
};

const fieldLabelStyle: React.CSSProperties = {
  color: COLORS.muted,
  fontSize: 14,
  marginBottom: 8,
  fontWeight: 700,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 14,
  borderRadius: 16,
  border: `1px solid ${COLORS.border}`,
  boxSizing: "border-box",
  outline: "none",
  background: "rgba(255,255,255,0.82)",
  color: COLORS.text,
  fontSize: 15,
};

const checksWrapStyle: React.CSSProperties = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  marginTop: 16,
  marginBottom: 16,
};

const checkCardStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "12px 14px",
  borderRadius: 14,
  background: COLORS.bgSoft,
  border: `1px solid ${COLORS.border}`,
  color: COLORS.text,
  fontWeight: 700,
};

const actionsWrapStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "12px 18px",
  borderRadius: 14,
  border: "none",
  background: `linear-gradient(180deg, ${COLORS.primary} 0%, ${COLORS.primaryDark} 100%)`,
  color: "white",
  cursor: "pointer",
  fontWeight: 700,
  boxShadow: "0 8px 18px rgba(123, 34, 24, 0.20)",
};

const secondaryActionButtonStyle: React.CSSProperties = {
  padding: "12px 18px",
  borderRadius: 14,
  border: `1px solid ${COLORS.border}`,
  background: "white",
  color: COLORS.text,
  cursor: "pointer",
  fontWeight: 700,
};

const productsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: 16,
  marginTop: 16,
};

const productCardStyle: React.CSSProperties = {
  background: COLORS.card,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 22,
  padding: 16,
  boxShadow: COLORS.shadow,
};

const productHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  marginBottom: 14,
};

const productNameStyle: React.CSSProperties = {
  color: COLORS.text,
  fontWeight: 800,
  fontSize: 22,
  lineHeight: 1.2,
  marginBottom: 8,
};
const productCategoryStyle: React.CSSProperties = {
  color: COLORS.muted,
  fontSize: 14,
  marginBottom: 6,
};
const productFixedPiecePriceStyle: React.CSSProperties = {
  color: COLORS.warning,
  fontSize: 14,
  fontWeight: 700,
  marginTop: 6,
};
const productPriceStyle: React.CSSProperties = {
  color: COLORS.primary,
  fontSize: 24,
  fontWeight: 800,
};

const badgeColumnStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  flexShrink: 0,
};

const statusBadgeStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  textAlign: "center",
};

const productActionsWrapStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const editButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: "12px 14px",
  borderRadius: 14,
  border: "none",
  background: "rgba(53,92,125,0.12)",
  color: COLORS.info,
  cursor: "pointer",
  fontWeight: 700,
};

const toggleButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: "12px 14px",
  borderRadius: 14,
  border: "none",
  background: "rgba(31,122,77,0.12)",
  color: COLORS.success,
  cursor: "pointer",
  fontWeight: 700,
};

const discountButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: "12px 14px",
  borderRadius: 14,
  border: "none",
  background: "rgba(166,106,16,0.12)",
  color: COLORS.warning,
  cursor: "pointer",
  fontWeight: 700,
};

const emptyBoxStyle: React.CSSProperties = {
  padding: 16,
  borderRadius: 18,
  background: COLORS.bgSoft,
  border: `1px dashed ${COLORS.border}`,
  color: COLORS.muted,
};

const secondaryButtonStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "12px 18px",
  borderRadius: 14,
  border: `1px solid ${COLORS.border}`,
  background: "rgba(255,255,255,0.75)",
  color: COLORS.text,
  textDecoration: "none",
  fontWeight: 700,
};