"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";

type Product = {
  id: string;
  name: string;
  price: number | null;
  is_active?: boolean | null;
  is_excluded_from_discount?: boolean | null;
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

export default function AdminProductosPage() {
  const supabase = getSupabaseClient();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isExcludedFromDiscount, setIsExcludedFromDiscount] = useState(false);

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
    setIsActive(true);
    setIsExcludedFromDiscount(false);
    setSaving(false);
  }

  function startEdit(product: Product) {
    setEditingId(product.id);
    setName(product.name || "");
    setPrice(product.price !== null && product.price !== undefined ? String(product.price) : "");
    setIsActive(Boolean(product.is_active));
    setIsExcludedFromDiscount(Boolean(product.is_excluded_from_discount));

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function saveProduct() {
    const cleanName = name.trim();
    const cleanPrice = Number(price);

    if (!cleanName) {
      alert("Escribe el nombre del producto");
      return;
    }

    if (price === "" || Number.isNaN(cleanPrice) || cleanPrice < 0) {
      alert("Escribe un precio válido");
      return;
    }

    setSaving(true);

    const payload = {
      name: cleanName,
      price: Number(cleanPrice.toFixed(2)),
      is_active: isActive,
      is_excluded_from_discount: isExcludedFromDiscount,
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
    const q = search.toLowerCase().trim();
    if (!q) return products;

    return products.filter((p) => {
      return (
        (p.name || "").toLowerCase().includes(q) ||
        String(p.price ?? "").toLowerCase().includes(q)
      );
    });
  }, [products, search]);

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

          {filteredProducts.length === 0 ? (
            <div style={emptyBoxStyle}>No hay productos para mostrar</div>
          ) : (
            <div style={productsGridStyle}>
              {filteredProducts.map((product) => (
                <div key={product.id} style={productCardStyle}>
                  <div style={productHeaderStyle}>
                    <div style={{ minWidth: 0 }}>
                      <div style={productNameStyle}>{product.name}</div>
                      <div style={productPriceStyle}>
                        ${Number(product.price || 0).toFixed(2)}
                      </div>
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