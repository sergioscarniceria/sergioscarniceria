"use client";

import Link from "next/link";
import { useState, useEffect, useRef, useCallback } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import NotificationBell from "@/components/NotificationBell";

// ─── Palette ───
const C = {
  bg: "#f7f1e8",
  bgSoft: "#fbf8f3",
  card: "rgba(255,255,255,0.82)",
  cardStrong: "rgba(255,255,255,0.92)",
  border: "rgba(92,27,17,0.10)",
  text: "#3b1c16",
  muted: "#7a5a52",
  primary: "#7b2218",
  primaryDark: "#5a190f",
  accent: "#d9c9a3",
  success: "#1f7a4d",
  warning: "#a66a10",
  danger: "#b42318",
  info: "#355c7d",
};

// ─── Data ───
const moduleCategories = {
  admin: {
    label: "Administración",
    roles: ["admin"],
    items: [
      { title: "Dashboard ventas", href: "/admin/dashboard", desc: "Resumen del negocio" },
      { title: "Movimientos totales", href: "/admin/movimientos", desc: "Todo lo que pasó en el día, minuto a minuto" },
      { title: "Gráficas", href: "/admin/graficas", desc: "Comportamiento de productos y clientes en el tiempo" },
      { title: "Historial clientes", href: "/admin/historial-clientes", desc: "Cuanto ha comprado cada cliente" },
      { title: "Programa de puntos", href: "/admin/puntos", desc: "Puntos por cliente y canje" },
      { title: "Analisis por categoria", href: "/admin/categorias", desc: "Utilidad por linea + recuperacion de inversion" },
      { title: "Proveedores / CxP", href: "/admin/proveedores", desc: "Compras y pagos" },
      { title: "Gestión de PINs", href: "/admin/pins", desc: "Accesos por rol" },
      { title: "Pantalla cliente", href: "/admin/display", desc: "Imágenes y videos del display" },
    ],
  },
  contabilidad: {
    label: "Contabilidad",
    roles: ["contabilidad"],
    items: [
      { title: "Proveedores / CxP", href: "/admin/proveedores", desc: "Compras y pagos a proveedores" },
      { title: "CxC", href: "/cxc", desc: "Cuentas por cobrar a clientes" },
    ],
  },
  gestion: {
    label: "Gestión",
    roles: ["admin", "cajera"],
    items: [
      { title: "Admin clientes", href: "/admin/clientes", desc: "Altas y control" },
      { title: "Admin productos", href: "/admin/productos", desc: "Catálogo y precios" },
      { title: "Admin de precios", href: "/admin/precios", desc: "Costo, margen y precio de venta" },
      { title: "Inventario", href: "/inventario/complementos", desc: "Bodega y complementos" },
      { title: "Compras", href: "/inventario/compras", desc: "Órdenes a proveedores" },
      { title: "Auditoría", href: "/inventario/auditoria", desc: "Conteo físico y pérdidas" },
      { title: "Dashboard asistencia", href: "/admin/dashboard/asistencia", desc: "Control de asistencia" },
      { title: "Incidencias personal", href: "/admin/incidencias", desc: "Retardos, amonestaciones y faltas" },
    ],
  },
  caja: {
    label: "Caja y cobranza",
    roles: ["admin", "cajera"],
    items: [
      { title: "Caja", href: "/admin/caja", desc: "Flujo de efectivo" },
      { title: "Cobranza", href: "/cobranza", desc: "Cobrar tickets" },
      { title: "CxC", href: "/cxc", desc: "Cuentas por cobrar" },
      { title: "Gastos Externos", href: "/admin/gastos", desc: "Gastos fuera de caja" },
    ],
  },
  operacion: {
    label: "Operación diaria",
    roles: ["admin", "cajera", "carnicero"],
    items: [
      { title: "Pedidos", href: "/pedidos", desc: "Captura de pedidos" },
      { title: "Ventas Mostrador", href: "/ventas", desc: "Venta en tienda" },
      { title: "Producción", href: "/produccion", desc: "Preparar pedidos" },
      { title: "Repartidores", href: "/repartidores", desc: "Control de entregas" },
      { title: "Checador", href: "/asistencia/checador", desc: "Checar asistencia" },
      { title: "Recetario", href: "/admin/recetario", desc: "Recetas con costos" },
      { title: "Tienda Online", href: "/tienda", desc: "Pedidos de clientes" },
    ],
  },
  pantallas: {
    label: "Pantallas cliente",
    roles: ["admin", "cajera", "carnicero"],
    items: [
      { title: "Display mostrador", href: "/display/mostrador", desc: "Pantalla para cliente en mostrador", target: "_blank" as const },
      { title: "Display caja", href: "/display/caja", desc: "Pantalla para cliente en caja", target: "_blank" as const },
      { title: "Display TV", href: "/display/promo", desc: "Pantalla promocional para televisión", target: "_blank" as const },
    ],
  },
};

const recipes = [
  {
    title: "Arrachera al ajo y limón",
    description: "Rápida, lucidora, suave y jugosa.",
    image: "https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?auto=format&fit=crop&w=800&q=75",
    time: "25 min",
    ingredients: ["1 kg de arrachera", "4 dientes de ajo picados", "Jugo de 3 limones", "2 cucharadas de aceite de oliva", "Sal y pimienta al gusto"],
    steps: ["Mezcla ajo, limón, aceite, sal y pimienta.", "Marina la arrachera por 30 a 60 minutos.", "Cocina en parrilla o sartén bien caliente.", "Deja reposar 5 minutos y rebana en tiras finas.", "Acompaña con cebollitas, nopales o tortillas calientes."],
  },
  {
    title: "Rib eye a la mantequilla",
    description: "Elegante, con ajo y romero.",
    image: "https://images.unsplash.com/photo-1558030006-450675393462?auto=format&fit=crop&w=800&q=75",
    time: "20 min",
    ingredients: ["2 rib eyes", "2 cucharadas de mantequilla", "2 dientes de ajo", "1 ramita de romero", "Sal gruesa y pimienta"],
    steps: ["Sazona los rib eyes con sal y pimienta.", "Sella en sartén o parrilla muy caliente.", "Agrega mantequilla, ajo y romero.", "Baña la carne con la mantequilla mientras termina su cocción.", "Deja reposar unos minutos antes de servir."],
  },
  {
    title: "Aguja marinada para parrilla",
    description: "Rendidora para reuniones familiares.",
    image: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=75",
    time: "35 min",
    ingredients: ["1.5 kg de aguja", "1/2 taza de salsa inglesa", "1/4 taza de jugo de naranja", "2 cucharadas de mostaza", "Sal, pimienta y ajo en polvo"],
    steps: ["Mezcla todos los ingredientes del marinado.", "Deja reposar la carne al menos 1 hora.", "Asa a fuego medio hasta obtener buen color.", "Rebana y sirve con frijoles o guacamole.", "Perfecta para tacos o plato fuerte."],
  },
];

const socialLinks = [
  { title: "WhatsApp", subtitle: "+52 441 115 3314", href: "https://wa.me/524411153314", color: "#25D366" },
  { title: "WhatsApp", subtitle: "+52 441 118 5767", href: "https://wa.me/524411185767", color: "#25D366" },
  { title: "Instagram", subtitle: "@sergioscarniceria", href: "https://www.instagram.com/sergioscarniceria?igsh=OGRycjY4bGNpdmk2", color: "#E1306C" },
  { title: "Facebook", subtitle: "Sergios Carnicería", href: "https://www.facebook.com/share/1RS83jZX6D/?mibextid=wwXIfr", color: "#1877F2" },
  { title: "Correo", subtitle: "contacto@sergioscarniceria.com", href: "mailto:contacto@sergioscarniceria.com", color: "#7b2218" },
  { title: "Cotizaciones", subtitle: "cotizaciones@sergioscarniceria.com", href: "mailto:cotizaciones@sergioscarniceria.com", color: "#a66a10" },
];

/**
 * Qué se promociona en la portada.
 *
 * OJO: NO están ordenados por volumen de venta, sino por UTILIDAD.
 * Sergio fue claro: la barbacoa es lo que más vende pero lo que menos
 * le deja, así que no encabeza la página. Aquí van los preparados y
 * marinados (donde se cobra el trabajo, no solo la carne), los cortes
 * finos de ticket alto y el carbón, que es el complemento con mejor
 * margen de los que sí tienen costo capturado.
 *
 * Los nombres deben coincidir EXACTO con la columna `name` de `products`
 * — la BD guarda el nombre, no el id, así que un typo deja el hueco vacío.
 * Todos los de esta lista tienen foto verificada.
 */
const PRODUCTOS_ESTRELLA = [
  "Arrachera",
  "Rib eye",
  "Cecina",
  "Diezmillo Marinado",
  "Pastor",
  "Longaniza",
  "Hamburguesa",
  "carbon",
];

/**
 * Nombres bonitos solo para mostrar en la web.
 * NO se renombra en la base de datos: `order_items` guarda el nombre
 * del producto, así que cambiarlo rompería reportes e inventario.
 */
const NOMBRE_PUBLICO: Record<string, string> = {
  carbon: "Carbón",
  "Rib eye": "Rib Eye",
  Pastor: "Pastor adobado",
  Hamburguesa: "Hamburguesa de res",
};

/** Frase corta que acompaña a cada producto, para antojar. */
const ANTOJO: Record<string, string> = {
  Arrachera: "Suave y jugosa, la reina de la parrilla",
  "Rib eye": "Nuestro corte más fino, marmoleado",
  Cecina: "Delgada y salada, lista para el comal",
  "Diezmillo Marinado": "Ya marinado, solo lo pones al fuego",
  Pastor: "Adobado en casa, para tus tacos",
  Longaniza: "Receta de la casa, desde 1976",
  Hamburguesa: "Carne molida prensada, gruesa",
  carbon: "Para que no te falte nada",
};

type Destacado = {
  id: string;
  name: string;
  price: number | null;
  image_url: string | null;
  sale_type: string | null;
  fixed_piece_price: number | null;
  category: string | null;
};

// ─── Scroll reveal hook ───
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Si el navegador no soporta IntersectionObserver, mostrar todo de una
    // vez. Antes la sección se quedaba invisible para siempre.
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    // Si la sección ya está en pantalla al cargar (o el usuario entró con la
    // página a medio scroll), mostrarla sin esperar.
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold: 0, rootMargin: "0px 0px 200px 0px" }
    );
    observer.observe(el);

    // Red de seguridad: si por lo que sea el observer nunca dispara, a los
    // 2 segundos se muestra igual. Más vale sin animación que en blanco.
    const rescate = setTimeout(() => setVisible(true), 2000);

    return () => { observer.disconnect(); clearTimeout(rescate); };
  }, []);

  return { ref, visible };
}

// ─── Animated counter ───
function AnimatedCounter({ target, prefix = "", suffix = "", duration = 1200 }: { target: number; prefix?: string; suffix?: string; duration?: number }) {
  const [count, setCount] = useState(0);
  const { ref, visible } = useReveal();

  useEffect(() => {
    if (!visible) return;
    let start = 0;
    const step = Math.max(1, Math.floor(target / (duration / 16)));
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(start);
    }, 16);
    return () => clearInterval(timer);
  }, [visible, target, duration]);

  return <span ref={ref}>{prefix}{count.toLocaleString("es-MX")}{suffix}</span>;
}

// ─── PIN entry ───
function PinEntry({ onSuccess }: { onSuccess: (role: string, name: string) => void }) {
  const supabase = getSupabaseClient();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  async function checkPin() {
    if (!pin.trim()) return;
    setChecking(true);
    setError("");

    // Timeout de 10 segundos para evitar cuelgue
    const timeout = setTimeout(() => {
      setChecking(false);
      setError("Conexión lenta. Intenta de nuevo.");
    }, 10000);

    try {
      const { data: appPin } = await supabase.from("app_pins").select("role").eq("pin", pin.trim()).single();
      if (appPin) { clearTimeout(timeout); onSuccess(appPin.role, ""); setChecking(false); return; }
      const { data: empCode } = await supabase.from("employee_codes").select("name, role").eq("code", pin.trim()).single();
      if (empCode) { clearTimeout(timeout); onSuccess(empCode.role, empCode.name); setChecking(false); return; }
      clearTimeout(timeout);
      setError("PIN incorrecto");
      setChecking(false);
    } catch {
      clearTimeout(timeout);
      setError("Error de conexión. Intenta de nuevo.");
      setChecking(false);
    }
  }

  return (
    <div>
      <input value={pin} onChange={(e) => { setPin(e.target.value); setError(""); }} onKeyDown={(e) => e.key === "Enter" && checkPin()} type="password" placeholder="PIN" autoFocus
        style={{ padding: "14px 18px", borderRadius: 14, border: `1.5px solid ${C.border}`, outline: "none", fontSize: 20, textAlign: "center", letterSpacing: 8, width: "100%", maxWidth: 220, marginBottom: 10, color: C.text, background: "rgba(255,255,255,0.8)" }} />
      {error && <div style={{ color: C.danger, fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{error}</div>}
      <button onClick={checkPin} disabled={checking} style={{ padding: "12px 32px", borderRadius: 14, border: "none", background: C.primary, color: "white", fontWeight: 800, cursor: "pointer", fontSize: 15 }}>
        {checking ? "..." : "Entrar"}
      </button>
    </div>
  );
}

// ─── Quick Stats ───
function QuickStats({ showInventory = false }: { showInventory?: boolean }) {
  const supabase = getSupabaseClient();
  const [stats, setStats] = useState<{ pedidosHoy: number; ventasHoy: number; pendientes: number; enCamino: number; inventoryValue: number } | null>(null);

  useEffect(() => {
    async function load() {
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      const ordersPromise = supabase.from("orders").select("id, status, delivery_status").gte("created_at", `${todayStr}T00:00:00`);
      // Ventas reales cobradas (cash_movements tipo venta del día)
      const cashPromise = supabase.from("cash_movements").select("amount, type").gte("created_at", `${todayStr}T00:00:00`).eq("type", "venta");
      const bodegaPromise = showInventory ? supabase.from("bodega_items").select("stock, cost").eq("is_active", true) : Promise.resolve({ data: [] as any[] });
      const complementosPromise = showInventory ? supabase.from("products").select("stock, purchase_price, category, fixed_piece_price").eq("is_active", true) : Promise.resolve({ data: [] as any[] });
      const [{ data: ordersData }, { data: cashData }, { data: bodegaData }, { data: productsData }] = await Promise.all([ordersPromise, cashPromise, bodegaPromise, complementosPromise]);
      const orders = ordersData || [];
      const ventasHoy = (cashData || []).reduce((acc: number, m: any) => acc + Number(m.amount || 0), 0);
      const pendientes = orders.filter((o: any) => o.status === "nuevo" || o.status === "proceso").length;
      const enCamino = orders.filter((o: any) => o.delivery_status === "en_camino").length;
      const bodegaValue = (bodegaData || []).reduce((acc: number, i: any) => acc + (Number(i.stock) || 0) * (Number(i.cost) || 0), 0);
      const complementos = (productsData || []).filter((p: any) => p.category === "Complementos" || (p.fixed_piece_price !== null && Number(p.fixed_piece_price) > 0));
      const complementosValue = complementos.reduce((acc: number, p: any) => acc + (Number(p.stock) || 0) * (Number(p.purchase_price) || 0), 0);
      setStats({ pedidosHoy: orders.length, ventasHoy, pendientes, enCamino, inventoryValue: bodegaValue + complementosValue });
    }
    load();
  }, [showInventory]);

  if (!stats) return null;
  return (
    <div className="qs-grid" style={{ display: "grid", gridTemplateColumns: `repeat(${showInventory ? 5 : 4}, 1fr)`, gap: 10, marginBottom: 16 }}>
      {[
        { label: "Pedidos hoy", value: stats.pedidosHoy, color: C.text },
        { label: "Ventas hoy", value: `$${stats.ventasHoy.toLocaleString("es-MX", { maximumFractionDigits: 0 })}`, color: C.primary },
        { label: "En producción", value: stats.pendientes, color: stats.pendientes > 0 ? C.warning : C.success },
        { label: "En camino", value: stats.enCamino, color: stats.enCamino > 0 ? C.info : C.muted },
        ...(showInventory ? [{ label: "Inventario", value: `$${stats.inventoryValue.toLocaleString("es-MX", { maximumFractionDigits: 0 })}`, color: C.primary }] : []),
      ].map((s) => (
        <div key={s.label} style={{ background: C.bgSoft, border: `1px solid ${C.border}`, borderRadius: 14, padding: "10px 14px", textAlign: "center" }}>
          <div style={{ fontSize: 11, color: C.muted, fontWeight: 700 }}>{s.label}</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Section wrapper with animation ───
function Section({ children, id, delay = 0, className = "" }: { children: React.ReactNode; id?: string; delay?: number; className?: string }) {
  const { ref, visible } = useReveal();
  return (
    <div ref={ref} id={id} className={className} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(40px)",
      transition: `opacity 0.7s ease ${delay}s, transform 0.7s ease ${delay}s`,
      willChange: "opacity, transform",
    }}>
      {children}
    </div>
  );
}

// ═══════════ MAIN COMPONENT ═══════════
export default function HomePage() {
  const [openRecipe, setOpenRecipe] = useState<string | null>(null);
  const [showOps, setShowOps] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [empRole, setEmpRole] = useState<string | null>(null);
  const [empName, setEmpName] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [customerCount, setCustomerCount] = useState(1580000);
  const [productCount, setProductCount] = useState(168);
  const [destacados, setDestacados] = useState<Destacado[]>([]);

  useEffect(() => {
    const role = typeof window !== "undefined" ? sessionStorage.getItem("pin_role") : null;
    if (role) setEmpRole(role);
    // Conteos estáticos para no saturar Supabase con tráfico público.
    // Productos: 168 activos, verificado en la tabla `products` (sep 2026).
    // Clientes: acumulado histórico de los 50 años, cifra que definió Sergio.
    setCustomerCount(1580000);
    setProductCount(168);
  }, []);

  // Precios en vivo de los productos más vendidos.
  // Se leen de la misma tabla que usa el mostrador, así que la página
  // nunca muestra un precio viejo: si Sergio lo cambia en admin, cambia aquí.
  useEffect(() => {
    let cancelado = false;

    async function cargarDestacados() {
      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
          .from("products")
          .select("id, name, price, image_url, sale_type, fixed_piece_price, category")
          .in("name", PRODUCTOS_ESTRELLA)
          .eq("is_active", true);

        if (error || !data || cancelado) return;

        // Respetar el orden de PRODUCTOS_ESTRELLA (van de más a menos vendido)
        const ordenados = PRODUCTOS_ESTRELLA
          .map((nombre) => data.find((p) => p.name === nombre))
          .filter(Boolean) as Destacado[];

        setDestacados(ordenados);
      } catch {
        // Si falla, la sección simplemente no se muestra. Nunca rompe la página.
      }
    }

    cargarDestacados();
    return () => { cancelado = true; };
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Segoe UI', system-ui, -apple-system, Arial, sans-serif", overflow: "hidden" }}>

      {/* ─── Global CSS ─── */}
      <style dangerouslySetInnerHTML={{ __html: `
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        @media (max-width: 700px) {
          .nav-desktop { display: none !important; }
          .nav-burger { display: flex !important; }
          .nav-mobile { display: flex !important; }
          .hero-title { font-size: 36px !important; }
          .hero-sub { font-size: 16px !important; }
          .loc-grid { grid-template-columns: 1fr !important; }
          .qs-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .recipe-scroll { scroll-snap-type: x mandatory; }
          .recipe-scroll > div { scroll-snap-align: center; min-width: 300px; }
          .social-grid { grid-template-columns: 1fr 1fr !important; }
          .stats-row { flex-direction: column !important; }
          .prod-grid { grid-template-columns: 1fr 1fr !important; gap: 14px !important; }
          .mayoreo-grid { grid-template-columns: 1fr !important; gap: 24px !important; }
        }
        @media (min-width: 701px) {
          .nav-desktop { display: flex !important; }
          .nav-burger { display: none !important; }
          .nav-mobile { display: none !important; }
        }
        @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        @keyframes pulse { 0%,100% { opacity: 0.6; } 50% { opacity: 1; } }
        @keyframes slideInLeft { from { opacity: 0; transform: translateX(-30px); } to { opacity: 1; transform: translateX(0); } }
        .recipe-card { transition: transform 0.35s ease, box-shadow 0.35s ease; }
        .recipe-card:hover { transform: translateY(-6px); box-shadow: 0 20px 50px rgba(91,25,15,0.14); }
        .social-card { transition: transform 0.3s ease, box-shadow 0.3s ease; }
        .social-card:hover { transform: translateY(-4px) scale(1.02); box-shadow: 0 16px 40px rgba(91,25,15,0.12); }
        .mod-link { transition: all 0.2s ease; }
        .mod-link:hover { background: rgba(123,34,24,0.06) !important; transform: translateX(4px); }
        .nav-link { position: relative; transition: color 0.2s; }
        .nav-link::after { content: ''; position: absolute; bottom: 2px; left: 50%; width: 0; height: 2px; background: ${C.primary}; transition: all 0.25s ease; transform: translateX(-50%); }
        .nav-link:hover::after { width: 70%; }
        .cta-btn { transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .cta-btn:hover { transform: scale(1.03); box-shadow: 0 12px 30px rgba(123,34,24,0.25); }
        .cta-btn:active { transform: scale(0.97); }
      ` }} />

      {/* ─── NAVIGATION ─── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        padding: "10px 16px",
        background: scrolled || mobileMenuOpen ? "rgba(255,255,255,0.97)" : "transparent",
        backdropFilter: scrolled ? "blur(12px)" : "none",
        boxShadow: scrolled ? "0 4px 30px rgba(91,25,15,0.08)" : "none",
        borderBottom: scrolled ? `1px solid ${C.border}` : "none",
        transition: "all 0.35s ease",
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <img src="/logo-sm.png" alt="Sergio's" style={{ width: 38, height: "auto" }} loading="eager" fetchPriority="high" />
            <span style={{ fontWeight: 800, color: C.text, fontSize: 15, letterSpacing: -0.3 }}>Sergio&apos;s Carnicería</span>
          </Link>

          <div className="nav-desktop" style={{ display: "flex", gap: 4, alignItems: "center" }}>
            {["Inicio", "Recetario", "Ubicación", "Contacto"].map((t) => (
              <a key={t} href={`#${t.toLowerCase().replace("ó", "o")}`} className="nav-link" style={{ padding: "8px 14px", borderRadius: 10, color: C.text, textDecoration: "none", fontWeight: 600, fontSize: 14 }}>{t}</a>
            ))}
            <Link href="/tienda" className="cta-btn" style={{ padding: "9px 18px", borderRadius: 12, background: C.primary, color: "white", textDecoration: "none", fontWeight: 700, fontSize: 14, marginLeft: 8 }}>
              Hacer pedido
            </Link>
          </div>

          <button className="nav-burger" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} style={{ display: "none", alignItems: "center", justifyContent: "center", width: 42, height: 42, borderRadius: 12, border: `1px solid ${C.border}`, background: "white", cursor: "pointer", fontSize: 20, color: C.text }}>
            {mobileMenuOpen ? "✕" : "☰"}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="nav-mobile" style={{ display: "none", flexDirection: "column", gap: 2, padding: "10px 16px 16px", maxWidth: 1200, margin: "0 auto" }}>
            {["Inicio", "Recetario", "Ubicación", "Contacto"].map((t) => (
              <a key={t} href={`#${t.toLowerCase().replace("ó", "o")}`} onClick={() => setMobileMenuOpen(false)} style={{ padding: "14px 16px", borderRadius: 12, color: C.text, textDecoration: "none", fontWeight: 600, fontSize: 16 }}>{t}</a>
            ))}
            <Link href="/tienda" onClick={() => setMobileMenuOpen(false)} style={{ padding: "14px 16px", borderRadius: 12, background: C.primary, color: "white", textDecoration: "none", fontWeight: 700, fontSize: 16, textAlign: "center", marginTop: 4 }}>
              Hacer pedido
            </Link>
          </div>
        )}
      </nav>

      {/* ─── HERO ─── */}
      <div id="inicio" style={{ position: "relative", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "100px 20px 60px", overflow: "hidden" }}>
        {/* Decorative elements */}
        <div style={{ position: "absolute", top: -100, left: -80, width: 400, height: 400, borderRadius: "50%", background: "rgba(123,34,24,0.06)", filter: "blur(60px)", animation: "float 8s ease-in-out infinite" }} />
        <div style={{ position: "absolute", bottom: -60, right: -40, width: 350, height: 350, borderRadius: "50%", background: "rgba(217,201,163,0.25)", filter: "blur(50px)", animation: "float 6s ease-in-out infinite 1s" }} />
        <div style={{ position: "absolute", top: "30%", right: "10%", width: 200, height: 200, borderRadius: "50%", background: "rgba(123,34,24,0.03)", filter: "blur(40px)", animation: "float 10s ease-in-out infinite 2s" }} />

        <div style={{ position: "relative", zIndex: 2, textAlign: "center", maxWidth: 800 }}>
          <img src="/logo-sm.png" alt="Sergios Carnicería" loading="eager" fetchPriority="high"
            style={{ width: 140, maxWidth: "50vw", height: "auto", display: "block", margin: "0 auto 24px", animation: "float 5s ease-in-out infinite" }} />

          <h1 className="hero-title" style={{ fontSize: 56, fontWeight: 800, color: C.text, lineHeight: 1.05, letterSpacing: -1.5, marginBottom: 18 }}>
            Carne de calidad<br />
            <span style={{ background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              desde Ezequiel Montes
            </span>
          </h1>

          <p className="hero-sub" style={{ fontSize: 19, color: C.muted, lineHeight: 1.7, maxWidth: 620, margin: "0 auto 32px", fontWeight: 400 }}>
            El sabor de una gran comida empieza con una gran carne. Cortes selectos,
            atención de primera y la frescura que tu mesa merece.
          </p>

          {/* Dato comprobable: ~771 kg despachados al día (60 días medidos).
              A unos 3 kg por familia son ~257, sin contar a quienes comen
              nuestra carne en los restaurantes que surtimos. */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 10,
            padding: "10px 20px", borderRadius: 999,
            background: "rgba(123,34,24,0.07)",
            border: `1px solid rgba(123,34,24,0.12)`,
            marginBottom: 30, flexWrap: "wrap", justifyContent: "center",
          }}>
            <span style={{ fontSize: 15, color: C.primary, fontWeight: 800 }}>
              +250 familias
            </span>
            <span style={{ fontSize: 15, color: C.muted, fontWeight: 600 }}>
              comen nuestra carne cada día, los 365 días del año
            </span>
          </div>

          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/tienda" className="cta-btn" style={{
              padding: "16px 40px", borderRadius: 16, border: "none",
              background: `linear-gradient(135deg, ${C.primary} 0%, ${C.primaryDark} 100%)`,
              color: "white", textDecoration: "none", fontWeight: 800, fontSize: 17,
              boxShadow: "0 10px 30px rgba(123,34,24,0.25)",
            }}>
              Hacer pedido
            </Link>
            <a href="#recetario" className="cta-btn" style={{
              padding: "16px 32px", borderRadius: 16,
              border: `2px solid ${C.border}`, background: "rgba(255,255,255,0.7)",
              color: C.text, textDecoration: "none", fontWeight: 700, fontSize: 17,
              backdropFilter: "blur(8px)",
            }}>
              Ver recetario
            </a>
          </div>

          {/* Scroll indicator */}
          <div style={{ marginTop: 50, animation: "pulse 2s ease-in-out infinite" }}>
            <div style={{ width: 28, height: 44, borderRadius: 14, border: `2px solid ${C.muted}`, margin: "0 auto", position: "relative", opacity: 0.5 }}>
              <div style={{ width: 4, height: 10, borderRadius: 2, background: C.muted, position: "absolute", top: 8, left: "50%", marginLeft: -2, animation: "float 1.5s ease-in-out infinite" }} />
            </div>
          </div>
        </div>
      </div>

      {/* ─── STATS ROW ─── */}
      <Section>
        <div className="stats-row" style={{ maxWidth: 900, margin: "0 auto 60px", display: "flex", justifyContent: "center", gap: 0, padding: "0 20px" }}>
          {[
            { n: 50, label: "Años de experiencia", suffix: "+" },
            { n: productCount, label: "Productos en catálogo", suffix: "" },
            { n: customerCount, label: "Clientes satisfechos", suffix: "+" },
          ].map((s, i) => (
            <div key={s.label} style={{ flex: 1, textAlign: "center", padding: "24px 16px", borderRight: i < 2 ? `1px solid ${C.border}` : "none" }}>
              <div style={{ fontSize: 42, fontWeight: 800, color: C.primary, lineHeight: 1 }}>
                <AnimatedCounter target={s.n} suffix={s.suffix} />
              </div>
              <div style={{ fontSize: 14, color: C.muted, marginTop: 8, fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </Section>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 20px 40px" }}>

        {/* ─── PROMO ─── */}
        <Section>
          <div style={{ background: "linear-gradient(135deg, rgba(123,34,24,0.04) 0%, rgba(217,201,163,0.15) 100%)", borderRadius: 28, padding: "32px 28px", marginBottom: 60, border: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 20 }}>
              <div style={{ flex: 1, minWidth: 280 }}>
                <div style={{ display: "inline-block", padding: "6px 14px", borderRadius: 999, background: "rgba(166,106,16,0.12)", color: C.warning, fontSize: 12, fontWeight: 700, marginBottom: 14, letterSpacing: 0.5, textTransform: "uppercase" }}>
                  Promoción
                </div>
                <h3 style={{ fontSize: 26, fontWeight: 800, color: C.text, marginBottom: 10, lineHeight: 1.2 }}>
                  5% de descuento por tu reseña
                </h3>
                <p style={{ color: C.muted, lineHeight: 1.7, fontSize: 15, marginBottom: 20 }}>
                  Califícanos con 5 estrellas en Google Maps, envía tu comprobante por WhatsApp y obtén el descuento en tu próxima compra.
                </p>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <a href="https://maps.app.goo.gl/XeRuLcML1HRg4U8G8" target="_blank" rel="noreferrer" className="cta-btn"
                    style={{ padding: "12px 22px", borderRadius: 14, border: `1.5px solid ${C.border}`, background: "rgba(255,255,255,0.85)", color: C.text, textDecoration: "none", fontWeight: 700, fontSize: 14 }}>
                    Calificar en Google Maps
                  </a>
                  <a href="https://wa.me/524411153314" target="_blank" rel="noreferrer" className="cta-btn"
                    style={{ padding: "12px 22px", borderRadius: 14, border: "none", background: C.primary, color: "white", textDecoration: "none", fontWeight: 700, fontSize: 14 }}>
                    Enviar comprobante
                  </a>
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* ─── NUESTROS CORTES (precios en vivo desde la BD) ─── */}
        {destacados.length > 0 && (
          <Section id="productos">
            <div style={{ marginBottom: 80 }}>
              <div style={{ textAlign: "center", marginBottom: 40 }}>
                <div style={{ display: "inline-block", padding: "6px 14px", borderRadius: 999, background: "rgba(123,34,24,0.08)", color: C.primary, fontSize: 12, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 12 }}>
                  Lo que más piden
                </div>
                <h2 style={{ fontSize: 38, fontWeight: 800, color: C.text, lineHeight: 1.15, marginBottom: 10 }}>
                  Nuestros cortes
                </h2>
                <p style={{ color: C.muted, fontSize: 17, maxWidth: 560, margin: "0 auto" }}>
                  Precios de hoy, actualizados al momento. Cortamos al gusto y al peso que pidas.
                </p>
              </div>

              <div
                className="prod-grid"
                style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20 }}
              >
                {destacados.map((p, i) => {
                  const porPieza = p.sale_type === "pieza";
                  const precio = porPieza
                    ? Number(p.fixed_piece_price || p.price || 0)
                    : Number(p.price || 0);
                  const unidad = porPieza ? "pieza" : "kg";
                  const esEstrella = i === 0;

                  return (
                    <a
                      key={p.id}
                      href="/tienda"
                      className="prod-card"
                      style={{
                        display: "block",
                        borderRadius: 22,
                        overflow: "hidden",
                        background: C.cardStrong,
                        border: esEstrella ? `2px solid ${C.primary}` : `1px solid ${C.border}`,
                        textDecoration: "none",
                        boxShadow: "0 8px 30px rgba(91,25,15,0.06)",
                        position: "relative",
                      }}
                    >
                      {esEstrella && (
                        <div style={{
                          position: "absolute", top: 12, left: 12, zIndex: 2,
                          background: C.primary, color: "white", fontSize: 11,
                          fontWeight: 800, padding: "5px 11px", borderRadius: 999,
                          letterSpacing: 0.4, textTransform: "uppercase",
                        }}>
                          Favorito de la casa
                        </div>
                      )}

                      <div style={{ width: "100%", aspectRatio: "4 / 3", background: "#e8ded3", overflow: "hidden" }}>
                        {p.image_url ? (
                          <img
                            src={p.image_url}
                            alt={p.name}
                            loading="lazy"
                            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                          />
                        ) : (
                          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: C.muted, fontSize: 13, fontWeight: 700 }}>
                            {p.name}
                          </div>
                        )}
                      </div>

                      <div style={{ padding: "16px 18px 18px" }}>
                        <div style={{ fontWeight: 800, color: C.text, fontSize: 17, marginBottom: 3 }}>
                          {NOMBRE_PUBLICO[p.name] || p.name}
                        </div>
                        {ANTOJO[p.name] && (
                          <div style={{ fontSize: 13, color: C.muted, marginBottom: 8, lineHeight: 1.4 }}>
                            {ANTOJO[p.name]}
                          </div>
                        )}
                        {precio > 0 ? (
                          <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                            <span style={{ fontSize: 24, fontWeight: 900, color: C.primary }}>
                              ${precio.toLocaleString("es-MX")}
                            </span>
                            <span style={{ fontSize: 14, color: C.muted, fontWeight: 600 }}>/ {unidad}</span>
                          </div>
                        ) : (
                          <div style={{ fontSize: 14, color: C.muted, fontWeight: 700 }}>
                            Consultar precio
                          </div>
                        )}
                      </div>
                    </a>
                  );
                })}
              </div>

              <div style={{ textAlign: "center", marginTop: 34 }}>
                <a href="/tienda" className="cta-btn" style={{
                  display: "inline-block", padding: "16px 36px", borderRadius: 16,
                  background: C.primary, color: "white", textDecoration: "none",
                  fontWeight: 800, fontSize: 16, boxShadow: "0 10px 30px rgba(123,34,24,0.25)",
                }}>
                  Ver catálogo completo y pedir
                </a>
                <p style={{ color: C.muted, fontSize: 14, marginTop: 12 }}>
                  Más de 160 productos. Pide hoy y recógelo listo.
                </p>
              </div>
            </div>
          </Section>
        )}

        {/* ─── EVENTOS Y MAYOREO ─── */}
        <Section id="mayoreo">
          <div style={{ marginBottom: 80 }}>
            <div style={{
              borderRadius: 28,
              background: `linear-gradient(135deg, ${C.primaryDark} 0%, ${C.primary} 100%)`,
              padding: "48px 40px",
              color: "white",
              boxShadow: "0 20px 60px rgba(91,25,15,0.25)",
            }}>
              <div className="mayoreo-grid" style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 36, alignItems: "center" }}>
                <div>
                  <div style={{ display: "inline-block", padding: "6px 14px", borderRadius: 999, background: "rgba(255,255,255,0.18)", fontSize: 12, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 14 }}>
                    Eventos y mayoreo
                  </div>
                  <h2 style={{ fontSize: 34, fontWeight: 800, lineHeight: 1.15, marginBottom: 14 }}>
                    ¿Taquiza, boda o restaurante?
                  </h2>
                  <p style={{ fontSize: 16, lineHeight: 1.7, opacity: 0.93, marginBottom: 10 }}>
                    Surtimos eventos y negocios con precio especial por volumen. Te decimos cuántos
                    kilos necesitas según tus invitados, lo dejamos porcionado y listo para servir.
                  </p>
                  <p style={{ fontSize: 15, lineHeight: 1.7, opacity: 0.85 }}>
                    Cortes para parrilla, carne preparada para taquiza, barbacoa por kilo y
                    abasto fijo para cocinas. Cotización el mismo día.
                  </p>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <a href="https://wa.me/524411185767?text=Hola%2C%20quiero%20cotizar%20carne%20para%20un%20evento"
                    target="_blank" rel="noreferrer" className="cta-btn"
                    style={{
                      display: "block", textAlign: "center", padding: "16px 24px", borderRadius: 16,
                      background: "white", color: C.primaryDark, textDecoration: "none",
                      fontWeight: 800, fontSize: 16,
                    }}>
                    Cotizar por WhatsApp
                  </a>
                  <a href="mailto:cotizaciones@sergioscarniceria.com?subject=Cotizaci%C3%B3n%20para%20evento"
                    className="cta-btn"
                    style={{
                      display: "block", textAlign: "center", padding: "16px 24px", borderRadius: 16,
                      background: "rgba(255,255,255,0.14)", color: "white", textDecoration: "none",
                      fontWeight: 700, fontSize: 15, border: "1.5px solid rgba(255,255,255,0.35)",
                    }}>
                    Pedir cotización por correo
                  </a>
                  <p style={{ fontSize: 13, opacity: 0.8, textAlign: "center", marginTop: 4 }}>
                    Atendemos Ezequiel Montes, Tequisquiapan, Bernal y Cadereyta
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* ─── RECETARIO ─── */}
        <Section id="recetario">
          <div style={{ marginBottom: 80 }}>
            <div style={{ textAlign: "center", marginBottom: 40 }}>
              <div style={{ display: "inline-block", padding: "6px 14px", borderRadius: 999, background: "rgba(123,34,24,0.08)", color: C.primary, fontSize: 12, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 12 }}>
                Inspírate
              </div>
              <h2 style={{ fontSize: 38, fontWeight: 800, color: C.text, lineHeight: 1.15, marginBottom: 10 }}>Recetario</h2>
              <p style={{ color: C.muted, fontSize: 17, maxWidth: 500, margin: "0 auto" }}>Ideas para cocinar con nuestros cortes selectos</p>
            </div>

            <div className="recipe-scroll" style={{ display: "flex", gap: 24, overflowX: "auto", paddingBottom: 8, scrollbarWidth: "thin" }}>
              {recipes.map((recipe) => {
                const isOpen = openRecipe === recipe.title;
                return (
                  <div key={recipe.title} className="recipe-card" style={{
                    flex: "0 0 340px", background: C.cardStrong, borderRadius: 24, overflow: "hidden",
                    border: `1px solid ${C.border}`, boxShadow: "0 8px 30px rgba(91,25,15,0.06)",
                    backdropFilter: "blur(10px)",
                  }}>
                    <div style={{ position: "relative", overflow: "hidden" }}>
                      <img src={recipe.image} alt={recipe.title} loading="lazy"
                        style={{ width: "100%", height: 220, objectFit: "cover", display: "block", transition: "transform 0.5s ease" }}
                        onMouseOver={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
                        onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1)")} />
                      <div style={{ position: "absolute", top: 14, right: 14, padding: "6px 12px", borderRadius: 999, background: "rgba(0,0,0,0.55)", color: "white", fontSize: 12, fontWeight: 700, backdropFilter: "blur(4px)" }}>
                        {recipe.time}
                      </div>
                    </div>

                    <div style={{ padding: 22 }}>
                      <h3 style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 6 }}>{recipe.title}</h3>
                      <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.5, marginBottom: 16 }}>{recipe.description}</p>

                      <button onClick={() => setOpenRecipe(isOpen ? null : recipe.title)}
                        style={{ padding: "10px 18px", borderRadius: 12, border: "none", background: isOpen ? C.primaryDark : `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`, color: "white", cursor: "pointer", fontWeight: 700, fontSize: 13, transition: "all 0.2s", boxShadow: "0 4px 12px rgba(123,34,24,0.2)" }}>
                        {isOpen ? "Ocultar" : "Ver receta"}
                      </button>

                      {isOpen && (
                        <div style={{ marginTop: 16, padding: 16, borderRadius: 16, background: "rgba(247,241,232,0.7)", border: `1px solid ${C.border}`, animation: "slideInLeft 0.3s ease", backdropFilter: "blur(6px)" }}>
                          <div style={{ fontWeight: 800, color: C.text, marginBottom: 8, fontSize: 14 }}>Ingredientes</div>
                          <ul style={{ margin: 0, paddingLeft: 18, color: C.muted, fontSize: 13 }}>
                            {recipe.ingredients.map((item) => <li key={item} style={{ marginBottom: 4, lineHeight: 1.5 }}>{item}</li>)}
                          </ul>
                          <div style={{ fontWeight: 800, color: C.text, marginBottom: 8, marginTop: 14, fontSize: 14 }}>Preparación</div>
                          <ol style={{ margin: 0, paddingLeft: 18, color: C.muted, fontSize: 13 }}>
                            {recipe.steps.map((step) => <li key={step} style={{ marginBottom: 4, lineHeight: 1.5 }}>{step}</li>)}
                          </ol>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Section>

        {/* ─── CONTACTO ─── */}
        <Section id="contacto">
          <div style={{ marginBottom: 80 }}>
            <div style={{ textAlign: "center", marginBottom: 40 }}>
              <div style={{ display: "inline-block", padding: "6px 14px", borderRadius: 999, background: "rgba(53,92,125,0.08)", color: C.info, fontSize: 12, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 12 }}>
                Encuéntranos
              </div>
              <h2 style={{ fontSize: 38, fontWeight: 800, color: C.text, lineHeight: 1.15, marginBottom: 10 }}>Redes y contacto</h2>
              <p style={{ color: C.muted, fontSize: 17 }}>Escríbenos por cualquier canal</p>
            </div>

            <div className="social-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
              {socialLinks.map((s, i) => (
                <a
                  key={i}
                  href={s.href}
                  {...(s.href.startsWith("mailto:") ? {} : { target: "_blank", rel: "noreferrer" })}
                  className="social-card"
                  style={{ display: "block", padding: 24, borderRadius: 22, background: C.cardStrong, border: `1px solid ${C.border}`, textDecoration: "none", boxShadow: "0 8px 30px rgba(91,25,15,0.05)", backdropFilter: "blur(10px)" }}>
                  <div style={{ width: 44, height: 44, borderRadius: 14, background: `${s.color}15`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                    <div style={{ width: 12, height: 12, borderRadius: "50%", background: s.color }} />
                  </div>
                  <div style={{ fontWeight: 800, color: C.text, fontSize: 17, marginBottom: 4 }}>{s.title}</div>
                  <div style={{ color: C.muted, fontSize: 14, wordBreak: "break-word", overflowWrap: "anywhere" }}>{s.subtitle}</div>
                </a>
              ))}
            </div>
          </div>
        </Section>

        {/* ─── UBICACIÓN ─── */}
        <Section id="ubicacion">
          <div style={{ marginBottom: 80 }}>
            <div style={{ textAlign: "center", marginBottom: 40 }}>
              <div style={{ display: "inline-block", padding: "6px 14px", borderRadius: 999, background: "rgba(31,122,77,0.08)", color: C.success, fontSize: 12, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 12 }}>
                Visítanos
              </div>
              <h2 style={{ fontSize: 38, fontWeight: 800, color: C.text, lineHeight: 1.15, marginBottom: 10 }}>Ubicación y horario</h2>
            </div>

            <div className="loc-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
              <div style={{ background: C.cardStrong, border: `1px solid ${C.border}`, borderRadius: 24, padding: 32, boxShadow: "0 8px 30px rgba(91,25,15,0.05)", backdropFilter: "blur(10px)" }}>
                <div style={{ marginBottom: 28 }}>
                  <div style={{ fontWeight: 800, color: C.text, fontSize: 18, marginBottom: 10 }}>Dirección</div>
                  <div style={{ color: C.muted, lineHeight: 1.7, fontSize: 15 }}>
                    H. Colegio Militar No. 122<br />Ezequiel Montes, Querétaro
                  </div>
                </div>

                <div style={{ marginBottom: 28 }}>
                  <div style={{ fontWeight: 800, color: C.text, fontSize: 18, marginBottom: 10 }}>Horario</div>
                  <div style={{ color: C.muted, lineHeight: 2.2, fontSize: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${C.border}` }}>
                      <span>Lun, Mar, Jue, Vie, Sáb</span>
                      <b style={{ color: C.text }}>7:30 – 3:30 PM</b>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                      <span>Miércoles y Domingo</span>
                      <b style={{ color: C.text }}>7:30 – 3:00 PM</b>
                    </div>
                  </div>
                </div>

                <div>
                  <div style={{ fontWeight: 800, color: C.text, fontSize: 18, marginBottom: 10 }}>Formas de pago</div>
                  <div style={{ color: C.muted, fontSize: 15 }}>Efectivo, tarjeta, transferencia</div>
                </div>
              </div>

              <div style={{ borderRadius: 24, overflow: "hidden", border: `1px solid ${C.border}`, boxShadow: "0 8px 30px rgba(91,25,15,0.05)", minHeight: 300 }}>
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d934.2!2d-99.8990919!3d20.6649555!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x85d382807e0d8b7d%3A0x10cabfa794775e2c!2sCarnicer%C3%ADa%20Sergio&#39;s!5e0!3m2!1ses!2smx!4v1700000000000"
                  width="100%" height="100%" style={{ border: 0, minHeight: 300 }} allowFullScreen loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade" title="Ubicación Sergio's Carnicería" />
              </div>
            </div>
          </div>
        </Section>

        {/* ─── CENTRO DE OPERACIONES (solo personal) ───
            Antes era un botón rojo grande a media página: el cliente que
            entraba a comprar carne veía un acceso al sistema interno.
            Ahora es un enlace discreto, del tamaño del texto legal. */}
        <Section>
          <div style={{ textAlign: "center", padding: "20px 0 40px" }}>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <button onClick={() => setShowOps(!showOps)} style={{
                padding: "8px 14px", borderRadius: 10, border: "none",
                background: "transparent",
                color: C.muted, cursor: "pointer", fontWeight: 600, fontSize: 12,
                opacity: showOps ? 1 : 0.55, textDecoration: "underline",
              }}>
                {showOps ? "Cerrar panel" : "Acceso personal"}
              </button>
            </div>

            {showOps && (
              <div style={{
                marginTop: 16, padding: 24, borderRadius: 24,
                background: "rgba(255,255,255,0.95)", border: `1px solid ${C.border}`,
                boxShadow: "0 16px 50px rgba(91,25,15,0.10)", maxWidth: 960,
                marginLeft: "auto", marginRight: "auto", textAlign: "left",
                animation: "slideInLeft 0.3s ease",
              }}>
                {empRole ? (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 12, background: C.primary, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 800, fontSize: 18 }}>
                          {empRole === "admin" ? "A" : empRole === "cajera" ? "C" : empRole === "contabilidad" ? "$" : "K"}
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, color: C.text, fontSize: 16 }}>
                            {empRole === "admin" ? "Administrador" : empRole === "cajera" ? "Cajera" : empRole === "contabilidad" ? "Contabilidad" : "Carnicero"}
                            {empName && <span style={{ fontWeight: 600, color: C.muted }}> — {empName}</span>}
                          </div>
                          <div style={{ fontSize: 12, color: C.muted }}>Centro de operaciones</div>
                        </div>
                        <NotificationBell />
                      </div>
                      <button onClick={() => { setEmpRole(null); setEmpName(""); sessionStorage.removeItem("pin_role"); }}
                        style={{ padding: "8px 16px", borderRadius: 10, border: `1px solid ${C.border}`, background: "white", color: C.muted, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
                        Cerrar sesión
                      </button>
                    </div>

                    {(empRole === "admin" || empRole === "cajera") && <QuickStats showInventory={empRole === "admin"} />}

                    {Object.entries(moduleCategories).map(([key, cat]) => {
                      if (!cat.roles.includes(empRole!)) return null;
                      return (
                        <div key={key} style={{ marginBottom: 16 }}>
                          <div style={{ fontSize: 13, fontWeight: 800, color: C.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
                            {cat.label}
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8 }}>
                            {cat.items.map((m) => (
                              <Link key={m.href} href={m.href} {...("target" in m ? { target: (m as any).target } : {})} className="mod-link" style={{
                                display: "flex", alignItems: "center", gap: 10, padding: "12px 14px",
                                borderRadius: 14, background: C.bgSoft, border: `1px solid ${C.border}`,
                                color: C.text, textDecoration: "none",
                              }}>
                                <div>
                                  <div style={{ fontWeight: 700, fontSize: 14 }}>{m.title}</div>
                                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{m.desc}</div>
                                </div>
                              </Link>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </>
                ) : (
                  <div style={{ textAlign: "center", padding: "24px 0" }}>
                    <div style={{ marginBottom: 14, fontWeight: 800, color: C.text, fontSize: 18 }}>Centro de operaciones</div>
                    <div style={{ marginBottom: 16, color: C.muted, fontSize: 15 }}>Ingresa tu PIN para acceder</div>
                    <PinEntry onSuccess={(role, name) => { setEmpRole(role); setEmpName(name); sessionStorage.setItem("pin_role", role); }} />
                  </div>
                )}
              </div>
            )}
          </div>
        </Section>

        {/* ─── FOOTER ─── */}
        <div style={{ textAlign: "center", padding: "16px 0 24px", borderTop: `1px solid ${C.border}` }}>
          <div style={{ color: C.muted, fontSize: 13 }}>
            © {new Date().getFullYear()} Sergio&apos;s Carnicería — Ezequiel Montes, Qro.
          </div>
        </div>
      </div>
    </div>
  );
}
