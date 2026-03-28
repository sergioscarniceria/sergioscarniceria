"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  customer_type: string | null;
  business_name?: string | null;
  address?: string | null;
};

type Product = {
  id: string;
  name: string;
  price: number;
  is_active?: boolean;
  is_excluded_from_discount?: boolean;
};

type CartItem = {
  name: string;
  price: number;
  kilos: number;
};

const COLORS = {
  bg: "#f7f1e8",
  bgSoft: "#fbf8f3",
  card: "rgba(255,255,255,0.74)",
  cardStrong: "rgba(255,255,255,0.9)",
  border: "rgba(92, 27, 17, 0.10)",
  text: "#3b1c16",
  muted: "#7a5a52",
  primary: "#7b2218",
  primaryDark: "#5a190f",
  success: "#1f7a4d",
  warning: "#a66a10",
  danger: "#b42318",
  shadow: "0 10px 30px rgba(91, 25, 15, 0.08)",
};

function getTodayDateInput() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatOrderDate(value?: string | null) {
  if (!value) return "Sin fecha";
  const date = new Date(`${value}T12:00:00`);
  if (isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

export default function NuevoPedidoPage() {
  const supabase = getSupabaseClient();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [customerSearch, setCustomerSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [notes, setNotes] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(getTodayDateInput());
  const [showCatalog, setShowCatalog] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    const { data: customersData, error: customersError } = await supabase
      .from("customers")
      .select("*")
      .order("name", { ascending: true });

    const { data: productsData, error: productsError } = await supabase
      .from("products")
      .select("*")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (customersError) {
      console.log(customersError);
      alert("No se pudieron cargar los clientes");
    }

    if (productsError) {
      console.log(productsError);
      alert("No se pudieron cargar los productos");
    }

    setCustomers((customersData as Customer[]) || []);
    setProducts((productsData as Product[]) || []);
    setLoading(false);
  }

  function getPrice(product: Product) {
    const basePrice = Number(product.price || 0);

    if (
      selectedCustomer?.customer_type === "mayoreo" &&
      !product.is_excluded_from_discount
    ) {
      return Number((basePrice * 0.9).toFixed(2));
    }

    return basePrice;
  }

  function selectCustomer(customer: Customer) {
    setSelectedCustomer(customer);
    setDeliveryAddress(customer.address || "");
  }

  function addProduct(product: Product, mode: "kg" | "half" | "money") {
    if (!selectedCustomer) {
      alert("Primero selecciona un cliente");
      return;
    }

    let kilos = 1;
    const price = getPrice(product);

    if (mode === "half") kilos = 0.5;

    if (mode === "money") {
      const amountText = prompt(`¿Cuánto dinero de ${product.name}?`);
      if (!amountText) return;

      const amount = Number(amountText);
      if (!amount || amount <= 0 || !price) return;

      kilos = Number((amount / price).toFixed(3));
    }

    setCart((prev) => [
      ...prev,
      {
        name: product.name,
        price,
        kilos,
      },
    ]);
  }

  function removeCartItem(index: number) {
    setCart((prev) => prev.filter((_, i) => i !== index));
  }

  function cartTotal() {
    return cart.reduce((acc, item) => {
      return acc + Number(item.price || 0) * Number(item.kilos || 0);
    }, 0);
  }

  async function createPhoneOrder() {
    if (!selectedCustomer) {
      alert("Selecciona un cliente");
      return;
    }

    if (cart.length === 0) {
      alert("Agrega productos al pedido");
      return;
    }

    if (!deliveryAddress.trim()) {
      alert("Agrega la dirección de entrega");
      return;
    }

    if (!deliveryDate) {
      alert("Selecciona la fecha de entrega");
      return;
    }

    setSaving(true);

    const finalNotes = notes?.trim()
      ? `Pedido por teléfono. ${notes.trim()}`
      : "Pedido por teléfono.";

    const { error: addressError } = await supabase
      .from("customers")
      .update({ address: deliveryAddress.trim() })
      .eq("id", selectedCustomer.id);

    if (addressError) {
      console.log(addressError);
      alert("No se pudo guardar la dirección del cliente");
      setSaving(false);
      return;
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert([
        {
          customer_id: selectedCustomer.id,
          customer_name: selectedCustomer.name,
          status: "nuevo",
          source: "telefono",
          notes: finalNotes,
          delivery_status: "pendiente",
          delivery_address: deliveryAddress.trim(),
          delivery_date: deliveryDate,
        },
      ])
      .select()
      .single();

    if (orderError || !order) {
      console.log(orderError);
      alert("No se pudo crear el pedido");
      setSaving(false);
      return;
    }

    const items = cart.map((item) => ({
      order_id: order.id,
      product: item.name,
      kilos: item.kilos,
      price: item.price,
    }));

    const { error: itemsError } = await supabase.from("order_items").insert(items);

    if (itemsError) {
      console.log(itemsError);
      alert("Se creó el pedido, pero fallaron los artículos");
      setSaving(false);
      return;
    }

    alert("Pedido creado correctamente");

    setCart([]);
    setNotes("");
    setSelectedCustomer(null);
    setCustomerSearch("");
    setProductSearch("");
    setDeliveryAddress("");
    setDeliveryDate(getTodayDateInput());
    setShowCatalog(false);
    setSaving(false);

    await loadData();
  }

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.toLowerCase().trim();
    if (!q) return customers.slice(0, 30);

    return customers
      .filter((c) => {
        return (
          (c.name || "").toLowerCase().includes(q) ||
          (c.phone || "").toLowerCase().includes(q) ||
          (c.email || "").toLowerCase().includes(q) ||
          (c.business_name || "").toLowerCase().includes(q)
        );
      })
      .slice(0, 30);
  }, [customers, customerSearch]);

  const filteredProducts = useMemo(() => {
    const q = productSearch.toLowerCase().trim();
    if (!q) return [];
    return products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 12);
  }, [products, productSearch]);

  const catalogProducts = useMemo(() => {
    if (!showCatalog) return [];
    return products;
  }, [showCatalog, products]);

  if (loading) {
    return (
      <div style={loadingPageStyle}>
        <div style={loadingCardStyle}>Cargando...</div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={shellStyle}>
        <div style={topBarStyle}>
          <div>
            <h1 style={{ margin: 0, color: COLORS.text }}>Nuevo pedido por teléfono</h1>
            <p style={{ margin: "6px 0 0 0", color: COLORS.muted }}>
              Selecciona cliente, agrega productos y guarda el pedido
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/" style={secondaryButtonStyle}>Inicio</Link>
            <Link href="/pedidos" style={secondaryButtonStyle}>Pedidos</Link>
            <Link href="/produccion" style={secondaryButtonStyle}>Producción</Link>
            <Link href="/repartidores" style={secondaryButtonStyle}>Repartidores</Link>
            <Link href="/admin/dashboard" style={secondaryButtonStyle}>Dashboard</Link>
          </div>
        </div>

        <div style={mainGridStyle}>
          <div style={leftColumnStyle}>
            <div style={panelStyle}>
              <div style={panelHeaderStyle}>
                <div>
                  <h2 style={panelTitleStyle}>1. Seleccionar cliente</h2>
                  <p style={panelSubtitleStyle}>Busca por nombre, teléfono o correo</p>
                </div>
              </div>

              <input
                placeholder="Buscar cliente"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                style={inputStyle}
              />

              {selectedCustomer ? (
                <div style={selectedCustomerBoxStyle}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, color: COLORS.text, fontSize: 18 }}>
                      {selectedCustomer.name}
                    </div>
                    <div style={{ color: COLORS.muted, marginTop: 4 }}>
                      {selectedCustomer.phone || "Sin teléfono"}
                    </div>
                    <div style={{ color: COLORS.muted }}>
                      Tipo: <b>{selectedCustomer.customer_type || "menudeo"}</b>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedCustomer(null);
                      setDeliveryAddress("");
                    }}
                    style={dangerButtonStyle}
                  >
                    Quitar
                  </button>
                </div>
              ) : null}

              <div style={{ display: "grid", gap: 10 }}>
                {filteredCustomers.map((customer) => (
                  <button
                    key={customer.id}
                    onClick={() => selectCustomer(customer)}
                    style={customerButtonStyle}
                  >
                    <div style={{ textAlign: "left", minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: COLORS.text }}>
                        {customer.name}
                      </div>
                      <div style={{ color: COLORS.muted, fontSize: 14 }}>
                        {customer.phone || "Sin teléfono"}
                      </div>
                    </div>
                    <div style={customerTypeBadgeStyle}>
                      {customer.customer_type || "menudeo"}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div style={panelStyle}>
              <div style={panelHeaderStyle}>
                <div>
                  <h2 style={panelTitleStyle}>2. Dirección de entrega</h2>
                  <p style={panelSubtitleStyle}>Esta dirección se guarda también para repartidores</p>
                </div>
              </div>

              <textarea
                placeholder="Calle, número, colonia, referencias..."
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                style={{ ...textareaStyle, minHeight: 110 }}
              />
            </div>

            <div style={panelStyle}>
              <div style={panelHeaderStyle}>
                <div>
                  <h2 style={panelTitleStyle}>3. Fecha de entrega</h2>
                  <p style={panelSubtitleStyle}>Elige cuándo quiere recibir el pedido</p>
                </div>
              </div>

              <input
                type="date"
                value={deliveryDate}
                min={getTodayDateInput()}
                onChange={(e) => setDeliveryDate(e.target.value)}
                style={inputStyle}
              />

              <div style={datePreviewStyle}>
                Fecha seleccionada: <b>{formatOrderDate(deliveryDate)}</b>
              </div>
            </div>

            <div style={panelStyle}>
              <div style={panelHeaderStyle}>
                <div>
                  <h2 style={panelTitleStyle}>4. Productos</h2>
                  <p style={panelSubtitleStyle}>
                    Busca uno específico o abre el catálogo completo
                  </p>
                </div>
              </div>

              <div style={searchHeaderWrapStyle}>
                <input
                  placeholder="Buscar producto"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  style={{ ...inputStyle, marginBottom: 0 }}
                />

                <button
                  onClick={() => setShowCatalog((prev) => !prev)}
                  style={catalogToggleButtonStyle}
                >
                  {showCatalog ? "Ocultar catálogo" : "Ver catálogo"}
                </button>
              </div>

              {productSearch.trim() ? (
                <div style={{ marginTop: 14 }}>
                  <div style={miniSectionTitleStyle}>Resultados de búsqueda</div>

                  {filteredProducts.length === 0 ? (
                    <div style={emptyBoxStyle}>No encontramos productos con ese nombre</div>
                  ) : (
                    <div style={searchResultsListStyle}>
                      {filteredProducts.map((p) => (
                        <div key={p.id} style={searchResultRowStyle}>
                          <div style={{ minWidth: 0 }}>
                            <div style={productNameStyle}>{p.name}</div>
                            <div style={{ color: COLORS.primary, fontWeight: 800, marginTop: 4 }}>
                              ${getPrice(p).toFixed(2)}
                            </div>
                          </div>

                          <div style={productButtonsWrapStyle}>
                            <button onClick={() => addProduct(p, "kg")} style={lightMiniButtonStyle}>
                              +1 kg
                            </button>
                            <button onClick={() => addProduct(p, "half")} style={lightMiniButtonStyle}>
                              +0.5
                            </button>
                            <button onClick={() => addProduct(p, "money")} style={darkMiniButtonStyle}>
                              $
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}

              {showCatalog ? (
                <div style={{ marginTop: 18 }}>
                  <div style={miniSectionTitleStyle}>Catálogo de productos</div>

                  <div style={catalogGridStyle}>
                    {catalogProducts.map((p) => (
                      <div key={p.id} style={productCardStyle}>
                        <div style={{ minHeight: 46 }}>
                          <div style={productNameStyle}>{p.name}</div>
                        </div>

                        <div style={productPriceStyle}>${getPrice(p).toFixed(2)}</div>

                        <div style={{ minHeight: 28, marginBottom: 10 }}>
                          {selectedCustomer?.customer_type === "mayoreo" &&
                          !p.is_excluded_from_discount ? (
                            <span style={discountBadgeStyle}>Precio mayoreo</span>
                          ) : null}

                          {p.is_excluded_from_discount ? (
                            <span style={excludedBadgeStyle}>Sin descuento</span>
                          ) : null}
                        </div>

                        <div style={productButtonsWrapStyle}>
                          <button onClick={() => addProduct(p, "kg")} style={lightMiniButtonStyle}>
                            +1 kg
                          </button>
                          <button onClick={() => addProduct(p, "half")} style={lightMiniButtonStyle}>
                            +0.5
                          </button>
                          <button onClick={() => addProduct(p, "money")} style={darkMiniButtonStyle}>
                            $
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {!productSearch.trim() && !showCatalog ? (
                <div style={{ ...emptyBoxStyle, marginTop: 16 }}>
                  Escribe en buscar producto o presiona <b>Ver catálogo</b>.
                </div>
              ) : null}
            </div>
          </div>

          <div style={rightColumnStyle}>
            <div style={panelStyle}>
              <div style={panelHeaderStyle}>
                <div>
                  <h2 style={panelTitleStyle}>5. Confirmar pedido</h2>
                  <p style={panelSubtitleStyle}>Revisa antes de guardar</p>
                </div>
              </div>

              {!selectedCustomer ? (
                <div style={emptyBoxStyle}>Primero selecciona un cliente</div>
              ) : (
                <div style={selectedCustomerSummaryStyle}>
                  <div style={{ fontWeight: 800, color: COLORS.text }}>
                    {selectedCustomer.name}
                  </div>
                  <div style={{ color: COLORS.muted }}>
                    {selectedCustomer.phone || "Sin teléfono"}
                  </div>
                  <div style={{ color: COLORS.muted, marginTop: 8 }}>
                    <b>Dirección:</b> {deliveryAddress || "Sin dirección"}
                  </div>
                  <div style={{ color: COLORS.muted, marginTop: 8 }}>
                    <b>Fecha de entrega:</b> {formatOrderDate(deliveryDate)}
                  </div>
                </div>
              )}

              {cart.length === 0 ? (
                <div style={{ ...emptyBoxStyle, marginTop: 12 }}>
                  Todavía no agregas productos
                </div>
              ) : (
                <>
                  <div style={{ marginTop: 12 }}>
                    {cart.map((c, i) => (
                      <div key={i} style={cartRowStyle}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700, color: COLORS.text }}>{c.name}</div>
                          <div style={{ color: COLORS.muted, fontSize: 14 }}>
                            {c.kilos} kg · ${c.price.toFixed(2)}/kg
                          </div>
                        </div>

                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div style={{ fontWeight: 700, color: COLORS.text, marginBottom: 8 }}>
                            ${(c.kilos * c.price).toFixed(2)}
                          </div>
                          <button
                            onClick={() => removeCartItem(i)}
                            style={dangerMiniButtonStyle}
                          >
                            Quitar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={totalBoxStyle}>
                    <span>Total</span>
                    <span>${cartTotal().toFixed(2)}</span>
                  </div>
                </>
              )}

              <textarea
                placeholder="Notas del pedido"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={textareaStyle}
              />

              <button
                onClick={createPhoneOrder}
                style={{ ...primaryButtonStyle, width: "100%" }}
                disabled={saving}
              >
                {saving ? "Guardando..." : "Guardar pedido por teléfono"}
              </button>
            </div>
          </div>
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
  fontFamily: "Arial, sans-serif",
};

const shellStyle: React.CSSProperties = {
  maxWidth: 1440,
  margin: "0 auto",
};

const topBarStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  flexWrap: "wrap",
  marginBottom: 20,
};

const mainGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.15fr) minmax(360px, 0.85fr)",
  gap: 20,
  alignItems: "start",
};

const leftColumnStyle: React.CSSProperties = {
  display: "grid",
  gap: 20,
};

const rightColumnStyle: React.CSSProperties = {
  display: "grid",
  gap: 20,
};

const panelStyle: React.CSSProperties = {
  background: COLORS.card,
  backdropFilter: "blur(10px)",
  border: `1px solid ${COLORS.border}`,
  borderRadius: 24,
  padding: 18,
  boxShadow: COLORS.shadow,
};

const panelHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  marginBottom: 14,
};

const panelTitleStyle: React.CSSProperties = {
  margin: 0,
  color: COLORS.text,
};

const panelSubtitleStyle: React.CSSProperties = {
  margin: "6px 0 0 0",
  color: COLORS.muted,
  fontSize: 14,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 14,
  borderRadius: 16,
  border: `1px solid ${COLORS.border}`,
  boxSizing: "border-box",
  outline: "none",
  marginBottom: 12,
  background: "rgba(255,255,255,0.82)",
  color: COLORS.text,
  fontSize: 15,
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 110,
  padding: 14,
  borderRadius: 16,
  border: `1px solid ${COLORS.border}`,
  boxSizing: "border-box",
  outline: "none",
  marginTop: 14,
  marginBottom: 12,
  background: "rgba(255,255,255,0.82)",
  color: COLORS.text,
  fontSize: 15,
  resize: "vertical",
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

const dangerButtonStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "none",
  background: COLORS.danger,
  color: "white",
  cursor: "pointer",
  fontWeight: 700,
};

const dangerMiniButtonStyle: React.CSSProperties = {
  padding: "7px 10px",
  borderRadius: 10,
  border: "none",
  background: COLORS.danger,
  color: "white",
  cursor: "pointer",
  fontWeight: 700,
};

const customerButtonStyle: React.CSSProperties = {
  width: "100%",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: 14,
  borderRadius: 16,
  border: `1px solid ${COLORS.border}`,
  background: "white",
  cursor: "pointer",
};

const customerTypeBadgeStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  background: "rgba(123, 34, 24, 0.10)",
  color: COLORS.primary,
  textTransform: "capitalize",
  flexShrink: 0,
};

const selectedCustomerBoxStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: 16,
  borderRadius: 18,
  background: COLORS.bgSoft,
  border: `1px solid ${COLORS.border}`,
  marginBottom: 12,
};

const selectedCustomerSummaryStyle: React.CSSProperties = {
  padding: 14,
  borderRadius: 16,
  background: COLORS.bgSoft,
  border: `1px solid ${COLORS.border}`,
};

const productCardStyle: React.CSSProperties = {
  background: COLORS.bgSoft,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 20,
  padding: 16,
};

const productNameStyle: React.CSSProperties = {
  color: COLORS.text,
  fontWeight: 700,
  lineHeight: 1.3,
  wordBreak: "break-word",
};

const productPriceStyle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 800,
  color: COLORS.primary,
  marginBottom: 6,
};

const productButtonsWrapStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const lightMiniButtonStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: `1px solid ${COLORS.border}`,
  background: "white",
  color: COLORS.text,
  cursor: "pointer",
  fontWeight: 700,
  flex: 1,
};

const darkMiniButtonStyle: React.CSSProperties = {
  width: 46,
  minWidth: 46,
  height: 46,
  borderRadius: 12,
  border: "none",
  background: COLORS.primary,
  color: "white",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 20,
};

const cartRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: 14,
  background: COLORS.bgSoft,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 18,
  marginBottom: 10,
  alignItems: "flex-start",
};

const totalBoxStyle: React.CSSProperties = {
  marginTop: 14,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: 16,
  borderRadius: 18,
  background: COLORS.primary,
  color: "white",
  fontWeight: 700,
  fontSize: 18,
};

const emptyBoxStyle: React.CSSProperties = {
  padding: 16,
  borderRadius: 18,
  background: COLORS.bgSoft,
  border: `1px dashed ${COLORS.border}`,
  color: COLORS.muted,
};

const discountBadgeStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "4px 10px",
  borderRadius: 999,
  background: "rgba(31, 122, 77, 0.10)",
  color: COLORS.success,
  fontSize: 12,
  fontWeight: 700,
};

const excludedBadgeStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "4px 10px",
  borderRadius: 999,
  background: "rgba(166, 106, 16, 0.12)",
  color: COLORS.warning,
  fontSize: 12,
  fontWeight: 700,
};

const datePreviewStyle: React.CSSProperties = {
  padding: 12,
  borderRadius: 14,
  background: COLORS.bgSoft,
  border: `1px solid ${COLORS.border}`,
  color: COLORS.text,
  marginTop: -2,
};

const searchHeaderWrapStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: 10,
  alignItems: "center",
};

const catalogToggleButtonStyle: React.CSSProperties = {
  padding: "14px 16px",
  borderRadius: 16,
  border: "none",
  background: "rgba(123, 34, 24, 0.12)",
  color: COLORS.primary,
  cursor: "pointer",
  fontWeight: 700,
  whiteSpace: "nowrap",
};

const miniSectionTitleStyle: React.CSSProperties = {
  color: COLORS.text,
  fontWeight: 800,
  marginBottom: 10,
  fontSize: 18,
};

const searchResultsListStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const searchResultRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: 12,
  padding: 14,
  borderRadius: 16,
  background: COLORS.bgSoft,
  border: `1px solid ${COLORS.border}`,
  alignItems: "center",
};

const catalogGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: 14,
  marginTop: 12,
  maxHeight: 620,
  overflowY: "auto",
  paddingRight: 4,
};