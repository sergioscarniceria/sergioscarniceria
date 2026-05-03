"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { listenCfd, type CfdMessage, type CfdItemLine } from "@/lib/cfd-channel";

type DisplayMode = "idle" | "active" | "done";

type MediaItem = {
  id: string;
  file_url: string;
  media_type: "image" | "video";
};

const C = {
  bg: "#1a0a08",
  bgGrad: "linear-gradient(145deg, #1a0a08 0%, #2d1410 50%, #1a0a08 100%)",
  card: "rgba(255,255,255,0.06)",
  text: "#fff",
  muted: "rgba(255,255,255,0.55)",
  accent: "#c9a96e",
  primary: "#d4453a",
  success: "#4ade80",
  successSoft: "rgba(74,222,128,0.12)",
};

const HEARTBEAT_TIMEOUT = 30000;
const CAROUSEL_INTERVAL = 7000;
const DONE_TIMEOUT = 8000;
const MEDIA_REFRESH = 300000;

export default function DisplayCajaPage() {
  const supabase = getSupabaseClient();

  const [mode, setMode] = useState<DisplayMode>("idle");
  const [items, setItems] = useState<CfdItemLine[]>([]);
  const [total, setTotal] = useState(0);
  const [customerName, setCustomerName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");

  const [media, setMedia] = useState<MediaItem[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slideVisible, setSlideVisible] = useState(true);

  const heartbeatTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const carouselTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const [lastAddedIdx, setLastAddedIdx] = useState(-1);
  const prevItemCount = useRef(0);
  const listEndRef = useRef<HTMLDivElement>(null);

  // ─── Load media ───
  const loadMedia = useCallback(async () => {
    const { data } = await supabase
      .from("display_media")
      .select("id, file_url, media_type")
      .eq("is_active", true)
      .or("target.eq.caja,target.eq.ambos")
      .order("sort_order", { ascending: true });
    setMedia((data as MediaItem[]) || []);
  }, []);

  useEffect(() => {
    loadMedia();
    const interval = setInterval(loadMedia, MEDIA_REFRESH);
    return () => clearInterval(interval);
  }, [loadMedia]);

  // ─── Carousel ───
  useEffect(() => {
    if (mode !== "idle" || media.length === 0) {
      if (carouselTimer.current) clearInterval(carouselTimer.current);
      return;
    }

    const currentMedia = media[currentSlide % media.length];
    if (currentMedia?.media_type === "video") return;

    const advance = () => {
      setSlideVisible(false);
      setTimeout(() => {
        setCurrentSlide((prev) => (prev + 1) % media.length);
        setSlideVisible(true);
      }, 600);
    };

    carouselTimer.current = setInterval(advance, CAROUSEL_INTERVAL);
    return () => { if (carouselTimer.current) clearInterval(carouselTimer.current); };
  }, [mode, media, currentSlide]);

  // ─── Listen BroadcastChannel ───
  useEffect(() => {
    const resetHeartbeat = () => {
      if (heartbeatTimer.current) clearTimeout(heartbeatTimer.current);
      heartbeatTimer.current = setTimeout(() => setMode("idle"), HEARTBEAT_TIMEOUT);
    };

    const unsub = listenCfd("caja", (msg: CfdMessage) => {
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

      if (msg.type === "pago_confirmado") {
        setTotal(msg.total);
        setCustomerName(msg.customerName || "");
        setPaymentMethod(msg.method || "");
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

  const methodLabels: Record<string, string> = {
    efectivo: "Efectivo",
    tarjeta: "Tarjeta",
    transferencia: "Transferencia",
  };

  return (
    <div style={{
      width: "100vw", height: "100vh", overflow: "hidden",
      background: C.bgGrad, fontFamily: "'Segoe UI', system-ui, sans-serif",
      color: C.text, position: "relative",
    }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes slideInRight { from { opacity: 0; transform: translateX(60px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
        @keyframes checkBounce { 0% { transform: scale(0); } 60% { transform: scale(1.2); } 100% { transform: scale(1); } }
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
                  autoPlay muted playsInline
                  onEnded={() => {
                    setSlideVisible(false);
                    setTimeout(() => {
                      setCurrentSlide((prev) => (prev + 1) % media.length);
                      setSlideVisible(true);
                    }, 600);
                  }}
                  style={{
                    width: "100%", height: "100%", objectFit: "cover",
                    opacity: slideVisible ? 1 : 0, transition: "opacity 0.6s ease",
                  }}
                />
              ) : (
                <img
                  key={media[currentSlide % media.length].id}
                  src={media[currentSlide % media.length].file_url}
                  alt=""
                  style={{
                    width: "100%", height: "100%", objectFit: "cover",
                    opacity: slideVisible ? 1 : 0, transition: "opacity 0.6s ease",
                  }}
                />
              )}
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0, height: 180,
                background: "linear-gradient(transparent, rgba(0,0,0,0.85))",
              }} />
            </>
          ) : (
            <div style={{
              width: "100%", height: "100%", display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", background: C.bgGrad,
            }}>
              <img src="/logo-sm.png" alt="Sergio's" style={{ width: 200, maxWidth: "40vw", height: "auto", opacity: 0.9, marginBottom: 30 }} />
              <div style={{ fontSize: 48, fontWeight: 800, color: C.text, letterSpacing: -1 }}>
                Sergio&apos;s Carnicería
              </div>
              <div style={{ fontSize: 20, color: C.accent, fontWeight: 600, marginTop: 10 }}>
                Carne de calidad desde Ezequiel Montes
              </div>
            </div>
          )}

          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            padding: "20px 40px", display: "flex", justifyContent: "space-between",
            alignItems: "flex-end", zIndex: 10,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <img src="/logo-sm.png" alt="" style={{ width: 44, height: "auto", opacity: 0.9 }} />
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, color: "white" }}>Sergio&apos;s Carnicería</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>
                  Lun-Sáb 7:30–3:30 PM | Mié y Dom 7:30–3:00 PM
                </div>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>Pedidos WhatsApp: 441 115 3314</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>@sergioscarniceria</div>
            </div>
          </div>

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

      {/* ═══ MODO VENTA ACTIVA (cuenta del cliente en caja) ═══ */}
      {mode === "active" && (
        <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", padding: "30px 40px" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 24, flexShrink: 0 }}>
            <img src="/logo-sm.png" alt="" style={{ width: 50, height: "auto", opacity: 0.9 }} />
            <div>
              <div style={{ fontSize: 32, fontWeight: 800, color: C.text, letterSpacing: -0.5 }}>Tu cuenta</div>
              {customerName && customerName !== "MOSTRADOR" && (
                <div style={{ fontSize: 18, color: C.accent, fontWeight: 600 }}>{customerName}</div>
              )}
            </div>
            <div style={{
              marginLeft: "auto", padding: "8px 18px", borderRadius: 10,
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
              fontSize: 14, fontWeight: 600, color: C.muted,
            }}>
              Verifica que tus productos sean correctos
            </div>
          </div>

          {/* Column headers */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 140px 140px 160px",
            padding: "12px 20px", borderRadius: 12,
            background: "rgba(255,255,255,0.04)", marginBottom: 8,
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>Producto</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.muted, textAlign: "right", textTransform: "uppercase", letterSpacing: 0.5 }}>Peso / Pzas</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.muted, textAlign: "right", textTransform: "uppercase", letterSpacing: 0.5 }}>Precio</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.muted, textAlign: "right", textTransform: "uppercase", letterSpacing: 0.5 }}>Subtotal</div>
          </div>

          {/* Items */}
          <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "thin" }}>
            {items.map((item, idx) => {
              const sub = itemSubtotal(item);
              const isNew = idx === lastAddedIdx;
              return (
                <div key={idx} style={{
                  display: "grid", gridTemplateColumns: "1fr 140px 140px 160px",
                  padding: "16px 20px", borderRadius: 14, marginBottom: 6,
                  background: idx % 2 === 0 ? "rgba(255,255,255,0.03)" : "transparent",
                  border: `1px solid ${isNew ? "rgba(201,169,110,0.3)" : "transparent"}`,
                  animation: isNew ? "slideInRight 0.4s ease" : "none",
                }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: C.text }}>{item.product}</div>
                  <div style={{ fontSize: 24, fontWeight: 600, color: C.muted, textAlign: "right" }}>
                    {item.sale_type === "pieza" ? `${item.quantity} pza` : `${Number(item.kilos).toFixed(3)} kg`}
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 600, color: C.muted, textAlign: "right" }}>
                    ${Math.ceil(item.price)}{item.sale_type !== "pieza" ? "/kg" : ""}
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: C.accent, textAlign: "right" }}>
                    ${Math.ceil(sub)}
                  </div>
                </div>
              );
            })}
            <div ref={listEndRef} />
          </div>

          {/* Total — más prominente que en mostrador */}
          <div style={{
            flexShrink: 0, marginTop: 16, padding: "28px 32px", borderRadius: 24,
            background: "linear-gradient(135deg, rgba(201,169,110,0.2), rgba(201,169,110,0.08))",
            border: `2px solid rgba(201,169,110,0.3)`,
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: C.muted }}>
              {items.length} producto{items.length !== 1 ? "s" : ""}
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
              <span style={{ fontSize: 32, fontWeight: 600, color: C.muted }}>Total a pagar</span>
              <span style={{ fontSize: 76, fontWeight: 800, color: C.accent, letterSpacing: -2 }}>
                ${Math.ceil(total).toLocaleString("es-MX")}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODO PAGO CONFIRMADO ═══ */}
      {mode === "done" && (
        <div style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          background: C.bgGrad, animation: "scaleIn 0.5s ease",
        }}>
          {/* Check icon */}
          <div style={{
            width: 120, height: 120, borderRadius: "50%",
            background: C.successSoft, display: "flex",
            alignItems: "center", justifyContent: "center",
            marginBottom: 30, animation: "checkBounce 0.6s ease",
            border: `3px solid ${C.success}`,
          }}>
            <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke={C.success} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>

          <div style={{ fontSize: 24, fontWeight: 700, color: C.success, textTransform: "uppercase", letterSpacing: 2, marginBottom: 16 }}>
            Pago recibido
          </div>

          <div style={{ fontSize: 88, fontWeight: 800, color: C.accent, marginBottom: 16, letterSpacing: -2 }}>
            ${Math.ceil(total).toLocaleString("es-MX")}
          </div>

          {paymentMethod && (
            <div style={{ fontSize: 20, color: C.muted, marginBottom: 24 }}>
              {methodLabels[paymentMethod] || paymentMethod}
            </div>
          )}

          {customerName && customerName !== "MOSTRADOR" && (
            <div style={{ fontSize: 22, color: C.text, fontWeight: 600, marginBottom: 32 }}>
              {customerName}
            </div>
          )}

          <div style={{
            padding: "22px 60px", borderRadius: 20,
            background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)",
          }}>
            <div style={{ fontSize: 36, fontWeight: 800, color: C.text, textAlign: "center" }}>
              Gracias por tu compra
            </div>
            <div style={{ fontSize: 18, color: C.muted, textAlign: "center", marginTop: 8 }}>
              Vuelve pronto
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
