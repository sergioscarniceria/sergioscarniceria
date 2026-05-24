"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { useKeepAwake } from "@/lib/useKeepAwake";

/* ─── Types ─── */
type Product = {
  id: string;
  name: string;
  price: number | null;
  category: string | null;
  sale_type: string | null;
  fixed_piece_price: number | null;
  image_url: string | null;
};

type MediaItem = {
  id: string;
  file_url: string;
  media_type: string;
  duration_seconds?: number;
};

/* ─── Constants ─── */
const BANNER_DURATION = 5000;
const PRODUCT_SLIDE_DURATION = 6000;
const TRANSITION_MS = 700;
const PRODUCTS_PER_SLIDE = 3;
const RELOAD_INTERVAL = 10 * 60 * 1000;

/* ─── Colors ─── */
const C = {
  bg: "#1a0a06",
  bgGrad: "linear-gradient(135deg, #1a0a06 0%, #2d1108 50%, #1a0a06 100%)",
  card: "rgba(255,255,255,0.06)",
  cardBorder: "rgba(212,168,83,0.25)",
  gold: "#d4a853",
  goldLight: "#e8c97a",
  text: "#fff",
  muted: "rgba(255,255,255,0.55)",
  price: "#d4a853",
  accent: "#7b2218",
};

export default function DisplayPromo() {
  useKeepAwake();
  const [products, setProducts] = useState<Product[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [transitioning, setTransitioning] = useState(false);

  // Unified carousel: builds a list of "slides" mixing banners and product groups
  const [slideIndex, setSlideIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ─── Load products ─── */
  const loadProducts = useCallback(async () => {
    try {
      const sb = getSupabaseClient();
      const { data } = await sb
        .from("products")
        .select("id, name, price, category, sale_type, fixed_piece_price, image_url")
        .eq("is_active", true)
        .order("category", { ascending: true })
        .order("name", { ascending: true });
      if (data && data.length > 0) {
        const shuffled = [...data].sort(() => Math.random() - 0.5);
        setProducts(shuffled);
      }
    } catch { /* silent */ }
  }, []);

  /* ─── Load banners ─── */
  const loadMedia = useCallback(async () => {
    try {
      const sb = getSupabaseClient();
      const { data } = await sb
        .from("display_media")
        .select("id, file_url, media_type, duration_seconds")
        .eq("is_active", true)
        .or("target.eq.ambos,target.eq.tv")
        .order("sort_order", { ascending: true })
        .limit(50);
      if (data) setMedia(data as MediaItem[]);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    loadProducts();
    loadMedia();
    const r1 = setInterval(loadProducts, RELOAD_INTERVAL);
    const r2 = setInterval(loadMedia, RELOAD_INTERVAL);
    return () => { clearInterval(r1); clearInterval(r2); };
  }, [loadProducts, loadMedia]);

  /* ─── Clock ─── */
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  /* ─── Build slides: banner, products, banner, products... ─── */
  type Slide =
    | { type: "banner"; item: MediaItem }
    | { type: "products"; items: Product[] };

  const slides: Slide[] = [];

  // Group products into chunks
  const productChunks: Product[][] = [];
  for (let i = 0; i < products.length; i += PRODUCTS_PER_SLIDE) {
    productChunks.push(products.slice(i, i + PRODUCTS_PER_SLIDE));
  }

  if (media.length > 0 && productChunks.length > 0) {
    // Alternate: banner, product chunk, banner, product chunk...
    let bi = 0;
    let pi = 0;
    while (bi < media.length || pi < productChunks.length) {
      if (bi < media.length) {
        slides.push({ type: "banner", item: media[bi] });
        bi++;
      }
      if (pi < productChunks.length) {
        slides.push({ type: "products", items: productChunks[pi] });
        pi++;
      }
    }
  } else if (media.length > 0) {
    media.forEach((m) => slides.push({ type: "banner", item: m }));
  } else {
    productChunks.forEach((chunk) => slides.push({ type: "products", items: chunk }));
  }

  const totalSlides = Math.max(1, slides.length);
  const safeIndex = slideIndex % totalSlides;
  const currentSlide = slides[safeIndex] || slides[0];

  /* ─── Auto-advance ─── */
  useEffect(() => {
    if (slides.length === 0) return;
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setTransitioning(true);
      setTimeout(() => {
        setSlideIndex((prev) => (prev + 1) % totalSlides);
        setTransitioning(false);
      }, TRANSITION_MS);
    }, currentSlide?.type === "banner"
      ? (Number((currentSlide.item as { duration_seconds?: number }).duration_seconds) * 1000 || BANNER_DURATION)
      : PRODUCT_SLIDE_DURATION);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [slides.length, totalSlides, safeIndex]);

  /* ─── Format price ─── */
  const formatPrice = (p: Product) => {
    if (p.fixed_piece_price != null && p.fixed_piece_price > 0) {
      return `$${p.fixed_piece_price.toFixed(2)} / pieza`;
    }
    if (p.price != null && p.price > 0) {
      return `$${p.price.toFixed(2)} / kg`;
    }
    return "";
  };

  /* ─── Format time ─── */
  const timeStr = currentTime.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  if (products.length === 0 && media.length === 0) {
    return (
      <div style={{
        minHeight: "100vh",
        background: C.bgGrad,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: C.muted,
        fontSize: 28,
        fontFamily: "'Segoe UI', system-ui, sans-serif",
      }}>
        Cargando...
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: C.bgGrad,
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* ─── Header (only on product slides) ─── */}
      {currentSlide?.type === "products" && (
        <>
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "28px 48px 12px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <img
                src="/logo.png"
                alt="Logo"
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 16,
                  objectFit: "cover",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
                }}
              />
              <div>
                <div style={{
                  fontSize: 36,
                  fontWeight: 800,
                  color: C.gold,
                  letterSpacing: "-0.5px",
                  lineHeight: 1.1,
                }}>
                  Sergio&apos;s Carnicer&iacute;a
                </div>
                <div style={{
                  fontSize: 16,
                  color: C.muted,
                  fontWeight: 500,
                  marginTop: 2,
                }}>
                  Calidad y frescura siempre
                </div>
              </div>
            </div>

            <div style={{ fontSize: 22, color: C.muted, fontWeight: 500 }}>
              {timeStr}
            </div>
          </div>

          <div style={{
            height: 1,
            margin: "8px 48px 0",
            background: `linear-gradient(90deg, transparent, ${C.cardBorder}, transparent)`,
          }} />
        </>
      )}

      {/* ─── Main content ─── */}
      <div style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: transitioning ? 0 : 1,
        transform: transitioning ? "scale(0.97)" : "scale(1)",
        transition: `opacity ${TRANSITION_MS}ms ease, transform ${TRANSITION_MS}ms ease`,
        ...(currentSlide?.type === "products" ? { padding: "24px 48px 20px" } : { padding: 0 }),
      }}>
        {currentSlide?.type === "banner" && (
          <img
            src={currentSlide.item.file_url}
            alt="Promoción"
            style={{
              width: "100%",
              height: "100vh",
              objectFit: "contain",
              background: "#000",
            }}
          />
        )}

        {currentSlide?.type === "products" && (
          <div style={{
            display: "grid",
            gridTemplateColumns: `repeat(${currentSlide.items.length}, 1fr)`,
            gap: 36,
            width: "100%",
            maxWidth: 1400,
          }}>
            {currentSlide.items.map((product) => (
              <div
                key={product.id}
                style={{
                  background: C.card,
                  border: `1px solid ${C.cardBorder}`,
                  borderRadius: 24,
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  boxShadow: "0 8px 40px rgba(0,0,0,0.3)",
                }}
              >
                <div style={{
                  width: "100%",
                  height: 320,
                  background: product.image_url
                    ? "#0d0503"
                    : `linear-gradient(135deg, ${C.accent} 0%, #3d1510 100%)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  position: "relative",
                }}>
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    <div style={{ fontSize: 80, opacity: 0.15, color: C.gold }}>
                      🥩
                    </div>
                  )}
                  {product.category && (
                    <div style={{
                      position: "absolute",
                      top: 16,
                      left: 16,
                      background: "rgba(0,0,0,0.65)",
                      backdropFilter: "blur(8px)",
                      color: C.goldLight,
                      fontSize: 13,
                      fontWeight: 600,
                      padding: "5px 14px",
                      borderRadius: 20,
                      letterSpacing: "0.3px",
                      textTransform: "uppercase",
                    }}>
                      {product.category}
                    </div>
                  )}
                </div>

                <div style={{
                  padding: "24px 28px 28px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  flex: 1,
                }}>
                  <div style={{
                    fontSize: 28,
                    fontWeight: 700,
                    color: C.text,
                    lineHeight: 1.2,
                  }}>
                    {product.name}
                  </div>
                  <div style={{
                    fontSize: 32,
                    fontWeight: 800,
                    color: C.price,
                    marginTop: "auto",
                    paddingTop: 8,
                  }}>
                    {formatPrice(product)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Progress dots ─── */}
      <div style={{
        display: "flex",
        justifyContent: "center",
        gap: 6,
        paddingBottom: 20,
        position: currentSlide?.type === "banner" ? "absolute" : "relative",
        bottom: currentSlide?.type === "banner" ? 0 : undefined,
        left: 0,
        right: 0,
      }}>
        {Array.from({ length: totalSlides }).map((_, i) => (
          <div
            key={i}
            style={{
              width: i === safeIndex ? 24 : 6,
              height: 6,
              borderRadius: 3,
              background: i === safeIndex ? C.gold : "rgba(255,255,255,0.2)",
              transition: "all 0.4s ease",
            }}
          />
        ))}
      </div>
    </div>
  );
}
