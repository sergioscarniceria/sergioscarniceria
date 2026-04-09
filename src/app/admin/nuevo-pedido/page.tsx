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
  sale_type: "kg" | "pieza";
  kilos: number;
  quantity: number;
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

function formatDateTime(value: Date) {
  return value.toLocaleString();
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
  const [takenBy, setTakenBy] = useState("");

  const [showCustomerCatalog, setShowCustomerCatalog] = useState(false);
  const [showProductCatalog, setShowProductCatalog] = useState(false);

  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [newCustomerBusinessName, setNewCustomerBusinessName] = useState("");
  const [newCustomerAddress, setNewCustomerAddress] = useState("");

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
    setShowCustomerCatalog(false);
    setCustomerSearch("");
  }

  async function createQuickCustomer() {
    if (!newCustomerName.trim()) {
      alert("Escribe el nombre del cliente");
      return;
    }

    setCreatingCustomer(true);

    const payload = {
      name: newCustomerName.trim(),
      phone: newCustomerPhone.trim() || null,
      email: newCustomerEmail.trim() || null,
      business_name: newCustomerBusinessName.trim() || null,
      address: newCustomerAddress.trim() || null,
      customer_type: "menudeo",
    };

    const { data, error } = await supabase
      .from("customers")
      .insert([payload])
      .select("*")
      .single();

    if (error || !data) {
      console.log(error);
      alert("No se pudo crear el cliente");
      setCreatingCustomer(false);
      return;
    }

    const createdCustomer = data as Customer;

    setCustomers((prev) =>
      [createdCustomer, ...prev].sort((a, b) => a.name.localeCompare(b.name))
    );

    setSelectedCustomer(createdCustomer);
    setDeliveryAddress(createdCustomer.address || "");
    setShowNewCustomerModal(false);
    setCustomerSearch("");

    setNewCustomerName("");
    setNewCustomerPhone("");
    setNewCustomerEmail("");
    setNewCustomerBusinessName("");
    setNewCustomerAddress("");
    setCreatingCustomer(false);
  }

  function closeNewCustomerModal() {
    if (creatingCustomer) return;

    setShowNewCustomerModal(false);
    setNewCustomerName("");
    setNewCustomerPhone("");
    setNewCustomerEmail("");
    setNewCustomerBusinessName("");
    setNewCustomerAddress("");
  }

      function addProduct(product: Product, mode: "kg" | "half" | "money" | "piece") {
    if (!selectedCustomer) {
      alert("Primero selecciona un cliente");
      return;
    }

    const price = getPrice(product);

    if (mode === "piece") {
      const quantityText = prompt(`¿Cuántas piezas de ${product.name}?`);
      if (!quantityText) return;

      const quantity = Number(quantityText);

      if (!quantity || quantity <= 0) {
        alert("Escribe una cantidad válida de piezas");
        return;
      }

      setCart((prev) => [
        ...prev,
        {
          name: product.name,
          price,
          sale_type: "pieza",
          kilos: 0,
          quantity,
        },
      ]);

      return;
    }

    let kilos = 1;

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
        sale_type: "kg",
        kilos,
        quantity: 0,
      },
    ]);
  }

  function removeCartItem(index: number) {
    setCart((prev) => prev.filter((_, i) => i !== index));
  }

    function updateCartItemKilos(index: number, delta: number) {
    setCart((prev) =>
      prev.flatMap((item, i) => {
        if (i !== index) return [item];
        if (item.sale_type !== "kg") return [item];

        const nextKilos = Number((item.kilos + delta).toFixed(3));
        if (nextKilos <= 0) return [];

        return [{ ...item, kilos: nextKilos }];
      })
    );
  }
  function updateCartItemQuantity(index: number, delta: number) {
    setCart((prev) =>
      prev.flatMap((item, i) => {
        if (i !== index) return [item];
        if (item.sale_type !== "pieza") return [item];

        const nextQuantity = item.quantity + delta;
        if (nextQuantity <= 0) return [];

        return [{ ...item, quantity: nextQuantity }];
      })
    );
  }
  function clearOrder() {
    const confirmed = window.confirm("¿Quieres limpiar todo el pedido actual?");
    if (!confirmed) return;

    setCart([]);
    setNotes("");
  }

    function cartTotal() {
    return cart.reduce((acc, item) => {
      if (item.sale_type === "pieza") return acc;
      return acc + Number(item.price || 0) * Number(item.kilos || 0);
    }, 0);
  }

   function totalKilos() {
    return cart.reduce((acc, item) => {
      if (item.sale_type !== "kg") return acc;
      return acc + Number(item.kilos || 0);
    }, 0);
  }
    function totalPieces() {
    return cart.reduce((acc, item) => {
      if (item.sale_type !== "pieza") return acc;
      return acc + Number(item.quantity || 0);
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

    const captureTime = new Date();
    setSaving(true);

    const takenByText = takenBy.trim() ? takenBy.trim() : "Sin especificar";

    const adminMeta = [
      "Pedido por teléfono.",
      `Capturó: ${takenByText}.`,
      `Hora de captura: ${formatDateTime(captureTime)}.`,
    ].join(" ");

    const finalNotes = notes?.trim()
      ? `${adminMeta} ${notes.trim()}`
      : adminMeta;

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
      kilos: item.sale_type === "kg" ? item.kilos : 0,
      price: item.price,
      sale_type: item.sale_type,
      quantity: item.sale_type === "pieza" ? item.quantity : null,
      prepared_kilos: null,
      is_ready: false,
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
    setTakenBy("");
    setSelectedCustomer(null);
    setCustomerSearch("");
    setProductSearch("");
    setDeliveryAddress("");
    setDeliveryDate(getTodayDateInput());
    setShowCustomerCatalog(false);
    setShowProductCatalog(false);
    setSaving(false);

    await loadData();
  }

  const searchedCustomers = useMemo(() => {
    const q = customerSearch.toLowerCase().trim();
    if (!q) return [];
    return customers
      .filter((c) => {
        return (
          (c.name || "").toLowerCase().includes(q) ||
          (c.phone || "").toLowerCase().includes(q) ||
          (c.email || "").toLowerCase().includes(q) ||
          (c.business_name || "").toLowerCase().includes(q)
        );
      })
      .slice(0, 20);
  }, [customers, customerSearch]);

  const customerCatalog = useMemo(() => {
    if (!showCustomerCatalog) return [];
    return customers.slice(0, 150);
  }, [customers, showCustomerCatalog]);

  const searchedProducts = useMemo(() => {
    const q = productSearch.toLowerCase().trim();
    if (!q) return [];
    return products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 12);
  }, [products, productSearch]);

  const productCatalog = useMemo(() => {
    if (!showProductCatalog) return [];
    return products;
  }, [products, showProductCatalog]);

  const capturePreview = useMemo(() => formatDateTime(new Date()), []);

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
                  <p style={panelSubtitleStyle}>Busca uno específico o abre la cartera</p>
                </div>
              </div>

              <div style={searchBarRowStyle}>
                <input
                  placeholder="Buscar cliente"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  style={{ ...inputStyle, marginBottom: 0 }}
                />

                <button
                  onClick={() => setShowCustomerCatalog((prev) => !prev)}
                  style={catalogButtonStyle}
                >
                  {showCustomerCatalog ? "Ocultar cartera" : "Ver cartera"}
                </button>

                <button
                  onClick={() => setShowNewCustomerModal(true)}
                  style={catalogButtonStyle}
                >
                  + Cliente nuevo
                </button>
              </div>

              {selectedCustomer ? (
                <div style={selectedCustomerBoxStyle}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, color: COLORS.text, fontSize: 18 }}>
                      {selectedCustomer.name}
                    </div>
                    <div style={{ color: COLORS.muted, marginTop: 4 }}>
                      {selectedCustomer.phone || "Sin teléfono"}
                    </div>
                    {selectedCustomer.email ? (
                      <div style={{ color: COLORS.muted, marginTop: 4 }}>
                        {selectedCustomer.email}
                      </div>
                    ) : null}
                    <div style={{ color: COLORS.muted, marginTop: 4 }}>
                      Tipo: <b>{selectedCustomer.customer_type || "menudeo"}</b>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedCustomer(null);
                      setDeliveryAddress("");
                    }}
                    style={dangerSoftButtonStyle}
                  >
                    Quitar
                  </button>
                </div>
              ) : null}

              {customerSearch.trim() ? (
                <div style={{ marginTop: 16 }}>
                  <div style={miniTitleStyle}>Resultados de búsqueda</div>

                  {searchedCustomers.length === 0 ? (
                    <div style={emptyBoxStyle}>No encontramos clientes con ese dato</div>
                  ) : (
                    <div style={listWrapStyle}>
                      {searchedCustomers.map((customer) => (
                        <button
                          key={customer.id}
                          onClick={() => selectCustomer(customer)}
                          style={customerRowStyle}
                        >
                          <div style={{ textAlign: "left", minWidth: 0 }}>
                            <div style={{ fontWeight: 700, color: COLORS.text }}>
                              {customer.name}
                            </div>
                            <div style={{ color: COLORS.muted, fontSize: 14 }}>
                              {customer.phone || "Sin teléfono"}
                            </div>
                          </div>

                          <div style={badgeStyle}>
                            {customer.customer_type || "menudeo"}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}

              {showCustomerCatalog ? (
                <div style={{ marginTop: 18 }}>
                  <div style={miniTitleStyle}>Cartera de clientes</div>

                  <div style={catalogListStyle}>
                    {customerCatalog.map((customer) => (
                      <button
                        key={customer.id}
                        onClick={() => selectCustomer(customer)}
                        style={customerCardStyle}
                      >
                        <div style={{ textAlign: "left", minWidth: 0 }}>
                          <div style={{ fontWeight: 700, color: COLORS.text }}>
                            {customer.name}
                          </div>
                          <div style={{ color: COLORS.muted, fontSize: 14, marginTop: 4 }}>
                            {customer.phone || "Sin teléfono"}
                          </div>
                          {customer.business_name ? (
                            <div style={{ color: COLORS.muted, fontSize: 13, marginTop: 3 }}>
                              {customer.business_name}
                            </div>
                          ) : null}
                        </div>

                        <div style={badgeStyle}>
                          {customer.customer_type || "menudeo"}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {!customerSearch.trim() && !showCustomerCatalog ? (
                <div style={{ ...emptyBoxStyle, marginTop: 16 }}>
                  Escribe en buscar cliente o presiona <b>Ver cartera</b>.
                </div>
              ) : null}
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
                  <p style={panelSubtitleStyle}>Busca uno específico o abre el catálogo completo</p>
                </div>
              </div>

              <div style={searchBarRowStyleProducts}>
                <input
                  placeholder="Buscar producto"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  style={{ ...inputStyle, marginBottom: 0 }}
                />

                <button
                  onClick={() => setShowProductCatalog((prev) => !prev)}
                  style={catalogButtonStyle}
                >
                  {showProductCatalog ? "Ocultar catálogo" : "Ver catálogo"}
                </button>
              </div>

              {productSearch.trim() ? (
                <div style={{ marginTop: 16 }}>
                  <div style={miniTitleStyle}>Resultados de búsqueda</div>

                  {searchedProducts.length === 0 ? (
                    <div style={emptyBoxStyle}>No encontramos productos con ese nombre</div>
                  ) : (
                    <div style={listWrapStyle}>
                      {searchedProducts.map((product) => (
                        <div key={product.id} style={searchProductRowStyle}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 700, color: COLORS.text }}>
                              {product.name}
                            </div>
                            <div style={{ color: COLORS.primary, fontWeight: 800, marginTop: 4 }}>
                              ${getPrice(product).toFixed(2)}
                            </div>
                          </div>

                                                    <div style={productButtonsWrapStyle}>
                            <button onClick={() => addProduct(product, "kg")} style={miniLightButtonStyle}>
                              +1 kg
                            </button>
                            <button onClick={() => addProduct(product, "half")} style={miniLightButtonStyle}>
                              +0.5
                            </button>
                            <button onClick={() => addProduct(product, "piece")} style={miniLightButtonStyle}>
                              Pzas
                            </button>
                            <button onClick={() => addProduct(product, "money")} style={miniDarkButtonStyle}>
                              $
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}

              {showProductCatalog ? (
                <div style={{ marginTop: 18 }}>
                  <div style={miniTitleStyle}>Catálogo de productos</div>

                  <div style={catalogGridStyle}>
                    {productCatalog.map((product) => (
                      <div key={product.id} style={productCardStyle}>
                        <div style={{ minHeight: 46 }}>
                          <div style={productNameStyle}>{product.name}</div>
                        </div>

                        <div style={productPriceStyle}>${getPrice(product).toFixed(2)}</div>

                        <div style={{ minHeight: 28, marginBottom: 10 }}>
                          {selectedCustomer?.customer_type === "mayoreo" &&
                          !product.is_excluded_from_discount ? (
                            <span style={successBadgeStyle}>Precio mayoreo</span>
                          ) : null}

                          {product.is_excluded_from_discount ? (
                            <span style={warningBadgeStyle}>Sin descuento</span>
                          ) : null}
                        </div>

                                                <div style={productButtonsWrapStyle}>
                          <button onClick={() => addProduct(product, "kg")} style={miniLightButtonStyle}>
                            +1 kg
                          </button>
                          <button onClick={() => addProduct(product, "half")} style={miniLightButtonStyle}>
                            +0.5
                          </button>
                          <button onClick={() => addProduct(product, "piece")} style={miniLightButtonStyle}>
                            Pzas
                          </button>
                          <button onClick={() => addProduct(product, "money")} style={miniDarkButtonStyle}>
                            $
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {!productSearch.trim() && !showProductCatalog ? (
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
                <div style={selectedSummaryStyle}>
                  <div style={{ fontWeight: 800, color: COLORS.text }}>
                    {selectedCustomer.name}
                  </div>
                  <div style={{ color: COLORS.muted, marginTop: 4 }}>
                    {selectedCustomer.phone || "Sin teléfono"}
                  </div>
                  {selectedCustomer.email ? (
                    <div style={{ color: COLORS.muted, marginTop: 4 }}>
                      {selectedCustomer.email}
                    </div>
                  ) : null}
                  <div style={{ color: COLORS.muted, marginTop: 8 }}>
                    <b>Dirección:</b> {deliveryAddress || "Sin dirección"}
                  </div>
                  <div style={{ color: COLORS.muted, marginTop: 8 }}>
                    <b>Fecha de entrega:</b> {formatOrderDate(deliveryDate)}
                  </div>
                </div>
              )}

                          <div style={summaryStatsWrapStyle}>
                <div style={summaryStatCardStyle}>
                  <div style={summaryStatLabelStyle}>Artículos</div>
                  <div style={summaryStatValueStyle}>{cart.length}</div>
                </div>

                <div style={summaryStatCardStyle}>
                  <div style={summaryStatLabelStyle}>Kilos totales</div>
                  <div style={summaryStatValueStyle}>{totalKilos().toFixed(2)}</div>
                </div>

                <div style={summaryStatCardStyle}>
                  <div style={summaryStatLabelStyle}>Piezas totales</div>
                  <div style={summaryStatValueStyle}>{totalPieces()}</div>
                </div>
              </div>

              <div style={captureBlockStyle}>
                <div style={fieldLabelStyle}>Capturó el pedido</div>
                <input
                  placeholder="Nombre de quien tomó el pedido"
                  value={takenBy}
                  onChange={(e) => setTakenBy(e.target.value)}
                  style={inputStyle}
                />

                <div style={captureTimeBoxStyle}>
                  <b>Hora visible de captura:</b> {capturePreview}
                </div>
              </div>

              {cart.length === 0 ? (
                <div style={{ ...emptyBoxStyle, marginTop: 12 }}>
                  Todavía no agregas productos
                </div>
              ) : (
                <>
                                    <div style={{ marginTop: 12 }}>
                    {cart.map((item, index) => (
                      <div key={index} style={cartRowStyle}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontWeight: 700, color: COLORS.text }}>{item.name}</div>

                          {item.sale_type === "kg" ? (
                            <div style={{ color: COLORS.muted, fontSize: 14, marginTop: 4 }}>
                              {item.kilos} kg · ${item.price.toFixed(2)}/kg
                            </div>
                          ) : (
                            <div style={{ color: COLORS.muted, fontSize: 14, marginTop: 4 }}>
                              {item.quantity} pieza{item.quantity === 1 ? "" : "s"} · se pesa en producción
                            </div>
                          )}

                          <div style={cartActionsRowStyle}>
                            {item.sale_type === "kg" ? (
                              <>
                                <button
                                  onClick={() => updateCartItemKilos(index, 1)}
                                  style={cartMiniButtonStyle}
                                >
                                  +1 kg
                                </button>
                                <button
                                  onClick={() => updateCartItemKilos(index, 0.5)}
                                  style={cartMiniButtonStyle}
                                >
                                  +0.5
                                </button>
                                <button
                                  onClick={() => updateCartItemKilos(index, -0.5)}
                                  style={cartMiniButtonStyle}
                                >
                                  -0.5
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => updateCartItemQuantity(index, 1)}
                                  style={cartMiniButtonStyle}
                                >
                                  +1 pza
                                </button>
                                <button
                                  onClick={() => updateCartItemQuantity(index, -1)}
                                  style={cartMiniButtonStyle}
                                >
                                  -1 pza
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div style={{ fontWeight: 700, color: COLORS.text, marginBottom: 8 }}>
                            {item.sale_type === "kg"
                              ? `$${(item.kilos * item.price).toFixed(2)}`
                              : "Se pesa después"}
                          </div>

                          <button
                            onClick={() => removeCartItem(index)}
                            style={dangerSoftButtonStyle}
                          >
                            Quitar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                                    <div style={totalBoxStyle}>
                    <span>Total estimado</span>
                    <span>${cartTotal().toFixed(2)}</span>
                  </div>

                  <button
                    onClick={clearOrder}
                    style={{ ...clearButtonStyle, marginTop: 12 }}
                  >
                    Limpiar pedido
                  </button>
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
                disabled={saving}
                style={{ ...primaryButtonStyle, width: "100%" }}
              >
                {saving ? "Guardando..." : "Guardar pedido por teléfono"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showNewCustomerModal ? (
        <div style={modalOverlayStyle}>
          <div style={modalCardStyle}>
            <div style={modalHeaderStyle}>
              <div>
                <h2 style={{ margin: 0, color: COLORS.text }}>Cliente nuevo</h2>
                <p style={{ margin: "6px 0 0 0", color: COLORS.muted }}>
                  Crea un cliente rápido sin salir de esta pantalla
                </p>
              </div>

              <button
                onClick={closeNewCustomerModal}
                style={modalCloseButtonStyle}
                disabled={creatingCustomer}
              >
                ✕
              </button>
            </div>

            <div style={modalFormGridStyle}>
              <input
                placeholder="Nombre del cliente"
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                style={inputStyle}
              />

              <input
                placeholder="Teléfono"
                value={newCustomerPhone}
                onChange={(e) => setNewCustomerPhone(e.target.value)}
                style={inputStyle}
              />

              <input
                placeholder="Correo"
                value={newCustomerEmail}
                onChange={(e) => setNewCustomerEmail(e.target.value)}
                style={inputStyle}
              />

              <input
                placeholder="Nombre del negocio (opcional)"
                value={newCustomerBusinessName}
                onChange={(e) => setNewCustomerBusinessName(e.target.value)}
                style={inputStyle}
              />

              <textarea
                placeholder="Dirección"
                value={newCustomerAddress}
                onChange={(e) => setNewCustomerAddress(e.target.value)}
                style={{ ...textareaStyle, marginTop: 0, minHeight: 110 }}
              />
            </div>

            <div style={modalActionsStyle}>
              <button
                onClick={closeNewCustomerModal}
                style={secondaryModalButtonStyle}
                disabled={creatingCustomer}
              >
                Cancelar
              </button>

              <button
                onClick={createQuickCustomer}
                style={primaryButtonStyle}
                disabled={creatingCustomer}
              >
                {creatingCustomer ? "Guardando..." : "Guardar cliente"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
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

const secondaryModalButtonStyle: React.CSSProperties = {
  padding: "12px 18px",
  borderRadius: 14,
  border: `1px solid ${COLORS.border}`,
  background: "rgba(255,255,255,0.82)",
  color: COLORS.text,
  cursor: "pointer",
  fontWeight: 700,
};

const catalogButtonStyle: React.CSSProperties = {
  padding: "14px 16px",
  borderRadius: 16,
  border: "none",
  background: "rgba(123, 34, 24, 0.12)",
  color: COLORS.primary,
  cursor: "pointer",
  fontWeight: 700,
  whiteSpace: "nowrap",
};

const dangerSoftButtonStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "none",
  background: "rgba(180,35,24,0.10)",
  color: COLORS.danger,
  cursor: "pointer",
  fontWeight: 700,
};

const clearButtonStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 16px",
  borderRadius: 14,
  border: `1px solid ${COLORS.border}`,
  background: "rgba(255,255,255,0.70)",
  color: COLORS.text,
  cursor: "pointer",
  fontWeight: 700,
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
  marginTop: 12,
};

const selectedSummaryStyle: React.CSSProperties = {
  padding: 14,
  borderRadius: 16,
  background: COLORS.bgSoft,
  border: `1px solid ${COLORS.border}`,
};

const searchBarRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto auto",
  gap: 10,
  alignItems: "center",
};

const searchBarRowStyleProducts: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: 10,
  alignItems: "center",
};

const miniTitleStyle: React.CSSProperties = {
  color: COLORS.text,
  fontWeight: 800,
  marginBottom: 10,
  fontSize: 18,
};

const listWrapStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const customerRowStyle: React.CSSProperties = {
  width: "100%",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: 14,
  borderRadius: 16,
  border: `1px solid ${COLORS.border}`,
  background: COLORS.bgSoft,
  cursor: "pointer",
};

const customerCardStyle: React.CSSProperties = {
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

const badgeStyle: React.CSSProperties = {
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

const catalogListStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  maxHeight: 460,
  overflowY: "auto",
  paddingRight: 4,
};

const searchProductRowStyle: React.CSSProperties = {
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

const miniLightButtonStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: `1px solid ${COLORS.border}`,
  background: "white",
  color: COLORS.text,
  cursor: "pointer",
  fontWeight: 700,
  flex: 1,
};

const miniDarkButtonStyle: React.CSSProperties = {
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

const successBadgeStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "4px 10px",
  borderRadius: 999,
  background: "rgba(31, 122, 77, 0.10)",
  color: COLORS.success,
  fontSize: 12,
  fontWeight: 700,
};

const warningBadgeStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "4px 10px",
  borderRadius: 999,
  background: "rgba(166, 106, 16, 0.12)",
  color: COLORS.warning,
  fontSize: 12,
  fontWeight: 700,
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

const cartActionsRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginTop: 10,
};

const cartMiniButtonStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: `1px solid ${COLORS.border}`,
  background: "white",
  color: COLORS.text,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 13,
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

const summaryStatsWrapStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: 10,
  marginTop: 12,
};

const summaryStatCardStyle: React.CSSProperties = {
  background: COLORS.bgSoft,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 16,
  padding: 12,
};

const summaryStatLabelStyle: React.CSSProperties = {
  color: COLORS.muted,
  fontSize: 13,
  marginBottom: 6,
};

const summaryStatValueStyle: React.CSSProperties = {
  color: COLORS.text,
  fontWeight: 800,
  fontSize: 22,
};

const captureBlockStyle: React.CSSProperties = {
  marginTop: 12,
  display: "grid",
  gap: 10,
};

const fieldLabelStyle: React.CSSProperties = {
  color: COLORS.muted,
  fontWeight: 700,
  fontSize: 14,
};

const captureTimeBoxStyle: React.CSSProperties = {
  padding: 12,
  borderRadius: 14,
  background: COLORS.bgSoft,
  border: `1px solid ${COLORS.border}`,
  color: COLORS.text,
};

const emptyBoxStyle: React.CSSProperties = {
  padding: 16,
  borderRadius: 18,
  background: COLORS.bgSoft,
  border: `1px dashed ${COLORS.border}`,
  color: COLORS.muted,
};

const datePreviewStyle: React.CSSProperties = {
  padding: 12,
  borderRadius: 14,
  background: COLORS.bgSoft,
  border: `1px solid ${COLORS.border}`,
  color: COLORS.text,
  marginTop: 12,
};

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.28)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
  zIndex: 80,
};

const modalCardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 620,
  background: COLORS.cardStrong,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 24,
  padding: 20,
  boxShadow: COLORS.shadow,
};

const modalHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  marginBottom: 16,
};

const modalCloseButtonStyle: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 999,
  border: "none",
  background: "rgba(123, 34, 24, 0.10)",
  color: COLORS.primary,
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 18,
};

const modalFormGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const modalActionsStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  flexWrap: "wrap",
  marginTop: 8,
};