"use client";

import { useEffect, useState } from "react";
import { getPrinter } from "@/lib/printer";

/**
 * Botón flotante para conectar/desconectar la impresora térmica.
 * Muestra el estado actual: desconectada, conectando, lista, error.
 * Se pone en la esquina inferior del módulo.
 */
export default function PrinterButton() {
  const [status, setStatus] = useState<string>("disconnected");
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    const printer = getPrinter();
    setSupported(printer.isSupported);
    setStatus(printer.status);

    // Auto-reconectar si ya tenía permiso
    if (printer.isSupported && !printer.isConnected) {
      (navigator as any).usb?.getDevices().then((devices: any[]) => {
        if (devices.length > 0) {
          printer.connect().then(() => setStatus(printer.status));
        }
      });
    }
  }, []);

  async function togglePrinter() {
    const printer = getPrinter();

    if (printer.isConnected) {
      await printer.disconnect();
    } else {
      await printer.connect();
    }
    setStatus(printer.status);
  }

  if (!supported) return null;

  const colors: Record<string, { bg: string; text: string; icon: string }> = {
    disconnected: { bg: "rgba(122,90,82,0.12)", text: "#7a5a52", icon: "🖨" },
    connecting: { bg: "rgba(166,106,16,0.15)", text: "#a66a10", icon: "⏳" },
    ready: { bg: "rgba(31,122,77,0.12)", text: "#1f7a4d", icon: "✓" },
    printing: { bg: "rgba(31,122,77,0.15)", text: "#1f7a4d", icon: "⟳" },
    error: { bg: "rgba(180,35,24,0.12)", text: "#b42318", icon: "✕" },
  };

  const c = colors[status] || colors.disconnected;
  const labels: Record<string, string> = {
    disconnected: "Conectar impresora",
    connecting: "Conectando...",
    ready: "Impresora lista",
    printing: "Imprimiendo...",
    error: "Error - Reintentar",
  };

  return (
    <button
      onClick={togglePrinter}
      style={{
        position: "fixed",
        bottom: 20,
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
      title={status === "ready" ? "Click para desconectar" : "Click para conectar impresora Epson"}
    >
      <span style={{ fontSize: 18 }}>{c.icon}</span>
      {labels[status]}
    </button>
  );
}
