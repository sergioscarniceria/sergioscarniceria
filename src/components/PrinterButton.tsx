"use client";

import { useEffect, useState } from "react";
import { getPrinter, anchoTicket } from "@/lib/printer";

/**
 * Botón flotante para conectar/desconectar la impresora térmica.
 * Muestra el estado actual: desconectada, conectando, lista, error.
 * Se pone en la esquina inferior del módulo.
 */
export default function PrinterButton() {
  const [status, setStatus] = useState<string>("disconnected");
  const [supported, setSupported] = useState(true);
  const [ancho, setAncho] = useState(42);
  const [showAncho, setShowAncho] = useState(false);

  useEffect(() => {
    const printer = getPrinter();
    setSupported(printer.isSupported);
    setStatus(printer.status);
    setAncho(anchoTicket());

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

  /**
   * El ancho del papel en caracteres. Si el ticket sale cortado de los lados,
   * hay que bajarlo; si sale muy angosto, subirlo.
   */
  function guardarAncho(valor: number) {
    try { localStorage.setItem("ancho_ticket", String(valor)); } catch { /* sin storage */ }
    setAncho(valor);
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
    <div style={{ position: "fixed", bottom: 20, left: 20, zIndex: 900 }}>
      {showAncho && (
        <div style={{
          marginBottom: 10, padding: 14, borderRadius: 14, background: "white",
          border: "1px solid rgba(92,27,17,0.14)", boxShadow: "0 8px 24px rgba(0,0,0,0.14)",
          width: 250,
        }}>
          <div style={{ fontWeight: 800, fontSize: 13.5, color: "#3b1c16", marginBottom: 4 }}>
            Ancho del ticket
          </div>
          <div style={{ fontSize: 11.5, color: "#7a5a52", marginBottom: 10, lineHeight: 1.45 }}>
            Si el ticket sale <b>cortado de los lados</b>, baja el número.
            Si sale muy angosto, súbelo. Imprime uno de prueba después de cambiarlo.
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[32, 40, 42, 48].map((v) => (
              <button
                key={v}
                onClick={() => guardarAncho(v)}
                style={{
                  flex: 1, minWidth: 52, padding: "9px 0", borderRadius: 9, cursor: "pointer",
                  border: `1.5px solid ${ancho === v ? "#7b2218" : "rgba(92,27,17,0.14)"}`,
                  background: ancho === v ? "#7b2218" : "white",
                  color: ancho === v ? "white" : "#3b1c16",
                  fontWeight: 800, fontSize: 13,
                }}
              >
                {v}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: "#7a5a52", marginTop: 8 }}>
            80 mm normalmente son 42 o 48 · 58 mm son 32
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
    <button
      onClick={togglePrinter}
      style={{
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

        <button
          onClick={() => setShowAncho((v) => !v)}
          title="Ajustar el ancho del ticket"
          style={{
            width: 38, height: 38, borderRadius: 50, border: "none",
            background: c.bg, color: c.text, fontSize: 16, cursor: "pointer",
            boxShadow: "0 4px 16px rgba(0,0,0,0.1)", fontWeight: 800,
          }}
        >
          ⚙
        </button>
      </div>
    </div>
  );
}
