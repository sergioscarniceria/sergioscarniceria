"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { getSupabaseClient } from "@/lib/supabase";

type NewOrder = {
  id: string;
  customer_name: string;
  created_at: string;
  status: string;
  delivery_date?: string | null;
  total?: number | null;
};

// Simple bell sound using Web Audio API (works on Safari/iPad)
function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const now = ctx.currentTime;

    // First tone
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(830, now);
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);

    // Second tone (higher)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1050, now + 0.15);
    gain2.gain.setValueAtTime(0, now);
    gain2.gain.setValueAtTime(0.3, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.5);

    // Third tone (highest, longer)
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = "sine";
    osc3.frequency.setValueAtTime(1250, now + 0.35);
    gain3.gain.setValueAtTime(0, now);
    gain3.gain.setValueAtTime(0.25, now + 0.35);
    gain3.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
    osc3.connect(gain3);
    gain3.connect(ctx.destination);
    osc3.start(now + 0.35);
    osc3.stop(now + 0.8);
  } catch (e) {
    // Audio not available, silent fallback
  }
}

export default function NotificationBell() {
  const [orders, setOrders] = useState<NewOrder[]>([]);
  const [showPanel, setShowPanel] = useState(false);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const [hasInteracted, setHasInteracted] = useState(false);
  const prevCountRef = useRef(0);
  const bellRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Track user interaction so we can play sound (Safari requires gesture)
  useEffect(() => {
    function handleInteraction() {
      setHasInteracted(true);
    }
    window.addEventListener("touchstart", handleInteraction, { once: true });
    window.addEventListener("click", handleInteraction, { once: true });
    return () => {
      window.removeEventListener("touchstart", handleInteraction);
      window.removeEventListener("click", handleInteraction);
    };
  }, []);

  // Load seen IDs from sessionStorage
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("notif_seen_ids");
      if (stored) {
        setSeenIds(new Set(JSON.parse(stored)));
      }
    } catch {}
  }, []);

  const fetchNewOrders = useCallback(async () => {
    const supabase = getSupabaseClient();

    // Get orders created in the last 12 hours with status "nuevo"
    const since = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

    const { data } = await supabase
      .from("orders")
      .select("id, customer_name, created_at, status, delivery_date, total")
      .eq("status", "nuevo")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(20);

    if (data) {
      setOrders(data);

      // Play sound if there are NEW orders we haven't seen
      const newUnseen = data.filter((o) => !seenIds.has(o.id));
      if (newUnseen.length > prevCountRef.current && hasInteracted && prevCountRef.current >= 0) {
        playNotificationSound();
      }
      prevCountRef.current = newUnseen.length;
    }
  }, [seenIds, hasInteracted]);

  // Poll every 15 seconds
  useEffect(() => {
    fetchNewOrders();
    const interval = setInterval(fetchNewOrders, 15000);
    return () => clearInterval(interval);
  }, [fetchNewOrders]);

  // Close panel when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        showPanel &&
        bellRef.current &&
        !bellRef.current.contains(e.target as Node) &&
        panelRef.current &&
        !panelRef.current.contains(e.target as Node)
      ) {
        setShowPanel(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside as any);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside as any);
    };
  }, [showPanel]);

  const unseenCount = orders.filter((o) => !seenIds.has(o.id)).length;

  function markAllSeen() {
    const allIds = new Set(orders.map((o) => o.id));
    const merged = new Set([...seenIds, ...allIds]);
    setSeenIds(merged);
    try {
      sessionStorage.setItem("notif_seen_ids", JSON.stringify([...merged]));
    } catch {}
    prevCountRef.current = 0;
  }

  function formatTime(dateStr: string) {
    try {
      return new Date(dateStr).toLocaleTimeString("es-MX", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Mexico_City",
      });
    } catch {
      return "";
    }
  }

  function formatDelivery(dateStr?: string | null) {
    if (!dateStr) return null;
    try {
      const d = new Date(`${dateStr.slice(0, 10)}T12:00:00`);
      return d.toLocaleDateString("es-MX", {
        day: "numeric",
        month: "short",
        timeZone: "America/Mexico_City",
      });
    } catch {
      return dateStr.slice(0, 10);
    }
  }

  return (
    <>
      {/* Bell icon */}
      <div
        ref={bellRef}
        onClick={() => {
          setShowPanel(!showPanel);
          if (!showPanel && unseenCount > 0) {
            markAllSeen();
          }
        }}
        style={{
          position: "relative",
          cursor: "pointer",
          padding: 8,
          borderRadius: 12,
          background: showPanel ? "rgba(123, 34, 24, 0.1)" : "transparent",
          transition: "background 0.2s",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        {/* Bell SVG */}
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke={unseenCount > 0 ? "#7b2218" : "#7a5a52"}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            animation: unseenCount > 0 ? "bellShake 0.5s ease-in-out" : "none",
          }}
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        {/* Badge */}
        {unseenCount > 0 && (
          <div
            style={{
              position: "absolute",
              top: 2,
              right: 2,
              background: "#e53e3e",
              color: "white",
              borderRadius: "50%",
              width: 20,
              height: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 800,
              border: "2px solid white",
              animation: "badgePulse 2s infinite",
            }}
          >
            {unseenCount > 9 ? "9+" : unseenCount}
          </div>
        )}
      </div>

      {/* Notification Panel */}
      {showPanel && (
        <div
          ref={panelRef}
          style={{
            position: "fixed",
            top: 60,
            right: 12,
            width: "min(360px, calc(100vw - 24px))",
            maxHeight: "70vh",
            overflowY: "auto",
            background: "rgba(255,255,255,0.97)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderRadius: 16,
            boxShadow: "0 12px 40px rgba(91, 25, 15, 0.15)",
            border: "1px solid rgba(92, 27, 17, 0.10)",
            zIndex: 9999,
            padding: 0,
          }}
        >
          {/* Panel header */}
          <div
            style={{
              padding: "14px 18px",
              borderBottom: "1px solid rgba(92, 27, 17, 0.08)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontWeight: 800, color: "#3b1c16", fontSize: 15 }}>
              Pedidos nuevos
            </span>
            {orders.length > 0 && (
              <span style={{ fontSize: 12, color: "#7a5a52" }}>
                {orders.length} pedido{orders.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* Orders list */}
          {orders.length === 0 ? (
            <div
              style={{
                padding: "32px 18px",
                textAlign: "center",
                color: "#7a5a52",
                fontSize: 14,
              }}
            >
              No hay pedidos nuevos
            </div>
          ) : (
            <div style={{ padding: "6px 0" }}>
              {orders.map((order) => (
                <div
                  key={order.id}
                  style={{
                    padding: "12px 18px",
                    borderBottom: "1px solid rgba(92, 27, 17, 0.05)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 10,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontWeight: 700,
                        color: "#3b1c16",
                        fontSize: 14,
                        marginBottom: 2,
                      }}
                    >
                      {order.customer_name}
                    </div>
                    <div style={{ fontSize: 12, color: "#7a5a52" }}>
                      {formatTime(order.created_at)}
                      {order.delivery_date && (
                        <span style={{ marginLeft: 8, color: "#355c7d" }}>
                          Entrega: {formatDelivery(order.delivery_date)}
                        </span>
                      )}
                    </div>
                  </div>
                  {order.total != null && (
                    <div
                      style={{
                        fontWeight: 700,
                        color: "#1f7a4d",
                        fontSize: 14,
                        whiteSpace: "nowrap",
                      }}
                    >
                      ${order.total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CSS animations */}
      <style>{`
        @keyframes bellShake {
          0%, 100% { transform: rotate(0); }
          15% { transform: rotate(14deg); }
          30% { transform: rotate(-12deg); }
          45% { transform: rotate(10deg); }
          60% { transform: rotate(-8deg); }
          75% { transform: rotate(4deg); }
        }
        @keyframes badgePulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
      `}</style>
    </>
  );
}
