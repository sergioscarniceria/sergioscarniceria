"use client";

import { useEffect, useState } from "react";
import { getScale } from "@/lib/scale";

/**
 * Botón flotante para conectar/desconectar la báscula Torrey PCR-40.
 * Muestra peso en tiempo real cuando está conectada.
 */
export default function ScaleButton() {
  const [status, setStatus] = useState<string>("disconnected");
  const [weight, setWeight] = useState<number>(0);
  const [stable, setStable] = useState<boolean>(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    const scale = getScale();
    setSupported(scale.isSupported);
    setStatus(scale.status);

    // Auto-reconectar si ya tenía permiso
    if (scale.isSupported && !scale.isConnected) {
      (navigator as any).serial?.getPorts().then((ports: any[]) => {
        if (ports.length > 0) {
          scale.connect().then(() => setStatus(scale.status));
        }
      });
    }

    // Suscribirse a cambios de peso
    const unsub = scale.onWeight((w, _unit, s) => {
      setWeight(w);
      setStable(s);
      setStatus(scale.status);
    });

    return unsub;
  }, []);

  async function toggleScale() {
    const scale = getScale();

    if (scale.isConnected) {
      await scale.disconnect();
    } else {
      await scale.connect();
    }
    setStatus(scale.status);
  }

  if (!supported) return null;

  const isConnected = status === "ready" || status === "reading";

  const colors: Record<string, { bg: string; text: string; icon: string }> = {
    disconnected: { bg: "rgba(122,90,82,0.12)", text: "#7a5a52", icon: "⚖" },
    connecting: { bg: "rgba(166,106,16,0.15)", text: "#a66a10", icon: "⏳" },
    ready: { bg: "rgba(31,122,77,0.12)", text: "#1f7a4d", icon: "⚖" },
    reading: { bg: "rgba(31,122,77,0.15)", text: "#1f7a4d", icon: "⚖" },
    error: { bg: "rgba(180,35,24,0.12)", text: "#b42318", icon: "✕" },
  };

  const c = colors[status] || colors.disconnected;

  let label = "Conectar báscula";
  if (status === "connecting") label = "Conectando...";
  else if (status === "error") label = "Error - Reintentar";
  else if (isConnected) {
    label = weight === -1
      ? "SOBRECARGA"
      : `${weight.toFixed(3)} kg${stable ? " ✓" : " ~"}`;
  }

  return (
    <button
      onClick={toggleScale}
      style={{
        position: "fixed",
        bottom: 70,
        right: 20,
        zIndex: 900,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 16px",
        borderRadius: 50,
        border: "none",
        background: c.bg,
        color: c.text,
        fontWeight: 700,
        fontSize: 13,
        cursor: "pointer",
        boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
        transition: "all 0.2s ease",
      }}
      title={isConnected ? "Click para desconectar báscula" : "Click para conectar báscula Torrey"}
    >
      <span style={{ fontSize: 18 }}>{c.icon}</span>
      {label}
    </button>
  );
}
