"use client";

import Link from "next/link";
import { useState } from "react";

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

const internalModules = [
  {
    title: "Pedidos",
    description: "Control general y seguimiento.",
    href: "/pedidos",
  },
  {
    title: "Producción",
    description: "Preparación y operación interna.",
    href: "/produccion",
  },
  {
    title: "Dashboard",
    description: "Ventas, pedidos y métricas.",
    href: "/admin/dashboard",
  },
  {
    title: "Admin clientes",
    description: "Altas y control comercial.",
    href: "/admin/clientes",
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

  return (
    <div style={pageStyle}>
      <div style={glowTopLeft} />
      <div style={glowTopRight} />

      <div style={shellStyle}>
        <div style={heroCardStyle}>
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

          <h1 style={titleStyle}>Sergios Carnicería</h1>
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
                href="https://maps.app.goo.gl/hTsYSdQNFN6sphnBA?g_st=ic"
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

        <div style={recipeSectionStyle}>
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

        <div style={socialSectionStyle}>
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

        <div style={internalSectionStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={{ margin: 0, color: COLORS.text }}>Accesos internos</h2>
            <p style={{ margin: "6px 0 0 0", color: COLORS.muted }}>
              Estas secciones piden contraseña de operación o administración
            </p>
          </div>

          <div style={gridStyle}>
            {internalModules.map((module) => (
              <Link
                key={module.href}
                href={module.href}
                style={{
                  ...cardStyle,
                  textDecoration: "none",
                }}
              >
                <div style={internalBadgeStyle}>Interno</div>
                <div style={cardTitleStyle}>{module.title}</div>
                <div style={cardTextStyle}>{module.description}</div>
                <div style={cardFooterStyle}>Abrir módulo →</div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

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