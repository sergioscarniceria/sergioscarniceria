"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";

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

type OrderItem = {
  id: string;
  product: string;
  kilos: number;
  price: number;
};

type Order = {
  id: string;
  customer_name: string;
  status: string;
  notes?: string | null;
  loyalty_points_earned?: number;
  created_at?: string;
  delivery_date?: string | null;
  order_items?: OrderItem[];
};

type CustomerProfile = {
  id: string;
  customer_id: string | null;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  customer_type?: string | null;
};

type CxcNote = {
  id: string;
  customer_id: string;
  customer_name: string;
  note_number?: string | null;
  note_date: string;
  due_date?: string | null;
  source_type: string;
  subtotal: number;
  discount_amount: number;
  total_amount: number;
  balance_due: number;
  status: string;
  notes?: string | null;
  created_at?: string | null;
};

type CxcPayment = {
  id: string;
  customer_id: string;
  customer_name: string;
  payment_date: string;
  amount: number;
  payment_method?: string | null;
  reference?: string | null;
  notes?: string | null;
  created_at?: string | null;
};

const COLORS = {
  bg: "#f7f1e8",
  bgSoft: "#fbf8f3",
  card: "rgba(255,255,255,0.88)",
  cardStrong: "rgba(255,255,255,0.95)",
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

function normalizeDateOnly(value?: string | null) {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

function formatCxcDate(value?: string | null) {
  const normalized = normalizeDateOnly(value);
  if (!normalized) return "Sin fecha";
  const date = new Date(`${normalized}T12:00:00`);
  if (isNaN(date.getTime())) return normalized;
  return date.toLocaleDateString();
}

function todayDateOnly() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isOverdue(note: CxcNote) {
  if (Number(note.balance_due || 0) <= 0) return false;
  const due = normalizeDateOnly(note.due_date || note.note_date);
  if (!due) return false;
  return due < todayDateOnly();
}

export default function ClientePage() {
  const supabase = getSupabaseClient();

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showCart, setShowCart] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const [mode, setMode] = useState<"login" | "register">("login");

  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [points, setPoints] = useState(0);
  const [notes, setNotes] = useState("");
  const [address, setAddress] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(getTodayDateInput());
  const [search, setSearch] = useState("");
  const [customerType, setCustomerType] = useState("menudeo");
  const [showCatalog, setShowCatalog] = useState(false);

  const [cxcNotes, setCxcNotes] = useState<CxcNote[]>([]);
  const [cxcPayments, setCxcPayments] = useState<CxcPayment[]>([]);
  const [creditEnabled, setCreditEnabled] = useState(false);
  const [creditLimit, setCreditLimit] = useState(0);
  const [creditDays, setCreditDays] = useState(0);

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    function handleResize() {
      const mobile = window.innerWidth < 960;
      setIsMobile(mobile);
      if (!mobile) setShowCart(false);
    }

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  function getPrice(product: Product) {
    const basePrice = Number(product.price || 0);

    if (customerType === "mayoreo" && !product.is_excluded_from_discount) {
      return Number((basePrice * 0.9).toFixed(2));
    }

    return basePrice;
  }

  async function checkUser() {
    setLoading(true);

    const { data, error } = await supabase.auth.getUser();

    if (error) {
      console.log(error);
      setLoading(false);
      return;
    }

    setUser(data.user);

    if (data.user) {
      await loadData(data.user.id);
    } else {
      await loadProducts();
    }

    setLoading(false);
  }

  async function loadProducts() {
    const { data } = await supabase
      .from("products")
      .select("*")
      .eq("is_active", true)
      .order("name", { ascending: true });

    setProducts((data as Product[]) || []);
  }

  async function loadData(userId: string) {
    const { data: profile } = await supabase
      .from("customer_profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    const customerProfile = profile as CustomerProfile | null;

    if (customerProfile?.customer_id) {
      setCustomerType(customerProfile.customer_type || "menudeo");

      const { data: customerData } = await supabase
        .from("customers")
        .select("address, credit_enabled, credit_limit, credit_days")
        .eq("id", customerProfile.customer_id)
        .maybeSingle();

      setAddress(customerData?.address || "");
      setCreditEnabled(Boolean(customerData?.credit_enabled));
      setCreditLimit(Number(customerData?.credit_limit || 0));
      setCreditDays(Number(customerData?.credit_days || 0));

      const { data: loyalty } = await supabase
        .from("loyalty_accounts")
        .select("*")
        .eq("customer_id", customerProfile.customer_id)
        .maybeSingle();

      setPoints(Number(loyalty?.points_balance || 0));

      const { data: ordersData } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("customer_id", customerProfile.customer_id)
        .order("created_at", { ascending: false });

      setOrders((ordersData as Order[]) || []);

      const { data: notesData } = await supabase
        .from("cxc_notes")
        .select("*")
        .eq("customer_id", customerProfile.customer_id)
        .order("note_date", { ascending: false })
        .order("created_at", { ascending: false });

      setCxcNotes((notesData as CxcNote[]) || []);

      const { data: paymentsData } = await supabase
        .from("cxc_payments")
        .select("*")
        .eq("customer_id", customerProfile.customer_id)
        .order("payment_date", { ascending: false })
        .order("created_at", { ascending: false });

      setCxcPayments((paymentsData as CxcPayment[]) || []);
    } else {
      setPoints(0);
      setOrders([]);
      setCustomerType("menudeo");
      setCxcNotes([]);
      setCxcPayments([]);
      setCreditEnabled(false);
      setCreditLimit(0);
      setCreditDays(0);
    }

    await loadProducts();
  }

  async function register() {
    if (!name || !phone || !email || !password) {
      alert("Llena todos los campos");
      return;
    }

    setSaving(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      console.log(error);
      alert("Error al registrar");
      setSaving(false);
      return;
    }

    const createdUser = data.user;
    if (!createdUser) {
      alert("No se creó el usuario");
      setSaving(false);
      return;
    }

    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .insert([
        {
          name,
          phone,
          business_name: name,
          customer_type: "menudeo",
          email,
          address: "",
        },
      ])
      .select()
      .single();

    if (customerError || !customer) {
      console.log(customerError);
      alert("Se creó el usuario, pero falló el cliente");
      setSaving(false);
      return;
    }

    const { error: profileError } = await supabase.from("customer_profiles").upsert([
      {
        id: createdUser.id,
        customer_id: customer.id,
        full_name: name,
        phone,
        email,
        customer_type: "menudeo",
        role: "customer",
      },
    ]);

    if (profileError) {
      console.log(profileError);
      alert("Se creó el usuario, pero falló el perfil");
      setSaving(false);
      return;
    }

    await supabase.from("loyalty_accounts").upsert([{ customer_id: customer.id }]);

    alert("Cuenta creada. Ahora inicia sesión.");

    setName("");
    setPhone("");
    setEmail("");
    setPassword("");
    setMode("login");
    setSaving(false);
  }

  async function login() {
    if (!email || !password) {
      alert("Escribe correo y contraseña");
      return;
    }

    setSaving(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.log(error);
      alert("Error al iniciar sesión");
      setSaving(false);
      return;
    }

    await checkUser();
    setSaving(false);
  }

  async function logout() {
    await supabase.auth.signOut();
    setUser(null);
    setCart([]);
    setOrders([]);
    setPoints(0);
    setNotes("");
    setAddress("");
    setDeliveryDate(getTodayDateInput());
    setSearch("");
    setCustomerType("menudeo");
    setShowCatalog(false);
    setCxcNotes([]);
    setCxcPayments([]);
    setCreditEnabled(false);
    setCreditLimit(0);
    setCreditDays(0);
  }

  async function saveAddress() {
    if (!user) return;

    const { data: profile } = await supabase
      .from("customer_profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.customer_id) {
      alert("No encontramos tu perfil");
      return;
    }

    const { error } = await supabase
      .from("customers")
      .update({ address: address })
      .eq("id", profile.customer_id);

    if (error) {
      console.log(error);
      alert("No se pudo guardar la dirección");
      return;
    }

    alert("Dirección guardada");
  }

  function addProduct(product: Product, mode: "kg" | "half" | "money" | "custom") {
    let kilos = 1;
    const price = getPrice(product);

    if (mode === "half") kilos = 0.5;

    if (mode === "custom") {
      const kilosText = prompt(`¿Cuántos kilos de ${product.name}? (ej: 3.2)`);
      if (!kilosText) return;

      const parsed = Number(kilosText.replace(",", "."));
      if (!parsed || parsed <= 0) {
        alert("Escribe una cantidad válida (ej: 3.2)");
        return;
      }

      kilos = Number(parsed.toFixed(3));
    }

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
    setCart(cart.filter((_, i) => i !== index));
  }

  function cartTotal() {
    return cart.reduce((acc, item) => {
      return acc + Number(item.price || 0) * Number(item.kilos || 0);
    }, 0);
  }

  function repeatOrder(order: Order) {
    const previousItems =
      (order.order_items || []).map((item) => ({
        name: item.product,
        kilos: Number(item.kilos || 0),
        price: Number(item.price || 0),
      })) || [];

    if (previousItems.length === 0) {
      alert("Ese pedido no tiene artículos");
      return;
    }

    setCart(previousItems);
    setNotes(order.notes || "");
    setDeliveryDate(order.delivery_date || getTodayDateInput());
    setShowCart(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
    alert("Pedido cargado otra vez en tu pedido");
  }

  async function createOrder() {
    if (!user) {
      alert("Debes iniciar sesión");
      return;
    }

    if (cart.length === 0) {
      alert("Agrega productos");
      return;
    }

    if (!address.trim()) {
      alert("Agrega tu dirección antes de enviar el pedido");
      return;
    }

    if (!deliveryDate) {
      alert("Selecciona la fecha de entrega");
      return;
    }

    setSaving(true);

    const { data: profile, error: profileError } = await supabase
      .from("customer_profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile?.customer_id) {
      console.log(profileError);
      alert("No encontramos tu perfil");
      setSaving(false);
      return;
    }

    const { error: addressError } = await supabase
      .from("customers")
      .update({ address: address })
      .eq("id", profile.customer_id);

    if (addressError) {
      console.log(addressError);
      alert("No se pudo guardar la dirección");
      setSaving(false);
      return;
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert([
        {
          customer_id: profile.customer_id,
          customer_profile_id: user.id,
          customer_name: profile.full_name || email,
          status: "nuevo",
          source: "cliente",
          notes,
          delivery_address: address,
          delivery_date: deliveryDate,
          delivery_status: "pendiente",
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

    const items = cart.map((p) => ({
      order_id: order.id,
      product: p.name,
      kilos: p.kilos,
      price: p.price,
    }));

    const { error: itemsError } = await supabase.from("order_items").insert(items);

    if (itemsError) {
      console.log(itemsError);
      alert("Se creó el pedido, pero fallaron los artículos");
      setSaving(false);
      return;
    }

    alert("Pedido enviado");

    setCart([]);
    setNotes("");
    setShowCart(false);
    setDeliveryDate(getTodayDateInput());
    await loadData(user.id);
    setSaving(false);
  }

  const filteredProducts = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return [];
    return products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 12);
  }, [search, products]);

  const catalogProducts = useMemo(() => {
    if (!showCatalog) return [];
    return products;
  }, [showCatalog, products]);

  const totalDebt = useMemo(() => {
    return cxcNotes.reduce((acc, note) => acc + Number(note.balance_due || 0), 0);
  }, [cxcNotes]);

  const openNotes = useMemo(() => {
    return cxcNotes.filter((note) => Number(note.balance_due || 0) > 0);
  }, [cxcNotes]);

  const overdueNotes = useMemo(() => {
    return openNotes.filter((note) => isOverdue(note));
  }, [openNotes]);

  const paidNotes = useMemo(() => {
    return cxcNotes.filter((note) => Number(note.balance_due || 0) <= 0 || note.status === "pagada");
  }, [cxcNotes]);

  if (loading) {
    return (
      <div style={loadingPageStyle}>
        <div style={loadingCardStyle}>Cargando...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={authPageStyle}>
        <div style={authGlow1} />
        <div style={authGlow2} />

        <div style={{ width: "100%", maxWidth: 520, position: "relative", zIndex: 2 }}>
          <div style={{ marginBottom: 18 }}>
            <Link href="/" style={backButton}>
              ← Volver
            </Link>
          </div>

          <div style={authCardStyle}>
            <div style={{ textAlign: "center", marginBottom: 22 }}>
              <img
                src="/logo.png"
                alt="Sergios Carnicería"
                style={{
                  width: 170,
                  maxWidth: "100%",
                  height: "auto",
                  display: "block",
                  margin: "0 auto 14px auto",
                }}
              />
              <h1 style={{ margin: 0, color: COLORS.text }}>Portal cliente</h1>
              <p style={{ color: COLORS.muted, marginTop: 8 }}>
                Haz tus pedidos de forma rápida y clara
              </p>
            </div>

            <div style={{ marginBottom: 18, display: "flex", gap: 10 }}>
              <button
                onClick={() => setMode("login")}
                style={{
                  ...switchButtonStyle,
                  background: mode === "login" ? COLORS.primary : "#efe8df",
                  color: mode === "login" ? "white" : COLORS.text,
                }}
              >
                Login
              </button>
              <button
                onClick={() => setMode("register")}
                style={{
                  ...switchButtonStyle,
                  background: mode === "register" ? COLORS.primary : "#efe8df",
                  color: mode === "register" ? "white" : COLORS.text,
                }}
              >
                Registro
              </button>
            </div>

            {mode === "login" ? (
              <>
                <input
                  placeholder="Correo"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={inputStyle}
                />
                <input
                  placeholder="Contraseña"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={inputStyle}
                />
                <button onClick={login} style={{ ...primaryButtonStyle, width: "100%" }}>
                  {saving ? "Entrando..." : "Entrar"}
                </button>
              </>
            ) : (
              <>
                <input
                  placeholder="Nombre"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={inputStyle}
                />
                <input
                  placeholder="Teléfono"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  style={inputStyle}
                />
                <input
                  placeholder="Correo"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={inputStyle}
                />
                <input
                  placeholder="Contraseña"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={inputStyle}
                />
                <button onClick={register} style={{ ...primaryButtonStyle, width: "100%" }}>
                  {saving ? "Creando..." : "Crear cuenta"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={glowTopLeft} />
      <div style={glowTopRight} />

      <div style={shellStyle}>
        <div style={topBarStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <img
              src="/logo.png"
              alt="Sergios Carnicería"
              style={{
                width: isMobile ? 72 : 96,
                height: "auto",
                display: "block",
              }}
            />

            <div>
              <h1 style={{ margin: 0, color: COLORS.text, fontSize: isMobile ? 28 : 34 }}>
                Portal cliente
              </h1>
              <p style={{ color: COLORS.muted, margin: "6px 0 0 0" }}>
                Pedido rápido y claro
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/" style={secondaryButtonStyle}>
              Inicio
            </Link>
            <button onClick={logout} style={primaryButtonStyle}>
              Cerrar sesión
            </button>
          </div>
        </div>

        <div style={heroGridStyle}>
          <div style={heroCardStyle}>
            <div style={smallLabelStyle}>Puntos acumulados</div>
            <div style={heroValueStyle}>{points}</div>
            <div style={heroMetaStyle}>
              Tipo de cliente: <b>{customerType}</b>
            </div>
          </div>

          <div style={heroCardStyle}>
            <div style={smallLabelStyle}>Resumen del pedido</div>
            <div style={heroValueStyle}>${cartTotal().toFixed(2)}</div>
            <div style={heroMetaStyle}>
              {cart.length} artículo{cart.length === 1 ? "" : "s"}
            </div>
          </div>

          <div style={heroCardStyle}>
            <div style={smallLabelStyle}>Adeudo pendiente</div>
            <div style={heroValueStyle}>${totalDebt.toFixed(2)}</div>
            <div style={heroMetaStyle}>
              {openNotes.length} nota{openNotes.length === 1 ? "" : "s"} abierta{openNotes.length === 1 ? "" : "s"}
            </div>
          </div>

          <div style={heroCardStyle}>
            <div style={smallLabelStyle}>Crédito</div>
            <div style={heroValueStyle}>{creditEnabled ? "Activo" : "No"}</div>
            <div style={heroMetaStyle}>
              Límite: <b>${creditLimit.toFixed(2)}</b> · {creditDays || 0} días
            </div>
          </div>
        </div>

        {creditEnabled || cxcNotes.length > 0 || cxcPayments.length > 0 ? (
          <div style={panelStyle}>
            <div style={panelHeaderStyle}>
              <div>
                <h2 style={panelTitleStyle}>Mi estado de cuenta</h2>
                <p style={panelSubtitleStyle}>
                  Solo consulta. Aquí puedes ver tus adeudos, notas y pagos.
                </p>
              </div>
            </div>

            <div style={accountSummaryGridStyle}>
              <div style={accountSummaryCardStyle}>
                <div style={smallLabelStyle}>Saldo pendiente</div>
                <div style={accountValueStyle}>${totalDebt.toFixed(2)}</div>
              </div>

              <div style={accountSummaryCardStyle}>
                <div style={smallLabelStyle}>Notas abiertas</div>
                <div style={accountValueStyle}>{openNotes.length}</div>
              </div>

              <div style={accountSummaryCardStyle}>
                <div style={smallLabelStyle}>Vencidas</div>
                <div style={accountValueStyle}>{overdueNotes.length}</div>
              </div>

              <div style={accountSummaryCardStyle}>
                <div style={smallLabelStyle}>Pagos registrados</div>
                <div style={accountValueStyle}>{cxcPayments.length}</div>
              </div>
            </div>

            <div style={accountGridStyle}>
              <div style={subPanelStyle}>
                <div style={subPanelTitleStyle}>Notas abiertas</div>

                {openNotes.length === 0 ? (
                  <div style={emptyBoxStyle}>No tienes notas abiertas</div>
                ) : (
                  openNotes.map((note) => (
                    <div key={note.id} style={accountCardStyle}>
                      <div style={accountCardHeaderStyle}>
                        <div style={{ minWidth: 0 }}>
                          <div style={accountCardTitleStyle}>
                            {note.note_number || "Sin folio"}
                          </div>
                          <div style={accountMetaStyle}>
                            Fecha: <b>{formatCxcDate(note.note_date)}</b>
                          </div>
                          <div style={accountMetaStyle}>
                            Vence: <b>{formatCxcDate(note.due_date || note.note_date)}</b>
                          </div>
                        </div>

                        <div
                          style={{
                            ...accountBadgeStyle,
                            background: isOverdue(note)
                              ? "rgba(180,35,24,0.10)"
                              : "rgba(166,106,16,0.12)",
                            color: isOverdue(note) ? COLORS.danger : COLORS.warning,
                          }}
                        >
                          {isOverdue(note) ? "Vencida" : note.status}
                        </div>
                      </div>

                      <div style={accountMetaWrapStyle}>
                        <span style={metaPillStyle}>
                          Total: <b>${Number(note.total_amount || 0).toFixed(2)}</b>
                        </span>
                        <span style={metaPillStyle}>
                          Saldo: <b>${Number(note.balance_due || 0).toFixed(2)}</b>
                        </span>
                        <span style={metaPillStyle}>
                          Origen: <b>{note.source_type || "manual"}</b>
                        </span>
                      </div>

                      {Number(note.discount_amount || 0) > 0 ? (
                        <div style={accountMetaStyle}>
                          Descuento: <b>${Number(note.discount_amount || 0).toFixed(2)}</b>
                        </div>
                      ) : null}

                      {note.notes ? (
                        <div style={accountNotesStyle}>
                          <b>Notas:</b> {note.notes}
                        </div>
                      ) : null}
                    </div>
                  ))
                )}
              </div>

              <div style={subPanelStyle}>
                <div style={subPanelTitleStyle}>Pagos realizados</div>

                {cxcPayments.length === 0 ? (
                  <div style={emptyBoxStyle}>Todavía no tienes pagos registrados</div>
                ) : (
                  cxcPayments.map((payment) => (
                    <div key={payment.id} style={accountCardStyle}>
                      <div style={accountCardHeaderStyle}>
                        <div style={{ minWidth: 0 }}>
                          <div style={accountCardTitleStyle}>
                            Pago del {formatCxcDate(payment.payment_date)}
                          </div>
                          <div style={accountMetaStyle}>
                            Método: <b>{payment.payment_method || "No definido"}</b>
                          </div>
                        </div>

                        <div
                          style={{
                            ...accountBadgeStyle,
                            background: "rgba(31,122,77,0.12)",
                            color: COLORS.success,
                          }}
                        >
                          ${Number(payment.amount || 0).toFixed(2)}
                        </div>
                      </div>

                      {payment.reference ? (
                        <div style={accountMetaStyle}>
                          Referencia: <b>{payment.reference}</b>
                        </div>
                      ) : null}

                      {payment.notes ? (
                        <div style={accountNotesStyle}>
                          <b>Notas:</b> {payment.notes}
                        </div>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </div>

            {paidNotes.length > 0 ? (
              <div style={{ marginTop: 20 }}>
                <div style={subPanelTitleStyle}>Notas pagadas</div>

                <div style={paidNotesGridStyle}>
                  {paidNotes.map((note) => (
                    <div key={note.id} style={paidNoteCardStyle}>
                      <div style={accountCardHeaderStyle}>
                        <div style={{ minWidth: 0 }}>
                          <div style={accountCardTitleStyle}>
                            {note.note_number || "Sin folio"}
                          </div>
                          <div style={accountMetaStyle}>
                            Fecha: <b>{formatCxcDate(note.note_date)}</b>
                          </div>
                        </div>

                        <div
                          style={{
                            ...accountBadgeStyle,
                            background: "rgba(31,122,77,0.12)",
                            color: COLORS.success,
                          }}
                        >
                          Pagada
                        </div>
                      </div>

                      <div style={accountMetaWrapStyle}>
                        <span style={metaPillStyle}>
                          Total: <b>${Number(note.total_amount || 0).toFixed(2)}</b>
                        </span>
                        <span style={metaPillStyle}>
                          Saldo: <b>${Number(note.balance_due || 0).toFixed(2)}</b>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <div style={panelStyle}>
          <div style={panelHeaderStyle}>
            <div>
              <h2 style={panelTitleStyle}>Dirección de entrega</h2>
              <p style={panelSubtitleStyle}>Esta dirección se guardará en tu pedido</p>
            </div>
          </div>

          <textarea
            placeholder="Escribe calle, número, colonia, referencias..."
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            style={{ ...textareaStyle, minHeight: 100 }}
          />

          <button onClick={saveAddress} style={primaryButtonStyle}>
            Guardar dirección
          </button>
        </div>

        <div style={{ ...panelStyle, marginTop: 20 }}>
          <div style={panelHeaderStyle}>
            <div>
              <h2 style={panelTitleStyle}>Fecha de entrega</h2>
              <p style={panelSubtitleStyle}>Selecciona cuándo quieres recibir tu pedido</p>
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

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1.15fr) minmax(360px, 0.85fr)",
            gap: 20,
            alignItems: "start",
            marginTop: 20,
          }}
        >
          <div style={panelStyle}>
            <div style={panelHeaderStyle}>
              <div>
                <h2 style={panelTitleStyle}>Productos</h2>
                <p style={panelSubtitleStyle}>
                  Busca uno específico o abre el catálogo completo
                </p>
              </div>
            </div>

            <div style={searchHeaderWrapStyle}>
              <input
                placeholder="Buscar producto"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ ...inputStyle, marginBottom: 0 }}
              />

              <button
                onClick={() => setShowCatalog((prev) => !prev)}
                style={catalogToggleButtonStyle}
              >
                {showCatalog ? "Ocultar catálogo" : "Ver catálogo"}
              </button>
            </div>

            {search.trim() ? (
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
                          <button onClick={() => addProduct(p, "custom")} style={lightMiniButtonStyle}>
                            Cant.
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

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: isMobile
                      ? "repeat(2, minmax(0, 1fr))"
                      : "repeat(auto-fit, minmax(210px, 1fr))",
                    gap: 14,
                    marginTop: 12,
                    maxHeight: 620,
                    overflowY: "auto",
                    paddingRight: 4,
                  }}
                >
                  {catalogProducts.map((p) => (
                    <div key={p.id} style={productCardStyle}>
                      <div style={{ minHeight: isMobile ? 42 : 46 }}>
                        <div style={productNameStyle}>{p.name}</div>
                      </div>

                      <div style={productPriceStyle}>${getPrice(p).toFixed(2)}</div>

                      <div style={{ minHeight: 28, marginBottom: 10 }}>
                        {customerType === "mayoreo" && !p.is_excluded_from_discount ? (
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

            {!search.trim() && !showCatalog ? (
              <div style={{ ...emptyBoxStyle, marginTop: 16 }}>
                Escribe en buscar producto o presiona <b>Ver catálogo</b>.
              </div>
            ) : null}
          </div>

          {!isMobile && (
            <div style={{ display: "grid", gap: 20 }}>
              <CartPanel
                cart={cart}
                notes={notes}
                setNotes={setNotes}
                removeCartItem={removeCartItem}
                cartTotal={cartTotal}
                createOrder={createOrder}
                saving={saving}
                deliveryDate={deliveryDate}
              />

              <OrdersPanel orders={orders} repeatOrder={repeatOrder} />
            </div>
          )}
        </div>

        {isMobile && (
          <>
            <div style={{ height: 90 }} />

            <button
              onClick={() => setShowCart(true)}
              style={floatingCartButtonStyle}
            >
              Ver pedido ({cart.length}) · ${cartTotal().toFixed(2)}
            </button>

            {showCart && (
              <div style={mobileOverlayStyle} onClick={() => setShowCart(false)}>
                <div style={mobileSheetStyle} onClick={(e) => e.stopPropagation()}>
                  <div style={mobileSheetHeaderStyle}>
                    <div>
                      <div style={{ fontWeight: 800, color: COLORS.text, fontSize: 24 }}>
                        Mi pedido
                      </div>
                      <div style={{ color: COLORS.muted }}>Revisa antes de enviar</div>
                    </div>

                    <button onClick={() => setShowCart(false)} style={closeButtonStyle}>
                      ✕
                    </button>
                  </div>

                  <CartPanel
                    cart={cart}
                    notes={notes}
                    setNotes={setNotes}
                    removeCartItem={removeCartItem}
                    cartTotal={cartTotal}
                    createOrder={createOrder}
                    saving={saving}
                    mobile
                    deliveryDate={deliveryDate}
                  />
                </div>
              </div>
            )}

            <div style={{ marginTop: 10 }}>
              <OrdersPanel orders={orders} repeatOrder={repeatOrder} mobile />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function CartPanel({
  cart,
  notes,
  setNotes,
  removeCartItem,
  cartTotal,
  createOrder,
  saving,
  mobile = false,
  deliveryDate,
}: {
  cart: CartItem[];
  notes: string;
  setNotes: (value: string) => void;
  removeCartItem: (index: number) => void;
  cartTotal: () => number;
  createOrder: () => void;
  saving: boolean;
  mobile?: boolean;
  deliveryDate: string;
}) {
  return (
    <div style={panelStyle}>
      <div style={panelHeaderStyle}>
        <div>
          <h2 style={panelTitleStyle}>Mi pedido</h2>
          <p style={panelSubtitleStyle}>Revisa antes de enviar</p>
        </div>
      </div>

      <div style={{ ...emptyBoxStyle, marginBottom: 12 }}>
        Fecha de entrega: <b>{formatOrderDate(deliveryDate)}</b>
      </div>

      {cart.length === 0 ? (
        <div style={emptyBoxStyle}>Todavía no agregas productos</div>
      ) : (
        <>
          {cart.map((c, i) => (
            <div key={i} style={cartRowStyle}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 700, color: COLORS.text }}>{c.name}</div>
                <div style={{ color: COLORS.muted, fontSize: 14 }}>
                  {c.kilos} kg · ${c.price.toFixed(2)}/kg
                </div>
              </div>

              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontWeight: 700, color: COLORS.text, marginBottom: 8 }}>
                  ${(c.kilos * c.price).toFixed(2)}
                </div>
                <button onClick={() => removeCartItem(i)} style={removeButtonStyle}>
                  Quitar
                </button>
              </div>
            </div>
          ))}

          <div style={totalBoxStyle}>
            <span>Total</span>
            <span>${cartTotal().toFixed(2)}</span>
          </div>
        </>
      )}

      <textarea
        placeholder="Notas para tu pedido"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        style={{
          ...textareaStyle,
          minHeight: mobile ? 100 : 110,
        }}
      />

      <button onClick={createOrder} style={{ ...primaryButtonStyle, width: "100%" }}>
        {saving ? "Enviando..." : "Enviar pedido"}
      </button>
    </div>
  );
}

function OrdersPanel({
  orders,
  repeatOrder,
  mobile = false,
}: {
  orders: Order[];
  repeatOrder: (order: Order) => void;
  mobile?: boolean;
}) {
  return (
    <div style={panelStyle}>
      <div style={panelHeaderStyle}>
        <div>
          <h2 style={panelTitleStyle}>Mis pedidos</h2>
          <p style={panelSubtitleStyle}>Historial y repetición rápida</p>
        </div>
      </div>

      {orders.length === 0 ? (
        <div style={emptyBoxStyle}>No hay pedidos</div>
      ) : (
        orders.map((o) => (
          <div key={o.id} style={historyCardStyle}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 12,
                marginBottom: 10,
                flexWrap: "wrap",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: COLORS.text, fontSize: mobile ? 18 : 20 }}>
                  {o.customer_name} - {o.status}
                </div>
                {o.created_at ? (
                  <div style={{ color: COLORS.muted, fontSize: 13, marginTop: 4 }}>
                    {new Date(o.created_at).toLocaleString()}
                  </div>
                ) : null}
                <div style={{ color: COLORS.muted, fontSize: 13, marginTop: 4 }}>
                  Fecha de entrega: <b>{formatOrderDate(o.delivery_date)}</b>
                </div>
              </div>

              <button onClick={() => repeatOrder(o)} style={repeatButtonStyle}>
                Repetir
              </button>
            </div>

            {o.notes ? (
              <div style={{ marginBottom: 10, color: COLORS.muted }}>📝 {o.notes}</div>
            ) : null}

            {o.order_items?.length ? (
              <div style={{ display: "grid", gap: 6 }}>
                {o.order_items.map((item) => (
                  <div key={item.id} style={historyItemStyle}>
                    <span style={{ minWidth: 0 }}>{item.product}</span>
                    <span style={{ flexShrink: 0 }}>
                      {item.kilos} kg · ${item.price}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}

            <div style={{ marginTop: 12, color: COLORS.muted, fontSize: 14 }}>
              Puntos generados:{" "}
              <b style={{ color: COLORS.text }}>{o.loyalty_points_earned || 0}</b>
            </div>
          </div>
        ))
      )}
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

const authPageStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
  background: `linear-gradient(180deg, ${COLORS.bgSoft} 0%, ${COLORS.bg} 100%)`,
  position: "relative",
  overflow: "hidden",
  fontFamily: "Arial, sans-serif",
};

const authGlow1: React.CSSProperties = {
  position: "absolute",
  top: -120,
  left: -80,
  width: 320,
  height: 320,
  borderRadius: "50%",
  background: "rgba(123, 34, 24, 0.10)",
  filter: "blur(40px)",
};

const authGlow2: React.CSSProperties = {
  position: "absolute",
  bottom: -100,
  right: -80,
  width: 340,
  height: 340,
  borderRadius: "50%",
  background: "rgba(217, 201, 163, 0.35)",
  filter: "blur(40px)",
};

const authCardStyle: React.CSSProperties = {
  background: COLORS.cardStrong,
  backdropFilter: "blur(10px)",
  border: `1px solid ${COLORS.border}`,
  borderRadius: 28,
  padding: 28,
  boxShadow: COLORS.shadow,
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
  maxWidth: 1440,
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
  marginBottom: 18,
};

const heroGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 16,
  marginBottom: 20,
};

const heroCardStyle: React.CSSProperties = {
  background: COLORS.cardStrong,
  backdropFilter: "blur(10px)",
  border: `1px solid ${COLORS.border}`,
  borderRadius: 24,
  padding: 20,
  boxShadow: COLORS.shadow,
};

const smallLabelStyle: React.CSSProperties = {
  color: COLORS.muted,
  fontSize: 14,
  marginBottom: 10,
};

const heroValueStyle: React.CSSProperties = {
  fontSize: 32,
  fontWeight: 800,
  color: COLORS.text,
  marginBottom: 6,
};

const heroMetaStyle: React.CSSProperties = {
  color: COLORS.muted,
  fontSize: 14,
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

const accountSummaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 14,
  marginBottom: 18,
};

const accountSummaryCardStyle: React.CSSProperties = {
  background: COLORS.bgSoft,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 20,
  padding: 16,
};

const accountValueStyle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 800,
  color: COLORS.text,
};

const accountGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: 18,
};

const subPanelStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.55)",
  border: `1px solid ${COLORS.border}`,
  borderRadius: 20,
  padding: 14,
};

const subPanelTitleStyle: React.CSSProperties = {
  color: COLORS.text,
  fontWeight: 800,
  fontSize: 20,
  marginBottom: 12,
};

const accountCardStyle: React.CSSProperties = {
  padding: 14,
  borderRadius: 18,
  background: COLORS.bgSoft,
  border: `1px solid ${COLORS.border}`,
  marginBottom: 12,
};

const accountCardHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  marginBottom: 10,
};

const accountCardTitleStyle: React.CSSProperties = {
  color: COLORS.text,
  fontWeight: 800,
  fontSize: 18,
};

const accountBadgeStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  textTransform: "capitalize",
  flexShrink: 0,
};

const accountMetaStyle: React.CSSProperties = {
  color: COLORS.muted,
  fontSize: 14,
  marginTop: 4,
};

const accountMetaWrapStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginTop: 10,
};

const accountNotesStyle: React.CSSProperties = {
  marginTop: 10,
  padding: 12,
  borderRadius: 14,
  background: "rgba(255,255,255,0.7)",
  border: `1px solid ${COLORS.border}`,
  color: COLORS.text,
};

const paidNotesGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 12,
};

const paidNoteCardStyle: React.CSSProperties = {
  padding: 14,
  borderRadius: 18,
  background: COLORS.bgSoft,
  border: `1px solid ${COLORS.border}`,
};

const productCardStyle: React.CSSProperties = {
  background: COLORS.bgSoft,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 20,
  padding: 14,
  minWidth: 0,
};

const productNameStyle: React.CSSProperties = {
  color: COLORS.text,
  fontWeight: 700,
  lineHeight: 1.25,
  fontSize: 15,
  wordBreak: "break-word",
};

const productPriceStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 800,
  color: COLORS.primary,
  marginBottom: 6,
};

const productButtonsWrapStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
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

const historyCardStyle: React.CSSProperties = {
  padding: 16,
  borderRadius: 18,
  background: COLORS.bgSoft,
  border: `1px solid ${COLORS.border}`,
  marginBottom: 12,
};

const historyItemStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  color: COLORS.text,
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

const switchButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: "12px 14px",
  borderRadius: 14,
  border: "none",
  cursor: "pointer",
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

const backButton: React.CSSProperties = {
  display: "inline-block",
  padding: "10px 14px",
  borderRadius: 14,
  border: `1px solid ${COLORS.border}`,
  background: "rgba(255,255,255,0.75)",
  color: COLORS.text,
  textDecoration: "none",
  fontWeight: 700,
};

const lightMiniButtonStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: "10px 10px",
  borderRadius: 12,
  border: `1px solid ${COLORS.border}`,
  background: "white",
  color: COLORS.text,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 14,
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

const removeButtonStyle: React.CSSProperties = {
  padding: "7px 10px",
  borderRadius: 10,
  border: "none",
  background: COLORS.danger,
  color: "white",
  cursor: "pointer",
  fontWeight: 700,
};

const repeatButtonStyle: React.CSSProperties = {
  padding: "9px 12px",
  borderRadius: 12,
  border: "none",
  background: COLORS.primary,
  color: "white",
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

const floatingCartButtonStyle: React.CSSProperties = {
  position: "fixed",
  left: 16,
  right: 16,
  bottom: 16,
  zIndex: 40,
  padding: "16px 18px",
  borderRadius: 18,
  border: "none",
  background: `linear-gradient(180deg, ${COLORS.primary} 0%, ${COLORS.primaryDark} 100%)`,
  color: "white",
  fontWeight: 800,
  fontSize: 16,
  boxShadow: "0 16px 30px rgba(123, 34, 24, 0.28)",
};

const mobileOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.28)",
  zIndex: 60,
  display: "flex",
  alignItems: "flex-end",
};

const mobileSheetStyle: React.CSSProperties = {
  width: "100%",
  maxHeight: "85vh",
  overflowY: "auto",
  background: COLORS.cardStrong,
  borderTopLeftRadius: 26,
  borderTopRightRadius: 26,
  padding: 18,
  boxShadow: "0 -10px 30px rgba(0,0,0,0.15)",
};

const mobileSheetHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  marginBottom: 12,
};

const closeButtonStyle: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 999,
  border: "none",
  background: "#efe8df",
  color: COLORS.text,
  fontWeight: 800,
  fontSize: 18,
  cursor: "pointer",
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

const metaPillStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "8px 12px",
  borderRadius: 999,
  background: "white",
  border: `1px solid ${COLORS.border}`,
  color: COLORS.text,
  fontSize: 13,
};