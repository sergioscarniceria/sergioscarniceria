"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

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

const adminModules = [
  {
    title: "Dashboard ventas",
    description: "Tu negocio en una mirada, sin tanto rodeo.",
    href: "/admin/dashboard",
  },
  {
    title: "Dashboard asistencia",
    description: "Quien llega con ganas, se nota desde la entrada.",
    href: "/admin/dashboard/asistencia",
  },
  {
    title: "Admin clientes",
    description: "Altas, control y orden comercial.",
    href: "/admin/clientes",
  },
  {
    title: "Admin productos",
    description: "Ordena tu catálogo, precios y categorías sin moverle al código.",
    href: "/admin/productos",
  },
  {
    title: "Proveedores / CxP",
    description: "Compras, deudas, pagos y rendimientos de tus proveedores.",
    href: "/admin/proveedores",
  },
  {
    title: "Gestión de PINs",
    description: "Contraseñas de acceso por rol.",
    href: "/admin/pins",
  },
];

const operationModules = [
  {
    title: "Caja",
    description: "Donde cada peso cuenta y cada cobro queda claro.",
    href: "/admin/caja",
  },
  {
    title: "Checador",
    description: "La puntualidad también se cocina todos los días.",
    href: "/asistencia/checador",
  },
  {
    title: "CxC",
    description: "Cobrar bien también es vender mejor.",
    href: "/admin/cxc",
  },
  {
    title: "Pedidos",
    description: "Deleita a tu paladar con lo que se merece.",
    href: "/pedidos",
  },
  {
    title: "Ventas Mostrador",
    description: "Agrega, pesa y cobra sin soltar el ritmo del mostrador.",
    href: "/ventas",
  },
  {
    title: "Repartidores",
    description: "En camino, entregado y sin perder detalle.",
    href: "/repartidores",
  },
  {
    title: "Producción",
    description: "Pasión por el trabajo bien hecho, corte por corte.",
    href: "/produccion",
  },
];

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

export default function HomePage() {
  const [openRecipe, setOpenRecipe] = useState<string | null>(null);
  const [showEmployeeMenu, setShowEmployeeMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div style={pageStyle}>
      <div style={glowTopLeft} />
      <div style={glowTopRight} />

      {/* Sticky navigation */}
      <nav style={{
        ...stickyNavStyle,
        background: scrolled ? "rgba(255,255,255,0.95)" : "transparent",
        boxShadow: scrolled ? COLORS.shadow : "none",
        borderBottom: scrolled ? `1px solid ${COLORS.border}` : "none",
      }}>
        <div style={navInnerStyle}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <img src="/logo.png" alt="Sergio's" style={{ width: 40, height: "auto" }} />
            <span style={{ fontWeight: 800, color: COLORS.text, fontSize: 16 }}>Sergio&apos;s Carnicería</span>
          </Link>
          <div style={navLinksStyle}>
            <a href="#inicio" style={navLinkStyle}>Inicio</a>
            <a href="#recetario" style={navLinkStyle}>Recetario</a>
            <a href="#ubicacion" style={navLinkStyle}>Ubicación</a>
            <a href="#contacto" style={navLinkStyle}>Contacto</a>
            <Link href="/cliente" style={navCtaStyle}>Hacer pedido</Link>
          </div>
        </div>
      </nav>

      <div style={shellStyle}>
        <div id="inicio" style={heroCardStyle}>
          <img
            src="/logo.png"
            alt="Sergios Carnicería"
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

          <div style={locationGridStyle}>
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
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d1868.5!2d-99.98948!3d20.66336!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x85d35e21e8d2e4f7%3A0x9e4a3c08c6e3a2b1!2sCarniceria%20sergios!5e0!3m2!1ses!2smx!4v1700000000000"
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

        {/* Botón discreto para empleados */}
        <div style={employeeAccessStyle}>
          <button
            onClick={() => setShowEmployeeMenu(!showEmployeeMenu)}
            style={employeeButtonStyle}
          >
            {showEmployeeMenu ? "Cerrar panel" : "Acceso empleados"}
          </button>

          {showEmployeeMenu && (
            <div style={employeeMenuStyle}>
              <div style={{ marginBottom: 10, fontWeight: 700, color: COLORS.muted, fontSize: 13 }}>
                Módulos internos
              </div>
              <div style={employeeGridStyle}>
                {[...adminModules, ...operationModules].map((m) => (
                  <Link key={m.href} href={m.href} style={employeeLinkStyle}>
                    {m.title}
                  </Link>
                ))}
              </div>
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

/* Employee access */
const employeeAccessStyle: React.CSSProperties = {
  textAlign: "center",
  padding: "20px 0",
};

const employeeButtonStyle: React.CSSProperties = {
  padding: "10px 20px",
  borderRadius: 12,
  border: `1px solid ${COLORS.border}`,
  background: "rgba(255,255,255,0.6)",
  color: COLORS.muted,
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 13,
};

const employeeMenuStyle: React.CSSProperties = {
  marginTop: 14,
  padding: 18,
  borderRadius: 22,
  background: COLORS.card,
  border: `1px solid ${COLORS.border}`,
  boxShadow: COLORS.shadow,
  maxWidth: 800,
  marginLeft: "auto",
  marginRight: "auto",
};

const employeeGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 8,
};

const employeeLinkStyle: React.CSSProperties = {
  display: "block",
  padding: "10px 14px",
  borderRadius: 12,
  background: COLORS.bgSoft,
  border: `1px solid ${COLORS.border}`,
  color: COLORS.text,
  textDecoration: "none",
  fontWeight: 600,
  fontSize: 14,
  textAlign: "center",
};

/* Footer */
const footerStyle: React.CSSProperties = {
  textAlign: "center",
  padding: "20px 0 10px 0",
};