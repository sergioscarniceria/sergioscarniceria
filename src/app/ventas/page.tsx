"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";

type Item = {
  id: string;
  product: string;
  kilos: number;
  price: number;
  sale_type?: "kg" | "pieza";
  quantity?: number | null;
  is_fixed_price_piece?: boolean;
};

type Product = {
  id: string;
  name: string;
  price: number;
  category: string | null;
  fixed_piece_price?: number | null;
};
type Ticket = {
  id: string;
  customer_name: string | null;
  status: string | null;
  payment_status: string | null;
  payment_method?: string | null;
  created_at?: string | null;
  source?: string | null;
  order_items?: {
    id: string;
    product: string;
    kilos: number;
    price: number;
    sale_type?: "kg" | "pieza" | null;
    quantity?: number | null;
    is_fixed_price_piece?: boolean | null;
  }[];
};
type Customer = {
  id: string;
  name: string;
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
  warning: "#a66a10",
  danger: "#b42318",
  shadow: "0 10px 30px rgba(91, 25, 15, 0.08)",
};

function makeId() {
  return `${Date.now()}-${Math.random()}`;
}

function money(value?: number | null) {
  return Number(value || 0).toFixed(2);
}

function shortId(id: string) {
  return id.slice(0, 6);
}

function ticketFolio(id: string) {
  return `TK-${shortId(id)}`;
}
function formatHour(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Mexico_City",
  });
}

function getTicketTotal(ticket: Ticket) {
  return (ticket.order_items || []).reduce((acc, item) => {
    if (item.sale_type === "pieza" && item.is_fixed_price_piece) {
      return acc + Number(item.quantity || 0) * Number(item.price || 0);
    }

    return acc + Number(item.kilos || 0) * Number(item.price || 0);
  }, 0);
}

function paymentBadgeStyle(status?: string | null): React.CSSProperties {
  if (status === "pagado") {
    return {
      background: "rgba(31,122,77,0.12)",
      color: COLORS.success,
    };
  }

  if (status === "credito" || status === "credito_autorizado") {
    return {
      background: "rgba(166,106,16,0.12)",
      color: COLORS.warning,
    };
  }

  if (status === "cancelado") {
    return {
      background: "rgba(180,35,24,0.10)",
      color: COLORS.danger,
    };
  }

  return {
    background: "rgba(53,92,125,0.12)",
    color: COLORS.text,
  };
}

function paymentStatusLabel(status?: string | null) {
  if (status === "pagado") return "Pagado, entregar";
  if (status === "credito" || status === "credito_autorizado") return "Crédito";
  if (status === "cancelado") return "Cancelado";
  return "Esperando pago";
}
export default function VentasPage() {
  const supabase = getSupabaseClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

 const [products, setProducts] = useState<Product[]>([]);
const [customers, setCustomers] = useState<Customer[]>([]);
const [tickets, setTickets] = useState<Ticket[]>([]);
const [items, setItems] = useState<Item[]>([]);
const [selectedProduct, setSelectedProduct] = useState<string>("");
const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
const [search, setSearch] = useState("");
const [kilos, setKilos] = useState("");
const [lastSavedFolio, setLastSavedFolio] = useState("");

const [customerMode, setCustomerMode] = useState<"general" | "existente">("general");
const [selectedCustomerId, setSelectedCustomerId] = useState("");
const [printTicketData, setPrintTicketData] = useState<{
  folio: string;
  orderId: string;
  customerName: string;
  items: Item[];
  total: number;
} | null>(null);

// Empleado atendiendo
const CARNICEROS = ["Manuel", "Ricardo", "Juanito", "Carlos", "Don Luis", "Sergio"];
const [attendant, setAttendant] = useState("");

// Ventas en espera (hold)
type HeldSale = {
  id: string;
  employee_name: string;
  items: Item[];
  notes: string;
  created_at: string;
};
const [heldSales, setHeldSales] = useState<HeldSale[]>([]);
const [showHeld, setShowHeld] = useState(false);
const [holdNote, setHoldNote] = useState("");
const [showHoldModal, setShowHoldModal] = useState(false);

  useEffect(() => {
  loadProducts();
  loadCustomers();
  loadTickets();
  loadHeldSales();

  const interval = setInterval(() => {
    loadTickets();
    loadHeldSales();
  }, 5000);

  return () => clearInterval(interval);
}, []);

  async function loadProducts() {
    setLoading(true);

    const { data, error } = await supabase
      .from("products")
     .select("id, name, price, category, fixed_piece_price")
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
  async function loadTickets() {
  const { data, error } = await supabase
    .from("orders")
   .select(`
      id,
      customer_name,
      status,
      payment_status,
      payment_method,
      created_at,
      source,
      order_items (
  id,
  product,
  kilos,
  price,
  sale_type,
  quantity,
  is_fixed_price_piece
)
    `)
    .eq("source", "mostrador")
    .order("created_at", { ascending: false })
    .limit(12);

  if (error) {
    console.log(error);
    return;
  }

  setTickets((data as Ticket[]) || []);
}

async function loadCustomers() {
  const { data, error } = await supabase
    .from("customers")
    .select("id, name")
    .order("name", { ascending: true });

  if (error) {
    console.log(error);
    return;
  }

  setCustomers((data as Customer[]) || []);
}

async function loadHeldSales() {
  const { data } = await supabase
    .from("held_sales")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);
  setHeldSales((data as HeldSale[]) || []);
}

async function holdCurrentSale() {
  if (items.length === 0) { alert("No hay productos para poner en espera"); return; }
  if (!attendant) { alert("Selecciona quién está atendiendo"); return; }

  const { error } = await supabase.from("held_sales").insert({
    employee_name: attendant,
    items: JSON.stringify(items),
    notes: holdNote.trim() || null,
  });

  if (error) { alert("Error: " + error.message); return; }

  setItems([]);
  setHoldNote("");
  setShowHoldModal(false);
  loadHeldSales();
}

async function resumeHeldSale(sale: HeldSale) {
  // If current cart has items, ask
  if (items.length > 0) {
    if (!confirm("Ya tienes productos en el carrito. ¿Quieres reemplazarlos con la venta en espera?")) return;
  }

  const parsedItems = typeof sale.items === "string" ? JSON.parse(sale.items) : sale.items;
  setItems(parsedItems as Item[]);
  setAttendant(sale.employee_name);

  // Delete held sale
  await supabase.from("held_sales").delete().eq("id", sale.id);
  loadHeldSales();
  setShowHeld(false);
}

async function deleteHeldSale(id: string) {
  if (!confirm("¿Eliminar esta venta en espera?")) return;
  await supabase.from("held_sales").delete().eq("id", id);
  loadHeldSales();
}

  const groupedCategories = useMemo(() => {
    const grouped: Record<string, Product[]> = {};

    for (const product of products) {
      const category = (product.category || "Complementos").trim();

      if (!grouped[category]) {
        grouped[category] = [];
      }

      grouped[category].push(product);
    }

    return grouped;
  }, [products]);

  const categoryNames = useMemo(() => {
    return Object.keys(groupedCategories);
  }, [groupedCategories]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) {
      if (!selectedCategory) return [];
      return groupedCategories[selectedCategory] || [];
    }

    return products.filter((product) =>
      product.name.toLowerCase().includes(q)
    );
  }, [search, selectedCategory, groupedCategories, products]);
  const selectedProductData = useMemo(() => {
  return products.find((p) => p.name === selectedProduct) || null;
}, [products, selectedProduct]);

const isFixedPieceProduct =
  selectedProductData?.fixed_piece_price !== null &&
  selectedProductData?.fixed_piece_price !== undefined;

  function addItem() {
  const product = products.find((p) => p.name === selectedProduct);

  if (!selectedProduct) {
    alert("Selecciona un producto");
    return;
  }

  if (!product) {
    alert("No encontramos el producto");
    return;
  }
if (isFixedPieceProduct && !Number.isInteger(Number(kilos))) {
  alert("Este producto se vende por pieza, no por kilos");
  return;
}
  if (isFixedPieceProduct) {
    const cleanQuantity = Number(kilos);

    if (!cleanQuantity || cleanQuantity <= 0 || !Number.isInteger(cleanQuantity)) {
      alert("Captura piezas válidas");
      return;
    }

    setItems((prev) => [
      ...prev,
      {
        id: makeId(),
        product: product.name,
        kilos: 0,
        price: Number(Number(product.fixed_piece_price || 0).toFixed(2)),
        sale_type: "pieza",
        quantity: cleanQuantity,
        is_fixed_price_piece: true,
      },
    ]);

    setKilos("");
    return;
  }

  const cleanKilos = Number(kilos);

  if (!cleanKilos || cleanKilos <= 0) {
    alert("Captura kilos válidos");
    return;
  }

  setItems((prev) => [
    ...prev,
    {
      id: makeId(),
      product: product.name,
      kilos: Number(cleanKilos.toFixed(3)),
      price: Number(Number(product.price || 0).toFixed(2)),
      sale_type: "kg",
      quantity: null,
      is_fixed_price_piece: false,
    },
  ]);

  setKilos("");
}

  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }
async function deliverTicket(id: string) {
  const { error } = await supabase
    .from("orders")
    .update({ status: "entregado" })
    .eq("id", id);

  if (error) {
    console.log(error);
    alert("Error al entregar: " + error.message);
    return;
  }

  // Actualizar lista local inmediatamente
  setTickets((prev) => prev.map((t) => t.id === id ? { ...t, status: "entregado" } : t));
  await loadTickets();
}
  async function saveTicket() {
    if (items.length === 0) {
      alert("Todavía no agregas productos");
      return;
    }

    setSaving(true);

let customerName = "MOSTRADOR";
let customerId: string | null = null;

if (customerMode === "existente" && selectedCustomerId) {
  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  if (selectedCustomer) {
    customerName = selectedCustomer.name;
    customerId = selectedCustomer.id;
  }
}

const { data: orderData, error: orderError } = await supabase
  .from("orders")
  .insert([
    {
      customer_id: customerId,
      customer_name: customerName,
      status: "pendiente",
      source: "mostrador",
      payment_status: "pendiente",
      notes: null,
      attendant_name: attendant || null,
    },
  ])
      .select()
      .single();

    if (orderError || !orderData) {
      console.log(orderError);
      alert("No se pudo guardar la orden");
      setSaving(false);
      return;
    }

    const itemsPayload = items.map((item) => ({
  order_id: orderData.id,
  product: item.product,
  kilos: Number(Number(item.kilos || 0).toFixed(3)),
  price: Number(Number(item.price || 0).toFixed(2)),
  sale_type: item.sale_type || "kg",
  quantity: item.sale_type === "pieza" ? Number(item.quantity || 0) : null,
  is_fixed_price_piece: Boolean(item.is_fixed_price_piece),
}));

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(itemsPayload);

    if (itemsError) {
      console.log(itemsError);
      alert("La orden se guardó, pero fallaron los renglones");
      setSaving(false);
      return;
    }

    const folio = ticketFolio(orderData.id);
    const ticketTotal = items.reduce((acc, item) => {
      if (item.sale_type === "pieza" && item.is_fixed_price_piece) {
        return acc + Number(item.quantity || 0) * Number(item.price || 0);
      }
      return acc + Number(item.kilos || 0) * Number(item.price || 0);
    }, 0);

   setPrintTicketData({
     folio,
     orderId: orderData.id,
     customerName: customerName,
     items: [...items],
     total: ticketTotal,
   });

   setLastSavedFolio(folio);
setItems([]);
setSelectedProduct("");
setSelectedCategory(null);
setSearch("");
setKilos("");
setCustomerMode("general");
setSelectedCustomerId("");
setSaving(false);

await loadTickets();
  }

  const total = useMemo(() => {
  return items.reduce((acc, item) => {
    if (item.sale_type === "pieza" && item.is_fixed_price_piece) {
      return acc + Number(item.quantity || 0) * Number(item.price || 0);
    }

    return acc + Number(item.kilos || 0) * Number(item.price || 0);
  }, 0);
}, [items]);
  const pendingTickets = useMemo(() => {
  return tickets.filter(
    (ticket) =>
      ticket.status !== "entregado" &&
      ticket.payment_status !== "cancelado"
  );
}, [tickets]);

const paidTickets = useMemo(() => {
  return tickets.filter(
    (ticket) =>
      ticket.status !== "entregado" &&
      (ticket.payment_status === "pagado" ||
      ticket.payment_status === "credito" ||
      ticket.payment_status === "credito_autorizado")
  );
}, [tickets]);

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
            <p style={subtitleStyle}>{attendant ? `Atendiendo: ${attendant}` : "Selecciona quién atiende"}</p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {heldSales.length > 0 && (
              <button onClick={() => setShowHeld(!showHeld)} style={{ padding: "14px 20px", borderRadius: 14, border: `1px solid ${COLORS.border}`, background: "rgba(166,106,16,0.10)", color: COLORS.warning, fontWeight: 800, cursor: "pointer", fontSize: 16, minHeight: 48 }}>
                En espera ({heldSales.length})
              </button>
            )}
            {items.length > 0 && (
              <button onClick={() => setShowHoldModal(true)} style={{ padding: "14px 20px", borderRadius: 14, border: `1px solid ${COLORS.border}`, background: "white", color: COLORS.text, fontWeight: 800, cursor: "pointer", fontSize: 16, minHeight: 48 }}>
                Pausar venta
              </button>
            )}
          </div>
        </div>

        {/* Selector de empleado */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", padding: "0 4px" }}>
          {CARNICEROS.map((name) => (
            <button key={name} onClick={() => setAttendant(name)} style={{
              padding: "14px 20px", borderRadius: 14, fontWeight: 800, cursor: "pointer", fontSize: 16, minHeight: 48,
              border: attendant === name ? "none" : `1px solid ${COLORS.border}`,
              background: attendant === name ? `linear-gradient(180deg, ${COLORS.primary} 0%, ${COLORS.primaryDark} 100%)` : "white",
              color: attendant === name ? "white" : COLORS.text,
            }}>
              {name}
            </button>
          ))}
        </div>

        {/* Held sales panel */}
        {showHeld && heldSales.length > 0 && (
          <div style={{ background: "rgba(255,255,255,0.92)", borderRadius: 18, padding: 16, marginBottom: 14, border: `1px solid ${COLORS.border}`, boxShadow: COLORS.shadow }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h3 style={{ margin: 0, color: COLORS.text, fontSize: 16 }}>Ventas en espera</h3>
              <button onClick={() => setShowHeld(false)} style={{ border: "none", background: "transparent", color: COLORS.muted, fontWeight: 700, cursor: "pointer" }}>X</button>
            </div>
            {heldSales.map((sale) => {
              const saleItems = typeof sale.items === "string" ? JSON.parse(sale.items) : sale.items;
              const saleTotal = (saleItems as Item[]).reduce((acc: number, it: Item) => {
                if (it.sale_type === "pieza" && it.is_fixed_price_piece) return acc + Number(it.quantity || 0) * Number(it.price || 0);
                return acc + Number(it.kilos || 0) * Number(it.price || 0);
              }, 0);
              return (
                <div key={sale.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${COLORS.border}` }}>
                  <div>
                    <div style={{ fontWeight: 700, color: COLORS.text, fontSize: 14 }}>{sale.employee_name} — {(saleItems as Item[]).length} productos</div>
                    <div style={{ color: COLORS.muted, fontSize: 12 }}>${money(saleTotal)} {sale.notes ? `— ${sale.notes}` : ""}</div>
                    <div style={{ color: COLORS.muted, fontSize: 11 }}>{new Date(sale.created_at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", timeZone: "America/Mexico_City" })}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => resumeHeldSale(sale)} style={{ padding: "8px 14px", borderRadius: 10, border: "none", background: "rgba(31,122,77,0.12)", color: COLORS.success, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>Continuar</button>
                    <button onClick={() => deleteHeldSale(sale.id)} style={{ padding: "8px 14px", borderRadius: 10, border: "none", background: "rgba(180,35,24,0.10)", color: COLORS.danger, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>Eliminar</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={mainGridStyle}>
          <div style={productsPanelStyle}>
            <h2 style={panelTitleStyle}>Productos</h2>
            <p style={panelSubtitleStyle}>
              Categorías + buscador para encontrar rápido
            </p>

            <input
              placeholder="Buscar producto"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ ...inputStyle, marginBottom: 14 }}
            />

            {!search.trim() ? (
              <>
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
                      {(groupedCategories[selectedCategory] || []).length === 0 ? (
                        <div style={emptyBoxStyle}>No hay productos en esta categoría</div>
                      ) : (
                        (groupedCategories[selectedCategory] || []).map((p) => {
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
                              <div style={productMetaStyle}>
                                {p.category || "Complementos"}
                              </div>
                              <div style={productPriceStyle}>${money(p.price)}</div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div style={productListStyle}>
                {filteredProducts.length === 0 ? (
                  <div style={emptyBoxStyle}>No encontramos ese producto</div>
                ) : (
                  filteredProducts.map((p) => {
                    const isSelected = selectedProduct === p.name;

                    return (
                      <button
                        key={p.id}
                        onClick={() => {
                          setSelectedCategory(p.category || "Complementos");
                          setSelectedProduct(p.name);
                        }}
                        style={{
                          ...productButtonStyle,
                          border: isSelected
                            ? `2px solid ${COLORS.primary}`
                            : `1px solid ${COLORS.border}`,
                          background: isSelected ? "#fff7f5" : "white",
                        }}
                      >
                        <div style={productNameStyle}>{p.name}</div>
                        <div style={productMetaStyle}>
                          {p.category || "Complementos"}
                        </div>
                        <div style={productPriceStyle}>${money(p.price)}</div>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          <div style={rightColumnStyle}>
  <div style={panelStyle}>
    <h2 style={panelTitleStyle}>Orden</h2>
    <p style={panelSubtitleStyle}>Vas armando el pedido en tiempo real</p>
    <div style={fieldBlockStyle}>
      <label style={fieldLabelStyle}>Cliente</label>

      <div style={customerModeWrapStyle}>
        <button
          onClick={() => {
            setCustomerMode("general");
            setSelectedCustomerId("");
          }}
          style={{
            ...customerModeButtonStyle,
            background: customerMode === "general" ? COLORS.primary : "white",
            color: customerMode === "general" ? "white" : COLORS.text,
            border:
              customerMode === "general"
                ? "none"
                : `1px solid ${COLORS.border}`,
          }}
        >
          Público general
        </button>

        <button
          onClick={() => setCustomerMode("existente")}
          style={{
            ...customerModeButtonStyle,
            background: customerMode === "existente" ? COLORS.primary : "white",
            color: customerMode === "existente" ? "white" : COLORS.text,
            border:
              customerMode === "existente"
                ? "none"
                : `1px solid ${COLORS.border}`,
          }}
        >
          Cliente existente
        </button>
      </div>

      {customerMode === "existente" ? (
        <select
          value={selectedCustomerId}
          onChange={(e) => setSelectedCustomerId(e.target.value)}
          style={inputStyle}
        >
          <option value="">Seleccionar cliente</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name}
            </option>
          ))}
        </select>
      ) : (
        <div style={customerHintStyle}>Se guardará como MOSTRADOR</div>
      )}
    </div>

    <div style={selectedProductCardStyle}>
      <div style={selectedProductLabelStyle}>Producto seleccionado</div>
     <div style={selectedProductValueStyle}>
  {selectedProduct || "Ninguno"}
</div>
{selectedProductData ? (
  <div style={productMetaStyle}>
    {isFixedPieceProduct
      ? `Precio fijo por pieza: $${money(selectedProductData.fixed_piece_price)}`
      : `Precio por kg: $${money(selectedProductData.price)}`}
  </div>
) : null}
    </div>

    <div style={fieldBlockStyle}>
      <label style={fieldLabelStyle}>
  {isFixedPieceProduct ? "Piezas" : "Kilos"}
</label>
      <input
        placeholder={isFixedPieceProduct ? "Ejemplo: 2" : "Ejemplo: 1.250"}
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
        $
        {money(
          item.sale_type === "pieza" && item.is_fixed_price_piece
            ? Number(item.quantity || 0) * Number(item.price || 0)
            : Number(item.kilos || 0) * Number(item.price || 0)
        )}
      </div>
    </div>

    <div style={orderItemMetaStyle}>
      {item.sale_type === "pieza" && item.is_fixed_price_piece
        ? `${item.quantity} pieza(s) × $${money(item.price)}`
        : `${item.kilos} kg × $${money(item.price)}`}
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
        <span>Cliente</span>
        <b>
          {customerMode === "existente"
            ? customers.find((c) => c.id === selectedCustomerId)?.name || "Cliente existente"
            : "MOSTRADOR"}
        </b>
      </div>

      <div style={summaryRowStyle}>
        <span>Renglones</span>
        <b>{items.length}</b>
      </div>

      <div style={summaryRowStyle}>
        <span>Producto activo</span>
        <b>{selectedProduct || "-"}</b>
      </div>

      <div style={summaryRowStyle}>
        <span>Último folio</span>
        <b>{lastSavedFolio || "-"}</b>
      </div>
    </div>

    <button
      style={{
        ...printButtonStyle,
        opacity: saving ? 0.7 : 1,
      }}
      disabled={saving}
      onClick={saveTicket}
    >
      {saving ? "Guardando..." : "Imprimir ticket"}
    </button>
  </div>

  <div style={panelStyle}>
    <h2 style={panelTitleStyle}>Tickets de mostrador</h2>
    <p style={panelSubtitleStyle}>
      Aquí mismo revisas si ya puedes entregar
    </p>

    <div style={ticketsSectionStyle}>
      <div style={ticketsTitleStyle}>Pendientes de cobro</div>

      {pendingTickets.length === 0 ? (
        <div style={emptyBoxStyle}>No hay tickets pendientes</div>
      ) : (
        <div style={ticketsListStyle}>
          {pendingTickets.map((ticket) => (
            <div key={ticket.id} style={ticketCardStyle}>
              <div style={ticketTopStyle}>
                <div>
                  <div style={ticketFolioStyle}>{ticketFolio(ticket.id)}</div>
                  <div style={ticketMetaStyle}>
                    {ticket.customer_name || "MOSTRADOR"} · {formatHour(ticket.created_at)}
                  </div>
                </div>

                <div
                  style={{
                    ...ticketStatusStyle,
                    ...paymentBadgeStyle(ticket.payment_status),
                  }}
                >
                  {paymentStatusLabel(ticket.payment_status)}
                </div>
              </div>

              <div style={ticketBottomStyle}>
                <b>${money(getTicketTotal(ticket))}</b>

                {ticket.payment_status === "pagado" ? (
                  <button
                    onClick={() => deliverTicket(ticket.id)}
                    style={deliverButtonStyle}
                  >
                    Entregar pedido
                  </button>
                ) : (
                  <div style={pendingBadgeStyle}>
                    Pendiente de pago
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>

    <div style={{ height: 14 }} />

    <div style={ticketsSectionStyle}>
      <div style={ticketsTitleStyle}>Ya pagados / crédito</div>

      {paidTickets.length === 0 ? (
        <div style={emptyBoxStyle}>Todavía no hay tickets pagados</div>
      ) : (
        <div style={ticketsListStyle}>
          {paidTickets.map((ticket) => (
            <div key={ticket.id} style={ticketCardStyle}>
              <div style={ticketTopStyle}>
                <div>
                  <div style={ticketFolioStyle}>{ticketFolio(ticket.id)}</div>
                  <div style={ticketMetaStyle}>
                    {ticket.customer_name || "MOSTRADOR"} · {formatHour(ticket.created_at)}
                  </div>
                </div>

                <div
                  style={{
                    ...ticketStatusStyle,
                    ...paymentBadgeStyle(ticket.payment_status),
                  }}
                >
                  {paymentStatusLabel(ticket.payment_status)}
                </div>
              </div>

              <div style={{ ...ticketBottomStyle, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <b style={{ fontSize: 18 }}>${money(getTicketTotal(ticket))}</b>
                <button onClick={() => deliverTicket(ticket.id)} style={{
                  padding: "14px 24px", borderRadius: 14, border: "none",
                  background: "#1f7a4d", color: "white",
                  fontWeight: 800, cursor: "pointer", fontSize: 16, minHeight: 48,
                }}>Entregar</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
</div>
        </div>
      </div>

      {/* Modal imprimir ticket con QR */}
      {printTicketData && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999,
        }}>
          <div style={{
            background: "white", borderRadius: 20, padding: 24, maxWidth: 380, width: "90%",
            textAlign: "center",
          }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.text, marginBottom: 8 }}>
              Ticket guardado
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: COLORS.primary, marginBottom: 4 }}>
              {printTicketData.folio}
            </div>
            <div style={{ fontSize: 14, color: COLORS.muted, marginBottom: 12 }}>
              {printTicketData.customerName} — ${money(printTicketData.total)}
            </div>
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(printTicketData.orderId)}`}
              alt="QR del ticket"
              style={{ width: 180, height: 180, margin: "0 auto 16px" }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => {
                  const d = printTicketData;
                  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(d.orderId)}`;
                  const itemsHtml = d.items.map((item) => {
                    if (item.sale_type === "pieza" && item.is_fixed_price_piece) {
                      return `<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:13px;border-bottom:1px dashed #ddd"><span>${item.product} x${item.quantity}</span><span>$${money(Number(item.quantity || 0) * Number(item.price || 0))}</span></div>`;
                    }
                    return `<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:13px;border-bottom:1px dashed #ddd"><span>${item.product} ${Number(item.kilos).toFixed(3)}kg</span><span>$${money(Number(item.kilos || 0) * Number(item.price || 0))}</span></div>`;
                  }).join("");

                  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Ticket ${d.folio}</title><style>@page{margin:0;size:80mm auto}body{font-family:Arial,sans-serif;width:72mm;margin:0 auto;padding:4mm 0;color:#222}*{box-sizing:border-box}</style></head><body>
                    <div style="text-align:center">
                      <img src="${window.location.origin}/logo.png" style="width:60px;height:60px;border-radius:10px" />
                      <div style="font-weight:800;font-size:15px;margin:6px 0 2px">SERGIO'S CARNICERÍA</div>
                      <div style="font-size:11px;color:#888">sergioscarniceria.com</div>
                      <hr style="border:none;border-top:1px solid #ccc;margin:8px 0">
                      <div style="font-size:20px;font-weight:800;color:#7b2218">${d.folio}</div>
                      <div style="font-size:12px;color:#666;margin:4px 0">${d.customerName} — ${new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City" })}</div>
                    </div>
                    <div style="margin:8px 0">${itemsHtml}</div>
                    <div style="text-align:right;font-size:16px;font-weight:800;margin:8px 0;color:#7b2218">TOTAL: $${money(d.total)}</div>
                    <div style="text-align:center;margin:10px 0">
                      <img src="${qrUrl}" style="width:140px;height:140px" />
                      <div style="font-size:10px;color:#999;margin-top:4px">Presenta este código en caja</div>
                    </div>
                    <div style="text-align:center;font-size:11px;color:#aaa;margin-top:8px">¡Gracias por su preferencia!</div>
                  </body></html>`;

                  const win = window.open("", "_blank", "width=400,height=600");
                  if (win) {
                    win.document.write(html);
                    win.document.close();
                    win.onload = () => {
                      setTimeout(() => win.print(), 300);
                    };
                  }
                }}
                style={{
                  flex: 1, padding: "12px 16px", borderRadius: 12, border: "none",
                  background: COLORS.primary, color: "white", fontWeight: 700, fontSize: 14, cursor: "pointer",
                }}
              >
                Imprimir ticket
              </button>
              <button
                onClick={() => setPrintTicketData(null)}
                style={{
                  flex: 1, padding: "12px 16px", borderRadius: 12,
                  border: `1px solid ${COLORS.border}`, background: "white",
                  color: COLORS.text, fontWeight: 600, fontSize: 14, cursor: "pointer",
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hold sale modal */}
      {showHoldModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => setShowHoldModal(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "rgba(255,255,255,0.95)", borderRadius: 22, padding: 24, maxWidth: 380, width: "100%", boxShadow: "0 20px 50px rgba(0,0,0,0.2)" }}>
            <h3 style={{ margin: "0 0 12px", color: COLORS.text, fontSize: 18 }}>Poner venta en espera</h3>
            <p style={{ margin: "0 0 12px", color: COLORS.muted, fontSize: 14 }}>{items.length} productos — {attendant || "Sin empleado"}</p>
            {!attendant && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ color: COLORS.muted, fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>¿Quién atiende?</label>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {CARNICEROS.map((n) => (
                    <button key={n} onClick={() => setAttendant(n)} style={{
                      padding: "6px 10px", borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: "pointer",
                      border: attendant === n ? "none" : `1px solid ${COLORS.border}`,
                      background: attendant === n ? COLORS.primary : "white",
                      color: attendant === n ? "white" : COLORS.text,
                    }}>{n}</button>
                  ))}
                </div>
              </div>
            )}
            <label style={{ color: COLORS.muted, fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>Nota (opcional)</label>
            <input value={holdNote} onChange={(e) => setHoldNote(e.target.value)} placeholder="Ej: Cliente fue por más cosas" style={{ width: "100%", padding: "10px 14px", borderRadius: 12, border: `1px solid ${COLORS.border}`, outline: "none", fontSize: 15, color: COLORS.text, marginBottom: 16 }} />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowHoldModal(false)} style={{ flex: 1, padding: "12px", borderRadius: 14, border: `1px solid ${COLORS.border}`, background: "white", color: COLORS.text, fontWeight: 700, cursor: "pointer" }}>Cancelar</button>
              <button onClick={holdCurrentSale} style={{ flex: 1, padding: "12px", borderRadius: 14, border: "none", background: `linear-gradient(180deg, ${COLORS.warning} 0%, #8a5500 100%)`, color: "white", fontWeight: 800, cursor: "pointer" }}>Poner en espera</button>
            </div>
          </div>
        </div>
      )}
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
  gridTemplateColumns: "2fr 1fr",
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
const rightColumnStyle: React.CSSProperties = {
  display: "grid",
  gap: 20,
};
const productsPanelStyle: React.CSSProperties = {
  ...panelStyle,
  minHeight: 780,
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
  padding: "24px 18px",
  borderRadius: 20,
  border: `1px solid ${COLORS.border}`,
  background: "white",
  color: COLORS.text,
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 22,
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
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
};

const productButtonStyle: React.CSSProperties = {
  width: "100%",
  padding: "18px 18px",
  borderRadius: 18,
  cursor: "pointer",
  textAlign: "left",
  minHeight: 110,
};

const productNameStyle: React.CSSProperties = {
  fontWeight: 800,
  color: COLORS.text,
  fontSize: 22,
  lineHeight: 1.2,
};

const productMetaStyle: React.CSSProperties = {
  color: COLORS.muted,
  marginTop: 4,
  fontSize: 13,
};

const productPriceStyle: React.CSSProperties = {
  color: COLORS.primary,
  marginTop: 8,
  fontSize: 18,
  fontWeight: 800,
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
  padding: 16,
  borderRadius: 16,
  border: `1px solid ${COLORS.border}`,
  boxSizing: "border-box",
  outline: "none",
  background: "white",
  color: COLORS.text,
  fontSize: 18,
};

const addButtonStyle: React.CSSProperties = {
  width: "100%",
  padding: "20px 16px",
  borderRadius: 16,
  border: "none",
  background: `linear-gradient(180deg, ${COLORS.primary} 0%, ${COLORS.primaryDark} 100%)`,
  color: "white",
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 20,
  minHeight: 56,
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
  padding: "14px 16px",
  borderRadius: 14,
  border: "none",
  background: "rgba(180,35,24,0.10)",
  color: COLORS.danger,
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 16,
  minHeight: 48,
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
  padding: "20px 16px",
  borderRadius: 16,
  border: `1px solid ${COLORS.border}`,
  background: "white",
  color: COLORS.text,
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 18,
  minHeight: 56,
};

const emptyBoxStyle: React.CSSProperties = {
  padding: 16,
  borderRadius: 18,
  background: COLORS.bgSoft,
  border: `1px dashed ${COLORS.border}`,
  color: COLORS.muted,
};
const ticketsSectionStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const ticketsTitleStyle: React.CSSProperties = {
  color: COLORS.text,
  fontWeight: 800,
  fontSize: 16,
};

const ticketsListStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const ticketCardStyle: React.CSSProperties = {
  border: `1px solid ${COLORS.border}`,
  borderRadius: 18,
  background: COLORS.bgSoft,
  padding: 16,
};

const ticketTopStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  alignItems: "flex-start",
};

const ticketFolioStyle: React.CSSProperties = {
  color: COLORS.text,
  fontWeight: 800,
  fontSize: 16,
};

const ticketMetaStyle: React.CSSProperties = {
  color: COLORS.muted,
  fontSize: 13,
  marginTop: 4,
};

const ticketStatusStyle: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 999,
  fontSize: 14,
  fontWeight: 800,
  textAlign: "center",
  flexShrink: 0,
};

const ticketBottomStyle: React.CSSProperties = {
  marginTop: 8,
  color: COLORS.text,
};
const deliverButtonStyle: React.CSSProperties = {
  marginTop: 10,
  width: "100%",
  padding: "16px",
  borderRadius: 14,
  border: "none",
  background: "#1f7a4d",
  color: "white",
  fontWeight: 800,
  cursor: "pointer",
  fontSize: 16,
  minHeight: 52,
};

const pendingBadgeStyle: React.CSSProperties = {
  marginTop: 10,
  padding: "10px",
  borderRadius: 12,
  background: "rgba(180,35,24,0.10)",
  color: "#b42318",
  fontWeight: 700,
  textAlign: "center",
};
const customerModeWrapStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const customerModeButtonStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  cursor: "pointer",
  fontWeight: 700,
};

const customerHintStyle: React.CSSProperties = {
  color: COLORS.muted,
  fontSize: 13,
  padding: "4px 2px",
};