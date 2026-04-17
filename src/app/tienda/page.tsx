"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
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
  image_url: string | null;
};

type CartItem = {
  productId: string;
  name: string;
  price: number;
  qty: number;
  sale_type: "kg" | "pieza";
};

type UserMode = "welcome" | "guest" | "registered";

/* ─── Visual config ─── */
const C = {
  bg: "#faf6f0",
  bgDark: "#1a0a06",
  card: "#ffffff",
  border: "rgba(123, 34, 24, 0.08)",
  text: "#2d1610",
  textLight: "#5a3a30",
  muted: "#8c6b60",
  primary: "#7b2218",
  primaryLight: "#a93222",
  primaryBg: "rgba(123, 34, 24, 0.06)",
  primaryBgStrong: "rgba(123, 34, 24, 0.12)",
  accent: "#d4a853",
  accentLight: "#f0ddb0",
  success: "#2d8a54",
  successBg: "#edf7f1",
  white: "#ffffff",
  gradient: "linear-gradient(135deg, #7b2218 0%, #a93222 50%, #c44530 100%)",
  gradientDark: "linear-gradient(135deg, #1a0a06 0%, #3b1510 50%, #5c180f 100%)",
  shadow: "0 2px 12px rgba(26, 10, 6, 0.08)",
  shadowLg: "0 8px 32px rgba(26, 10, 6, 0.12)",
};

const CATEGORY_ICONS: Record<string, string> = {
  Res: "🥩", Cerdo: "🐷", Pollo: "🍗", Complementos: "🛒",
  Marinados: "🌶️", Especiales: "⭐", Otros: "🔖",
};

/* ─── Helpers ─── */
const fmt = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const minDeliveryTime = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 70);
  const m = d.getMinutes();
  d.setMinutes(m + (15 - (m % 15)));
  d.setSeconds(0);
  return d;
};

const toDateTimeLocal = (d: Date) => {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

type Step = "catalog" | "cart" | "checkout" | "confirm";

/* ══════════════════════════════════════════════════════════════ */
export default function TiendaPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [step, setStep] = useState<Step>("catalog");
  const [searchQ, setSearchQ] = useState("");
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [qtyInputs, setQtyInputs] = useState<Record<string, string>>({});
  const [addedAnim, setAddedAnim] = useState<string | null>(null);

  // User mode: welcome / guest / registered
  const [userMode, setUserMode] = useState<UserMode>("welcome");

  // Checkout
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [deliveryDateTime, setDeliveryDateTime] = useState(toDateTimeLocal(minDeliveryTime()));
  const [saving, setSaving] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [payingMP, setPayingMP] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from("products")
        .select("id, name, price, category, sale_type, fixed_piece_price, is_active, image_url")
        .eq("is_active", true)
        .order("category")
        .order("name");
      setProducts(data || []);
      setLoading(false);
    })();
  }, []);

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

  const groupedProducts = useMemo(() => {
    const groups: Record<string, Product[]> = {};
    filtered.forEach((p) => {
      const cat = p.category || "Otros";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(p);
    });
    return groups;
  }, [filtered]);

  const cartTotal = useMemo(() => cart.reduce((s, c) => s + c.qty * c.price, 0), [cart]);
  const cartCount = cart.length;

  const addToCart = useCallback((p: Product, qty: number) => {
    if (qty <= 0) return;
    const saleType = p.sale_type === "pieza" ? "pieza" as const : "kg" as const;
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
    setQtyInputs((prev) => ({ ...prev, [p.id]: "" }));
    setAddedAnim(p.id);
    setTimeout(() => setAddedAnim(null), 600);
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setCart((prev) => prev.filter((c) => c.productId !== productId));
  }, []);

  const updateCartQty = useCallback((productId: string, qty: number) => {
    if (qty <= 0) { setCart((prev) => prev.filter((c) => c.productId !== productId)); return; }
    setCart((prev) => prev.map((c) => (c.productId === productId ? { ...c, qty } : c)));
  }, []);

  /* ─── Submit order (guest = Mercado Pago only) ─── */
  const submitOrder = async () => {
    if (!name.trim() || !phone.trim() || !address.trim()) {
      alert("Completa tu nombre, tel\u00e9fono y direcci\u00f3n");
      return;
    }
    if (cart.length === 0) return;
    const deliveryTime = new Date(deliveryDateTime);
    const minTime = new Date();
    minTime.setMinutes(minTime.getMinutes() + 55);
    if (deliveryTime < minTime) {
      alert("La hora de entrega debe ser al menos 1 hora a partir de ahora");
      return;
    }
    setSaving(true);
    const supabase = getSupabaseClient();

    // 1. Create order
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert([{
        customer_name: name.trim(),
        status: "nuevo",
        source: "app_cliente",
        notes: `Tel: ${phone.trim()} | ${notes.trim() || "Sin notas"}`,
        delivery_address: address.trim(),
        delivery_date: deliveryDateTime,
        delivery_status: "pendiente",
        payment_status: "pendiente",
        payment_method: userMode === "guest" ? "tarjeta_mp" : "tarjeta_mp",
      }])
      .select()
      .single();

    if (orderError || !order) {
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
    await supabase.from("order_items").insert(items);

    // 3. For guests → redirect to Mercado Pago
    if (userMode === "guest") {
      setPayingMP(true);
      try {
        const res = await fetch("/api/mp/create-preference", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order_id: order.id }),
        });
        const data = await res.json();
        if (data.init_point) {
          window.location.href = data.init_point;
          return;
        } else {
          // Fallback: show confirmation without MP
          setOrderId(order.id);
          setStep("confirm");
        }
      } catch {
        setOrderId(order.id);
        setStep("confirm");
      }
      setPayingMP(false);
    } else {
      // Registered users: just confirm (they have credit, etc.)
      setOrderId(order.id);
      setStep("confirm");
    }
    setSaving(false);
  };

  /* ════════════════════════════════════════════════════════════
     RENDER
     ════════════════════════════════════════════════════════════ */

  const Shell = ({ children, stickyHeader }: { children: React.ReactNode; stickyHeader?: React.ReactNode }) => (
    <div style={{
      minHeight: "100dvh",
      background: C.bg,
      fontFamily: "-apple-system, 'SF Pro Display', 'Segoe UI', system-ui, sans-serif",
      color: C.text,
      maxWidth: 520,
      margin: "0 auto",
      position: "relative",
      paddingBottom: cartCount > 0 && step === "catalog" ? 90 : 20,
      overflowX: "hidden",
    }}>
      {stickyHeader}
      {children}
    </div>
  );

  /* ─────── WELCOME SCREEN ─────── */
  if (userMode === "welcome") {
    return (
      <div style={{
        minHeight: "100dvh",
        background: C.gradientDark,
        fontFamily: "-apple-system, 'SF Pro Display', 'Segoe UI', system-ui, sans-serif",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "40px 24px",
        textAlign: "center",
        maxWidth: 520, margin: "0 auto",
      }}>
        {/* Logo */}
        <div style={{
          width: 100, height: 100, borderRadius: 24,
          overflow: "hidden", marginBottom: 24,
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
          border: "3px solid rgba(255,255,255,0.15)",
        }}>
          <img src="/logo.png" alt="Sergio's Carnicer\u00eda"
            style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>

        <h1 style={{
          color: C.white, fontSize: 28, fontWeight: 800,
          margin: "0 0 6px", letterSpacing: "-0.5px",
        }}>
          Sergio&apos;s Carnicer\u00eda
        </h1>
        <p style={{
          color: C.accentLight, fontSize: 15, margin: "0 0 40px",
          fontWeight: 500,
        }}>
          Cortes frescos directo a tu puerta
        </p>

        {/* Guest button */}
        <button
          onClick={() => setUserMode("guest")}
          style={{
            width: "100%", maxWidth: 320, padding: "16px 24px",
            borderRadius: 16, border: "none",
            background: C.gradient,
            color: C.white, fontWeight: 700, fontSize: 16,
            cursor: "pointer", marginBottom: 12,
            boxShadow: "0 4px 20px rgba(123, 34, 24, 0.4)",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          }}
        >
          <span style={{ fontSize: 20 }}>🛒</span>
          Pedir como invitado
        </button>
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginBottom: 28 }}>
          Pago seguro con Mercado Pago
        </div>

        {/* Registered button */}
        <button
          onClick={() => { window.location.href = "/cliente"; }}
          style={{
            width: "100%", maxWidth: 320, padding: "15px 24px",
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.2)",
            background: "rgba(255,255,255,0.08)",
            backdropFilter: "blur(8px)",
            color: C.white, fontWeight: 600, fontSize: 15,
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          }}
        >
          <span style={{ fontSize: 18 }}>👤</span>
          Ya tengo cuenta
        </button>
        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 8 }}>
          Accede a cr\u00e9dito y m\u00e1s opciones de pago
        </div>

        {/* Footer */}
        <div style={{
          marginTop: 50, color: "rgba(255,255,255,0.3)", fontSize: 12,
        }}>
          sergioscarniceria.com
        </div>
      </div>
    );
  }

  /* ─────── CONFIRMATION ─────── */
  if (step === "confirm") {
    return (
      <Shell>
        <div style={{ padding: "60px 24px 24px", textAlign: "center" }}>
          <div style={{
            width: 80, height: 80, borderRadius: "50%", background: C.successBg,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 40, margin: "0 auto 20px",
          }}>✅</div>
          <h2 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 800, letterSpacing: "-0.5px" }}>
            Pedido recibido
          </h2>
          <p style={{ color: C.muted, margin: "0 0 24px", fontSize: 15 }}>
            Lo estamos preparando. Te avisamos por WhatsApp.
          </p>
          <div style={{
            background: C.card, borderRadius: 16, padding: 20,
            boxShadow: C.shadow, textAlign: "left", marginBottom: 20,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <span style={{ fontSize: 13, color: C.muted }}>Pedido #{orderId?.slice(0, 8)}</span>
              <span style={{
                background: C.successBg, color: C.success,
                padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700,
              }}>Confirmado</span>
            </div>
            {cart.map((c) => (
              <div key={c.productId} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 6, color: C.textLight }}>
                <span>{c.name} &times; {c.sale_type === "pieza" ? `${c.qty} pza` : `${c.qty} kg`}</span>
                <span style={{ fontWeight: 600, color: C.text }}>${fmt(c.qty * c.price)}</span>
              </div>
            ))}
            <div style={{ borderTop: `1px solid ${C.border}`, margin: "12px 0", paddingTop: 12, display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 18, fontWeight: 800 }}>Total</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: C.primary }}>${fmt(cartTotal)}</span>
            </div>
            <div style={{ marginTop: 12, fontSize: 13, color: C.muted, display: "flex", flexDirection: "column", gap: 4 }}>
              <span>📅 {new Date(deliveryDateTime).toLocaleString("es-MX", {
                weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
              })}</span>
              <span>💳 Mercado Pago</span>
              <span>📱 {phone}</span>
            </div>
          </div>
          <button
            onClick={() => {
              setCart([]); setStep("catalog"); setName(""); setPhone("");
              setAddress(""); setNotes(""); setOrderId(null);
            }}
            style={{ ...btnPrimaryStyle, background: C.gradient }}
          >
            Hacer otro pedido
          </button>
        </div>
      </Shell>
    );
  }

  /* ─────── CHECKOUT ─────── */
  if (step === "checkout") {
    return (
      <Shell stickyHeader={
        <div style={navBarStyle}>
          <button onClick={() => setStep("cart")} style={backBtnStyle}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          <span style={{ fontSize: 17, fontWeight: 700 }}>Finalizar pedido</span>
          <div style={{ width: 36 }} />
        </div>
      }>
        <div style={{ padding: "16px 20px" }}>
          {/* Mini order summary */}
          <div style={{
            background: C.primaryBg, borderRadius: 14, padding: "14px 16px", marginBottom: 20,
            border: `1px solid ${C.border}`,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 14, color: C.textLight }}>{cartCount} producto{cartCount !== 1 ? "s" : ""}</span>
              <span style={{ fontSize: 20, fontWeight: 800, color: C.primary }}>${fmt(cartTotal)}</span>
            </div>
          </div>

          {/* Datos personales */}
          <SectionLabel icon="👤" text="Tus datos" />
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
            <StyledInput placeholder="Nombre completo *" value={name} onChange={setName} />
            <StyledInput placeholder="Tel\u00e9fono (WhatsApp) *" value={phone} onChange={setPhone} type="tel" />
            <StyledInput placeholder="Direcci\u00f3n de entrega *" value={address} onChange={setAddress} />
            <StyledInput placeholder="Notas especiales (opcional)" value={notes} onChange={setNotes} multiline />
          </div>

          {/* Entrega */}
          <SectionLabel icon="📅" text="Fecha y hora de entrega" />
          <input
            type="datetime-local"
            value={deliveryDateTime}
            min={toDateTimeLocal(minDeliveryTime())}
            onChange={(e) => setDeliveryDateTime(e.target.value)}
            style={{ ...inputBaseStyle, marginBottom: 4 }}
          />
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 20 }}>
            M\u00ednimo 1 hora a partir de ahora para preparar tu pedido
          </div>

          {/* Pago - Guest = solo Mercado Pago */}
          <SectionLabel icon="💳" text="M\u00e9todo de pago" />
          <div style={{
            background: C.card, borderRadius: 14, padding: "16px 18px",
            border: `2px solid ${C.primary}`, marginBottom: 24,
            display: "flex", alignItems: "center", gap: 14,
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: "#009ee3", display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ color: C.white, fontWeight: 800, fontSize: 16 }}>MP</span>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: C.text }}>Mercado Pago</div>
              <div style={{ fontSize: 13, color: C.muted }}>Tarjeta, d\u00e9bito o saldo MP</div>
            </div>
            <div style={{ marginLeft: "auto" }}>
              <div style={{
                width: 22, height: 22, borderRadius: "50%", background: C.primary,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
              </div>
            </div>
          </div>

          <button
            onClick={submitOrder}
            disabled={saving || payingMP}
            style={{
              ...btnPrimaryStyle,
              background: (saving || payingMP) ? C.muted : "#009ee3",
              opacity: (saving || payingMP) ? 0.7 : 1,
              boxShadow: "0 4px 20px rgba(0, 158, 227, 0.3)",
            }}
          >
            {payingMP ? "Conectando con Mercado Pago..." : saving ? "Creando pedido..." : `Pagar $${fmt(cartTotal)} con Mercado Pago`}
          </button>

          <div style={{ textAlign: "center", marginTop: 12 }}>
            <div style={{ fontSize: 12, color: C.muted, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
              Pago seguro procesado por Mercado Pago
            </div>
          </div>
        </div>
      </Shell>
    );
  }

  /* ─────── CART ─────── */
  if (step === "cart") {
    return (
      <Shell stickyHeader={
        <div style={navBarStyle}>
          <button onClick={() => setStep("catalog")} style={backBtnStyle}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          <span style={{ fontSize: 17, fontWeight: 700 }}>Mi carrito</span>
          <span style={{ fontSize: 14, color: C.muted, fontWeight: 600 }}>{cartCount} art.</span>
        </div>
      }>
        <div style={{ padding: "12px 20px" }}>
          {cart.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: C.muted }}>
              <div style={{ fontSize: 64, marginBottom: 16, opacity: 0.5 }}>🛒</div>
              <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 4, color: C.text }}>Carrito vac\u00edo</div>
              <div style={{ fontSize: 14, marginBottom: 20 }}>Agrega productos del cat\u00e1logo</div>
              <button onClick={() => setStep("catalog")} style={{
                ...btnPrimaryStyle, width: "auto", display: "inline-block", padding: "12px 32px",
              }}>
                Ver productos
              </button>
            </div>
          ) : (
            <>
              {cart.map((c) => (
                <div key={c.productId} style={{
                  background: C.card, borderRadius: 16, padding: 16, marginBottom: 10,
                  boxShadow: C.shadow, display: "flex", alignItems: "center", gap: 14,
                }}>
                  <div style={{
                    width: 46, height: 46, borderRadius: 12, background: C.primaryBg,
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0,
                  }}>
                    {c.sale_type === "pieza" ? "🥓" : "🥩"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{c.name}</div>
                    <div style={{ fontSize: 13, color: C.muted }}>${fmt(c.price)} / {c.sale_type === "pieza" ? "pza" : "kg"}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                    <div style={{ fontWeight: 800, fontSize: 16, color: C.primary }}>${fmt(c.qty * c.price)}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <button onClick={() => updateCartQty(c.productId, c.sale_type === "pieza" ? c.qty - 1 : c.qty - 0.25)} style={qtyBtnStyle}>−</button>
                      <span style={{ fontWeight: 700, minWidth: 32, textAlign: "center", fontSize: 14 }}>
                        {c.sale_type === "pieza" ? c.qty : c.qty.toFixed(2)}
                      </span>
                      <button onClick={() => updateCartQty(c.productId, c.sale_type === "pieza" ? c.qty + 1 : c.qty + 0.25)} style={qtyBtnStyle}>+</button>
                      <button onClick={() => removeFromCart(c.productId)} style={{
                        background: "rgba(180,35,24,0.08)", border: "none", borderRadius: 8,
                        width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center",
                        cursor: "pointer", marginLeft: 4,
                      }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#b42318" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              <div style={{
                background: C.card, borderRadius: 16, padding: "18px 20px", marginTop: 12,
                boxShadow: C.shadowLg, display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <div>
                  <div style={{ fontSize: 13, color: C.muted }}>Total estimado</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: C.primary, letterSpacing: "-1px" }}>
                    ${fmt(cartTotal)}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: C.muted, textAlign: "right", maxWidth: 140 }}>
                  *El peso final puede variar ligeramente
                </div>
              </div>

              <button onClick={() => setStep("checkout")} style={{
                ...btnPrimaryStyle, background: C.gradient, marginTop: 16,
              }}>
                Continuar al pago
              </button>
            </>
          )}
        </div>
      </Shell>
    );
  }

  /* ─────── CATALOG (default) ─────── */
  return (
    <Shell stickyHeader={
      <div style={{
        position: "sticky", top: 0, zIndex: 100,
        background: C.bg,
        borderBottom: `1px solid ${C.border}`,
      }}>
        {/* Top bar */}
        <div style={{
          background: C.gradientDark,
          padding: "12px 16px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src="/logo.png" alt="Logo"
              style={{ width: 36, height: 36, borderRadius: 10, objectFit: "cover" }} />
            <div>
              <div style={{ color: C.white, fontSize: 16, fontWeight: 800, letterSpacing: "-0.3px" }}>
                Sergio&apos;s Carnicer\u00eda
              </div>
              <div style={{ color: C.accentLight, fontSize: 11, fontWeight: 500 }}>
                Cortes frescos a tu puerta
              </div>
            </div>
          </div>
          {cartCount > 0 && (
            <button onClick={() => setStep("cart")} style={{
              background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.2)", borderRadius: 14,
              padding: "7px 12px", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6, color: C.white,
            }}>
              <span style={{ fontSize: 15 }}>🛒</span>
              <span style={{ fontWeight: 700, fontSize: 13 }}>{cartCount}</span>
              <span style={{
                background: C.accent, color: C.bgDark,
                borderRadius: 8, padding: "2px 7px", fontSize: 12, fontWeight: 800,
              }}>
                ${fmt(cartTotal)}
              </span>
            </button>
          )}
        </div>

        {/* Search */}
        <div style={{ padding: "10px 12px 6px" }}>
          <div style={{ position: "relative" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.muted}
              strokeWidth="2" strokeLinecap="round"
              style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}
            >
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              placeholder="Buscar cortes, productos..."
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              style={{
                width: "100%", padding: "10px 12px 10px 36px", borderRadius: 12,
                border: `1px solid ${C.border}`, fontSize: 14, outline: "none",
                background: C.card, boxSizing: "border-box",
                boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
              }}
            />
          </div>
        </div>

        {/* Category pills */}
        <div style={{
          display: "flex", gap: 6, padding: "4px 12px 8px",
          overflowX: "auto", WebkitOverflowScrolling: "touch",
        }}>
          <button onClick={() => setSelectedCat(null)} style={pillBtn(!selectedCat)}>
            Todos
          </button>
          {categories.map((cat) => (
            <button key={cat} onClick={() => setSelectedCat(cat === selectedCat ? null : cat)}
              style={pillBtn(selectedCat === cat)}>
              {CATEGORY_ICONS[cat] || "🔖"} {cat}
            </button>
          ))}
        </div>
      </div>
    }>
      <div style={{ padding: "8px 12px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{
              width: 48, height: 48, borderRadius: "50%",
              border: `3px solid ${C.border}`, borderTopColor: C.primary,
              animation: "spin 0.8s linear infinite",
              margin: "0 auto 16px",
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <div style={{ color: C.muted, fontSize: 15 }}>Cargando productos...</div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: C.muted }}>
            <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.4 }}>🔍</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: C.text }}>Sin resultados</div>
            <div style={{ fontSize: 14 }}>Intenta con otro t\u00e9rmino</div>
          </div>
        ) : (
          Object.entries(groupedProducts).map(([cat, prods]) => (
            <div key={cat} style={{ marginBottom: 16 }}>
              {!selectedCat && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 4px 6px" }}>
                  <span style={{ fontSize: 20 }}>{CATEGORY_ICONS[cat] || "🔖"}</span>
                  <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.3px" }}>{cat}</span>
                  <span style={{ fontSize: 12, color: C.muted }}>({prods.length})</span>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {prods.map((p) => {
                  const saleType = p.sale_type === "pieza" ? "pieza" : "kg";
                  const displayPrice = saleType === "pieza" && p.fixed_piece_price ? p.fixed_piece_price : p.price;
                  const inCart = cart.find((c) => c.productId === p.id);
                  const tempQty = qtyInputs[p.id] || "";
                  const justAdded = addedAnim === p.id;

                  return (
                    <div key={p.id} style={{
                      background: C.card, borderRadius: 14, overflow: "hidden",
                      boxShadow: inCart ? `0 0 0 2px ${C.primary}, ${C.shadow}` : C.shadow,
                      transition: "box-shadow 0.2s, transform 0.15s",
                      transform: justAdded ? "scale(0.97)" : "scale(1)",
                    }}>
                      {/* Visual top */}
                      <div style={{
                        background: p.image_url ? "#f5f0eb" : `linear-gradient(135deg, ${C.primaryBg} 0%, rgba(212,168,83,0.06) 100%)`,
                        padding: p.image_url ? "0" : "14px 10px 10px", textAlign: "center", position: "relative",
                        height: p.image_url ? 120 : "auto", overflow: "hidden",
                      }}>
                        {p.image_url ? (
                          <img src={p.image_url} alt={p.name} style={{
                            width: "100%", height: 120, objectFit: "cover", display: "block",
                          }} />
                        ) : (
                          <div style={{ fontSize: 34 }}>{saleType === "pieza" ? "🥓" : "🥩"}</div>
                        )}
                        <div style={{
                          position: "absolute", top: 6, right: 6,
                          background: saleType === "pieza" ? C.accentLight : "rgba(255,255,255,0.85)",
                          color: C.textLight, fontSize: 9, fontWeight: 700,
                          padding: "2px 6px", borderRadius: 5,
                          textTransform: "uppercase", letterSpacing: "0.5px",
                        }}>
                          {saleType === "pieza" ? "pieza" : "x kg"}
                        </div>
                        {inCart && (
                          <div style={{
                            position: "absolute", top: 6, left: 6,
                            background: C.success, color: C.white,
                            fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 5,
                          }}>
                            {inCart.sale_type === "pieza" ? `${inCart.qty} pza` : `${inCart.qty} kg`}
                          </div>
                        )}
                      </div>

                      <div style={{ padding: "8px 10px 12px" }}>
                        <div style={{
                          fontWeight: 700, fontSize: 13, lineHeight: 1.2, marginBottom: 3,
                          minHeight: 32, display: "-webkit-box", WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical", overflow: "hidden",
                        }}>
                          {p.name}
                        </div>
                        <div style={{
                          fontWeight: 800, fontSize: 17, color: C.primary, marginBottom: 8,
                          letterSpacing: "-0.5px",
                        }}>
                          ${fmt(displayPrice)}
                          <span style={{ fontSize: 11, fontWeight: 500, color: C.muted }}>
                            /{saleType === "pieza" ? "pza" : "kg"}
                          </span>
                        </div>

                        {saleType === "pieza" ? (
                          <button onClick={() => addToCart(p, 1)} style={{
                            width: "100%", padding: "8px 0", borderRadius: 10, border: "none",
                            background: inCart ? C.primaryBgStrong : C.gradient,
                            color: inCart ? C.primary : C.white,
                            fontWeight: 700, fontSize: 12, cursor: "pointer",
                          }}>
                            {inCart ? "+ Agregar otra" : "Agregar"}
                          </button>
                        ) : (
                          <div style={{ display: "flex", gap: 4 }}>
                            <input
                              type="number" step="0.25" min="0.25" placeholder="Kg"
                              value={tempQty}
                              onChange={(e) => setQtyInputs((prev) => ({ ...prev, [p.id]: e.target.value }))}
                              style={{
                                flex: 1, padding: "7px 4px", borderRadius: 8,
                                border: `1px solid ${C.border}`, fontSize: 13,
                                textAlign: "center", outline: "none", minWidth: 0,
                              }}
                            />
                            <button onClick={() => addToCart(p, parseFloat(tempQty) || 0.5)} style={{
                              padding: "7px 12px", borderRadius: 8, border: "none",
                              background: C.gradient, color: C.white,
                              fontWeight: 700, fontSize: 12, cursor: "pointer", flexShrink: 0,
                            }}>
                              +
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Floating cart bar */}
      {cartCount > 0 && (
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          padding: "12px 12px", paddingBottom: "max(12px, env(safe-area-inset-bottom))",
          background: "linear-gradient(transparent 0%, rgba(250,246,240,0.92) 25%)",
          backdropFilter: "blur(8px)",
          zIndex: 100, maxWidth: 520, margin: "0 auto",
        }}>
          <button onClick={() => setStep("cart")} style={{
            width: "100%", padding: "13px 18px", borderRadius: 14,
            border: "none", background: C.gradient, color: C.white,
            fontWeight: 700, fontSize: 14, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            boxShadow: "0 4px 20px rgba(123, 34, 24, 0.3)",
          }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              🛒 Ver carrito
              <span style={{
                background: "rgba(255,255,255,0.25)", borderRadius: 8,
                padding: "2px 7px", fontSize: 12,
              }}>{cartCount}</span>
            </span>
            <span style={{ fontSize: 15, fontWeight: 800 }}>${fmt(cartTotal)}</span>
          </button>
        </div>
      )}
    </Shell>
  );
}

/* ════════════════════════════════════════════════════════════
   SUBCOMPONENTS & STYLES
   ════════════════════════════════════════════════════════════ */

function SectionLabel({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      marginBottom: 10, fontSize: 15, fontWeight: 700, color: "#2d1610",
    }}>
      <span style={{ fontSize: 18 }}>{icon}</span> {text}
    </div>
  );
}

const inputBaseStyle: React.CSSProperties = {
  width: "100%", padding: "13px 16px", borderRadius: 12,
  border: "1px solid rgba(123, 34, 24, 0.1)", fontSize: 15,
  outline: "none", background: "#fff", boxSizing: "border-box",
};

function StyledInput({ placeholder, value, onChange, type, multiline }: {
  placeholder: string; value: string; onChange: (v: string) => void;
  type?: string; multiline?: boolean;
}) {
  const Tag = multiline ? "textarea" : "input";
  return (
    <Tag placeholder={placeholder} value={value}
      onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value)}
      type={type} rows={multiline ? 2 : undefined}
      style={{ ...inputBaseStyle, resize: multiline ? "vertical" : undefined }}
    />
  );
}

const pillBtn = (active: boolean): React.CSSProperties => ({
  padding: "7px 14px", borderRadius: 12, fontSize: 12, fontWeight: 600,
  cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
  border: active ? "none" : "1px solid rgba(123, 34, 24, 0.1)",
  background: active ? "linear-gradient(135deg, #7b2218 0%, #a93222 100%)" : "#ffffff",
  color: active ? "#ffffff" : "#2d1610",
  boxShadow: active ? "0 2px 8px rgba(123,34,24,0.2)" : "0 1px 3px rgba(0,0,0,0.04)",
});

const btnPrimaryStyle: React.CSSProperties = {
  width: "100%", padding: "15px 24px", borderRadius: 14, border: "none",
  background: "linear-gradient(135deg, #7b2218 0%, #a93222 50%, #c44530 100%)",
  color: "#ffffff", fontWeight: 700, fontSize: 16, cursor: "pointer",
  boxShadow: "0 4px 16px rgba(123, 34, 24, 0.25)", letterSpacing: "-0.3px",
};

const navBarStyle: React.CSSProperties = {
  position: "sticky", top: 0, zIndex: 100,
  background: "rgba(250, 246, 240, 0.92)", backdropFilter: "blur(12px)",
  padding: "12px 16px", display: "flex", alignItems: "center",
  justifyContent: "space-between", borderBottom: "1px solid rgba(123, 34, 24, 0.08)",
};

const backBtnStyle: React.CSSProperties = {
  background: "rgba(123, 34, 24, 0.06)", border: "none", borderRadius: 10,
  width: 36, height: 36, display: "flex", alignItems: "center",
  justifyContent: "center", cursor: "pointer", color: "#2d1610",
};

const qtyBtnStyle: React.CSSProperties = {
  width: 30, height: 30, borderRadius: 8,
  border: "1px solid rgba(123, 34, 24, 0.1)", background: "#fff",
  fontSize: 16, fontWeight: 700, cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center", color: "#2d1610",
};
