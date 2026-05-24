"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { listenCfd, type CfdMessage, type CfdItemLine } from "@/lib/cfd-channel";
import { useKeepAwake } from "@/lib/useKeepAwake";

type DisplayMode = "idle" | "active" | "done";

type MediaItem = {
  id: string;
  file_url: string;
  media_type: "image" | "video";
};

// ─── Paleta igual al sitio web ───
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
  accent: "#c9a96e",
  accentSoft: "rgba(201,169,110,0.15)",
  success: "#1f7a4d",
};

const HEARTBEAT_TIMEOUT = 30000;
const CAROUSEL_INTERVAL = 7000;
const DONE_TIMEOUT = 12000;
const MEDIA_REFRESH = 600000; // 10 min

// ─── Frases graciosas para "ticket listo" ───
const FRASES_TICKET = [
  { frase: "A falta de todo, de tu amada... una carnita asada", emoji: "🔥" },
  { frase: "Un taco al día es la llave de la alegría", emoji: "🌮" },
  { frase: "La carne no pregunta, la carne entiende", emoji: "🥩" },
  { frase: "Quien tiene carne asada, no necesita nada", emoji: "✨" },
  { frase: "No hay pena que una buena arrachera no cure", emoji: "💪" },
  { frase: "La vida es corta, pide el corte grueso", emoji: "🔥" },
  { frase: "Mientras haya carbón, hay esperanza", emoji: "🌟" },
  { frase: "Hoy se come bien, mañana también", emoji: "🎉" },
  { frase: "Barriga llena, corazón contento", emoji: "❤️" },
  { frase: "Si la vida te da limones... exprímelos sobre la carne", emoji: "🍋" },
  { frase: "El que madruga, se lleva el mejor corte", emoji: "🌅" },
  { frase: "La mejor salsa es el hambre... y la nuestra también", emoji: "🫙" },
  { frase: "No es lo mismo bistec de res, que res del bistec", emoji: "😄" },
  { frase: "Carne de calidad, clientela de verdad", emoji: "🤝" },
  { frase: "50 años asegurando que comas bien", emoji: "🏆" },
];

export default function DisplayMostradorPage() {
  useKeepAwake();
  const supabase = getSupabaseClient();

  const [mode, setMode] = useState<DisplayMode>("idle");
  const [items, setItems] = useState<CfdItemLine[]>([]);
  const [total, setTotal] = useState(0);
  const [customerName, setCustomerName] = useState("");
  const [folio, setFolio] = useState("");
  const [fraseIdx, setFraseIdx] = useState(0);

  // Carousel
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slideVisible, setSlideVisible] = useState(true);

  // Timers
  const heartbeatTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const carouselTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Animation tracking
  const [lastAddedIdx, setLastAddedIdx] = useState(-1);
  const prevItemCount = useRef(0);
  const listEndRef = useRef<HTMLDivElement>(null);

  // ─── Load media from Supabase ───
  const loadMedia = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("display_media")
        .select("id, file_url, media_type, duration_seconds")
        .eq("is_active", true)
        .or("target.eq.mostrador,target.eq.ambos")
        .order("sort_order", { ascending: true })
        .limit(50);
      setMedia((data as MediaItem[]) || []);
    } catch {
      // Silent — display should never crash
    }
  }, []);

  useEffect(() => {
    loadMedia();
    const interval = setInterval(loadMedia, MEDIA_REFRESH);
    return () => clearInterval(interval);
  }, [loadMedia]);

  // ─── Carousel logic ───
  useEffect(() => {
    if (mode !== "idle" || media.length === 0) {
      if (carouselTimer.current) clearTimeout(carouselTimer.current);
      return;
    }

    const advance = () => {
      setSlideVisible(false);
      setTimeout(() => {
        setCurrentSlide((prev) => (prev + 1) % media.length);
        setSlideVisible(true);
      }, 600);
    };

    const currentMedia = media[currentSlide % media.length];
    if (currentMedia?.media_type === "video") return;

    const slideDuration = Number((currentMedia as { duration_seconds?: number })?.duration_seconds) * 1000 || CAROUSEL_INTERVAL;
    carouselTimer.current = setTimeout(advance, slideDuration);
    return () => {
      if (carouselTimer.current) clearInterval(carouselTimer.current);
    };
  }, [mode, media, currentSlide]);

  // ─── Listen to Supabase Realtime ───
  useEffect(() => {
    const resetHeartbeat = () => {
      if (heartbeatTimer.current) clearTimeout(heartbeatTimer.current);
      heartbeatTimer.current = setTimeout(() => setMode("idle"), HEARTBEAT_TIMEOUT);
    };

    const unsub = listenCfd("mostrador", (msg: CfdMessage) => {
      resetHeartbeat();

      if (msg.type === "venta_activa") {
        if (doneTimer.current) clearTimeout(doneTimer.current);
        if (msg.items.length > prevItemCount.current) {
          setLastAddedIdx(msg.items.length - 1);
        }
        prevItemCount.current = msg.items.length;
        setItems(msg.items);
        setTotal(msg.total);
        setCustomerName(msg.customerName || "");
        setMode("active");
      }

      if (msg.type === "ticket_listo") {
        setTotal(msg.total);
        setFolio(msg.folio || "");
        setCustomerName(msg.customerName || "");
        setFraseIdx(Math.floor(Math.random() * FRASES_TICKET.length));
        setMode("done");
        doneTimer.current = setTimeout(() => {
          setMode("idle");
          setItems([]);
          prevItemCount.current = 0;
        }, DONE_TIMEOUT);
      }

      if (msg.type === "idle") {
        setMode("idle");
        setItems([]);
        prevItemCount.current = 0;
      }
    });

    return () => {
      unsub();
      if (heartbeatTimer.current) clearTimeout(heartbeatTimer.current);
      if (doneTimer.current) clearTimeout(doneTimer.current);
    };
  }, []);

  // Auto-scroll to bottom when items change
  useEffect(() => {
    if (mode === "active" && listEndRef.current) {
      listEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [items, mode]);

  function itemSubtotal(item: CfdItemLine) {
    if (item.sale_type === "pieza" && item.is_fixed_price_piece) {
      return Number(item.quantity || 0) * Number(item.price || 0);
    }
    return Number(item.kilos || 0) * Number(item.price || 0);
  }

  const frase = FRASES_TICKET[fraseIdx];

  // ═══════ RENDER ═══════

  return (
    <div style={{
      width: "100vw", height: "100vh", overflow: "hidden",
      background: C.bg, fontFamily: "'Segoe UI', system-ui, sans-serif",
      color: C.text, position: "relative",
    }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes slideInRight { from { opacity: 0; transform: translateX(60px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.7; } }
        @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
      ` }} />

      {/* ═══ MODO REPOSO ═══ */}
      {mode === "idle" && (
        <div style={{ width: "100%", height: "100%", position: "relative" }}>
          {media.length > 0 ? (
            <>
              {media[currentSlide % media.length]?.media_type === "video" ? (
                <video
                  key={media[currentSlide % media.length].id}
                  src={media[currentSlide % media.length].file_url}
                  autoPlay
                  muted
                  playsInline
                  onEnded={() => {
                    setSlideVisible(false);
                    setTimeout(() => {
                      setCurrentSlide((prev) => (prev + 1) % media.length);
                      setSlideVisible(true);
                    }, 600);
                  }}
                  style={{
                    width: "100%", height: "100%", objectFit: "cover",
                    opacity: slideVisible ? 1 : 0,
                    transition: "opacity 0.6s ease",
                  }}
                />
              ) : (
                <img
                  key={media[currentSlide % media.length].id}
                  src={media[currentSlide % media.length].file_url}
                  alt=""
                  style={{
                    width: "100%", height: "100%", objectFit: "cover",
                    opacity: slideVisible ? 1 : 0,
                    transition: "opacity 0.6s ease",
                  }}
                />
              )}
              {/* Gradient overlay for bottom info */}
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0, height: 180,
                background: "linear-gradient(transparent, rgba(59,28,22,0.9))",
              }} />
            </>
          ) : (
            /* Fallback: logo con colores del sitio */
            <div style={{
              width: "100%", height: "100%", display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              background: `linear-gradient(145deg, ${C.bg} 0%, ${C.bgSoft} 50%, ${C.bg} 100%)`,
            }}>
              <img src="/logo-sm.png" alt="Sergio's" style={{ width: 220, maxWidth: "40vw", height: "auto", marginBottom: 30 }} />
              <div style={{ fontSize: 48, fontWeight: 800, color: C.primary, letterSpacing: -1 }}>
                Sergio&apos;s Carnicería
              </div>
              <div style={{ fontSize: 22, color: C.accent, fontWeight: 600, marginTop: 12 }}>
                Carne de calidad desde 1976 — Ezequiel Montes, Qro.
              </div>
              <div style={{
                marginTop: 40, padding: "14px 36px", borderRadius: 16,
                background: C.accentSoft, border: `1px solid ${C.accent}`,
                fontSize: 18, color: C.muted, fontWeight: 500,
              }}>
                Pedidos por WhatsApp: 441 115 3314
              </div>
            </div>
          )}

          {/* Bottom bar */}
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            padding: "20px 40px", display: "flex", justifyContent: "space-between",
            alignItems: "flex-end", zIndex: 10,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <img src="/logo-sm.png" alt="" style={{ width: 44, height: "auto" }} />
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, color: "white" }}>Sergio&apos;s Carnicería</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>
                  Lun-Sáb 7:30–3:30 PM | Mié y Dom 7:30–3:00 PM
                </div>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>
                Pedidos WhatsApp: 441 115 3314
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>
                @sergioscarniceria
              </div>
            </div>
          </div>

          {/* Slide indicators */}
          {media.length > 1 && (
            <div style={{ position: "absolute", bottom: 70, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 8, zIndex: 10 }}>
              {media.map((_, i) => (
                <div key={i} style={{
                  width: i === currentSlide % media.length ? 24 : 8, height: 8,
                  borderRadius: 4, transition: "all 0.3s ease",
                  background: i === currentSlide % media.length ? C.accent : "rgba(255,255,255,0.3)",
                }} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ MODO VENTA ACTIVA ═══ */}
      {mode === "active" && (
        <div style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column", padding: "30px 40px",
          background: `linear-gradient(170deg, ${C.bg} 0%, ${C.bgSoft} 100%)`,
        }}>
          {/* Header */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: 20, flexShrink: 0,
            padding: "16px 24px", borderRadius: 20,
            background: C.cardStrong, border: `1px solid ${C.border}`,
            boxShadow: "0 2px 12px rgba(92,27,17,0.06)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <img src="/logo-sm.png" alt="" style={{ width: 50, height: "auto" }} />
              <div>
                <div style={{ fontSize: 30, fontWeight: 800, color: C.primary, letterSpacing: -0.5 }}>Tu pedido</div>
                {customerName && customerName !== "MOSTRADOR" && (
                  <div style={{ fontSize: 18, color: C.accent, fontWeight: 600 }}>{customerName}</div>
                )}
              </div>
            </div>
            <div style={{ fontSize: 16, color: C.muted, fontWeight: 600 }}>
              {items.length} producto{items.length !== 1 ? "s" : ""}
            </div>
          </div>

          {/* Column headers */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 140px 140px 160px",
            padding: "10px 20px", borderRadius: 12,
            background: C.accentSoft, marginBottom: 6,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>Producto</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.muted, textAlign: "right", textTransform: "uppercase", letterSpacing: 0.5 }}>Peso / Pzas</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.muted, textAlign: "right", textTransform: "uppercase", letterSpacing: 0.5 }}>Precio</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.muted, textAlign: "right", textTransform: "uppercase", letterSpacing: 0.5 }}>Subtotal</div>
          </div>

          {/* Items list */}
          <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "thin" }}>
            {items.map((item, idx) => {
              const sub = itemSubtotal(item);
              const isNew = idx === lastAddedIdx;
              return (
                <div key={idx} style={{
                  display: "grid", gridTemplateColumns: "1fr 140px 140px 160px",
                  padding: "14px 20px", borderRadius: 14, marginBottom: 4,
                  background: idx % 2 === 0 ? C.cardStrong : "transparent",
                  border: `1px solid ${isNew ? C.accent : "transparent"}`,
                  animation: isNew ? "slideInRight 0.4s ease" : "none",
                  boxShadow: isNew ? `0 0 20px ${C.accentSoft}` : "none",
                }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>{item.product}</div>
                  <div style={{ fontSize: 22, fontWeight: 600, color: C.muted, textAlign: "right" }}>
                    {item.sale_type === "pieza" ? `${item.quantity} pza` : `${Number(item.kilos).toFixed(3)} kg`}
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 600, color: C.muted, textAlign: "right" }}>
                    ${Math.ceil(item.price)}{item.sale_type !== "pieza" ? "/kg" : ""}
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: C.primary, textAlign: "right" }}>
                    ${Math.ceil(sub)}
                  </div>
                </div>
              );
            })}
            <div ref={listEndRef} />
          </div>

          {/* Total bar */}
          <div style={{
            flexShrink: 0, marginTop: 12, padding: "20px 28px", borderRadius: 20,
            background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`,
            display: "flex", justifyContent: "space-between", alignItems: "center",
            boxShadow: "0 4px 20px rgba(123,34,24,0.3)",
          }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: "rgba(255,255,255,0.8)" }}>
              Total
            </div>
            <div style={{ fontSize: 60, fontWeight: 800, color: "#fff", letterSpacing: -2 }}>
              ${Math.ceil(total).toLocaleString("es-MX")}
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODO TICKET LISTO ═══ */}
      {mode === "done" && (
        <div style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          background: `linear-gradient(170deg, ${C.bg} 0%, ${C.bgSoft} 50%, ${C.bg} 100%)`,
          animation: "scaleIn 0.5s ease",
        }}>
          {/* Checkmark circle */}
          <div style={{
            width: 100, height: 100, borderRadius: "50%",
            background: `linear-gradient(135deg, ${C.success}, #28a05e)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: 28, boxShadow: "0 8px 30px rgba(31,122,77,0.3)",
            animation: "float 3s ease-in-out infinite",
          }}>
            <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>

          <div style={{
            fontSize: 22, fontWeight: 700, color: C.success,
            textTransform: "uppercase", letterSpacing: 3, marginBottom: 8,
          }}>
            Gracias por tu compra
          </div>

          <div style={{
            fontSize: 36, fontWeight: 800, color: C.primary, marginBottom: 6,
          }}>
            Tu ticket está listo
          </div>

          {folio && (
            <div style={{ fontSize: 20, fontWeight: 600, color: C.muted, marginBottom: 20 }}>
              Folio: {folio}
            </div>
          )}

          <div style={{
            fontSize: 76, fontWeight: 800, color: C.primary,
            marginBottom: 28, letterSpacing: -2,
          }}>
            ${Math.ceil(total).toLocaleString("es-MX")}
          </div>

          {/* Pasa a caja box */}
          <div style={{
            padding: "20px 60px", borderRadius: 24,
            background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`,
            boxShadow: "0 4px 20px rgba(123,34,24,0.3)",
            marginBottom: 36,
          }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: "#fff", textAlign: "center" }}>
              Favor de pasar a caja a pagar
            </div>
          </div>

          {/* Frase graciosa */}
          <div style={{
            padding: "16px 40px", borderRadius: 16,
            background: C.accentSoft, border: `1px solid ${C.accent}`,
            maxWidth: 700,
          }}>
            <div style={{ fontSize: 22, color: C.muted, textAlign: "center", fontStyle: "italic", fontWeight: 500 }}>
              {frase.emoji} &ldquo;{frase.frase}&rdquo; {frase.emoji}
            </div>
          </div>

          {/* Logo at bottom */}
          <div style={{ position: "absolute", bottom: 30, display: "flex", alignItems: "center", gap: 12, opacity: 0.6 }}>
            <img src="/logo-sm.png" alt="" style={{ width: 36, height: "auto" }} />
            <span style={{ fontSize: 14, color: C.muted, fontWeight: 600 }}>Sergio&apos;s Carnicería — Desde 1976</span>
          </div>
        </div>
      )}
    </div>
  );
}
