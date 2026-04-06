"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";

type Item = {
  id: string;
  product: string;
  kilos: number;
  price: number;
};

type Product = {
  id: string;
  name: string;
  price: number;
  category: string | null;
  active?: boolean | null;
};

const COLORS = {
  bg: "#f7f1e8",
  bgSoft: "#fbf8f3",
  card: "rgba(255,255,255,0.92)",
  border: "rgba(92, 27, 17, 0.10)",
  text: "#3b1c16",
  muted: "#7a5a52",
  primary: "#7b2218",
  primaryDark: "#5a190f",
  success: "#1f7a4d",
  danger: "#b42318",
  shadow: "0 10px 30px rgba(91, 25, 15, 0.08)",
};

function makeId() {
  return `${Date.now()}-${Math.random()}`;
}

function money(value?: number | null) {
  return Number(value || 0).toFixed(2);
}

export default function VentasPage() {
  const supabase = getSupabaseClient();

  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [kilos, setKilos] = useState("");

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    setLoading(true);

    const { data, error } = await supabase
  .from("products")
  .select("id, name, price, category")
  .order("category", { ascending: true })
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

  const groupedCategories = useMemo(() => {
    const grouped: Record<string, Product[]> = {};

    for (const product of products) {
      const category = (product.category || "Sin categoría").trim();

      if (!grouped[category]) {
        grouped[category] = [];
      }

      grouped[category].push(product);
    }

    return grouped;
  }, [products]);

  function addItem() {
    const cleanKilos = Number(kilos);

    if (!selectedProduct) {
      alert("Selecciona un producto");
      return;
    }

    if (!cleanKilos || cleanKilos <= 0) {
      alert("Captura kilos válidos");
      return;
    }

    const product =
      selectedCategory && groupedCategories[selectedCategory]
        ? groupedCategories[selectedCategory].find((p) => p.name === selectedProduct)
        : null;

    if (!product) {
      alert("No encontramos el producto");
      return;
    }

    setItems((prev) => [
      ...prev,
      {
        id: makeId(),
        product: product.name,
        kilos: cleanKilos,
        price: Number(product.price || 0),
      },
    ]);

    setKilos("");
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  const total = useMemo(() => {
    return items.reduce((acc, item) => acc + item.kilos * item.price, 0);
  }, [items]);

  const categoryNames = useMemo(() => {
    return Object.keys(groupedCategories);
  }, [groupedCategories]);

  if (loading) {
    return (
      <div style={pageStyle}>
        <div style={shellStyle}>
          <div style={panelStyle}>Cargando productos...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={shellStyle}>
        <div style={headerStyle}>
          <div>
            <h1 style={titleStyle}>Ventas Mostrador</h1>
            <p style={subtitleStyle}>Agrega, pesa y cobra 🔥</p>
          </div>
        </div>

        <div style={mainGridStyle}>
          <div style={panelStyle}>
            <h2 style={panelTitleStyle}>Productos</h2>
            <p style={panelSubtitleStyle}>
              Elige primero una categoría y después el producto
            </p>

            {!selectedCategory ? (
              <div style={categoryGridStyle}>
                {categoryNames.length === 0 ? (
                  <div style={emptyBoxStyle}>No hay categorías disponibles</div>
                ) : (
                  categoryNames.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => {
                        setSelectedCategory(cat);
                        setSelectedProduct("");
                      }}
                      style={categoryButtonStyle}
                    >
                      {cat}
                    </button>
                  ))
                )}
              </div>
            ) : (
              <>
                <button
                  onClick={() => {
                    setSelectedCategory(null);
                    setSelectedProduct("");
                  }}
                  style={backButtonStyle}
                >
                  ← Volver a categorías
                </button>

                <div style={selectedCategoryStyle}>
                  Categoría: <b>{selectedCategory}</b>
                </div>

                <div style={productListStyle}>
                  {groupedCategories[selectedCategory]?.length ? (
                    groupedCategories[selectedCategory].map((p) => {
                      const isSelected = selectedProduct === p.name;

                      return (
                        <button
                          key={p.id}
                          onClick={() => setSelectedProduct(p.name)}
                          style={{
                            ...productButtonStyle,
                            border: isSelected
                              ? `2px solid ${COLORS.primary}`
                              : `1px solid ${COLORS.border}`,
                            background: isSelected ? "#fff7f5" : "white",
                          }}
                        >
                          <div style={productNameStyle}>{p.name}</div>
                          <div style={productPriceStyle}>${money(p.price)}</div>
                        </button>
                      );
                    })
                  ) : (
                    <div style={emptyBoxStyle}>No hay productos en esta categoría</div>
                  )}
                </div>
              </>
            )}
          </div>

          <div style={panelStyle}>
            <h2 style={panelTitleStyle}>Orden</h2>
            <p style={panelSubtitleStyle}>Vas armando el pedido en tiempo real</p>

            <div style={selectedProductCardStyle}>
              <div style={selectedProductLabelStyle}>Producto seleccionado</div>
              <div style={selectedProductValueStyle}>
                {selectedProduct || "Ninguno"}
              </div>
            </div>

            <div style={fieldBlockStyle}>
              <label style={fieldLabelStyle}>Kilos</label>
              <input
                placeholder="Ejemplo: 1.250"
                value={kilos}
                onChange={(e) => setKilos(e.target.value)}
                style={inputStyle}
                inputMode="decimal"
              />
            </div>

            <button onClick={addItem} style={addButtonStyle}>
              + Agregar a la orden
            </button>

            <div style={{ marginTop: 18 }}>
              {items.length === 0 ? (
                <div style={emptyBoxStyle}>Todavía no agregas productos</div>
              ) : (
                <div style={orderListStyle}>
                  {items.map((item) => (
                    <div key={item.id} style={orderItemCardStyle}>
                      <div style={orderItemTopStyle}>
                        <div style={orderItemNameStyle}>{item.product}</div>
                        <div style={orderItemSubtotalStyle}>
                          ${money(item.kilos * item.price)}
                        </div>
                      </div>

                      <div style={orderItemMetaStyle}>
                        {item.kilos} kg × ${money(item.price)}
                      </div>

                      <button
                        onClick={() => removeItem(item.id)}
                        style={removeButtonStyle}
                      >
                        Eliminar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={panelStyle}>
            <h2 style={panelTitleStyle}>Total</h2>
            <p style={panelSubtitleStyle}>Resumen rápido del pedido</p>

            <div style={totalCardStyle}>
              <div style={totalLabelStyle}>Importe total</div>
              <div style={totalValueStyle}>${money(total)}</div>
            </div>

            <div style={summaryMiniStyle}>
              <div style={summaryRowStyle}>
                <span>Renglones</span>
                <b>{items.length}</b>
              </div>

              <div style={summaryRowStyle}>
                <span>Producto activo</span>
                <b>{selectedProduct || "-"}</b>
              </div>
            </div>

            <button
              style={printButtonStyle}
              onClick={() => alert("Aquí después conectamos el ticket real")}
            >
              Imprimir ticket
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: `linear-gradient(180deg, ${COLORS.bgSoft} 0%, ${COLORS.bg} 100%)`,
  padding: 16,
  fontFamily: "Arial, sans-serif",
};

const shellStyle: React.CSSProperties = {
  maxWidth: 1480,
  margin: "0 auto",
};

const headerStyle: React.CSSProperties = {
  marginBottom: 20,
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  color: COLORS.text,
  fontSize: 34,
};

const subtitleStyle: React.CSSProperties = {
  margin: "6px 0 0 0",
  color: COLORS.muted,
  fontSize: 18,
};

const mainGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(320px, 1fr) minmax(360px, 1.1fr) minmax(300px, 0.9fr)",
  gap: 20,
  alignItems: "start",
};

const panelStyle: React.CSSProperties = {
  background: COLORS.card,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 24,
  padding: 18,
  boxShadow: COLORS.shadow,
};

const panelTitleStyle: React.CSSProperties = {
  margin: 0,
  color: COLORS.text,
  fontSize: 24,
};

const panelSubtitleStyle: React.CSSProperties = {
  margin: "6px 0 16px 0",
  color: COLORS.muted,
  fontSize: 14,
};

const categoryGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const categoryButtonStyle: React.CSSProperties = {
  width: "100%",
  padding: "18px 16px",
  borderRadius: 18,
  border: `1px solid ${COLORS.border}`,
  background: "white",
  color: COLORS.text,
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 18,
};

const backButtonStyle: React.CSSProperties = {
  width: "100%",
  padding: "14px 16px",
  borderRadius: 16,
  border: `1px solid ${COLORS.border}`,
  background: "white",
  color: COLORS.text,
  cursor: "pointer",
  fontWeight: 700,
  marginBottom: 12,
};

const selectedCategoryStyle: React.CSSProperties = {
  color: COLORS.muted,
  marginBottom: 12,
  fontSize: 14,
};

const productListStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const productButtonStyle: React.CSSProperties = {
  width: "100%",
  padding: "14px 16px",
  borderRadius: 16,
  cursor: "pointer",
  textAlign: "left",
};

const productNameStyle: React.CSSProperties = {
  fontWeight: 800,
  color: COLORS.text,
  fontSize: 18,
};

const productPriceStyle: React.CSSProperties = {
  color: COLORS.muted,
  marginTop: 6,
  fontSize: 14,
};

const selectedProductCardStyle: React.CSSProperties = {
  border: `1px solid ${COLORS.border}`,
  borderRadius: 18,
  background: COLORS.bgSoft,
  padding: 14,
  marginBottom: 14,
};

const selectedProductLabelStyle: React.CSSProperties = {
  color: COLORS.muted,
  fontSize: 13,
};

const selectedProductValueStyle: React.CSSProperties = {
  color: COLORS.text,
  fontWeight: 800,
  fontSize: 22,
  marginTop: 6,
};

const fieldBlockStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  marginBottom: 14,
};

const fieldLabelStyle: React.CSSProperties = {
  color: COLORS.muted,
  fontWeight: 700,
  fontSize: 14,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 14,
  borderRadius: 16,
  border: `1px solid ${COLORS.border}`,
  boxSizing: "border-box",
  outline: "none",
  background: "white",
  color: COLORS.text,
  fontSize: 16,
};

const addButtonStyle: React.CSSProperties = {
  width: "100%",
  padding: "14px 16px",
  borderRadius: 16,
  border: "none",
  background: `linear-gradient(180deg, ${COLORS.primary} 0%, ${COLORS.primaryDark} 100%)`,
  color: "white",
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 16,
};

const orderListStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const orderItemCardStyle: React.CSSProperties = {
  border: `1px solid ${COLORS.border}`,
  borderRadius: 18,
  background: COLORS.bgSoft,
  padding: 14,
};

const orderItemTopStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
};

const orderItemNameStyle: React.CSSProperties = {
  fontWeight: 800,
  color: COLORS.text,
  fontSize: 18,
};

const orderItemSubtotalStyle: React.CSSProperties = {
  fontWeight: 800,
  color: COLORS.text,
  whiteSpace: "nowrap",
};

const orderItemMetaStyle: React.CSSProperties = {
  color: COLORS.muted,
  marginTop: 8,
  fontSize: 14,
};

const removeButtonStyle: React.CSSProperties = {
  marginTop: 10,
  padding: "10px 12px",
  borderRadius: 12,
  border: "none",
  background: "rgba(180,35,24,0.10)",
  color: COLORS.danger,
  cursor: "pointer",
  fontWeight: 800,
};

const totalCardStyle: React.CSSProperties = {
  borderRadius: 22,
  background: COLORS.primary,
  color: "white",
  padding: 18,
  marginBottom: 16,
};

const totalLabelStyle: React.CSSProperties = {
  fontSize: 14,
  opacity: 0.9,
};

const totalValueStyle: React.CSSProperties = {
  fontSize: 36,
  fontWeight: 900,
  marginTop: 8,
};

const summaryMiniStyle: React.CSSProperties = {
  border: `1px solid ${COLORS.border}`,
  borderRadius: 18,
  background: COLORS.bgSoft,
  padding: 14,
  display: "grid",
  gap: 10,
  marginBottom: 16,
};

const summaryRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  color: COLORS.text,
};

const printButtonStyle: React.CSSProperties = {
  width: "100%",
  padding: "16px 16px",
  borderRadius: 16,
  border: `1px solid ${COLORS.border}`,
  background: "white",
  color: COLORS.text,
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 16,
};

const emptyBoxStyle: React.CSSProperties = {
  padding: 16,
  borderRadius: 18,
  background: COLORS.bgSoft,
  border: `1px dashed ${COLORS.border}`,
  color: COLORS.muted,
};