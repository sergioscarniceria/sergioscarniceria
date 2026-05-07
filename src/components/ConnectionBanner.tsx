"use client";

import { useEffect, useState, useRef } from "react";
import { onConnectionChange, isOnline } from "@/lib/resilience";

/**
 * Floating banner that appears when the browser goes offline
 * and disappears (with a brief "reconnected" message) when back online.
 *
 * Also pings Supabase periodically to detect server-side issues
 * (e.g. Vercel deploying) even when the browser says "online."
 */
export default function ConnectionBanner() {
  const [online, setOnline] = useState(true);
  const [showReconnected, setShowReconnected] = useState(false);
  const wasOfflineRef = useRef(false);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [serverReachable, setServerReachable] = useState(true);

  /* ─── Browser online/offline events ─── */
  useEffect(() => {
    setOnline(isOnline());
    const unsub = onConnectionChange((on) => {
      setOnline(on);
      if (on && wasOfflineRef.current) {
        setShowReconnected(true);
        setTimeout(() => setShowReconnected(false), 3000);
      }
      wasOfflineRef.current = !on;
    });
    return unsub;
  }, []);

  /* ─── Server ping every 15s to detect Vercel/Supabase issues ─── */
  useEffect(() => {
    async function ping() {
      if (!navigator.onLine) return;
      try {
        const res = await fetch("/api/health", {
          method: "HEAD",
          cache: "no-store",
          signal: AbortSignal.timeout(5000),
        });
        setServerReachable(res.ok);
        if (res.ok && wasOfflineRef.current) {
          wasOfflineRef.current = false;
          setShowReconnected(true);
          setTimeout(() => setShowReconnected(false), 3000);
        }
        if (!res.ok) wasOfflineRef.current = true;
      } catch {
        setServerReachable(false);
        wasOfflineRef.current = true;
      }
    }

    ping();
    pingRef.current = setInterval(ping, 30000);
    return () => {
      if (pingRef.current) clearInterval(pingRef.current);
    };
  }, []);

  const isDown = !online || !serverReachable;

  if (!isDown && !showReconnected) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 99999,
        padding: "10px 20px",
        textAlign: "center",
        fontWeight: 700,
        fontSize: 15,
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        color: "#fff",
        background: isDown
          ? "linear-gradient(90deg, #c0392b, #e74c3c)"
          : "linear-gradient(90deg, #27ae60, #2ecc71)",
        boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
        transition: "all 0.4s ease",
        animation: "slideDown 0.3s ease",
      }}
    >
      {isDown ? (
        <>
          ⚠️ Sin conexión — el sistema sigue funcionando con datos guardados.
          Los cambios se guardarán cuando regrese la conexión.
        </>
      ) : (
        <>✅ Conexión restablecida</>
      )}
      <style>{`
        @keyframes slideDown {
          from { transform: translateY(-100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
