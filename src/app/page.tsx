"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import NotificationBell from "@/components/NotificationBell";

const COLORS = {
  bg: "#f7f1e8",
  bgSoft: "#fbf8f3",
  card: "rgba(255,255,255,0.76)",
  cardStrong: "rgba(255,255,255,0.9)",
  border: "rgba(92, 27, 17, 0.10)",
  text: "#3b1c16",
  muted: "#7a5a52",
  primary: "#7b2218",
  primaryDark: "#5a190f",
  accent: "#d9c9a3",
  success: "#1f7a4d",
  warning: "#a66a10",
  info: "#355c7d",
  shadow: "0 10px 30px rgba(91, 25, 15, 0.08)",
};

// ─── Módulos organizados por categoría ───
const moduleCategories = {
  admin: {
    label: "Administración",
    icon: "⚙️",
    roles: ["admin"],
    items: [
      { title: "Dashboard ventas", icon: "📊", href: "/admin/dashboard", desc: "Resumen del negocio" },
      { title: "Proveedores / CxP", icon: "🏭", href: "/admin/proveedores", desc: "Compras y pagos" },
      { title: "Gestión de PINs", icon: "🔐", href: "/admin/pins", desc: "Accesos por rol" },
    ],
  },
  gestion: {
    label: "Gestión",
    icon: "📋",
    roles: ["admin", "cajera"],
    items: [
      { title: "Admin clientes", icon: "👥", href: "/admin/clientes", desc: "Altas y control" },
      { title: "Admin productos", icon: "🥩", href: "/admin/productos", desc: "Catálogo y precios" },
      { title: "Inventario", icon: "📦", href: "/inventario/complementos", desc: "Bodega y complementos" },
      { title: "Compras", icon: "🛒", href: "/inventario/compras", desc: "Órdenes a proveedores" },
      { title: "Auditoría", icon: "✅", href: "/inventario/auditoria", desc: "Conteo físico y pérdidas" },
      { title: "Dashboard asistencia", icon: "📅", href: "/admin/dashboard/asistencia", desc: "Control de asistencia" },
    ],
  },
  caja: {
    label: "Caja y cobranza",
    icon: "💰",
    roles: ["admin", "cajera"],
    items: [
      { title: "Caja", icon: "💵", href: "/admin/caja", desc: "Flujo de efectivo" },
      { title: "Cobranza", icon: "🧾", href: "/cobranza", desc: "Cobrar tickets" },
      { title: "CxC", icon: "📒", href: "/cxc", desc: "Cuentas por cobrar" },
      { title: "Gastos Externos", icon: "📊", href: "/admin/gastos", desc: "Gastos fuera de caja" },
    ],
  },
  operacion: {
    label: "Operación diaria",
    icon: "🔪",
    roles: ["admin", "cajera", "carnicero"],
    items: [
      { title: "Pedidos", icon: "📝", href: "/pedidos", desc: "Captura de pedidos" },
      { title: "Ventas Mostrador", icon: "🏪", href: "/ventas", desc: "Venta en tienda" },
      { title: "Producción", icon: "🔥", href: "/produccion", desc: "Preparar pedidos" },
      { title: "Repartidores", icon: "🚚", href: "/repartidores", desc: "Control de entregas" },
      { title: "Checador", icon: "⏰", href: "/asistencia/checador", desc: "Checar asistencia" },
      { title: "Recetario", icon: "📖", href: "/admin/recetario", desc: "Recetas con costos" },
      { title: "Tienda Online", icon: "🌐", href: "/tienda", desc: "Pedidos de clientes" },
    ],
  },
};

const recipes = [
  {
    title: "Arrachera al ajo y limón",
    description:
      "Una receta rápida y lucidora para una carne suave, jugosa y con mucho sabor.",
    image:
      "https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?auto=format&fit=crop&w=1200&q=80",
    time: "25 min",
    ingredients: [
      "1 kg de arrachera",
      "4 dientes de ajo picados",
      "Jugo de 3 limones",
      "2 cucharadas de aceite de oliva",
      "Sal y pimienta al gusto",
    ],
    steps: [
      "Mezcla ajo, limón, aceite, sal y pimienta.",
      "Marina la arrachera por 30 a 60 minutos.",
      "Cocina en parrilla o sartén bien caliente.",
      "Deja reposar 5 minutos y rebana en tiras finas.",
      "Acompaña con cebollitas, nopales o tortillas calientes.",
    ],
  },
  {
    title: "Rib eye a la mantequilla",
    description:
      "Ideal para una cena especial, con un acabado elegante de ajo y romero.",
    image:
      "https://images.unsplash.com/photo-1558030006-450675393462?auto=format&fit=crop&w=1200&q=80",
    time: "20 min",
    ingredients: [
      "2 rib eyes",
      "2 cucharadas de mantequilla",
      "2 dientes de ajo",
      "1 ramita de romero",
      "Sal gruesa y pimienta",
    ],
    steps: [
      "Sazona los rib eyes con sal y pimienta.",
      "Sella en sartén o parrilla muy caliente.",
      "Agrega mantequilla, ajo y romero.",
      "Baña la carne con la mantequilla mientras termina su cocción.",
      "Deja reposar unos minutos antes de servir.",
    ],
  },
  {
    title: "Aguja marinada para parrilla",
    description:
      "Una receta rendidora y muy buena para reuniones familiares o comidas con amigos.",
    image:
      "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1200&q=80",
    time: "35 min",
    ingredients: [
      "1.5 kg de aguja",
      "1/2 taza de salsa inglesa",
      "1/4 taza de jugo de naranja",
      "2 cucharadas de mostaza",
      "Sal, pimienta y ajo en polvo",
    ],
    steps: [
      "Mezcla todos los ingredientes del marinado.",
      "Deja reposar la carne al menos 1 hora.",
      "Asa a fuego medio hasta obtener buen color y jugosidad.",
      "Rebana y sirve con frijoles, guacamole o ensalada.",
      "Perfecta para tacos o plato fuerte.",
    ],
  },
];

const socialLinks = [
  {
    title: "WhatsApp 1",
    subtitle: "+52 441 115 3314",
    href: "https://wa.me/524411153314",
    tone: "primary",
  },
  {
    title: "WhatsApp 2",
    subtitle: "+52 441 118 5767",
    href: "https://wa.me/524411185767",
    tone: "success",
  },
  {
    title: "Instagram",
    subtitle: "@sergioscarniceria",
    href: "https://www.instagram.com/sergioscarniceria?igsh=OGRycjY4bGNpdmk2",
    tone: "info",
  },
  {
    title: "Facebook",
    subtitle: "Sergios Carnicería",
    href: "https://www.facebook.com/share/1RS83jZX6D/?mibextid=wwXIfr",
    tone: "warning",
  },
];

function PinEntry({ onSuccess }: { onSuccess: (role: string, name: string) => void }) {
  const supabase = getSupabaseClient();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  async function checkPin() {
    if (!pin.trim()) return;
    setChecking(true);
    setError("");

    // Check app_pins (admin/cajera roles)
    const { data: appPin } = await supabase
      .from("app_pins")
      .select("role")
      .eq("pin", pin.trim())
      .single();

    if (appPin) {
      onSuccess(appPin.role, "");
      setChecking(false);
      return;
    }

    // Check employee_codes
    const { data: empCode } = await supabase
      .from("employee_codes")
      .select("name, role")
      .eq("code", pin.trim())
      .single();

    if (empCode) {
      const role = empCode.role === "cajera" ? "cajera" : "carnicero";
      onSuccess(role, empCode.name);
      setChecking(false);
      return;
    }

    setError("PIN incorrecto");
    setChecking(false);
  }

  return (
    <div>
      <input
        value={pin}
        onChange={(e) => { setPin(e.target.value); setError(""); }}
        onKeyDown={(e) => e.key === "Enter" && checkPin()}
        type="password"
        placeholder="PIN"
        autoFocus
        style={{ padding: "12px 16px", borderRadius: 12, border: `1px solid ${COLORS.border}`, outline: "none", fontSize: 18, textAlign: "center", letterSpacing: 6, width: "100%", maxWidth: 200, marginBottom: 8, color: COLORS.text }}
      />
      {error && <div style={{ color: "#b42318", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{error}</div>}
      <button onClick={checkPin} disabled={checking} style={{ padding: "10px 24px", borderRadius: 12, border: "none", background: `linear-gradient(180deg, ${COLORS.primary} 0%, ${COLORS.primaryDark} 100%)`, color: "white", fontWeight: 800, cursor: "pointer", fontSize: 14 }}>
        {checking ? "..." : "Entrar"}
      </button>
    </div>
  );
}

function QuickStats({ showInventory = false }: { showInventory?: boolean }) {
  const supabase = getSupabaseClient();
  const [stats, setStats] = useState<{ pedidosHoy: number; ventasHoy: number; pendientes: number; enCamino: number; inventoryValue: number } | null>(null);

  useEffect(() => {
    async function load() {
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

      const ordersPromise = supabase
        .from("orders")
        .select("id, status, delivery_status, order_items(kilos, price)")
        .gte("created_at", `${todayStr}T00:00:00`);

      const bodegaPromise = showInventory
        ? supabase.from("bodega_items").select("stock, cost").eq("is_active", true)
        : Promise.resolve({ data: [] as any[] });

      const complementosPromise = showInventory
        ? supabase.from("products").select("stock, purchase_price, category, fixed_piece_price").eq("is_active", true)
        : Promise.resolve({ data: [] as any[] });

      const [{ data: ordersData }, { data: bodegaData }, { data: productsData }] = await Promise.all([
        ordersPromise,
        bodegaPromise,
        complementosPromise,
      ]);

      const orders = ordersData || [];
      const ventasHoy = orders.reduce((acc: number, o: any) => {
        return acc + (o.order_items || []).reduce((s: number, i: any) => s + (i.kilos || 0) * (i.price || 0), 0);
      }, 0);
      const pendientes = orders.filter((o: any) => o.status === "nuevo" || o.status === "proceso").length;
      const enCamino = orders.filter((o: any) => o.delivery_status === "en_camino").length;

      const bodegaValue = (bodegaData || []).reduce((acc: number, i: any) => acc + (Number(i.stock) || 0) * (Number(i.cost) || 0), 0);
      const complementos = (productsData || []).filter((p: any) => p.category === "Complementos" || (p.fixed_piece_price !== null && Number(p.fixed_piece_price) > 0));
      const complementosValue = complementos.reduce((acc: number, p: any) => acc + (Number(p.stock) || 0) * (Number(p.purchase_price) || 0), 0);
      const inventoryValue = bodegaValue + complementosValue;

      setStats({ pedidosHoy: orders.length, ventasHoy, pendientes, enCamino, inventoryValue });
    }
    load();
  }, [showInventory]);

  if (!stats) return null;

  const cols = showInventory ? 5 : 4;
  return (
    <div className="quick-stats-grid" style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 10, marginBottom: 16 }}>
      <div style={quickStatCardStyle}>
        <div style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700 }}>Pedidos hoy</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.text }}>{stats.pedidosHoy}</div>
      </div>
      <div style={quickStatCardStyle}>
        <div style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700 }}>Ventas hoy</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.primary }}>${stats.ventasHoy.toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
      </div>
      <div style={quickStatCardStyle}>
        <div style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700 }}>En producción</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: stats.pendientes > 0 ? COLORS.warning : COLORS.success }}>{stats.pendientes}</div>
      </div>
      <div style={quickStatCardStyle}>
        <div style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700 }}>En camino</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: stats.enCamino > 0 ? COLORS.info : COLORS.muted }}>{stats.enCamino}</div>
      </div>
      {showInventory && (
        <div style={quickStatCardStyle}>
          <div style={{ fontSize: 11, color: COLORS.muted, fontWeight: 700 }}>Valor inventario</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.primary }}>${stats.inventoryValue.toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
        </div>
      )}
    </div>
  );
}

export default function HomePage() {
  const [openRecipe, setOpenRecipe] = useState<string | null>(null);
  const [showEmployeeMenu, setShowEmployeeMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [empRole, setEmpRole] = useState<string | null>(null); // "admin" | "cajera" | "carnicero"
  const [empName, setEmpName] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Check if already logged in
  useEffect(() => {
    const role = typeof window !== "undefined" ? sessionStorage.getItem("pin_role") : null;
    if (role) setEmpRole(role);
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div style={pageStyle}>
      <div style={glowTopLeft} />
      <div style={glowTopRight} />

      {/* Responsive CSS */}
      <style>{`
        @media (max-width: 700px) {
          .nav-links-desktop { display: none !important; }
          .nav-hamburger { display: flex !important; }
          .nav-mobile-menu { display: flex !important; }
          .location-grid { grid-template-columns: 1fr !important; }
          .quick-stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (min-width: 701px) {
          .nav-links-desktop { display: flex !important; }
          .nav-hamburger { display: none !important; }
          .nav-mobile-menu { display: none !important; }
        }
      `}</style>

      {/* Sticky navigation */}
      <nav style={{
        ...stickyNavStyle,
        background: scrolled || mobileMenuOpen ? "rgba(255,255,255,0.95)" : "transparent",
        boxShadow: scrolled || mobileMenuOpen ? COLORS.shadow : "none",
        borderBottom: scrolled || mobileMenuOpen ? `1px solid ${COLORS.border}` : "none",
      }}>
        <div style={navInnerStyle}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <img src="/logo-sm.png" alt="Sergio's" style={{ width: 40, height: "auto" }} loading="eager" fetchPriority="high" />
            <span style={{ fontWeight: 800, color: COLORS.text, fontSize: 16 }}>Sergio&apos;s Carnicería</span>
          </Link>

          {/* Desktop links */}
          <div className="nav-links-desktop" style={navLinksStyle}>
            <a href="#inicio" style={navLinkStyle}>Inicio</a>
            <a href="#recetario" style={navLinkStyle}>Recetario</a>
            <a href="#ubicacion" style={navLinkStyle}>Ubicación</a>
            <a href="#contacto" style={navLinkStyle}>Contacto</a>
            <Link href="/cliente" style={navCtaStyle}>Hacer pedido</Link>
          </div>

          {/* Hamburger button (mobile) */}
          <button
            className="nav-hamburger"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{
              display: "none",
              alignItems: "center",
              justifyContent: "center",
              width: 44,
              height: 44,
              borderRadius: 12,
              border: `1px solid ${COLORS.border}`,
              background: "white",
              cursor: "pointer",
              fontSize: 22,
              color: COLORS.text,
            }}
          >
            {mobileMenuOpen ? "✕" : "☰"}
          </button>
        </div>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div
            className="nav-mobile-menu"
            style={{
              display: "none",
              flexDirection: "column",
              gap: 4,
              padding: "12px 16px 16px",
              maxWidth: 1320,
              margin: "0 auto",
            }}
          >
            <a href="#inicio" onClick={() => setMobileMenuOpen(false)} style={{ ...navLinkStyle, padding: "12px 16px", fontSize: 16 }}>Inicio</a>
            <a href="#recetario" onClick={() => setMobileMenuOpen(false)} style={{ ...navLinkStyle, padding: "12px 16px", fontSize: 16 }}>Recetario</a>
            <a href="#ubicacion" onClick={() => setMobileMenuOpen(false)} style={{ ...navLinkStyle, padding: "12px 16px", fontSize: 16 }}>Ubicación</a>
            <a href="#contacto" onClick={() => setMobileMenuOpen(false)} style={{ ...navLinkStyle, padding: "12px 16px", fontSize: 16 }}>Contacto</a>
            <Link href="/cliente" onClick={() => setMobileMenuOpen(false)} style={{ ...navCtaStyle, padding: "14px 16px", fontSize: 16, textAlign: "center", display: "block", marginTop: 4 }}>Hacer pedido</Link>
          </div>
        )}
      </nav>

      <div style={shellStyle}>
        <div id="inicio" style={heroCardStyle}>
          <img
            src="/logo-sm.png"
            alt="Sergios Carnicería"
            loading="eager"
            fetchPriority="high"
            style={{
              width: 190,
              maxWidth: "70vw",
              height: "auto",
              display: "block",
              margin: "0 auto 18px auto",
            }}
          />

          <h1 style={titleStyle}>Sergio&apos;s Carnicería</h1>
          <p style={subtitleStyle}>
            El sabor de una gran comida empieza con una gran carne. Aquí puedes
            inspirarte, descubrir nuevas ideas para cocinar, pedir tus productos
            favoritos y llevar a tu mesa cortes con la calidad y el sabor que
            hacen especial cada reunión, cada comida y cada asado.
          </p>

          <div style={customerCtaBoxStyle}>
            <div style={customerCtaLabelStyle}>Acceso principal para clientes</div>
            <Link href="/cliente" style={primaryButtonStyle}>
              Entrar al portal cliente
            </Link>
          </div>
        </div>

        <div style={promoSectionStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={{ margin: 0, color: COLORS.text }}>Promoción especial</h2>
            <p style={{ margin: "6px 0 0 0", color: COLORS.muted }}>
              Ayúdanos con tu reseña y recibe un beneficio en tu próxima compra
            </p>
          </div>

          <div style={promoCardStyle}>
            <div style={promoBadgeStyle}>Google Maps</div>
            <div style={promoTitleStyle}>
              Califícanos con 5 estrellas y obtén 5% de descuento
            </div>
            <div style={promoTextStyle}>
              Déjanos tu reseña en Google Maps y manda tu comprobante a nuestro
              WhatsApp. En tu siguiente compra te hacemos válido un 5% de
              descuento.
            </div>

            <div style={promoButtonsWrapStyle}>
              <a
                href="https://maps.app.goo.gl/XeRuLcML1HRg4U8G8"
                target="_blank"
                rel="noreferrer"
                style={secondarySmallButtonStyle}
              >
                Calificar en Google Maps
              </a>

              <a
                href="https://wa.me/524411153314"
                target="_blank"
                rel="noreferrer"
                style={primarySmallButtonStyle}
              >
                Enviar comprobante por WhatsApp
              </a>
            </div>
          </div>
        </div>

        <div id="recetario" style={recipeSectionStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={{ margin: 0, color: COLORS.text }}>Recetario</h2>
            <p style={{ margin: "6px 0 0 0", color: COLORS.muted }}>
              Ideas para inspirarte y cocinar con nuestros productos
            </p>
          </div>

          <div style={recipeGridStyle}>
            {recipes.map((recipe) => {
              const isOpen = openRecipe === recipe.title;

              return (
                <div key={recipe.title} style={recipeCardStyle}>
                  <img
                    src={recipe.image}
                    alt={recipe.title}
                    style={recipeImageStyle}
                  />

                  <div style={{ padding: 18 }}>
                    <div style={recipeTimeStyle}>{recipe.time}</div>
                    <div style={recipeTitleStyle}>{recipe.title}</div>
                    <div style={recipeTextStyle}>{recipe.description}</div>

                    <button
                      onClick={() =>
                        setOpenRecipe(isOpen ? null : recipe.title)
                      }
                      style={recipeButtonStyle}
                    >
                      {isOpen ? "Ocultar receta" : "Ver receta"}
                    </button>

                    {isOpen ? (
                      <div style={recipeDetailBoxStyle}>
                        <div style={recipeDetailTitleStyle}>Ingredientes</div>
                        <ul style={recipeListStyle}>
                          {recipe.ingredients.map((item) => (
                            <li key={item} style={recipeListItemStyle}>
                              {item}
                            </li>
                          ))}
                        </ul>

                        <div style={recipeDetailTitleStyle}>Preparación</div>
                        <ol style={recipeListStyle}>
                          {recipe.steps.map((step) => (
                            <li key={step} style={recipeListItemStyle}>
                              {step}
                            </li>
                          ))}
                        </ol>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div id="contacto" style={socialSectionStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={{ margin: 0, color: COLORS.text }}>Redes y contacto</h2>
            <p style={{ margin: "6px 0 0 0", color: COLORS.muted }}>
              Encuéntranos, escríbenos y mantente al tanto
            </p>
          </div>

          <div style={socialGridStyle}>
            {socialLinks.map((social) => (
              <a
                key={social.title}
                href={social.href}
                target="_blank"
                rel="noreferrer"
                style={{
                  ...socialCardStyle,
                  textDecoration: "none",
                }}
              >
                <div
                  style={{
                    ...socialBadgeStyle,
                    ...(social.tone === "primary"
                      ? {
                          background: "rgba(123, 34, 24, 0.12)",
                          color: COLORS.primary,
                        }
                      : social.tone === "success"
                      ? {
                          background: "rgba(31, 122, 77, 0.12)",
                          color: COLORS.success,
                        }
                      : social.tone === "warning"
                      ? {
                          background: "rgba(166, 106, 16, 0.12)",
                          color: COLORS.warning,
                        }
                      : {
                          background: "rgba(53, 92, 125, 0.12)",
                          color: COLORS.info,
                        }),
                  }}
                >
                  {social.title}
                </div>

                <div style={cardTitleStyle}>{social.title}</div>
                <div style={cardTextStyle}>{social.subtitle}</div>
                <div style={cardFooterStyle}>Abrir →</div>
              </a>
            ))}
          </div>
        </div>

        {/* Ubicación y horario */}
        <div id="ubicacion" style={locationSectionStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={{ margin: 0, color: COLORS.text }}>Ubicación y horario</h2>
            <p style={{ margin: "6px 0 0 0", color: COLORS.muted }}>
              Visítanos en nuestra sucursal
            </p>
          </div>

          <div className="location-grid" style={locationGridStyle}>
            <div style={locationInfoCardStyle}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 800, color: COLORS.text, fontSize: 18, marginBottom: 6 }}>Dirección</div>
                <div style={{ color: COLORS.muted, lineHeight: 1.6 }}>
                  H. Colegio Militar No. 122<br />
                  Ezequiel Montes, Querétaro
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 800, color: COLORS.text, fontSize: 18, marginBottom: 6 }}>Horario</div>
                <div style={{ color: COLORS.muted, lineHeight: 1.8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <span>Lunes, Martes, Jueves, Viernes, Sábado</span>
                    <b style={{ color: COLORS.text }}>7:30 AM – 3:30 PM</b>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <span>Miércoles y Domingo</span>
                    <b style={{ color: COLORS.text }}>7:30 AM – 3:00 PM</b>
                  </div>
                </div>
              </div>

              <div>
                <div style={{ fontWeight: 800, color: COLORS.text, fontSize: 18, marginBottom: 6 }}>Formas de pago</div>
                <div style={{ color: COLORS.muted }}>Efectivo, tarjeta, transferencia</div>
              </div>
            </div>

            <div style={mapContainerStyle}>
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d934.2!2d-99.8990919!3d20.6649555!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x85d382807e0d8b7d%3A0x10cabfa794775e2c!2sCarnicer%C3%ADa%20Sergio&#39;s!5e0!3m2!1ses!2smx!4v1700000000000"
                width="100%"
                height="100%"
                style={{ border: 0, borderRadius: 18, minHeight: 280 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Ubicación Sergio's Carnicería"
              />
            </div>
          </div>
        </div>

        {/* ─── Centro de operaciones ─── */}
        <div style={operationsHubStyle}>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginBottom: showEmployeeMenu ? 0 : 0 }}>
            <Link
              href="/asistencia/checador"
              style={{
                display: "inline-block",
                padding: "12px 20px",
                borderRadius: 14,
                background: "rgba(31, 122, 77, 0.10)",
                color: "#1f7a4d",
                textDecoration: "none",
                fontWeight: 700,
                fontSize: 14,
                border: "1px solid rgba(31, 122, 77, 0.15)",
              }}
            >
              Checador de asistencia
            </Link>
            <button
              onClick={() => setShowEmployeeMenu(!showEmployeeMenu)}
              style={{
                padding: "12px 24px",
                borderRadius: 14,
                border: "none",
                background: showEmployeeMenu ? COLORS.primary : `linear-gradient(180deg, ${COLORS.primary} 0%, ${COLORS.primaryDark} 100%)`,
                color: "white",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 14,
                boxShadow: "0 4px 12px rgba(123, 34, 24, 0.15)",
              }}
            >
              {showEmployeeMenu ? "Cerrar panel" : "Centro de operaciones"}
            </button>
          </div>

          {showEmployeeMenu && (
            <div style={operationsPanelStyle}>
              {empRole ? (
                <>
                  {/* Header con rol y stats */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: `linear-gradient(180deg, ${COLORS.primary} 0%, ${COLORS.primaryDark} 100%)`, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 800, fontSize: 18 }}>
                        {empRole === "admin" ? "A" : empRole === "cajera" ? "C" : "K"}
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, color: COLORS.text, fontSize: 16 }}>
                          {empRole === "admin" ? "Administrador" : empRole === "cajera" ? "Cajera" : "Carnicero"}
                          {empName && <span style={{ fontWeight: 600, color: COLORS.muted }}> — {empName}</span>}
                        </div>
                        <div style={{ fontSize: 12, color: COLORS.muted }}>Centro de operaciones</div>
                      </div>
                      <NotificationBell />
                    </div>
                    <button onClick={() => { setEmpRole(null); setEmpName(""); sessionStorage.removeItem("pin_role"); }} style={{ padding: "8px 16px", borderRadius: 10, border: `1px solid ${COLORS.border}`, background: "white", color: COLORS.muted, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>Cerrar sesión</button>
                  </div>

                  {/* Mini stats - solo admin y cajeras */}
                  {(empRole === "admin" || empRole === "cajera") && <QuickStats showInventory={empRole === "admin"} />}

                  {/* Módulos por categoría */}
                  {Object.entries(moduleCategories).map(([key, cat]) => {
                    if (!cat.roles.includes(empRole!)) return null;
                    return (
                      <div key={key} style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: COLORS.muted, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                          <span>{cat.icon}</span> {cat.label}
                        </div>
                        <div style={moduleGridStyle}>
                          {cat.items.map((m) => (
                            <Link key={m.href} href={m.href} style={moduleLinkStyle}>
                              <span style={{ fontSize: 22 }}>{m.icon}</span>
                              <div>
                                <div style={{ fontWeight: 700, color: COLORS.text, fontSize: 14 }}>{m.title}</div>
                                <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>{m.desc}</div>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </>
              ) : (
                <div style={{ textAlign: "center", padding: "20px 0" }}>
                  <div style={{ marginBottom: 14, fontWeight: 700, color: COLORS.text, fontSize: 16 }}>
                    Centro de operaciones
                  </div>
                  <div style={{ marginBottom: 14, color: COLORS.muted, fontSize: 14 }}>
                    Ingresa tu PIN para acceder a los módulos del sistema
                  </div>
                  <PinEntry onSuccess={(role, name) => { setEmpRole(role); setEmpName(name); sessionStorage.setItem("pin_role", role); }} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={footerStyle}>
          <div style={{ color: COLORS.muted, fontSize: 13 }}>
            © {new Date().getFullYear()} Sergio&apos;s Carnicería — Ezequiel Montes, Qro.
          </div>
        </div>
        </div>
      </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: `linear-gradient(180deg, ${COLORS.bgSoft} 0%, ${COLORS.bg} 100%)`,
  padding: "70px 16px 16px 16px",
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
  maxWidth: 1320,
  margin: "0 auto",
  position: "relative",
  zIndex: 2,
};

const heroCardStyle: React.CSSProperties = {
  background: COLORS.cardStrong,
  backdropFilter: "blur(10px)",
  border: `1px solid ${COLORS.border}`,
  borderRadius: 30,
  padding: 28,
  boxShadow: COLORS.shadow,
  textAlign: "center",
  marginBottom: 24,
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  color: COLORS.text,
  fontSize: 42,
  fontWeight: 800,
  lineHeight: 1.1,
};

const subtitleStyle: React.CSSProperties = {
  maxWidth: 860,
  margin: "14px auto 0 auto",
  color: COLORS.muted,
  fontSize: 17,
  lineHeight: 1.6,
};

const customerCtaBoxStyle: React.CSSProperties = {
  marginTop: 26,
  maxWidth: 560,
  marginLeft: "auto",
  marginRight: "auto",
  padding: 22,
  borderRadius: 22,
  background: "rgba(255,255,255,0.72)",
  border: `1px solid ${COLORS.border}`,
};

const customerCtaLabelStyle: React.CSSProperties = {
  marginBottom: 12,
  color: COLORS.muted,
  fontSize: 14,
  fontWeight: 700,
};

const primaryButtonStyle: React.CSSProperties = {
  display: "inline-block",
  width: "100%",
  maxWidth: 320,
  padding: "16px 24px",
  borderRadius: 18,
  border: "none",
  background: `linear-gradient(180deg, ${COLORS.primary} 0%, ${COLORS.primaryDark} 100%)`,
  color: "white",
  textDecoration: "none",
  fontWeight: 800,
  fontSize: 16,
  boxSizing: "border-box",
  boxShadow: "0 8px 18px rgba(123, 34, 24, 0.20)",
};

const promoSectionStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.46)",
  border: `1px solid ${COLORS.border}`,
  borderRadius: 28,
  padding: 20,
  marginBottom: 24,
};

const promoCardStyle: React.CSSProperties = {
  background: COLORS.card,
  backdropFilter: "blur(10px)",
  border: `1px solid ${COLORS.border}`,
  borderRadius: 22,
  padding: 22,
  boxShadow: COLORS.shadow,
};

const promoBadgeStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  marginBottom: 12,
  background: "rgba(166, 106, 16, 0.12)",
  color: COLORS.warning,
};

const promoTitleStyle: React.CSSProperties = {
  color: COLORS.text,
  fontWeight: 800,
  fontSize: 24,
  marginBottom: 10,
};

const promoTextStyle: React.CSSProperties = {
  color: COLORS.muted,
  lineHeight: 1.6,
};

const promoButtonsWrapStyle: React.CSSProperties = {
  marginTop: 16,
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
};

const primarySmallButtonStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "12px 18px",
  borderRadius: 14,
  border: "none",
  background: `linear-gradient(180deg, ${COLORS.primary} 0%, ${COLORS.primaryDark} 100%)`,
  color: "white",
  textDecoration: "none",
  fontWeight: 700,
};

const secondarySmallButtonStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "12px 18px",
  borderRadius: 14,
  border: `1px solid ${COLORS.border}`,
  background: "rgba(255,255,255,0.85)",
  color: COLORS.text,
  textDecoration: "none",
  fontWeight: 700,
};

const recipeSectionStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.46)",
  border: `1px solid ${COLORS.border}`,
  borderRadius: 28,
  padding: 20,
  marginBottom: 24,
};

const socialSectionStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.46)",
  border: `1px solid ${COLORS.border}`,
  borderRadius: 28,
  padding: 20,
  marginBottom: 24,
};

const internalSectionStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.46)",
  border: `1px solid ${COLORS.border}`,
  borderRadius: 28,
  padding: 20,
};

const sectionHeaderStyle: React.CSSProperties = {
  marginBottom: 16,
};

const recipeGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 16,
};

const recipeCardStyle: React.CSSProperties = {
  background: COLORS.card,
  backdropFilter: "blur(10px)",
  border: `1px solid ${COLORS.border}`,
  borderRadius: 22,
  overflow: "hidden",
  boxShadow: COLORS.shadow,
};

const recipeImageStyle: React.CSSProperties = {
  width: "100%",
  height: 220,
  objectFit: "cover",
  display: "block",
};

const recipeTimeStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  marginBottom: 12,
  background: "rgba(166, 106, 16, 0.12)",
  color: COLORS.warning,
};

const recipeTitleStyle: React.CSSProperties = {
  color: COLORS.text,
  fontWeight: 800,
  fontSize: 22,
  marginBottom: 10,
};

const recipeTextStyle: React.CSSProperties = {
  color: COLORS.muted,
  lineHeight: 1.5,
  marginBottom: 14,
};

const recipeButtonStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "none",
  background: COLORS.primary,
  color: "white",
  cursor: "pointer",
  fontWeight: 700,
};

const recipeDetailBoxStyle: React.CSSProperties = {
  marginTop: 14,
  padding: 14,
  borderRadius: 16,
  background: COLORS.bgSoft,
  border: `1px solid ${COLORS.border}`,
};

const recipeDetailTitleStyle: React.CSSProperties = {
  fontWeight: 800,
  color: COLORS.text,
  marginBottom: 8,
  marginTop: 6,
};

const recipeListStyle: React.CSSProperties = {
  margin: 0,
  paddingLeft: 18,
  color: COLORS.muted,
};

const recipeListItemStyle: React.CSSProperties = {
  marginBottom: 6,
  lineHeight: 1.5,
};

const socialGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
  gap: 16,
};

const socialCardStyle: React.CSSProperties = {
  background: COLORS.card,
  backdropFilter: "blur(10px)",
  border: `1px solid ${COLORS.border}`,
  borderRadius: 22,
  padding: 18,
  boxShadow: COLORS.shadow,
  minHeight: 170,
};

const socialBadgeStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  marginBottom: 12,
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
  gap: 16,
};

const cardStyle: React.CSSProperties = {
  background: COLORS.card,
  backdropFilter: "blur(10px)",
  border: `1px solid ${COLORS.border}`,
  borderRadius: 22,
  padding: 18,
  boxShadow: COLORS.shadow,
  minHeight: 190,
};

const internalBadgeStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  marginBottom: 12,
  background: "rgba(53, 92, 125, 0.12)",
  color: COLORS.info,
};

const cardTitleStyle: React.CSSProperties = {
  color: COLORS.text,
  fontWeight: 800,
  fontSize: 22,
  marginBottom: 10,
};

const cardTextStyle: React.CSSProperties = {
  color: COLORS.muted,
  lineHeight: 1.5,
  minHeight: 48,
};

const cardFooterStyle: React.CSSProperties = {
  marginTop: 18,
  color: COLORS.primary,
  fontWeight: 700,
};

/* Sticky navigation */
const stickyNavStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  zIndex: 100,
  padding: "10px 16px",
  transition: "all 0.25s ease",
};

const navInnerStyle: React.CSSProperties = {
  maxWidth: 1320,
  margin: "0 auto",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
};

const navLinksStyle: React.CSSProperties = {
  display: "flex",
  gap: 6,
  alignItems: "center",
  flexWrap: "wrap",
};

const navLinkStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 12,
  color: COLORS.text,
  textDecoration: "none",
  fontWeight: 600,
  fontSize: 14,
};

const navCtaStyle: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: 12,
  background: COLORS.primary,
  color: "white",
  textDecoration: "none",
  fontWeight: 700,
  fontSize: 14,
};

/* Location section */
const locationSectionStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.46)",
  border: `1px solid ${COLORS.border}`,
  borderRadius: 28,
  padding: 20,
  marginBottom: 24,
};

const locationGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
  gap: 20,
};

const locationInfoCardStyle: React.CSSProperties = {
  background: COLORS.card,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 22,
  padding: 22,
  boxShadow: COLORS.shadow,
};

const mapContainerStyle: React.CSSProperties = {
  background: COLORS.card,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 22,
  overflow: "hidden",
  boxShadow: COLORS.shadow,
  minHeight: 280,
};

/* Operations hub */
const operationsHubStyle: React.CSSProperties = {
  textAlign: "center",
  padding: "20px 0",
};

const operationsPanelStyle: React.CSSProperties = {
  marginTop: 14,
  padding: 22,
  borderRadius: 24,
  background: "rgba(255,255,255,0.92)",
  border: `1px solid ${COLORS.border}`,
  boxShadow: "0 12px 40px rgba(91, 25, 15, 0.10)",
  maxWidth: 960,
  marginLeft: "auto",
  marginRight: "auto",
  textAlign: "left",
};

const moduleGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: 8,
};

const moduleLinkStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "12px 14px",
  borderRadius: 14,
  background: COLORS.bgSoft,
  border: `1px solid ${COLORS.border}`,
  color: COLORS.text,
  textDecoration: "none",
  transition: "all 0.15s ease",
};

const quickStatCardStyle: React.CSSProperties = {
  background: COLORS.bgSoft,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 14,
  padding: "10px 14px",
  textAlign: "center",
};

/* Footer */
const footerStyle: React.CSSProperties = {
  textAlign: "center",
  padding: "20px 0 10px 0",
};