"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";

/* ─── Types ─── */
type Product = {
  id: string;
  name: string;
  price: number;
  category: string | null;
  sale_type: string | null;
  fixed_piece_price: number | null;
  is_active: boolean;
};

type CartItem = {
  productId: string;
  name: string;
  price: number;
  qty: number; // kilos or pieces
  sale_type: "kg" | "pieza";
};

/* ─── Colors ─── */
const C = {
  bg: "#f7f1e8",
  card: "#fff",
  border: "#e8ddd0",
  text: "#3b1c16",
  muted: "#7a5a52",
  primary: "#7b2218",
  primaryLight: "#a13328",
  primaryBg: "#fdf0ee",
  success: "#1f7a4d",
  successBg: "#edf7f0",
  warning: "#a66a10",
  white: "#fff",
};

/* ─── Payment methods for end clients ─── */
const PAYMENT_METHODS = [
  { id: "efectivo", label: "Efectivo", icon: "💵", desc: "Paga al recibir" },
  { id: "transferencia", label: "Transferencia", icon: "📱", desc: "SPEI / banco" },
  { id: "tarjeta", label: "Tarjeta", icon: "💳", desc: "Al entregar" },
];

/* ─── Helper ─── */
const fmt = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const minDeliveryTime = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 70); // +1h + buffer
  // Round to next 15min
  const m = d.getMinutes();
  d.setMinutes(m + (15 - (m % 15)));
  d.setSeconds(0);
  return d;
};

const toDateTimeLocal = (d: Date) => {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/* ─── Steps ─── */
type Step = "catalog" | "cart" | "checkout" | "confirm";

export default function TiendaPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [step, setStep] = useState<Step>("catalog");
  const [searchQ, setSearchQ] = useState("");
  const [selectedCat, setSelectedCat] = useState<string | null>(null);

  // Quantity input temp state (for kg items)
  const [qtyInputs, setQtyInputs] = useState<Record<string, string>>({});

  // Checkout form
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("efectivo");
  const [deliveryDateTime, setDeliveryDateTime] = useState(toDateTimeLocal(minDeliveryTime()));
  const [saving, setSaving] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);

  /* ─── Load products ─── */
  useEffect(() => {
    (async () => {
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from("products")
        .select("id, name, price, category, sale_type, fixed_piece_price, is_active")
        .eq("is_active", true)
        .order("category")
        .order("name");
      setProducts(data || []);
      setLoading(false);
    })();
  }, []);

  /* ─── Derived ─── */
  const categories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach((p) => cats.add(p.category || "Otros"));
    return Array.from(cats).sort();
  }, [products]);

  const filtered = useMemo(() => {
    let list = products;
    if (selectedCat) list = list.filter((p) => (p.category || "Otros") === selectedCat);
    if (searchQ.trim()) {
      const q = searchQ.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
    return list;
  }, [products, selectedCat, searchQ]);

  const cartTotal = useMemo(
    () => cart.reduce((s, c) => s + c.qty * c.price, 0),
    [cart]
  );
  const cartCount = cart.length;

  /* ─── Cart ops ─── */
  const addToCart = (p: Product, qty: number) => {
    if (qty <= 0) return;
    const saleType = p.sale_type === "pieza" ? "pieza" : "kg";
    const price = saleType === "pieza" && p.fixed_piece_price ? p.fixed_piece_price : p.price;
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.productId === p.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + qty };
        return next;
      }
      return [...prev, { productId: p.id, name: p.name, price, qty, sale_type: saleType }];
    });
    // Clear temp input
    setQtyInputs((prev) => ({ ...prev, [p.id]: "" }));
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((c) => c.productId !== productId));
  };

  const updateCartQty = (productId: string, qty: number) => {
    if (qty <= 0) return removeFromCart(productId);
    setCart((prev) =>
      prev.map((c) => (c.productId === productId ? { ...c, qty } : c))
    );
  };

  /* ─── Submit order ─── */
  const submitOrder = async () => {
    if (!name.trim() || !phone.trim() || !address.trim()) {
      alert("Completa tu nombre, teléfono y dirección");
      return;
    }
    if (cart.length === 0) return;

    // Validate delivery time (at least 1 hour from now)
    const deliveryTime = new Date(deliveryDateTime);
    const minTime = new Date();
    minTime.setMinutes(minTime.getMinutes() + 55); // 55min to give small buffer
    if (deliveryTime < minTime) {
      alert("La hora de entrega debe ser al menos 1 hora a partir de ahora");
      return;
    }

    setSaving(true);
    const supabase = getSupabaseClient();

    // 1. Insert order
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert([
        {
          customer_name: name.trim(),
          status: "nuevo",
          source: "app_cliente",
          notes: `Tel: ${phone.trim()} | ${notes.trim() || "Sin notas"}`,
          delivery_address: address.trim(),
          delivery_date: deliveryDateTime,
          delivery_status: "pendiente",
          payment_status: "pendiente",
          payment_method: paymentMethod,
        },
      ])
      .select()
      .single();

    if (orderError || !order) {
      console.error(orderError);
      alert("Error al crear tu pedido. Intenta de nuevo.");
      setSaving(false);
      return;
    }

    // 2. Insert items
    const items = cart.map((c) => ({
      order_id: order.id,
      product: c.name,
      kilos: c.sale_type === "pieza" ? 0 : c.qty,
      price: c.price,
      sale_type: c.sale_type,
      quantity: c.sale_type === "pieza" ? c.qty : null,
      is_fixed_price_piece: c.sale_type === "pieza",
    }));

    const { error: itemsError } = await supabase.from("order_items").insert(items);
    if (itemsError) {
      console.error(itemsError);
      alert("Se creó el pedido pero hubo un error con los productos. Llámanos.");
    }

    setOrderId(order.id);
    setStep("confirm");
    setSaving(false);
  };

  /* ─── Styles ─── */
  const pageStyle: React.CSSProperties = {
    minHeight: "100vh",
    background: C.bg,
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    color: C.text,
    maxWidth: 480,
    margin: "0 auto",
    position: "relative",
    paddingBottom: 80,
  };

  const headerStyle: React.CSSProperties = {
    background: C.primary,
    color: C.white,
    padding: "16px 20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    position: "sticky",
    top: 0,
    zIndex: 100,
  };

  const cardStyle: React.CSSProperties = {
    background: C.card,
    borderRadius: 12,
    border: `1px solid ${C.border}`,
    padding: 14,
    marginBottom: 10,
  };

  const btnPrimary: React.CSSProperties = {
    background: C.primary,
    color: C.white,
    border: "none",
    borderRadius: 10,
    padding: "12px 24px",
    fontWeight: 700,
    fontSize: 15,
    cursor: "pointer",
    width: "100%",
  };

  const btnOutline: React.CSSProperties = {
    background: "transparent",
    color: C.primary,
    border: `2px solid ${C.primary}`,
    borderRadius: 10,
    padding: "10px 20px",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
  };

  /* ─── Confirmation Screen ─── */
  if (step === "confirm") {
    return (
      <div style={pageStyle}>
        <div style={{ ...headerStyle, justifyContent: "center" }}>
          <span style={{ fontSize: 18, fontWeight: 700 }}>Sergio&apos;s Carnicer&iacute;a</span>
        </div>
        <div style={{ padding: 20, textAlign: "center" }}>
          <div style={{ fontSize: 60, marginBottom: 16 }}>✅</div>
          <h2 style={{ margin: "0 0 8px", fontSize: 22 }}>Pedido enviado</h2>
          <p style={{ color: C.muted, marginBottom: 20 }}>
            Tu pedido ha sido recibido y lo estamos preparando.
          </p>
          <div style={{ ...cardStyle, textAlign: "left" }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Resumen</div>
            <div style={{ fontSize: 14, color: C.muted, marginBottom: 4 }}>
              Pedido #{orderId?.slice(0, 8)}
            </div>
            <div style={{ fontSize: 14, marginBottom: 4 }}>
              {cart.length} producto{cart.length !== 1 ? "s" : ""}
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.primary }}>
              Total: ${fmt(cartTotal)}
            </div>
            <hr style={{ border: "none", borderTop: `1px solid ${C.border}`, margin: "12px 0" }} />
            <div style={{ fontSize: 14, color: C.muted }}>
              Entrega: {new Date(deliveryDateTime).toLocaleString("es-MX", {
                weekday: "short",
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
            <div style={{ fontSize: 14, color: C.muted }}>Pago: {PAYMENT_METHODS.find((m) => m.id === paymentMethod)?.label}</div>
          </div>
          <p style={{ fontSize: 13, color: C.muted, margin: "20px 0" }}>
            Te contactaremos al <b>{phone}</b> para confirmar tu pedido.
          </p>
          <button
            style={btnPrimary}
            onClick={() => {
              setCart([]);
              setStep("catalog");
              setName("");
              setPhone("");
              setAddress("");
              setNotes("");
              setOrderId(null);
            }}
          >
            Hacer otro pedido
          </button>
        </div>
      </div>
    );
  }

  /* ─── Checkout Screen ─── */
  if (step === "checkout") {
    return (
      <div style={pageStyle}>
        <div style={headerStyle}>
          <button
            onClick={() => setStep("cart")}
            style={{ background: "none", border: "none", color: C.white, fontSize: 20, cursor: "pointer" }}
          >
            ←
          </button>
          <span style={{ fontSize: 17, fontWeight: 700 }}>Finalizar pedido</span>
          <div style={{ width: 28 }} />
        </div>

        <div style={{ padding: 16 }}>
          {/* Order summary */}
          <div style={{ ...cardStyle, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Tu pedido ({cartCount} productos)</div>
            {cart.map((c) => (
              <div key={c.productId} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 4 }}>
                <span>{c.name} x {c.sale_type === "pieza" ? `${c.qty} pza` : `${c.qty} kg`}</span>
                <span style={{ fontWeight: 600 }}>${fmt(c.qty * c.price)}</span>
              </div>
            ))}
            <hr style={{ border: "none", borderTop: `1px solid ${C.border}`, margin: "10px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 17 }}>
              <span>Total</span>
              <span style={{ color: C.primary }}>${fmt(cartTotal)}</span>
            </div>
          </div>

          {/* Contact info */}
          <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 15 }}>Tus datos</div>
          <input
            placeholder="Nombre completo *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle}
          />
          <input
            placeholder="Teléfono (WhatsApp) *"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            type="tel"
            style={inputStyle}
          />
          <input
            placeholder="Dirección de entrega *"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            style={inputStyle}
          />
          <textarea
            placeholder="Notas (opcional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            style={{ ...inputStyle, resize: "vertical" }}
          />

          {/* Delivery time */}
          <div style={{ fontWeight: 700, margin: "16px 0 8px", fontSize: 15 }}>
            Fecha y hora de entrega
          </div>
          <input
            type="datetime-local"
            value={deliveryDateTime}
            min={toDateTimeLocal(minDeliveryTime())}
            onChange={(e) => setDeliveryDateTime(e.target.value)}
            style={inputStyle}
          />
          <div style={{ fontSize: 12, color: C.muted, marginTop: -6, marginBottom: 12 }}>
            Mínimo 1 hora a partir de ahora
          </div>

          {/* Payment method */}
          <div style={{ fontWeight: 700, margin: "8px 0 8px", fontSize: 15 }}>
            Método de pago
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m.id}
                onClick={() => setPaymentMethod(m.id)}
                style={{
                  flex: 1,
                  padding: "10px 6px",
                  borderRadius: 10,
                  border: paymentMethod === m.id ? `2px solid ${C.primary}` : `1px solid ${C.border}`,
                  background: paymentMethod === m.id ? C.primaryBg : C.card,
                  cursor: "pointer",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 22 }}>{m.icon}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{m.label}</div>
                <div style={{ fontSize: 10, color: C.muted }}>{m.desc}</div>
              </button>
            ))}
          </div>

          <button
            style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}
            onClick={submitOrder}
            disabled={saving}
          >
            {saving ? "Enviando..." : `Enviar pedido · $${fmt(cartTotal)}`}
          </button>
        </div>
      </div>
    );
  }

  /* ─── Cart Screen ─── */
  if (step === "cart") {
    return (
      <div style={pageStyle}>
        <div style={headerStyle}>
          <button
            onClick={() => setStep("catalog")}
            style={{ background: "none", border: "none", color: C.white, fontSize: 20, cursor: "pointer" }}
          >
            ←
          </button>
          <span style={{ fontSize: 17, fontWeight: 700 }}>Mi carrito ({cartCount})</span>
          <div style={{ width: 28 }} />
        </div>

        <div style={{ padding: 16 }}>
          {cart.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: C.muted }}>
              <div style={{ fontSize: 50, marginBottom: 12 }}>🛒</div>
              <div>Tu carrito está vacío</div>
              <button onClick={() => setStep("catalog")} style={{ ...btnOutline, marginTop: 16 }}>
                Ver productos
              </button>
            </div>
          ) : (
            <>
              {cart.map((c) => (
                <div key={c.productId} style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700 }}>{c.name}</div>
                    <div style={{ fontSize: 13, color: C.muted }}>
                      ${fmt(c.price)}/{c.sale_type === "pieza" ? "pza" : "kg"}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                      onClick={() => updateCartQty(c.productId, c.sale_type === "pieza" ? c.qty - 1 : c.qty - 0.25)}
                      style={qtyBtnStyle}
                    >
                      −
                    </button>
                    <span style={{ fontWeight: 700, minWidth: 36, textAlign: "center" }}>
                      {c.sale_type === "pieza" ? c.qty : c.qty.toFixed(2)}
                    </span>
                    <button
                      onClick={() => updateCartQty(c.productId, c.sale_type === "pieza" ? c.qty + 1 : c.qty + 0.25)}
                      style={qtyBtnStyle}
                    >
                      +
                    </button>
                  </div>
                  <div style={{ textAlign: "right", minWidth: 65 }}>
                    <div style={{ fontWeight: 800 }}>${fmt(c.qty * c.price)}</div>
                    <button
                      onClick={() => removeFromCart(c.productId)}
                      style={{ background: "none", border: "none", color: "#c00", fontSize: 12, cursor: "pointer" }}
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              ))}

              <div
                style={{
                  ...cardStyle,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontWeight: 800,
                  fontSize: 18,
                  marginTop: 8,
                }}
              >
                <span>Total</span>
                <span style={{ color: C.primary }}>${fmt(cartTotal)}</span>
              </div>

              <button style={{ ...btnPrimary, marginTop: 12 }} onClick={() => setStep("checkout")}>
                Continuar al pago
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  /* ─── Catalog Screen (default) ─── */
  return (
    <div style={pageStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>Sergio&apos;s Carnicer&iacute;a</div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Pide tus cortes frescos</div>
        </div>
        {cartCount > 0 && (
          <button
            onClick={() => setStep("cart")}
            style={{
              background: C.white,
              color: C.primary,
              border: "none",
              borderRadius: 20,
              padding: "8px 16px",
              fontWeight: 800,
              fontSize: 14,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            🛒 {cartCount} · ${fmt(cartTotal)}
          </button>
        )}
      </div>

      {/* Search */}
      <div style={{ padding: "12px 16px 0" }}>
        <input
          placeholder="Buscar producto..."
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          style={{
            width: "100%",
            padding: "10px 14px",
            borderRadius: 10,
            border: `1px solid ${C.border}`,
            fontSize: 15,
            outline: "none",
            background: C.card,
            boxSizing: "border-box",
          }}
        />
      </div>

      {/* Category pills */}
      <div
        style={{
          display: "flex",
          gap: 8,
          padding: "10px 16px",
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <button
          onClick={() => setSelectedCat(null)}
          style={{
            ...pillStyle,
            background: !selectedCat ? C.primary : C.card,
            color: !selectedCat ? C.white : C.text,
            border: !selectedCat ? "none" : `1px solid ${C.border}`,
          }}
        >
          Todos
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCat(cat === selectedCat ? null : cat)}
            style={{
              ...pillStyle,
              background: selectedCat === cat ? C.primary : C.card,
              color: selectedCat === cat ? C.white : C.text,
              border: selectedCat === cat ? "none" : `1px solid ${C.border}`,
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Products */}
      <div style={{ padding: "0 16px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: C.muted }}>Cargando productos...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: C.muted }}>No se encontraron productos</div>
        ) : (
          filtered.map((p) => {
            const saleType = p.sale_type === "pieza" ? "pieza" : "kg";
            const displayPrice = saleType === "pieza" && p.fixed_piece_price ? p.fixed_piece_price : p.price;
            const inCart = cart.find((c) => c.productId === p.id);
            const tempQty = qtyInputs[p.id] || "";

            return (
              <div
                key={p.id}
                style={{
                  ...cardStyle,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  border: inCart ? `2px solid ${C.primary}` : `1px solid ${C.border}`,
                }}
              >
                {/* Product emoji placeholder */}
                <div
                  style={{
                    width: 50,
                    height: 50,
                    borderRadius: 10,
                    background: C.primaryBg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 24,
                    flexShrink: 0,
                  }}
                >
                  {saleType === "pieza" ? "🥓" : "🥩"}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{p.name}</div>
                  <div style={{ fontSize: 13, color: C.muted }}>
                    {p.category || "Otros"}
                  </div>
                  <div style={{ fontWeight: 800, color: C.primary, fontSize: 15 }}>
                    ${fmt(displayPrice)}/{saleType === "pieza" ? "pza" : "kg"}
                  </div>
                </div>

                {/* Add to cart controls */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                  {saleType === "pieza" ? (
                    <button
                      onClick={() => addToCart(p, 1)}
                      style={{
                        background: C.primary,
                        color: C.white,
                        border: "none",
                        borderRadius: 8,
                        padding: "8px 14px",
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {inCart ? `+ Otra` : "Agregar"}
                    </button>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <input
                        type="number"
                        step="0.25"
                        min="0.25"
                        placeholder="Kg"
                        value={tempQty}
                        onChange={(e) => setQtyInputs((prev) => ({ ...prev, [p.id]: e.target.value }))}
                        style={{
                          width: 55,
                          padding: "6px 4px",
                          borderRadius: 8,
                          border: `1px solid ${C.border}`,
                          fontSize: 14,
                          textAlign: "center",
                          outline: "none",
                        }}
                      />
                      <button
                        onClick={() => addToCart(p, parseFloat(tempQty) || 0.5)}
                        style={{
                          background: C.primary,
                          color: C.white,
                          border: "none",
                          borderRadius: 8,
                          padding: "6px 10px",
                          fontWeight: 700,
                          fontSize: 13,
                          cursor: "pointer",
                        }}
                      >
                        +
                      </button>
                    </div>
                  )}
                  {inCart && (
                    <div style={{ fontSize: 11, color: C.success, fontWeight: 600 }}>
                      En carrito: {inCart.sale_type === "pieza" ? `${inCart.qty} pza` : `${inCart.qty} kg`}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Floating cart button */}
      {cartCount > 0 && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            padding: 16,
            background: "linear-gradient(transparent, rgba(247,241,232,0.95) 20%)",
            zIndex: 100,
            maxWidth: 480,
            margin: "0 auto",
          }}
        >
          <button style={btnPrimary} onClick={() => setStep("cart")}>
            Ver carrito · {cartCount} producto{cartCount !== 1 ? "s" : ""} · ${fmt(cartTotal)}
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Shared styles ─── */
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 14px",
  borderRadius: 10,
  border: `1px solid ${C.border}`,
  fontSize: 15,
  outline: "none",
  marginBottom: 10,
  background: "#fff",
  boxSizing: "border-box",
};

const pillStyle: React.CSSProperties = {
  padding: "7px 16px",
  borderRadius: 20,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  whiteSpace: "nowrap",
  flexShrink: 0,
};

const qtyBtnStyle: React.CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 8,
  border: `1px solid ${C.border}`,
  background: "#fff",
  fontSize: 16,
  fontWeight: 700,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
