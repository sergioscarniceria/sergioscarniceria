"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import CustomerCard from "@/components/CustomerCard";

type Product = {
  id: string;
  name: string;
  price: number;
  is_active?: boolean;
  is_excluded_from_discount?: boolean;
  category?: string | null;
  fixed_piece_price?: number | null;
  recommended_with?: string[] | null;
};

type CartItem = {
  name: string;
  price: number;
  kilos: number;
  sale_type: "kg" | "pieza";
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

type Ticket = {
  id: string;
  type: string | null;
  source: string | null;
  amount: number | null;
  payment_method: string | null;
  created_at: string | null;
  reference_id?: string | null;
  cashier_name?: string | null;
  is_cancelled?: boolean | null;
  order_items?: OrderItem[];
  customer_name?: string | null;
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

type RecipeIngredient = {
  name: string;
  productMatch: string; // partial name to match in product catalog
  kgPerPerson: number; // kg (or pieces) per person
  unit: "kg" | "pza";
  isFromStore: boolean; // true = we sell it, false = bring your own
};

type Recipe = {
  id: string;
  title: string;
  description: string;
  image: string;
  time: string;
  basePeople: number;
  emoji: string;
  ingredients: RecipeIngredient[];
  otherIngredients: string[]; // things we don't sell
  steps: string[];
};

const RECIPES: Recipe[] = [
  {
    id: "arrachera-ajo-limon",
    title: "Arrachera al ajo y limon",
    description: "Rapida, lucidora y con mucho sabor. Perfecta para impresionar.",
    image: "https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?auto=format&fit=crop&w=600&q=80",
    time: "25 min",
    basePeople: 4,
    emoji: "🥩",
    ingredients: [
      { name: "Arrachera", productMatch: "Arrachera", kgPerPerson: 0.25, unit: "kg", isFromStore: true },
    ],
    otherIngredients: ["4 dientes de ajo picados", "Jugo de 3 limones", "Aceite de oliva", "Sal y pimienta"],
    steps: [
      "Mezcla ajo, limon, aceite, sal y pimienta.",
      "Marina la arrachera por 30 a 60 minutos.",
      "Cocina en parrilla o sarten bien caliente.",
      "Deja reposar 5 minutos y rebana en tiras finas.",
      "Acompaña con cebollitas o tortillas calientes.",
    ],
  },
  {
    id: "rib-eye-mantequilla",
    title: "Rib eye a la mantequilla",
    description: "Para una cena especial, con acabado elegante de ajo y romero.",
    image: "https://images.unsplash.com/photo-1558030006-450675393462?auto=format&fit=crop&w=600&q=80",
    time: "20 min",
    basePeople: 2,
    emoji: "🥩",
    ingredients: [
      { name: "Rib eye", productMatch: "Rib eye", kgPerPerson: 0.35, unit: "kg", isFromStore: true },
    ],
    otherIngredients: ["Mantequilla", "Dientes de ajo", "Ramita de romero", "Sal gruesa y pimienta"],
    steps: [
      "Sazona los rib eyes con sal y pimienta.",
      "Sella en sarten o parrilla muy caliente.",
      "Agrega mantequilla, ajo y romero.",
      "Baña la carne con la mantequilla mientras termina su coccion.",
      "Deja reposar unos minutos antes de servir.",
    ],
  },
  {
    id: "aguja-parrilla",
    title: "Aguja marinada para parrilla",
    description: "Rendidora y perfecta para reuniones familiares o con amigos.",
    image: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80",
    time: "35 min",
    basePeople: 6,
    emoji: "🥩",
    ingredients: [
      { name: "Aguja", productMatch: "Aguja", kgPerPerson: 0.25, unit: "kg", isFromStore: true },
    ],
    otherIngredients: ["Salsa inglesa", "Jugo de naranja", "Mostaza", "Sal, pimienta y ajo en polvo"],
    steps: [
      "Mezcla todos los ingredientes del marinado.",
      "Deja reposar la carne al menos 1 hora.",
      "Asa a fuego medio hasta obtener buen color.",
      "Rebana y sirve con frijoles o guacamole.",
    ],
  },
  {
    id: "tacos-bistec",
    title: "Tacos de bistec",
    description: "El clasico que nunca falla. Rapido, sabroso y para toda la familia.",
    image: "https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?auto=format&fit=crop&w=600&q=80",
    time: "15 min",
    basePeople: 4,
    emoji: "🌮",
    ingredients: [
      { name: "Bistec de res", productMatch: "Bistec de res", kgPerPerson: 0.2, unit: "kg", isFromStore: true },
    ],
    otherIngredients: ["Tortillas", "Cebolla", "Cilantro", "Limon", "Salsa verde"],
    steps: [
      "Corta el bistec en tiras finas.",
      "Sazona con sal y pimienta.",
      "Cocina en sarten caliente con poco aceite.",
      "Sirve en tortillas con cebolla y cilantro.",
    ],
  },
  {
    id: "costillas-bbq",
    title: "Costillas BBQ de cerdo",
    description: "Costillas tiernas y jugosas con salsa barbecue. Ideales para el fin de semana.",
    image: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80",
    time: "2 hrs",
    basePeople: 4,
    emoji: "🐷",
    ingredients: [
      { name: "Costilla de cerdo", productMatch: "Costilla de cerdo", kgPerPerson: 0.35, unit: "kg", isFromStore: true },
    ],
    otherIngredients: ["Salsa BBQ", "Miel", "Vinagre de manzana", "Paprika", "Ajo en polvo"],
    steps: [
      "Sazona las costillas con especias.",
      "Envuelve en aluminio y hornea a 150°C por 1.5 hrs.",
      "Retira el aluminio, baña con salsa BBQ.",
      "Hornea 20 min mas para caramelizar.",
    ],
  },
  {
    id: "hamburguesas",
    title: "Hamburguesas caseras",
    description: "Jugosas, con queso y todos los complementos. Las favoritas de los niños.",
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80",
    time: "20 min",
    basePeople: 4,
    emoji: "🍔",
    ingredients: [
      { name: "Hamburguesa", productMatch: "Hamburguesa", kgPerPerson: 0.2, unit: "kg", isFromStore: true },
    ],
    otherIngredients: ["Pan para hamburguesa", "Queso americano", "Lechuga", "Tomate", "Cebolla", "Catsup y mostaza"],
    steps: [
      "Forma las hamburguesas con la carne, sal y pimienta.",
      "Cocina en sarten o parrilla 4 min por lado.",
      "Agrega queso los ultimos 2 minutos.",
      "Arma con pan, lechuga, tomate y salsas.",
    ],
  },
  {
    id: "tacos-pastor",
    title: "Tacos al pastor",
    description: "El sabor de la taqueria en tu casa. Con piña y salsa.",
    image: "https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?auto=format&fit=crop&w=600&q=80",
    time: "30 min",
    basePeople: 5,
    emoji: "🌮",
    ingredients: [
      { name: "Pastor", productMatch: "Pastor", kgPerPerson: 0.2, unit: "kg", isFromStore: true },
    ],
    otherIngredients: ["Tortillas", "Piña en rodajas", "Cebolla", "Cilantro", "Limon", "Salsa roja"],
    steps: [
      "Calienta un sarten o comal a fuego alto.",
      "Cocina la carne al pastor hasta que este dorada y jugosa.",
      "Asa las rodajas de piña junto a la carne.",
      "Pica la piña y mezcla con la carne.",
      "Sirve en tortillas con cebolla, cilantro y salsa.",
    ],
  },
  {
    id: "costillas-asadas",
    title: "Costillas para asar a la parrilla",
    description: "Corte grueso y jugoso, perfecto para el carbon con sal de la casa.",
    image: "https://images.unsplash.com/photo-1558030006-450675393462?auto=format&fit=crop&w=600&q=80",
    time: "40 min",
    basePeople: 4,
    emoji: "🥩",
    ingredients: [
      { name: "Costilla para asar", productMatch: "Costilla para asar", kgPerPerson: 0.3, unit: "kg", isFromStore: true },
      { name: "Sal Ahumada de la casa", productMatch: "Sal Ahumada", kgPerPerson: 0.02, unit: "kg", isFromStore: true },
    ],
    otherIngredients: ["Pimienta negra", "Limon"],
    steps: [
      "Sazona las costillas con sal ahumada y pimienta.",
      "Deja reposar 15 minutos a temperatura ambiente.",
      "Asa en carbon a fuego medio-alto, 7 min por lado.",
      "Deja reposar 5 minutos antes de servir.",
      "Acompaña con limon y salsa.",
    ],
  },
  {
    id: "new-york-parrilla",
    title: "New York a la parrilla",
    description: "Corte premium, solo necesita sal y buena brasa. Para conocedores.",
    image: "https://images.unsplash.com/photo-1558030006-450675393462?auto=format&fit=crop&w=600&q=80",
    time: "20 min",
    basePeople: 2,
    emoji: "🥩",
    ingredients: [
      { name: "New York", productMatch: "New York", kgPerPerson: 0.35, unit: "kg", isFromStore: true },
    ],
    otherIngredients: ["Sal gruesa", "Pimienta negra", "Mantequilla (opcional)"],
    steps: [
      "Saca la carne del refrigerador 30 min antes.",
      "Sazona generosamente con sal gruesa y pimienta.",
      "Asa a fuego alto 4-5 min por lado (termino medio).",
      "Deja reposar 5 minutos cubierto con aluminio.",
      "Sirve con un toque de mantequilla si gustas.",
    ],
  },
  {
    id: "discada-norteña",
    title: "Discada norteña",
    description: "La clasica del norte. Mezcla de carnes con chorizo y tocino.",
    image: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80",
    time: "45 min",
    basePeople: 6,
    emoji: "🔥",
    ingredients: [
      { name: "Bistec de res", productMatch: "Bistec de res", kgPerPerson: 0.1, unit: "kg", isFromStore: true },
      { name: "Pastor", productMatch: "Pastor", kgPerPerson: 0.08, unit: "kg", isFromStore: true },
      { name: "Chorizo ranchero", productMatch: "Chorizo ranchero", kgPerPerson: 0.05, unit: "kg", isFromStore: true },
      { name: "Tocino economico", productMatch: "Tocino econ", kgPerPerson: 0.05, unit: "kg", isFromStore: true },
      { name: "Longaniza", productMatch: "Longaniza", kgPerPerson: 0.05, unit: "kg", isFromStore: true },
    ],
    otherIngredients: ["Cebolla", "Chile jalapeño", "Tomate", "Tortillas de harina"],
    steps: [
      "Pica toda la carne en trozos pequeños.",
      "En el disco o sarten grande, frie el tocino primero.",
      "Agrega chorizo y longaniza, cocina 5 min.",
      "Agrega la carne de res y pastor, mezcla bien.",
      "Incorpora cebolla, chile y tomate picado.",
      "Cocina hasta que todo este bien dorado.",
      "Sirve con tortillas de harina calientes.",
    ],
  },
  {
    id: "chuletas-cerdo",
    title: "Chuletas de cerdo al grill",
    description: "Jugosas y faciles de preparar. Perfectas entre semana.",
    image: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80",
    time: "25 min",
    basePeople: 4,
    emoji: "🐷",
    ingredients: [
      { name: "Chuleta de cerdo", productMatch: "Chuleta de cerdo", kgPerPerson: 0.25, unit: "kg", isFromStore: true },
    ],
    otherIngredients: ["Ajo en polvo", "Paprika", "Aceite de oliva", "Sal y pimienta", "Limon"],
    steps: [
      "Mezcla ajo en polvo, paprika, sal y pimienta con aceite.",
      "Unta la mezcla en las chuletas.",
      "Deja reposar 15 minutos.",
      "Asa en parrilla o sarten 5-6 min por lado.",
      "Sirve con limon y ensalada.",
    ],
  },
  {
    id: "caldo-res",
    title: "Caldo de res",
    description: "Reconfortante y lleno de sabor. Ideal para el fin de semana.",
    image: "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=600&q=80",
    time: "2 hrs",
    basePeople: 6,
    emoji: "🍲",
    ingredients: [
      { name: "Costilla para caldo", productMatch: "Costilla para caldo", kgPerPerson: 0.2, unit: "kg", isFromStore: true },
      { name: "Chambarete", productMatch: "Chambarete", kgPerPerson: 0.15, unit: "kg", isFromStore: true },
    ],
    otherIngredients: ["Elote en rodajas", "Zanahoria", "Papa", "Calabaza", "Cilantro", "Cebolla", "Chile serrano", "Limon"],
    steps: [
      "Hierve la carne en agua con cebolla y sal por 1 hora.",
      "Retira la espuma que se forme.",
      "Agrega las verduras cortadas en trozos grandes.",
      "Cocina 40 min mas hasta que las verduras esten suaves.",
      "Sirve con cilantro, limon y chile serrano.",
    ],
  },
];

function getCategoryEmoji(category?: string | null): string {
  const cat = (category || "").toLowerCase();
  if (cat.includes("res") || cat.includes("asar")) return "🥩";
  if (cat.includes("cerdo")) return "🐷";
  if (cat.includes("embutido")) return "🌭";
  if (cat.includes("complemento")) return "🧂";
  return "🥩";
}

function isPieceProduct(product: Product): boolean {
  return product.fixed_piece_price != null && product.fixed_piece_price > 0;
}

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
  const [loginPhone, setLoginPhone] = useState("");
  const [loginMethod, setLoginMethod] = useState<"phone" | "email">("phone");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [loginError, setLoginError] = useState("");
  const [loginSuccess, setLoginSuccess] = useState("");
  const [newCardData, setNewCardData] = useState<{ name: string; phone: string; email: string; password: string; customerId: string } | null>(null);
  const [forgotPhone, setForgotPhone] = useState("");
  const [forgotNewPass, setForgotNewPass] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [topSellerNames, setTopSellerNames] = useState<string[]>([]);
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

  const [activeTab, setActiveTab] = useState<"orden" | "catalogo" | "pedidos" | "tickets" | "recetas" | "cuenta">("orden");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);
  const [expandedRecipe, setExpandedRecipe] = useState<string | null>(null);
  const [recipeServings, setRecipeServings] = useState<Record<string, number>>({});

  // Mercado Pago - pago con tarjeta
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [lastOrderTotal, setLastOrderTotal] = useState(0);
  const [showPaymentChoice, setShowPaymentChoice] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentResult, setPaymentResult] = useState<"success" | "failure" | "pending" | null>(null);

  useEffect(() => {
    checkUser();
    // Detectar regreso de Mercado Pago
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const paymentParam = params.get("payment");
      if (paymentParam === "success" || paymentParam === "failure" || paymentParam === "pending") {
        setPaymentResult(paymentParam);
        // Limpiar URL sin recargar
        window.history.replaceState({}, "", "/cliente");
      }
    }
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
    await loadTopSellers();
  }

  async function loadTopSellers() {
    // Top vendidos últimos 2 meses - para sugerencias genéricas
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    const since = twoMonthsAgo.toISOString();

    const { data } = await supabase
      .from("order_items")
      .select("product, created_at")
      .gte("created_at", since)
      .limit(2000);

    if (!data) return;

    const counts: Record<string, number> = {};
    for (const row of data as Array<{ product: string }>) {
      if (!row.product) continue;
      counts[row.product] = (counts[row.product] || 0) + 1;
    }
    const top = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name]) => name);
    setTopSellerNames(top);
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

      // Cargar tickets de compra (cash_movements de los últimos 4 meses)
      const fourMonthsAgo = new Date();
      fourMonthsAgo.setMonth(fourMonthsAgo.getMonth() - 4);
      const sinceDate = fourMonthsAgo.toISOString();

      // Traer orders pagados del cliente para obtener sus IDs
      const paidOrderIds = ((ordersData as Order[]) || [])
        .filter((o) => o.id)
        .map((o) => o.id);

      if (paidOrderIds.length > 0) {
        const { data: ticketsData } = await supabase
          .from("cash_movements")
          .select("*")
          .in("reference_id", paidOrderIds)
          .gte("created_at", sinceDate)
          .eq("type", "venta")
          .order("created_at", { ascending: false });

        // Enriquecer tickets con items del order
        const enrichedTickets: Ticket[] = ((ticketsData as Ticket[]) || []).map((t) => {
          const matchingOrder = ((ordersData as Order[]) || []).find((o) => o.id === t.reference_id);
          return {
            ...t,
            order_items: matchingOrder?.order_items || [],
            customer_name: matchingOrder?.customer_name || null,
          };
        });

        setTickets(enrichedTickets);
      } else {
        setTickets([]);
      }
    } else {
      setPoints(0);
      setOrders([]);
      setCustomerType("menudeo");
      setCxcNotes([]);
      setCxcPayments([]);
      setCreditEnabled(false);
      setCreditLimit(0);
      setCreditDays(0);
      setTickets([]);
    }

    await loadProducts();
  }

  async function register() {
    setLoginError("");
    if (!name || !phone || !password) {
      setLoginError("Llena tu nombre, tel\u00e9fono y contrase\u00f1a");
      return;
    }
    if (password.length < 4) {
      setLoginError("La contrase\u00f1a debe tener al menos 4 caracteres");
      return;
    }

    setSaving(true);

    try {
      // 1. Create account via server API (admin, auto-confirmed)
      const res = await fetch("/api/portal/registrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim(), email: email.trim() || null, password }),
      });
      const result = await res.json();

      if (!res.ok || !result.success) {
        setLoginError(result.error || "Error al crear tu cuenta");
        setSaving(false);
        return;
      }

      // 2. Auto-login immediately
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: result.auth_email,
        password,
      });

      if (signInError) {
        // Account created but login failed — show card and let them login manually
        setNewCardData({ name, phone, email, password, customerId: result.customer_id });
        setSaving(false);
        return;
      }

      // 3. Show customer card + load data (user is now logged in)
      setNewCardData({ name, phone, email, password, customerId: result.customer_id });
      await checkUser();
    } catch {
      setLoginError("Error de conexi\u00f3n. Intenta de nuevo.");
    }

    setSaving(false);
  }

  async function resetPassword() {
    setLoginError("");
    setLoginSuccess("");
    if (!forgotPhone.trim()) {
      setLoginError("Escribe tu n\u00famero de tel\u00e9fono");
      return;
    }
    if (!forgotNewPass || forgotNewPass.length < 4) {
      setLoginError("Escribe tu nueva contrase\u00f1a (m\u00ednimo 4 caracteres)");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/portal/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: forgotPhone.trim(), new_password: forgotNewPass }),
      });
      const result = await res.json();

      if (!res.ok || !result.success) {
        setLoginError(result.error || "No se pudo cambiar la contrase\u00f1a");
        setSaving(false);
        return;
      }

      setLoginSuccess(`Listo, ${result.name || ""}. Tu contrase\u00f1a fue cambiada. Ya puedes entrar.`);
      setForgotPhone("");
      setForgotNewPass("");
      setTimeout(() => { setMode("login"); setLoginSuccess(""); }, 3000);
    } catch {
      setLoginError("Error de conexi\u00f3n");
    }
    setSaving(false);
  }

  async function login() {
    setLoginError("");

    const lookupField = loginMethod === "phone"
      ? { phone: loginPhone.trim() }
      : { email: email.trim() };

    if (loginMethod === "phone" && !loginPhone.trim()) {
      setLoginError("Escribe tu tel\u00e9fono");
      return;
    }
    if (loginMethod === "email" && !email.trim()) {
      setLoginError("Escribe tu correo");
      return;
    }
    if (!password) {
      setLoginError("Escribe tu contrase\u00f1a");
      return;
    }

    setSaving(true);

    try {
      const res = await fetch("/api/portal/buscar-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lookupField),
      });

      const result = await res.json();

      if (!res.ok || !result.email) {
        setLoginError(
          loginMethod === "phone"
            ? "No encontramos una cuenta con ese tel\u00e9fono. Verifica o crea una cuenta nueva."
            : "No encontramos una cuenta con ese correo. Verifica o usa tel\u00e9fono."
        );
        setSaving(false);
        return;
      }

      // Try all possible auth emails
      const emailsToTry = [result.email, ...(result.alternatives || [])];
      let loginOk = false;

      for (const tryEmail of emailsToTry) {
        if (!tryEmail) continue;
        const { error: err } = await supabase.auth.signInWithPassword({
          email: tryEmail,
          password,
        });
        if (!err) {
          loginOk = true;
          break;
        }
      }

      if (!loginOk) {
        setLoginError("Contrase\u00f1a incorrecta. Si la olvidaste, usa \"\u00bfOlvid\u00e9 mi contrase\u00f1a?\" para poner una nueva.");
        setSaving(false);
        return;
      }
    } catch {
      setLoginError("Error de conexi\u00f3n. Intenta de nuevo.");
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
    setTickets([]);
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

  function addProduct(product: Product, mode: "kg" | "half" | "money" | "custom" | "pieza") {
    const piece = isPieceProduct(product);
    const price = getPrice(product);

    if (piece || mode === "pieza") {
      // Producto por pieza: siempre cantidad entera
      let qty = 1;
      if (mode === "custom") {
        const qtyText = prompt(`¿Cuántas piezas de ${product.name}?`);
        if (!qtyText) return;
        const parsed = Math.round(Number(qtyText));
        if (!parsed || parsed <= 0) {
          alert("Escribe una cantidad válida (ej: 3)");
          return;
        }
        qty = parsed;
      }
      setCart((prev) => [
        ...prev,
        { name: product.name, price, kilos: qty, sale_type: "pieza" as const },
      ]);
      return;
    }

    let kilos = 1;

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
      { name: product.name, price, kilos, sale_type: "kg" as const },
    ]);
  }

  function removeCartItem(index: number) {
    setCart(cart.filter((_, i) => i !== index));
  }

  function cartTotal() {
    return cart.reduce((acc, item) => {
      if (item.sale_type === "pieza") {
        return acc + Number(item.price || 0) * Number(item.kilos || 0); // kilos = quantity for pieces
      }
      return acc + Number(item.price || 0) * Number(item.kilos || 0);
    }, 0);
  }

  // Sugerencias combinando: recomendaciones manuales + categoría complementaria + top vendidos
  const suggestions = useMemo(() => {
    if (cart.length === 0) return [] as Product[];

    const cartNames = new Set(cart.map((c) => c.name));
    const cartProducts = cart
      .map((c) => products.find((p) => p.name === c.name))
      .filter((p): p is Product => Boolean(p));

    const picked: Product[] = [];
    const pickedIds = new Set<string>();

    const addIfEligible = (p?: Product) => {
      if (!p) return;
      if (!p.is_active) return;
      if (cartNames.has(p.name)) return;
      if (pickedIds.has(p.id)) return;
      picked.push(p);
      pickedIds.add(p.id);
    };

    // 1) Manuales definidas en Admin Productos
    for (const cp of cartProducts) {
      for (const recId of cp.recommended_with || []) {
        if (picked.length >= 4) break;
        addIfEligible(products.find((x) => x.id === recId));
      }
      if (picked.length >= 4) break;
    }

    // 2) Por categoría: si hay carne (res/cerdo/asar/embutido), sugerir complementos
    if (picked.length < 4) {
      const hasMeat = cartProducts.some((p) => {
        const c = (p.category || "").toLowerCase();
        return c.includes("res") || c.includes("cerdo") || c.includes("asar") || c.includes("embutido");
      });
      const hasComplement = cartProducts.some((p) =>
        (p.category || "").toLowerCase().includes("complemento")
      );
      if (hasMeat && !hasComplement) {
        const complementos = products.filter((p) =>
          (p.category || "").toLowerCase().includes("complemento")
        );
        for (const p of complementos) {
          if (picked.length >= 4) break;
          addIfEligible(p);
        }
      }
      // Si solo tiene complementos, sugerir carne
      if (hasComplement && !hasMeat) {
        const carnes = products.filter((p) => {
          const c = (p.category || "").toLowerCase();
          return c.includes("res") || c.includes("asar");
        });
        for (const p of carnes) {
          if (picked.length >= 4) break;
          addIfEligible(p);
        }
      }
    }

    // 3) Top vendidos (fallback o relleno)
    if (picked.length < 4) {
      for (const name of topSellerNames) {
        if (picked.length >= 4) break;
        addIfEligible(products.find((x) => x.name === name));
      }
    }

    return picked.slice(0, 4);
  }, [cart, products, topSellerNames]);

  function repeatOrder(order: Order) {
    const previousItems =
      (order.order_items || []).map((item) => {
        const matchedProduct = products.find((p) => p.name === item.product);
        const piece = matchedProduct ? isPieceProduct(matchedProduct) : false;
        return {
          name: item.product,
          kilos: Number(item.kilos || 0),
          price: Number(item.price || 0),
          sale_type: (piece ? "pieza" : "kg") as "kg" | "pieza",
        };
      }) || [];

    if (previousItems.length === 0) {
      alert("Ese pedido no tiene artículos");
      return;
    }

    setCart(previousItems);
    setNotes(order.notes || "");
    setDeliveryDate(order.delivery_date || getTodayDateInput());
    setShowCart(true);
    setActiveTab("orden");
    window.scrollTo({ top: 0, behavior: "smooth" });
    alert("Pedido cargado otra vez en tu pedido");
  }

  function getServings(recipeId: string, basePeople: number) {
    return recipeServings[recipeId] || basePeople;
  }

  function orderRecipeIngredients(recipe: Recipe) {
    const servings = getServings(recipe.id, recipe.basePeople);
    const multiplier = servings / recipe.basePeople;
    const newItems: CartItem[] = [];
    const notFound: string[] = [];

    for (const ing of recipe.ingredients) {
      if (!ing.isFromStore) continue;

      // Find product by partial name match
      const match = products.find((p) =>
        p.name.toLowerCase().includes(ing.productMatch.toLowerCase())
      );

      if (match) {
        const piece = isPieceProduct(match);
        const qty = piece
          ? Math.max(1, Math.round(ing.kgPerPerson * servings))
          : Number((ing.kgPerPerson * servings).toFixed(3));
        newItems.push({
          name: match.name,
          price: piece ? Number(match.fixed_piece_price) : getPrice(match),
          kilos: qty,
          sale_type: piece ? "pieza" : "kg",
        });
      } else {
        notFound.push(ing.name);
      }
    }

    if (newItems.length === 0) {
      alert("No encontramos los productos de esta receta en nuestro catalogo. Contactanos por WhatsApp.");
      return;
    }

    setCart((prev) => [...prev, ...newItems]);
    setActiveTab("orden");
    setShowCart(true);
    window.scrollTo({ top: 0, behavior: "smooth" });

    if (notFound.length > 0) {
      alert(`Se agregaron los productos disponibles. No encontramos: ${notFound.join(", ")}`);
    } else {
      alert(`Se agregaron ${newItems.length} producto${newItems.length > 1 ? "s" : ""} para ${servings} persona${servings > 1 ? "s" : ""}`);
    }
  }

  async function createOrder() {
    if (!user) {
      alert("Debes iniciar sesion");
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
      sale_type: p.sale_type || "kg",
      is_fixed_price_piece: p.sale_type === "pieza",
      quantity: p.sale_type === "pieza" ? p.kilos : null,
    }));

    const { error: itemsError } = await supabase.from("order_items").insert(items);

    if (itemsError) {
      console.log(itemsError);
      alert("Se creó el pedido, pero fallaron los artículos");
      setSaving(false);
      return;
    }

    // Guardar info del pedido para ofrecer pago
    const orderTotal = cart.reduce((acc, c) => acc + c.kilos * c.price, 0);
    setLastOrderId(order.id);
    setLastOrderTotal(orderTotal);
    setShowPaymentChoice(true);

    setCart([]);
    setNotes("");
    setShowCart(false);
    setDeliveryDate(getTodayDateInput());
    await loadData(user.id);
    setSaving(false);
  }

  async function payWithMP() {
    if (!lastOrderId) return;
    setPaymentLoading(true);
    try {
      const res = await fetch("/api/mp/create-preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: lastOrderId }),
      });
      const data = await res.json();
      if (!res.ok || !data.init_point) {
        alert("Error al generar link de pago: " + (data.error || "desconocido"));
        setPaymentLoading(false);
        return;
      }
      // Redirigir a MP Checkout Pro
      const url = data.init_point;
      window.location.href = url;
    } catch (err) {
      console.error(err);
      alert("Error al conectar con Mercado Pago");
      setPaymentLoading(false);
    }
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

  // Modal: resultado de pago (regreso de MP)
  if (paymentResult) {
    const msgs = {
      success: { icon: "✅", title: "Pago recibido", desc: "Tu pago fue procesado exitosamente. Tu pedido está confirmado." },
      failure: { icon: "❌", title: "Pago no procesado", desc: "Hubo un problema con el pago. Puedes intentar de nuevo o pagar en efectivo al recibir." },
      pending: { icon: "⏳", title: "Pago en proceso", desc: "Tu pago está siendo verificado. Te notificaremos cuando se confirme." },
    };
    const m = msgs[paymentResult];
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(180deg, ${COLORS.bgSoft} 0%, ${COLORS.bg} 100%)`, fontFamily: "Arial, sans-serif", padding: 20 }}>
        <div style={{ background: COLORS.cardStrong, borderRadius: 24, padding: 32, maxWidth: 420, width: "100%", textAlign: "center", boxShadow: COLORS.shadow, border: `1px solid ${COLORS.border}` }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>{m.icon}</div>
          <h2 style={{ margin: "0 0 12px", color: COLORS.text }}>{m.title}</h2>
          <p style={{ color: COLORS.muted, marginBottom: 24 }}>{m.desc}</p>
          <button onClick={() => setPaymentResult(null)} style={{ padding: "14px 28px", borderRadius: 14, border: "none", background: `linear-gradient(180deg, ${COLORS.primary} 0%, ${COLORS.primaryDark} 100%)`, color: "white", fontWeight: 800, cursor: "pointer", fontSize: 16 }}>
            Continuar
          </button>
        </div>
      </div>
    );
  }

  // Modal: elegir método de pago después de crear pedido
  if (showPaymentChoice) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(180deg, ${COLORS.bgSoft} 0%, ${COLORS.bg} 100%)`, fontFamily: "Arial, sans-serif", padding: 20 }}>
        <div style={{ background: COLORS.cardStrong, borderRadius: 24, padding: 32, maxWidth: 440, width: "100%", boxShadow: COLORS.shadow, border: `1px solid ${COLORS.border}` }}>
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
            <h2 style={{ margin: "0 0 8px", color: COLORS.text }}>Pedido enviado</h2>
            <p style={{ color: COLORS.muted, margin: 0 }}>Total: <b style={{ color: COLORS.primary, fontSize: 20 }}>${lastOrderTotal.toFixed(2)}</b></p>
          </div>

          <p style={{ color: COLORS.text, textAlign: "center", marginBottom: 20, fontWeight: 600 }}>
            ¿Cómo quieres pagar?
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <button
              onClick={payWithMP}
              disabled={paymentLoading}
              style={{
                padding: "16px 20px", borderRadius: 16, border: "none",
                background: "linear-gradient(180deg, #009ee3 0%, #0077b6 100%)",
                color: "white", fontWeight: 800, cursor: paymentLoading ? "not-allowed" : "pointer",
                fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                opacity: paymentLoading ? 0.7 : 1,
              }}
            >
              💳 {paymentLoading ? "Conectando con Mercado Pago..." : "Pagar ahora con tarjeta"}
            </button>

            <button
              onClick={() => { setShowPaymentChoice(false); setLastOrderId(null); }}
              style={{
                padding: "14px 20px", borderRadius: 16,
                border: `1px solid ${COLORS.border}`,
                background: "white", color: COLORS.text, fontWeight: 700,
                cursor: "pointer", fontSize: 15,
              }}
            >
              💵 Pago en efectivo / al recibir
            </button>

            <button
              onClick={() => { setShowPaymentChoice(false); setLastOrderId(null); }}
              style={{
                padding: "10px", borderRadius: 12, border: "none",
                background: "transparent", color: COLORS.muted, fontWeight: 600,
                cursor: "pointer", fontSize: 13,
              }}
            >
              Decidir después
            </button>
          </div>
        </div>
      </div>
    );
  }

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
              &larr; Volver
            </Link>
          </div>

          <div style={authCardStyle}>
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <img
                src="/logo-sm.png"
                alt="Sergios Carnicer&iacute;a"
                loading="eager"
                fetchPriority="high"
                style={{
                  width: 200,
                  maxWidth: "100%",
                  height: "auto",
                  display: "block",
                  margin: "0 auto 18px auto",
                }}
              />
              <h1 style={{ margin: 0, color: COLORS.text, fontSize: 32, fontWeight: 800 }}>
                Sergio{"'"}s Carnicer&iacute;a
              </h1>
              <p style={{ color: COLORS.muted, marginTop: 10, fontSize: 16, lineHeight: 1.5 }}>
                Pide carne fresca desde tu celular
              </p>
            </div>

            {/* Tabs: Entrar / Crear cuenta */}
            <div style={{ marginBottom: 22, display: "flex", gap: 12 }}>
              <button
                onClick={() => { setMode("login"); setLoginError(""); setLoginSuccess(""); }}
                style={{
                  ...switchButtonStyle,
                  background: mode === "login" ? COLORS.primary : "#efe8df",
                  color: mode === "login" ? "white" : COLORS.text,
                  fontWeight: 800,
                }}
              >
                Entrar
              </button>
              <button
                onClick={() => { setMode("register"); setLoginError(""); setLoginSuccess(""); }}
                style={{
                  ...switchButtonStyle,
                  background: mode === "register" ? COLORS.primary : "#efe8df",
                  color: mode === "register" ? "white" : COLORS.text,
                  fontWeight: 800,
                }}
              >
                Crear cuenta
              </button>
            </div>

            {loginError && (
              <div style={loginErrorStyle}>{loginError}</div>
            )}
            {loginSuccess && (
              <div style={{ ...loginErrorStyle, background: "rgba(31,122,77,0.1)", color: "#1f7a4d", borderColor: "rgba(31,122,77,0.2)" }}>{loginSuccess}</div>
            )}

            {mode === "login" ? (
              <>
                <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                  <button
                    onClick={() => { setLoginMethod("phone"); setLoginError(""); }}
                    style={{
                      ...loginMethodButtonStyle,
                      background: loginMethod === "phone" ? "rgba(123,34,24,0.12)" : "transparent",
                      color: loginMethod === "phone" ? COLORS.primary : COLORS.muted,
                      borderColor: loginMethod === "phone" ? COLORS.primary : COLORS.border,
                    }}
                  >
                    Tel&eacute;fono
                  </button>
                  <button
                    onClick={() => { setLoginMethod("email"); setLoginError(""); }}
                    style={{
                      ...loginMethodButtonStyle,
                      background: loginMethod === "email" ? "rgba(123,34,24,0.12)" : "transparent",
                      color: loginMethod === "email" ? COLORS.primary : COLORS.muted,
                      borderColor: loginMethod === "email" ? COLORS.primary : COLORS.border,
                    }}
                  >
                    Correo
                  </button>
                </div>

                {loginMethod === "phone" ? (
                  <input
                    placeholder="Tu n&uacute;mero de tel&eacute;fono"
                    value={loginPhone}
                    onChange={(e) => setLoginPhone(e.target.value)}
                    style={inputStyle}
                    type="tel"
                  />
                ) : (
                  <input
                    placeholder="Tu correo electr&oacute;nico"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={inputStyle}
                    type="email"
                  />
                )}

                <div style={{ position: "relative" }}>
                  <input
                    placeholder="Contrase\u00f1a"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{ ...inputStyle, paddingRight: 80 }}
                  />
                  <button onClick={() => setShowPassword(!showPassword)} type="button" style={showPassBtnStyle}>
                    {showPassword ? "Ocultar" : "Mostrar"}
                  </button>
                </div>
                <button
                  onClick={login}
                  disabled={saving}
                  style={{ ...primaryButtonStyle, width: "100%", opacity: saving ? 0.65 : 1 }}
                >
                  {saving ? "Entrando..." : "Entrar"}
                </button>

                {/* Forgot password link */}
                <button
                  onClick={() => { setMode("forgot"); setLoginError(""); setLoginSuccess(""); }}
                  style={{
                    background: "none", border: "none", color: COLORS.primary,
                    fontSize: 14, fontWeight: 600, cursor: "pointer",
                    marginTop: 12, padding: 0, textDecoration: "underline",
                    width: "100%", textAlign: "center",
                  }}
                >
                  &iquest;Olvidaste tu contrase&ntilde;a?
                </button>
              </>
            ) : mode === "register" ? (
              <>
                <input
                  placeholder="Tu nombre *"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={inputStyle}
                />
                <input
                  placeholder="Tu tel&eacute;fono (WhatsApp) *"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  style={inputStyle}
                  type="tel"
                />
                <input
                  placeholder="Correo electr&oacute;nico (opcional)"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={inputStyle}
                  type="email"
                />
                <div style={{ position: "relative" }}>
                  <input
                    placeholder="Crea una contrase\u00f1a *"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{ ...inputStyle, paddingRight: 80 }}
                  />
                  <button onClick={() => setShowPassword(!showPassword)} type="button" style={showPassBtnStyle}>
                    {showPassword ? "Ocultar" : "Mostrar"}
                  </button>
                </div>
                <button
                  onClick={register}
                  disabled={saving}
                  style={{ ...primaryButtonStyle, width: "100%", opacity: saving ? 0.65 : 1 }}
                >
                  {saving ? "Creando tu cuenta..." : "Crear mi cuenta"}
                </button>
                <div style={{ fontSize: 12, color: COLORS.muted, textAlign: "center", marginTop: 10 }}>
                  Al crear tu cuenta entras autom&aacute;ticamente
                </div>
              </>
            ) : (
              /* Forgot password mode */
              <>
                <div style={{ marginBottom: 16, fontSize: 14, color: COLORS.muted, lineHeight: 1.5 }}>
                  Escribe tu n&uacute;mero de tel&eacute;fono y tu nueva contrase&ntilde;a.
                </div>
                <input
                  placeholder="Tu n&uacute;mero de tel&eacute;fono"
                  value={forgotPhone}
                  onChange={(e) => setForgotPhone(e.target.value)}
                  style={inputStyle}
                  type="tel"
                />
                <div style={{ position: "relative" }}>
                  <input
                    placeholder="Nueva contrase\u00f1a"
                    type={showPassword ? "text" : "password"}
                    value={forgotNewPass}
                    onChange={(e) => setForgotNewPass(e.target.value)}
                    style={{ ...inputStyle, paddingRight: 80 }}
                  />
                  <button onClick={() => setShowPassword(!showPassword)} type="button" style={showPassBtnStyle}>
                    {showPassword ? "Ocultar" : "Mostrar"}
                  </button>
                </div>
                <button
                  onClick={resetPassword}
                  disabled={saving}
                  style={{ ...primaryButtonStyle, width: "100%", opacity: saving ? 0.65 : 1 }}
                >
                  {saving ? "Cambiando..." : "Cambiar contrase\u00f1a"}
                </button>
                <button
                  onClick={() => { setMode("login"); setLoginError(""); setLoginSuccess(""); }}
                  style={{
                    background: "none", border: "none", color: COLORS.primary,
                    fontSize: 14, fontWeight: 600, cursor: "pointer",
                    marginTop: 12, padding: 0, width: "100%", textAlign: "center",
                  }}
                >
                  &larr; Volver a entrar
                </button>
              </>
            )}

            <div style={authPromoStyle}>
              <div style={{ fontWeight: 800, color: COLORS.primary, marginBottom: 8, fontSize: 16 }}>
                🥩 Carne fresca todos los d&iacute;as
              </div>
              <div style={{ color: COLORS.muted, fontSize: 14, lineHeight: 1.6 }}>
                Cortes especiales, marinados y complementos. Hacemos tu pedido a medida.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      {newCardData && (
        <CustomerCard
          name={newCardData.name}
          phone={newCardData.phone}
          email={newCardData.email}
          password={newCardData.password}
          customerId={newCardData.customerId}
          onClose={() => {
            setNewCardData(null);
            setName("");
            setPhone("");
            setEmail("");
            setPassword("");
          }}
        />
      )}
      <div style={glowTopLeft} />
      <div style={glowTopRight} />

      <div style={shellStyle}>
        <div style={topBarStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <img
              src="/logo.png"
              alt="Sergios Carnicería"
              style={{
                width: isMobile ? 60 : 80,
                height: "auto",
                display: "block",
              }}
            />

            <div>
              <h1 style={{ margin: 0, color: COLORS.text, fontSize: isMobile ? 24 : 28, fontWeight: 800 }}>
                Bienvenido
              </h1>
              <p style={{ color: COLORS.muted, margin: "4px 0 0 0", fontSize: 14 }}>
                Sergio{"'"}s Carnicería
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href="/" style={secondaryButtonStyle}>
              Inicio
            </Link>
            <button onClick={logout} style={secondaryButtonStyle as any}>
              Cerrar sesión
            </button>
          </div>
        </div>

        <div style={tabNavigationStyle}>
          <button
            onClick={() => setActiveTab("orden")}
            style={{
              ...tabButtonStyle,
              background: activeTab === "orden" ? COLORS.primary : "transparent",
              color: activeTab === "orden" ? "white" : COLORS.text,
              borderBottom: activeTab === "orden" ? "none" : `2px solid ${COLORS.border}`,
            }}
          >
            🛒 Hacer pedido
          </button>
          <button
            onClick={() => setActiveTab("catalogo")}
            style={{
              ...tabButtonStyle,
              background: activeTab === "catalogo" ? COLORS.primary : "transparent",
              color: activeTab === "catalogo" ? "white" : COLORS.text,
              borderBottom: activeTab === "catalogo" ? "none" : `2px solid ${COLORS.border}`,
            }}
          >
            📋 Catálogo
          </button>
          <button
            onClick={() => setActiveTab("pedidos")}
            style={{
              ...tabButtonStyle,
              background: activeTab === "pedidos" ? COLORS.primary : "transparent",
              color: activeTab === "pedidos" ? "white" : COLORS.text,
              borderBottom: activeTab === "pedidos" ? "none" : `2px solid ${COLORS.border}`,
            }}
          >
            📦 Mis pedidos
          </button>
          <button
            onClick={() => setActiveTab("tickets")}
            style={{
              ...tabButtonStyle,
              background: activeTab === "tickets" ? COLORS.primary : "transparent",
              color: activeTab === "tickets" ? "white" : COLORS.text,
              borderBottom: activeTab === "tickets" ? "none" : `2px solid ${COLORS.border}`,
            }}
          >
            🧾 Tickets
          </button>
          <button
            onClick={() => setActiveTab("recetas")}
            style={{
              ...tabButtonStyle,
              background: activeTab === "recetas" ? COLORS.primary : "transparent",
              color: activeTab === "recetas" ? "white" : COLORS.text,
              borderBottom: activeTab === "recetas" ? "none" : `2px solid ${COLORS.border}`,
            }}
          >
            👨‍🍳 Recetas
          </button>
          <button
            onClick={() => setActiveTab("cuenta")}
            style={{
              ...tabButtonStyle,
              background: activeTab === "cuenta" ? COLORS.primary : "transparent",
              color: activeTab === "cuenta" ? "white" : COLORS.text,
              borderBottom: activeTab === "cuenta" ? "none" : `2px solid ${COLORS.border}`,
            }}
          >
            👤 Mi cuenta
          </button>
        </div>

        {/* TAB: HACER PEDIDO */}
        {activeTab === "orden" && (
          <div style={{ animation: "fadeIn 0.3s ease" }}>
            <div style={heroGridStyle}>
              <div style={heroCardStyle}>
                <div style={smallLabelStyle}>Puntos acumulados</div>
                <div style={heroValueStyle}>{points}</div>
                <div style={heroMetaStyle}>
                  Tipo: <b>{customerType}</b>
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
                  {openNotes.length} nota{openNotes.length === 1 ? "" : "s"} abierta
                </div>
              </div>

              <div style={heroCardStyle}>
                <div style={smallLabelStyle}>Tu crédito</div>
                <div style={heroValueStyle}>{creditEnabled ? "✓" : "—"}</div>
                <div style={heroMetaStyle}>
                  Límite: ${creditLimit.toFixed(2)} · {creditDays} días
                </div>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1.15fr) minmax(360px, 0.85fr)",
                gap: 20,
                alignItems: "start",
              }}
            >
              <div style={panelStyle}>
                <div style={panelHeaderStyle}>
                  <div>
                    <h2 style={panelTitleStyle}>Buscar productos</h2>
                    <p style={panelSubtitleStyle}>
                      Escribe el nombre del corte o abre el catálogo completo
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
                    {showCatalog ? "Ocultar" : "Catálogo"}
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
                              <div style={productNameStyle}>{getCategoryEmoji(p.category)} {p.name}</div>
                              <div style={{ color: COLORS.primary, fontWeight: 800, marginTop: 4, fontSize: 16 }}>
                                {isPieceProduct(p)
                                  ? `$${Number(p.fixed_piece_price).toFixed(2)}/pza`
                                  : `$${getPrice(p).toFixed(2)}/kg`}
                              </div>
                            </div>

                            <div style={productButtonsWrapStyle}>
                              {isPieceProduct(p) ? (
                                <>
                                  <button onClick={() => addProduct(p, "kg")} style={lightMiniButtonStyle}>
                                    +1 pza
                                  </button>
                                  <button onClick={() => addProduct(p, "custom")} style={lightMiniButtonStyle}>
                                    Cant.
                                  </button>
                                </>
                              ) : (
                                <>
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
                                </>
                              )}
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
                          <div style={{ fontSize: 28, marginBottom: 8, textAlign: "center" }}>{getCategoryEmoji(p.category)}</div>
                          <div style={{ minHeight: isMobile ? 42 : 46 }}>
                            <div style={productNameStyle}>{p.name}</div>
                          </div>

                          <div style={productPriceStyle}>
                            {isPieceProduct(p)
                              ? `$${Number(p.fixed_piece_price).toFixed(2)}/pza`
                              : `$${getPrice(p).toFixed(2)}/kg`}
                          </div>

                          <div style={{ minHeight: 28, marginBottom: 10 }}>
                            {customerType === "mayoreo" && !p.is_excluded_from_discount ? (
                              <span style={discountBadgeStyle}>Mayoreo</span>
                            ) : null}

                            {p.is_excluded_from_discount ? (
                              <span style={excludedBadgeStyle}>Fijo</span>
                            ) : null}

                            {isPieceProduct(p) ? (
                              <span style={{
                                display: "inline-block",
                                padding: "4px 10px",
                                borderRadius: 999,
                                background: "rgba(53,92,125,0.10)",
                                color: COLORS.info,
                                fontSize: 12,
                                fontWeight: 700,
                              }}>Por pieza</span>
                            ) : null}
                          </div>

                          <div style={productButtonsWrapStyle}>
                            {isPieceProduct(p) ? (
                              <>
                                <button onClick={() => addProduct(p, "kg")} style={lightMiniButtonStyle}>
                                  +1 pza
                                </button>
                                <button onClick={() => addProduct(p, "custom")} style={lightMiniButtonStyle}>
                                  Cant.
                                </button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => addProduct(p, "kg")} style={lightMiniButtonStyle}>
                                  +1 kg
                                </button>
                                <button onClick={() => addProduct(p, "half")} style={lightMiniButtonStyle}>
                                  +0.5
                                </button>
                                <button onClick={() => addProduct(p, "money")} style={darkMiniButtonStyle}>
                                  $
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {!search.trim() && !showCatalog ? (
                  <div style={catalogPromptStyle}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.text, marginBottom: 6 }}>
                      Busca lo que necesitas
                    </div>
                    <div style={{ color: COLORS.muted, fontSize: 14, marginBottom: 14 }}>
                      Escribe el nombre del corte o abre el catálogo completo
                    </div>
                    <button
                      onClick={() => setShowCatalog(true)}
                      style={{ ...primaryButtonStyle, width: "100%" }}
                    >
                      Ver catálogo completo
                    </button>
                  </div>
                ) : null}
              </div>

              {!isMobile && (
                <div style={{ display: "grid", gap: 20 }}>
                  <div style={panelStyle}>
                    <div style={panelHeaderStyle}>
                      <div>
                        <h2 style={panelTitleStyle}>Mi pedido</h2>
                        <p style={panelSubtitleStyle}>Revisa antes de enviar</p>
                      </div>
                    </div>

                    <div style={{ ...emptyBoxStyle, marginBottom: 12 }}>
                      Entrega: <b>{formatOrderDate(deliveryDate)}</b>
                    </div>

                    {cart.length === 0 ? (
                      <div style={emptyBoxStyle}>Todavía no agregas productos</div>
                    ) : (
                      <>
                        {cart.map((c, i) => {
                          const matchedProduct = products.find((p) => p.name === c.name);
                          const isPiece = c.sale_type === "pieza";
                          const emoji = getCategoryEmoji(matchedProduct?.category);
                          return (
                          <div key={i} style={cartRowStyle}>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontWeight: 700, color: COLORS.text }}>{emoji} {c.name}</div>
                              <div style={{ color: COLORS.muted, fontSize: 14 }}>
                                {isPiece
                                  ? `${c.kilos} pza · $${c.price.toFixed(2)}/pza`
                                  : `${c.kilos} kg · $${c.price.toFixed(2)}/kg`}
                              </div>
                            </div>

                            <div style={{ textAlign: "right", flexShrink: 0 }}>
                              <div style={{ fontWeight: 700, color: COLORS.text, marginBottom: 8 }}>
                                ${(c.kilos * c.price).toFixed(2)}
                              </div>
                              <button onClick={() => removeCartItem(i)} style={removeButtonStyle}>
                                ✕
                              </button>
                            </div>
                          </div>
                          );
                        })}

                        <div style={totalBoxStyle}>
                          <span>Total del pedido</span>
                          <span>${cartTotal().toFixed(2)}</span>
                        </div>
                      </>
                    )}

                    {suggestions.length > 0 && (
                      <div style={suggestionBlockStyle}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                          <span style={{ fontWeight: 800, color: COLORS.text, fontSize: 15 }}>✨ Te puede interesar</span>
                          <span style={{ fontSize: 12, color: COLORS.muted }}>Complementa tu pedido</span>
                        </div>
                        <div style={suggestionListStyle}>
                          {suggestions.map((p) => {
                            const piece = isPieceProduct(p);
                            const price = piece ? Number(p.fixed_piece_price) : getPrice(p);
                            return (
                              <div key={p.id} style={suggestionCardStyle}>
                                <div style={{ fontSize: 22, textAlign: "center", marginBottom: 6 }}>{getCategoryEmoji(p.category)}</div>
                                <div style={{ fontWeight: 700, color: COLORS.text, fontSize: 13, textAlign: "center", marginBottom: 4, minHeight: 34 }}>{p.name}</div>
                                <div style={{ color: COLORS.primary, fontWeight: 800, fontSize: 13, textAlign: "center", marginBottom: 8 }}>
                                  ${price.toFixed(2)}{piece ? "/pza" : "/kg"}
                                </div>
                                <button
                                  onClick={() => addProduct(p, piece ? "pieza" : "kg")}
                                  style={suggestionAddButtonStyle}
                                >
                                  + Agregar
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div style={{ marginTop: 12 }}>
                      <label style={{ display: "block", color: COLORS.text, fontWeight: 700, marginBottom: 8 }}>
                        Dirección de entrega
                      </label>
                      <textarea
                        placeholder="Calle, número, colonia, referencias..."
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        style={{
                          ...textareaStyle,
                          minHeight: 80,
                        }}
                      />
                      <button onClick={saveAddress} style={{ ...secondaryButtonStyle, width: "100%", display: "block", textAlign: "center" }}>
                        Guardar dirección
                      </button>
                    </div>

                    <div style={{ marginTop: 12 }}>
                      <label style={{ display: "block", color: COLORS.text, fontWeight: 700, marginBottom: 8 }}>
                        Fecha de entrega
                      </label>
                      <input
                        type="date"
                        value={deliveryDate}
                        min={getTodayDateInput()}
                        onChange={(e) => setDeliveryDate(e.target.value)}
                        style={inputStyle}
                      />
                    </div>

                    <div style={{ marginTop: 12 }}>
                      <label style={{ display: "block", color: COLORS.text, fontWeight: 700, marginBottom: 8 }}>
                        Notas para tu pedido
                      </label>
                      <textarea
                        placeholder="Instrucciones especiales, preferencias, etc."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        style={{
                          ...textareaStyle,
                          minHeight: 90,
                        }}
                      />
                    </div>

                    <button onClick={createOrder} style={{ ...primaryButtonStyle, width: "100%", marginTop: 14, fontSize: 16, padding: "14px 18px" }}>
                      {saving ? "Enviando..." : "Enviar pedido"}
                    </button>
                  </div>
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
                        address={address}
                        setAddress={setAddress}
                        saveAddress={saveAddress}
                        products={products}
                        suggestions={suggestions}
                        addProduct={addProduct}
                        getPrice={getPrice}
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* TAB: CATALOGO */}
        {activeTab === "catalogo" && (
          <div style={{ animation: "fadeIn 0.3s ease" }}>
            <div style={panelStyle}>
              <div style={panelHeaderStyle}>
                <div>
                  <h2 style={panelTitleStyle}>Catálogo de productos</h2>
                  <p style={panelSubtitleStyle}>
                    Todos nuestros cortes y complementos disponibles
                  </p>
                </div>
              </div>

              {products.length === 0 ? (
                <div style={emptyBoxStyle}>No hay productos disponibles</div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: isMobile
                      ? "repeat(2, minmax(0, 1fr))"
                      : "repeat(auto-fill, minmax(220px, 1fr))",
                    gap: 16,
                  }}
                >
                  {products.map((p) => (
                    <div key={p.id} style={catalogCardStyle}>
                      <div style={{ fontSize: 32, marginBottom: 12, textAlign: "center" }}>{getCategoryEmoji(p.category)}</div>
                      <div style={{ minHeight: 50 }}>
                        <div style={productNameStyle}>{p.name}</div>
                      </div>

                      <div style={productPriceStyle}>
                        {isPieceProduct(p)
                          ? `$${Number(p.fixed_piece_price).toFixed(2)}/pza`
                          : `$${getPrice(p).toFixed(2)}/kg`}
                      </div>

                      <div style={{ minHeight: 32, marginBottom: 12 }}>
                        {customerType === "mayoreo" && !p.is_excluded_from_discount ? (
                          <span style={discountBadgeStyle}>Precio mayoreo</span>
                        ) : null}

                        {p.is_excluded_from_discount ? (
                          <span style={excludedBadgeStyle}>Precio fijo</span>
                        ) : null}

                        {isPieceProduct(p) ? (
                          <span style={{
                            display: "inline-block",
                            padding: "4px 10px",
                            borderRadius: 999,
                            background: "rgba(53,92,125,0.10)",
                            color: COLORS.info,
                            fontSize: 12,
                            fontWeight: 700,
                          }}>Por pieza</span>
                        ) : null}
                      </div>

                      <div style={productButtonsWrapStyle}>
                        {isPieceProduct(p) ? (
                          <>
                            <button onClick={() => addProduct(p, "kg")} style={lightMiniButtonStyle}>
                              +1 pza
                            </button>
                            <button onClick={() => addProduct(p, "custom")} style={lightMiniButtonStyle}>
                              Cant.
                            </button>
                          </>
                        ) : (
                          <>
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
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: MIS PEDIDOS */}
        {activeTab === "pedidos" && (
          <div style={{ animation: "fadeIn 0.3s ease" }}>
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
                <div style={{ display: "grid", gap: 12 }}>
                  {orders.map((o) => {
                    const statusColor =
                      o.status === "nuevo" ? { bg: "rgba(53, 92, 125, 0.12)", color: COLORS.info } :
                      o.status === "proceso" ? { bg: "rgba(166, 106, 16, 0.12)", color: COLORS.warning } :
                      { bg: "rgba(31, 122, 77, 0.12)", color: COLORS.success };

                    return (
                      <div key={o.id} style={orderCardStyle}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            gap: 12,
                            marginBottom: 12,
                            flexWrap: "wrap",
                          }}
                        >
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontWeight: 800, color: COLORS.text, fontSize: 18 }}>
                              Pedido de {o.customer_name}
                            </div>
                            {o.created_at ? (
                              <div style={{ color: COLORS.muted, fontSize: 13, marginTop: 4 }}>
                                {new Date(o.created_at).toLocaleString("es-MX", { timeZone: "America/Mexico_City" })}
                              </div>
                            ) : null}
                          </div>

                          <div
                            style={{
                              ...statusBadgeStyle,
                              background: statusColor.bg,
                              color: statusColor.color,
                            }}
                          >
                            {o.status === "nuevo" ? "🆕 Nuevo" :
                             o.status === "proceso" ? "⏳ Proceso" :
                             o.status === "terminado" ? "✓ Terminado" :
                             o.status === "entregado" ? "📦 Entregado" : o.status}
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
                          <div style={orderInfoPillStyle}>
                            📅 {formatOrderDate(o.delivery_date)}
                          </div>
                          <div style={orderInfoPillStyle}>
                            ⭐ {o.loyalty_points_earned || 0} puntos
                          </div>
                        </div>

                        {o.notes ? (
                          <div style={{ marginBottom: 12, padding: 10, background: COLORS.bgSoft, borderRadius: 12, color: COLORS.text, fontSize: 14 }}>
                            📝 <b>Notas:</b> {o.notes}
                          </div>
                        ) : null}

                        {o.order_items?.length ? (
                          <div style={{ display: "grid", gap: 6, marginBottom: 12, paddingBottom: 12, borderBottom: `1px solid ${COLORS.border}` }}>
                            {o.order_items.map((item) => {
                              const mp = products.find((p) => p.name === item.product);
                              const isPiece = mp ? isPieceProduct(mp) : false;
                              return (
                              <div key={item.id} style={historyItemStyle}>
                                <span style={{ minWidth: 0 }}>{getCategoryEmoji(mp?.category)} {item.product}</span>
                                <span style={{ flexShrink: 0, fontWeight: 700 }}>
                                  {isPiece
                                    ? `${item.kilos} pza · $${(item.kilos * item.price).toFixed(2)}`
                                    : `${item.kilos} kg · $${(item.kilos * item.price).toFixed(2)}`}
                                </span>
                              </div>
                              );
                            })}
                          </div>
                        ) : null}

                        <button onClick={() => repeatOrder(o)} style={{ ...primaryButtonStyle, width: "100%" }}>
                          🔄 Repetir pedido
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: TICKETS DE COMPRA */}
        {activeTab === "tickets" && (
          <div style={{ animation: "fadeIn 0.3s ease" }}>
            <div style={panelStyle}>
              <div style={panelHeaderStyle}>
                <div>
                  <h2 style={panelTitleStyle}>Mis tickets de compra</h2>
                  <p style={panelSubtitleStyle}>
                    Historial de los ultimos 4 meses. Toca un ticket para ver el desglose.
                  </p>
                </div>
                <div style={{
                  padding: "6px 14px",
                  borderRadius: 999,
                  background: "rgba(123,34,24,0.08)",
                  color: COLORS.primary,
                  fontWeight: 700,
                  fontSize: 13,
                }}>
                  {tickets.length} ticket{tickets.length !== 1 ? "s" : ""}
                </div>
              </div>

              {tickets.length === 0 ? (
                <div style={emptyBoxStyle}>
                  No tienes tickets de compra recientes
                </div>
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  {tickets.map((t) => {
                    const isExpanded = expandedTicket === t.id;
                    const items = t.order_items || [];
                    const itemsTotal = items.reduce((acc, item) => acc + (Number(item.price || 0) * Number(item.kilos || 0)), 0);

                    return (
                      <div
                        key={t.id}
                        style={{
                          background: COLORS.bgSoft,
                          border: `1px solid ${isExpanded ? COLORS.primary : COLORS.border}`,
                          borderRadius: 20,
                          overflow: "hidden",
                          transition: "border-color 0.2s",
                        }}
                      >
                        {/* Ticket header - clickable */}
                        <div
                          onClick={() => setExpandedTicket(isExpanded ? null : t.id)}
                          style={{
                            padding: "16px 18px",
                            cursor: "pointer",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 12,
                            WebkitTapHighlightColor: "transparent",
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                              <span style={{ fontSize: 18 }}>🧾</span>
                              <span style={{ fontWeight: 800, color: COLORS.text, fontSize: 16 }}>
                                ${Number(t.amount || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                              </span>
                              {t.is_cancelled && (
                                <span style={{
                                  padding: "2px 8px",
                                  borderRadius: 999,
                                  background: "rgba(180,35,24,0.10)",
                                  color: COLORS.danger,
                                  fontSize: 11,
                                  fontWeight: 700,
                                }}>
                                  Cancelado
                                </span>
                              )}
                            </div>
                            <div style={{ color: COLORS.muted, fontSize: 13 }}>
                              {t.created_at
                                ? new Date(t.created_at).toLocaleString("es-MX", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    timeZone: "America/Mexico_City",
                                  })
                                : "Sin fecha"}
                              {t.payment_method && (
                                <span style={{ marginLeft: 8 }}>
                                  · {t.payment_method === "efectivo" ? "💵 Efectivo" : t.payment_method === "tarjeta" ? "💳 Tarjeta" : t.payment_method === "transferencia" ? "📱 Transferencia" : t.payment_method}
                                </span>
                              )}
                            </div>
                          </div>
                          <div style={{
                            width: 28,
                            height: 28,
                            borderRadius: 8,
                            background: isExpanded ? COLORS.primary : "rgba(123,34,24,0.08)",
                            color: isExpanded ? "white" : COLORS.primary,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 800,
                            fontSize: 14,
                            flexShrink: 0,
                            transition: "all 0.2s",
                          }}>
                            {isExpanded ? "−" : "+"}
                          </div>
                        </div>

                        {/* Ticket detail - expandable */}
                        {isExpanded && (
                          <div style={{
                            padding: "0 18px 16px 18px",
                            borderTop: `1px solid ${COLORS.border}`,
                          }}>
                            {t.cashier_name && (
                              <div style={{ color: COLORS.muted, fontSize: 13, marginTop: 12, marginBottom: 8 }}>
                                Cajera: <b style={{ color: COLORS.text }}>{t.cashier_name}</b>
                              </div>
                            )}

                            {items.length > 0 ? (
                              <div style={{ marginTop: 10 }}>
                                <div style={{
                                  display: "grid",
                                  gap: 6,
                                }}>
                                  {items.map((item) => {
                                    const mp = products.find((p) => p.name === item.product);
                                    const isPiece = mp ? isPieceProduct(mp) : false;
                                    return (
                                    <div
                                      key={item.id}
                                      style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        padding: "10px 14px",
                                        borderRadius: 14,
                                        background: "rgba(255,255,255,0.8)",
                                        border: `1px solid ${COLORS.border}`,
                                        gap: 10,
                                      }}
                                    >
                                      <div style={{ minWidth: 0, flex: 1 }}>
                                        <div style={{ fontWeight: 700, color: COLORS.text, fontSize: 14 }}>
                                          {getCategoryEmoji(mp?.category)} {item.product}
                                        </div>
                                        <div style={{ color: COLORS.muted, fontSize: 12, marginTop: 2 }}>
                                          {isPiece
                                            ? `${item.kilos} pza × $${Number(item.price || 0).toFixed(2)}`
                                            : `${item.kilos} kg × $${Number(item.price || 0).toFixed(2)}`}
                                        </div>
                                      </div>
                                      <div style={{ fontWeight: 800, color: COLORS.primary, fontSize: 14, flexShrink: 0 }}>
                                        ${(Number(item.kilos || 0) * Number(item.price || 0)).toFixed(2)}
                                      </div>
                                    </div>
                                    );
                                  })}
                                </div>

                                {/* Total */}
                                <div style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  marginTop: 10,
                                  padding: "12px 14px",
                                  borderRadius: 14,
                                  background: COLORS.primary,
                                  color: "white",
                                  fontWeight: 800,
                                  fontSize: 15,
                                }}>
                                  <span>Total cobrado</span>
                                  <span>${Number(t.amount || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}</span>
                                </div>

                                {Math.abs(itemsTotal - Number(t.amount || 0)) > 0.5 && itemsTotal > 0 && (
                                  <div style={{
                                    marginTop: 6,
                                    padding: "8px 12px",
                                    borderRadius: 12,
                                    background: "rgba(166,106,16,0.08)",
                                    color: COLORS.warning,
                                    fontSize: 12,
                                    fontWeight: 600,
                                  }}>
                                    Subtotal productos: ${itemsTotal.toFixed(2)} (se aplico descuento o ajuste)
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div style={{
                                ...emptyBoxStyle,
                                marginTop: 10,
                                fontSize: 13,
                              }}>
                                Venta directa sin desglose de productos
                              </div>
                            )}

                            {/* Ticket ID mini */}
                            <div style={{
                              marginTop: 10,
                              color: COLORS.muted,
                              fontSize: 11,
                              fontFamily: "monospace",
                              opacity: 0.6,
                            }}>
                              ID: {t.id.slice(0, 8)}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: RECETAS */}
        {activeTab === "recetas" && (
          <div style={{ animation: "fadeIn 0.3s ease" }}>
            <div style={panelStyle}>
              <div style={panelHeaderStyle}>
                <div>
                  <h2 style={panelTitleStyle}>Recetas para inspirarte</h2>
                  <p style={panelSubtitleStyle}>
                    Elige una receta, ajusta las personas y ordena los ingredientes directo
                  </p>
                </div>
              </div>

              <div style={{ display: "grid", gap: 16 }}>
                {RECIPES.map((recipe) => {
                  const isExpanded = expandedRecipe === recipe.id;
                  const servings = getServings(recipe.id, recipe.basePeople);

                  return (
                    <div
                      key={recipe.id}
                      style={{
                        background: COLORS.bgSoft,
                        border: `1px solid ${isExpanded ? COLORS.primary : COLORS.border}`,
                        borderRadius: 20,
                        overflow: "hidden",
                        transition: "border-color 0.2s",
                      }}
                    >
                      {/* Recipe card header */}
                      <div
                        onClick={() => setExpandedRecipe(isExpanded ? null : recipe.id)}
                        style={{
                          cursor: "pointer",
                          WebkitTapHighlightColor: "transparent",
                        }}
                      >
                        {/* Image */}
                        <div style={{
                          width: "100%",
                          height: isMobile ? 140 : 180,
                          backgroundImage: `url(${recipe.image})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                          position: "relative",
                        }}>
                          <div style={{
                            position: "absolute",
                            bottom: 0,
                            left: 0,
                            right: 0,
                            padding: "32px 16px 12px",
                            background: "linear-gradient(transparent, rgba(0,0,0,0.6))",
                          }}>
                            <div style={{
                              color: "white",
                              fontWeight: 800,
                              fontSize: isMobile ? 18 : 22,
                              textShadow: "0 1px 4px rgba(0,0,0,0.3)",
                            }}>
                              {recipe.emoji} {recipe.title}
                            </div>
                          </div>
                          {/* Time badge */}
                          <div style={{
                            position: "absolute",
                            top: 10,
                            right: 10,
                            padding: "4px 10px",
                            borderRadius: 999,
                            background: "rgba(255,255,255,0.9)",
                            fontSize: 12,
                            fontWeight: 700,
                            color: COLORS.text,
                          }}>
                            ⏱ {recipe.time}
                          </div>
                        </div>

                        {/* Description */}
                        <div style={{ padding: "12px 16px" }}>
                          <div style={{ color: COLORS.muted, fontSize: 14, lineHeight: 1.5 }}>
                            {recipe.description}
                          </div>
                          <div style={{
                            color: COLORS.primary,
                            fontWeight: 700,
                            fontSize: 13,
                            marginTop: 8,
                          }}>
                            {isExpanded ? "Ocultar detalles ▲" : "Ver receta y ordenar ▼"}
                          </div>
                        </div>
                      </div>

                      {/* Expanded content */}
                      {isExpanded && (
                        <div style={{
                          padding: "0 16px 16px",
                          borderTop: `1px solid ${COLORS.border}`,
                        }}>
                          {/* Servings selector */}
                          <div style={{
                            marginTop: 14,
                            padding: 14,
                            borderRadius: 16,
                            background: "rgba(255,255,255,0.8)",
                            border: `1px solid ${COLORS.border}`,
                          }}>
                            <div style={{ fontWeight: 700, color: COLORS.text, marginBottom: 8, fontSize: 15 }}>
                              ¿Para cuantas personas?
                            </div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              {[2, 4, 6, 8, 10, 15].map((n) => (
                                <button
                                  key={n}
                                  onClick={() => setRecipeServings((prev) => ({ ...prev, [recipe.id]: n }))}
                                  style={{
                                    padding: "10px 16px",
                                    borderRadius: 12,
                                    border: servings === n ? `2px solid ${COLORS.primary}` : `1px solid ${COLORS.border}`,
                                    background: servings === n ? COLORS.primary : "white",
                                    color: servings === n ? "white" : COLORS.text,
                                    fontWeight: 700,
                                    fontSize: 15,
                                    cursor: "pointer",
                                    minWidth: 48,
                                    WebkitTapHighlightColor: "transparent",
                                  }}
                                >
                                  {n}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* What you need from us */}
                          <div style={{ marginTop: 14 }}>
                            <div style={{ fontWeight: 800, color: COLORS.text, fontSize: 15, marginBottom: 8 }}>
                              Lo que necesitas de nosotros
                            </div>
                            {recipe.ingredients.map((ing, idx) => {
                              const qty = Number((ing.kgPerPerson * servings).toFixed(2));
                              const matchedProd = products.find((p) =>
                                p.name.toLowerCase().includes(ing.productMatch.toLowerCase())
                              );
                              const price = matchedProd
                                ? isPieceProduct(matchedProd)
                                  ? Number(matchedProd.fixed_piece_price)
                                  : getPrice(matchedProd)
                                : 0;

                              return (
                                <div
                                  key={idx}
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    padding: "10px 14px",
                                    borderRadius: 14,
                                    background: "rgba(255,255,255,0.8)",
                                    border: `1px solid ${COLORS.border}`,
                                    marginBottom: 6,
                                    gap: 8,
                                  }}
                                >
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 700, color: COLORS.text, fontSize: 14 }}>
                                      {getCategoryEmoji(matchedProd?.category)} {matchedProd?.name || ing.name}
                                    </div>
                                    <div style={{ color: COLORS.muted, fontSize: 12, marginTop: 2 }}>
                                      {qty} {ing.unit} para {servings} personas
                                    </div>
                                  </div>
                                  <div style={{ fontWeight: 800, color: COLORS.primary, fontSize: 15, flexShrink: 0 }}>
                                    {price > 0 ? `$${(qty * price).toFixed(2)}` : "—"}
                                  </div>
                                </div>
                              );
                            })}

                            {/* Total estimate */}
                            {(() => {
                              const total = recipe.ingredients.reduce((acc, ing) => {
                                const qty = ing.kgPerPerson * servings;
                                const mp = products.find((p) =>
                                  p.name.toLowerCase().includes(ing.productMatch.toLowerCase())
                                );
                                const price = mp ? (isPieceProduct(mp) ? Number(mp.fixed_piece_price) : getPrice(mp)) : 0;
                                return acc + qty * price;
                              }, 0);
                              return total > 0 ? (
                                <div style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  padding: "12px 14px",
                                  borderRadius: 14,
                                  background: COLORS.primary,
                                  color: "white",
                                  fontWeight: 800,
                                  fontSize: 15,
                                  marginTop: 6,
                                }}>
                                  <span>Estimado</span>
                                  <span>${total.toFixed(2)}</span>
                                </div>
                              ) : null;
                            })()}
                          </div>

                          {/* Other ingredients */}
                          {recipe.otherIngredients.length > 0 && (
                            <div style={{ marginTop: 14 }}>
                              <div style={{ fontWeight: 700, color: COLORS.muted, fontSize: 13, marginBottom: 6 }}>
                                Tambien necesitas (traelos de casa):
                              </div>
                              <div style={{
                                padding: 12,
                                borderRadius: 14,
                                background: "rgba(255,255,255,0.6)",
                                border: `1px dashed ${COLORS.border}`,
                                color: COLORS.muted,
                                fontSize: 13,
                                lineHeight: 1.6,
                              }}>
                                {recipe.otherIngredients.join(" · ")}
                              </div>
                            </div>
                          )}

                          {/* Steps */}
                          <div style={{ marginTop: 14 }}>
                            <div style={{ fontWeight: 800, color: COLORS.text, fontSize: 15, marginBottom: 8 }}>
                              Preparacion
                            </div>
                            <div style={{ display: "grid", gap: 6 }}>
                              {recipe.steps.map((step, idx) => (
                                <div
                                  key={idx}
                                  style={{
                                    display: "flex",
                                    gap: 10,
                                    padding: "8px 12px",
                                    borderRadius: 12,
                                    background: "rgba(255,255,255,0.6)",
                                    fontSize: 14,
                                    color: COLORS.text,
                                    alignItems: "flex-start",
                                  }}
                                >
                                  <span style={{
                                    fontWeight: 800,
                                    color: COLORS.primary,
                                    fontSize: 13,
                                    minWidth: 20,
                                    flexShrink: 0,
                                  }}>
                                    {idx + 1}.
                                  </span>
                                  <span>{step}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* ORDER BUTTON */}
                          <button
                            onClick={() => orderRecipeIngredients(recipe)}
                            style={{
                              width: "100%",
                              marginTop: 16,
                              padding: "14px 18px",
                              borderRadius: 16,
                              border: "none",
                              background: `linear-gradient(180deg, ${COLORS.primary} 0%, ${COLORS.primaryDark} 100%)`,
                              color: "white",
                              fontWeight: 800,
                              fontSize: 16,
                              cursor: "pointer",
                              boxShadow: "0 8px 18px rgba(123, 34, 24, 0.20)",
                              WebkitTapHighlightColor: "transparent",
                            }}
                          >
                            🛒 Ordenar insumos para {servings} personas
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB: MI CUENTA */}
        {activeTab === "cuenta" && (
          <div style={{ animation: "fadeIn 0.3s ease" }}>
            <div style={{ display: "grid", gap: 20 }}>
              <div style={panelStyle}>
                <div style={panelHeaderStyle}>
                  <div>
                    <h2 style={panelTitleStyle}>Mi información</h2>
                    <p style={panelSubtitleStyle}>Datos y preferencias de tu cuenta</p>
                  </div>
                </div>

                <div style={accountGridStyle}>
                  <div style={accountItemStyle}>
                    <div style={accountLabelStyle}>Tipo de cliente</div>
                    <div style={accountValueStyle}>{customerType}</div>
                  </div>

                  <div style={accountItemStyle}>
                    <div style={accountLabelStyle}>Puntos acumulados</div>
                    <div style={accountValueStyle}>{points}</div>
                  </div>

                  <div style={accountItemStyle}>
                    <div style={accountLabelStyle}>Crédito disponible</div>
                    <div style={accountValueStyle}>{creditEnabled ? "✓ Activo" : "No"}</div>
                    {creditEnabled && (
                      <div style={{ fontSize: 13, color: COLORS.muted, marginTop: 4 }}>
                        Límite: ${creditLimit.toFixed(2)} · {creditDays} días
                      </div>
                    )}
                  </div>

                  <div style={accountItemStyle}>
                    <div style={accountLabelStyle}>Adeudo pendiente</div>
                    <div style={accountValueStyle}>${totalDebt.toFixed(2)}</div>
                    {totalDebt > 0 && (
                      <div style={{ fontSize: 13, color: COLORS.danger, marginTop: 4 }}>
                        {openNotes.length} nota{openNotes.length === 1 ? "" : "s"} abierta{openNotes.length === 1 ? "" : "s"}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div style={panelStyle}>
                <div style={panelHeaderStyle}>
                  <div>
                    <h2 style={panelTitleStyle}>Dirección de entrega</h2>
                    <p style={panelSubtitleStyle}>Se usará en tus pedidos</p>
                  </div>
                </div>

                <textarea
                  placeholder="Calle, número, colonia, referencias..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  style={{ ...textareaStyle, minHeight: 100 }}
                />

                <button onClick={saveAddress} style={{ ...primaryButtonStyle, width: "100%" }}>
                  Guardar dirección
                </button>
              </div>

              {creditEnabled || cxcNotes.length > 0 || cxcPayments.length > 0 ? (
                <div style={panelStyle}>
                  <div style={panelHeaderStyle}>
                    <div>
                      <h2 style={panelTitleStyle}>Mi estado de cuenta</h2>
                      <p style={panelSubtitleStyle}>
                        Adeudos, notas y pagos registrados
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

              <button
                onClick={logout}
                style={{
                  ...primaryButtonStyle,
                  width: "100%",
                  background: COLORS.danger,
                  padding: "14px 18px",
                  fontSize: 16,
                }}
              >
                🚪 Cerrar sesión
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
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
  address,
  setAddress,
  saveAddress,
  products,
  suggestions,
  addProduct,
  getPrice,
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
  address: string;
  setAddress: (value: string) => void;
  saveAddress: () => void;
  products: Product[];
  suggestions: Product[];
  addProduct: (product: Product, mode: "kg" | "half" | "money" | "custom" | "pieza") => void;
  getPrice: (product: Product) => number;
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
          {cart.map((c, i) => {
            const mp = products.find((p) => p.name === c.name);
            const isPiece = c.sale_type === "pieza";
            const emoji = getCategoryEmoji(mp?.category);
            return (
            <div key={i} style={cartRowStyle}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 700, color: COLORS.text }}>{emoji} {c.name}</div>
                <div style={{ color: COLORS.muted, fontSize: 14 }}>
                  {isPiece
                    ? `${c.kilos} pza · $${c.price.toFixed(2)}/pza`
                    : `${c.kilos} kg · $${c.price.toFixed(2)}/kg`}
                </div>
              </div>

              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontWeight: 700, color: COLORS.text, marginBottom: 8 }}>
                  ${(c.kilos * c.price).toFixed(2)}
                </div>
                <button onClick={() => removeCartItem(i)} style={removeButtonStyle}>
                  ✕
                </button>
              </div>
            </div>
            );
          })}

          <div style={totalBoxStyle}>
            <span>Total del pedido</span>
            <span>${cartTotal().toFixed(2)}</span>
          </div>
        </>
      )}

      {suggestions.length > 0 && (
        <div style={suggestionBlockStyle}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontWeight: 800, color: COLORS.text, fontSize: 15 }}>✨ Te puede interesar</span>
            <span style={{ fontSize: 12, color: COLORS.muted }}>Complementa tu pedido</span>
          </div>
          <div style={suggestionListStyle}>
            {suggestions.map((p) => {
              const piece = isPieceProduct(p);
              const price = piece ? Number(p.fixed_piece_price) : getPrice(p);
              return (
                <div key={p.id} style={suggestionCardStyle}>
                  <div style={{ fontSize: 22, textAlign: "center", marginBottom: 6 }}>{getCategoryEmoji(p.category)}</div>
                  <div style={{ fontWeight: 700, color: COLORS.text, fontSize: 13, textAlign: "center", marginBottom: 4, minHeight: 34 }}>{p.name}</div>
                  <div style={{ color: COLORS.primary, fontWeight: 800, fontSize: 13, textAlign: "center", marginBottom: 8 }}>
                    ${price.toFixed(2)}{piece ? "/pza" : "/kg"}
                  </div>
                  <button
                    onClick={() => addProduct(p, piece ? "pieza" : "kg")}
                    style={suggestionAddButtonStyle}
                  >
                    + Agregar
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ marginTop: 14 }}>
        <label style={{ display: "block", color: COLORS.text, fontWeight: 700, marginBottom: 8 }}>
          Dirección de entrega
        </label>
        <textarea
          placeholder="Calle, número, colonia, referencias..."
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          style={{
            ...textareaStyle,
            minHeight: mobile ? 80 : 100,
          }}
        />
        <button onClick={saveAddress} style={{ ...secondaryButtonStyle, width: "100%", display: "block", textAlign: "center" }}>
          Guardar dirección
        </button>
      </div>

      <div style={{ marginTop: 14 }}>
        <label style={{ display: "block", color: COLORS.text, fontWeight: 700, marginBottom: 8 }}>
          Notas para tu pedido
        </label>
        <textarea
          placeholder="Instrucciones especiales, preferencias, etc."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          style={{
            ...textareaStyle,
            minHeight: mobile ? 100 : 110,
          }}
        />
      </div>

      <button onClick={createOrder} style={{ ...primaryButtonStyle, width: "100%", marginTop: 14, fontSize: 16, padding: "14px 18px" }}>
        {saving ? "Enviando..." : "Enviar pedido"}
      </button>
    </div>
  );
}

// STYLES

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

const tabNavigationStyle: React.CSSProperties = {
  display: "flex",
  gap: 6,
  marginBottom: 20,
  background: COLORS.card,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 20,
  padding: 8,
  position: "sticky",
  top: 0,
  zIndex: 10,
  backdropFilter: "blur(10px)",
  boxShadow: "0 4px 12px rgba(91, 25, 15, 0.05)",
  overflowX: "auto",
  WebkitOverflowScrolling: "touch",
  scrollbarWidth: "none",
};

const tabButtonStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 14,
  border: "none",
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 13,
  transition: "all 0.2s ease",
  whiteSpace: "nowrap",
  flexShrink: 0,
  WebkitTapHighlightColor: "transparent",
};

const heroGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: 14,
  marginBottom: 20,
};

const heroCardStyle: React.CSSProperties = {
  background: COLORS.cardStrong,
  backdropFilter: "blur(10px)",
  border: `1px solid ${COLORS.border}`,
  borderRadius: 24,
  padding: 18,
  boxShadow: COLORS.shadow,
};

const smallLabelStyle: React.CSSProperties = {
  color: COLORS.muted,
  fontSize: 12,
  marginBottom: 8,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.5px",
};

const heroValueStyle: React.CSSProperties = {
  fontSize: 32,
  fontWeight: 800,
  color: COLORS.text,
  marginBottom: 6,
};

const heroMetaStyle: React.CSSProperties = {
  color: COLORS.muted,
  fontSize: 13,
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
  fontSize: 22,
  fontWeight: 800,
};

const panelSubtitleStyle: React.CSSProperties = {
  margin: "6px 0 0 0",
  color: COLORS.muted,
  fontSize: 13,
};

const accountSummaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
  marginBottom: 18,
};

const accountSummaryCardStyle: React.CSSProperties = {
  background: COLORS.bgSoft,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 18,
  padding: 14,
};

const accountValueStyle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 800,
  color: COLORS.text,
};

const accountGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 12,
};

const accountItemStyle: React.CSSProperties = {
  background: COLORS.bgSoft,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 18,
  padding: 16,
};

const accountLabelStyle: React.CSSProperties = {
  color: COLORS.muted,
  fontSize: 12,
  fontWeight: 700,
  textTransform: "uppercase",
  marginBottom: 6,
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
  fontSize: 18,
  marginBottom: 12,
};

const accountCardStyle: React.CSSProperties = {
  padding: 12,
  borderRadius: 16,
  background: COLORS.bgSoft,
  border: `1px solid ${COLORS.border}`,
  marginBottom: 10,
};

const accountCardHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  marginBottom: 8,
};

const accountCardTitleStyle: React.CSSProperties = {
  color: COLORS.text,
  fontWeight: 800,
  fontSize: 16,
};

const accountBadgeStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "4px 8px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 700,
  textTransform: "capitalize",
  flexShrink: 0,
};

const accountMetaStyle: React.CSSProperties = {
  color: COLORS.muted,
  fontSize: 13,
  marginTop: 3,
};

const accountMetaWrapStyle: React.CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
  marginTop: 8,
};

const accountNotesStyle: React.CSSProperties = {
  marginTop: 8,
  padding: 10,
  borderRadius: 12,
  background: "rgba(255,255,255,0.7)",
  border: `1px solid ${COLORS.border}`,
  color: COLORS.text,
  fontSize: 13,
};

const paidNotesGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 10,
};

const paidNoteCardStyle: React.CSSProperties = {
  padding: 12,
  borderRadius: 16,
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

const catalogCardStyle: React.CSSProperties = {
  background: COLORS.cardStrong,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 20,
  padding: 16,
  minWidth: 0,
  transition: "all 0.2s ease",
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
  padding: 12,
  background: COLORS.bgSoft,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 16,
  marginBottom: 10,
  alignItems: "flex-start",
};

const totalBoxStyle: React.CSSProperties = {
  marginTop: 12,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: 14,
  borderRadius: 16,
  background: COLORS.primary,
  color: "white",
  fontWeight: 800,
  fontSize: 16,
};

const orderCardStyle: React.CSSProperties = {
  padding: 16,
  borderRadius: 18,
  background: COLORS.bgSoft,
  border: `1px solid ${COLORS.border}`,
};

const orderInfoPillStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "6px 12px",
  borderRadius: 12,
  background: "white",
  border: `1px solid ${COLORS.border}`,
  color: COLORS.text,
  fontSize: 13,
  fontWeight: 600,
};

const statusBadgeStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "6px 12px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  textTransform: "capitalize",
  flexShrink: 0,
};

const historyItemStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  color: COLORS.text,
  fontSize: 13,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 12,
  borderRadius: 14,
  border: `1px solid ${COLORS.border}`,
  boxSizing: "border-box",
  outline: "none",
  marginBottom: 12,
  background: "rgba(255,255,255,0.85)",
  color: COLORS.text,
  fontSize: 14,
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  padding: 12,
  borderRadius: 14,
  border: `1px solid ${COLORS.border}`,
  boxSizing: "border-box",
  outline: "none",
  marginTop: 12,
  marginBottom: 12,
  background: "rgba(255,255,255,0.85)",
  color: COLORS.text,
  fontSize: 14,
  resize: "vertical",
  fontFamily: "Arial, sans-serif",
};

const switchButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: "12px 14px",
  borderRadius: 14,
  border: "none",
  cursor: "pointer",
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "12px 18px",
  borderRadius: 14,
  border: "none",
  background: `linear-gradient(180deg, ${COLORS.primary} 0%, ${COLORS.primaryDark} 100%)`,
  color: "white",
  cursor: "pointer",
  fontWeight: 800,
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
  fontSize: 12,
};

const darkMiniButtonStyle: React.CSSProperties = {
  width: 44,
  minWidth: 44,
  height: 44,
  borderRadius: 12,
  border: "none",
  background: COLORS.primary,
  color: "white",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 18,
};

const removeButtonStyle: React.CSSProperties = {
  padding: "6px 8px",
  borderRadius: 8,
  border: "none",
  background: COLORS.danger,
  color: "white",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 14,
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
  fontSize: 11,
  fontWeight: 700,
};

const excludedBadgeStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "4px 10px",
  borderRadius: 999,
  background: "rgba(166, 106, 16, 0.12)",
  color: COLORS.warning,
  fontSize: 11,
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
  cursor: "pointer",
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
  padding: "12px 14px",
  borderRadius: 14,
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
  fontSize: 16,
};

const searchResultsListStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const searchResultRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: 12,
  padding: 12,
  borderRadius: 14,
  background: COLORS.bgSoft,
  border: `1px solid ${COLORS.border}`,
  alignItems: "center",
};

const metaPillStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "6px 10px",
  borderRadius: 999,
  background: "white",
  border: `1px solid ${COLORS.border}`,
  color: COLORS.text,
  fontSize: 12,
};

const showPassBtnStyle: React.CSSProperties = {
  position: "absolute",
  right: 8,
  top: "50%",
  transform: "translateY(-50%)",
  background: "rgba(123,34,24,0.08)",
  border: "none",
  borderRadius: 8,
  padding: "5px 12px",
  fontSize: 13,
  fontWeight: 600,
  color: "#7b2218",
  cursor: "pointer",
};

const loginErrorStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 14,
  background: "rgba(180,35,24,0.08)",
  border: "1px solid rgba(180,35,24,0.15)",
  color: "#b42318",
  fontSize: 14,
  fontWeight: 600,
  marginBottom: 14,
};

const loginMethodButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 14,
};

const authPromoStyle: React.CSSProperties = {
  marginTop: 24,
  padding: 18,
  borderRadius: 18,
  background: "rgba(123, 34, 24, 0.06)",
  border: "1px solid rgba(123, 34, 24, 0.10)",
  textAlign: "center",
};

const promoBannerStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, rgba(123,34,24,0.06) 0%, rgba(217,201,163,0.18) 100%)",
  border: `1px solid ${COLORS.border}`,
  borderRadius: 20,
  padding: "18px 22px",
  marginBottom: 20,
  textAlign: "center",
};

const catalogPromptStyle: React.CSSProperties = {
  marginTop: 16,
  padding: 24,
  borderRadius: 20,
  background: "linear-gradient(135deg, rgba(123,34,24,0.04) 0%, rgba(217,201,163,0.12) 100%)",
  border: `1px dashed ${COLORS.border}`,
  textAlign: "center",
};

const suggestionBlockStyle: React.CSSProperties = {
  marginTop: 14,
  padding: 14,
  borderRadius: 16,
  background: "linear-gradient(135deg, rgba(166,106,16,0.06) 0%, rgba(217,201,163,0.14) 100%)",
  border: `1px solid ${COLORS.border}`,
};

const suggestionListStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
  gap: 10,
};

const suggestionCardStyle: React.CSSProperties = {
  background: "white",
  border: `1px solid ${COLORS.border}`,
  borderRadius: 14,
  padding: 10,
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
};

const suggestionAddButtonStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "none",
  background: `linear-gradient(180deg, ${COLORS.primary} 0%, ${COLORS.primaryDark} 100%)`,
  color: "white",
  fontWeight: 800,
  cursor: "pointer",
  fontSize: 12,
  width: "100%",
};
