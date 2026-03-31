"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type TabMode = "ticket" | "manual";

const COLORS = {
  bg: "#f7f1e8",
  bgSoft: "#fbf8f3",
  card: "rgba(255,255,255,0.92)",
  cardStrong: "rgba(255,255,255,0.96)",
  border: "rgba(92, 27, 17, 0.10)",
  text: "#3b1c16",
  muted: "#7a5a52",
  primary: "#7b2218",
  primaryDark: "#5a190f",
  success: "#1f7a4d",
  warning: "#a66a10",
  danger: "#b42318",
  info: "#355c7d",
  shadow: "0 10px 30px rgba(91, 25, 15, 0.08)",
};

type DemoTicket = {
  id: string;
  customer_name: string;
  total: number;
  status: string;
};

type ManualLine = {
  id: string;
  product: string;
  kilos: string;
  price: string;
};

function makeLineId() {
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function money(value: number) {
  return value.toFixed(2);
}

export default function CobranzaPage() {
  const [tab, setTab] = useState<TabMode>("ticket");

  const [ticketSearch, setTicketSearch] = useState("");
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  const [customerName, setCustomerName] = useState("");
  const [manualNotes, setManualNotes] = useState("");
  const [manualLines, setManualLines] = useState<ManualLine[]>([]);

  const demoTickets: DemoTicket[] = [
    { id: "TK-1001", customer_name: "Mostrador", total: 385.5, status: "pendiente" },
    { id: "TK-1002", customer_name: "Jaime Ríos", total: 1240, status: "pendiente" },
    { id: "TK-1003", customer_name: "Restaurante El Fogón", total: 890.75, status: "pendiente" },
  ];

  const filteredTickets = useMemo(() => {
    const q = ticketSearch.toLowerCase().trim();
    if (!q) return demoTickets;
    return demoTickets.filter((ticket) =>
      `${ticket.id} ${ticket.customer_name}`.toLowerCase().includes(q)
    );
  }, [ticketSearch]);

  const selectedTicket = useMemo(() => {
    return demoTickets.find((t) => t.id === selectedTicketId) || null;
  }, [selectedTicketId]);

  const manualTotal = useMemo(() => {
    return manualLines.reduce((acc, line) => {
      return acc + Number(line.kilos || 0) * Number(line.price || 0);
    }, 0);
  }, [manualLines]);

  function addManualLine() {
    setManualLines((prev) => [
      ...prev,
      {
        id: makeLineId(),
        product: "",
        kilos: "1",
        price: "0",
      },
    ]);
  }

  function updateManualLine(
    id: string,
    field: "product" | "kilos" | "price",
    value: string
  ) {
    setManualLines((prev) =>
      prev.map((line) => (line.id === id ? { ...line, [field]: value } : line))
    );
  }

  function removeManualLine(id: string) {
    setManualLines((prev) => prev.filter((line) => line.id !== id));
  }

  function clearManualSale() {
    setCustomerName("");
    setManualNotes("");
    setManualLines([]);
  }

  function simulateAction(message: string) {
    alert(message);
  }

  return (
    <div style={pageStyle}>
      <div style={glowTopLeft} />
      <div style={glowTopRight} />

      <div style={shellStyle}>
        <div style={topBarStyle}>
          <div>
            <h1 style={{ margin: 0, color: COLORS.text }}>Cobranza</h1>
            <p style={{ margin: "6px 0 0 0", color: COLORS.muted }}>
              Base estable del módulo de caja y respaldo manual
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/" style={secondaryButtonStyle}>Inicio</Link>
            <Link href="/pedidos" style={secondaryButtonStyle}>Pedidos</Link>
            <Link href="/admin/cxc" style={secondaryButtonStyle}>CxC</Link>
            <Link href="/admin/dashboard" style={secondaryButtonStyle}>Dashboard</Link>
          </div>
        </div>

        <div style={tabsCardStyle}>
          <button
            onClick={() => setTab("ticket")}
            style={{
              ...tabButtonStyle,
              background: tab === "ticket" ? COLORS.primary : "white",
              color: tab === "ticket" ? "white" : COLORS.text,
            }}
          >
            Ticket existente
          </button>

          <button
            onClick={() => setTab("manual")}
            style={{
              ...tabButtonStyle,
              background: tab === "manual" ? COLORS.primary : "white",
              color: tab === "manual" ? "white" : COLORS.text,
            }}
          >
            Venta manual
          </button>
        </div>

        {tab === "ticket" ? (
          <div style={mainGridStyle}>
            <div style={leftColumnStyle}>
              <div style={panelStyle}>
                <div style={panelHeaderStyle}>
                  <div>
                    <h2 style={panelTitleStyle}>Buscar ticket</h2>
                    <p style={panelSubtitleStyle}>
                      Aquí después conectaremos lector, QR o folio manual
                    </p>
                  </div>
                </div>

                <input
                  placeholder="Buscar por folio o cliente"
                  value={ticketSearch}
                  onChange={(e) => setTicketSearch(e.target.value)}
                  style={inputStyle}
                />

                <div style={{ marginTop: 14 }}>
                  <div style={miniTitleStyle}>Pendientes recientes</div>

                  <div style={listWrapStyle}>
                    {filteredTickets.map((ticket) => (
                      <button
                        key={ticket.id}
                        onClick={() => setSelectedTicketId(ticket.id)}
                        style={searchResultCardStyle}
                      >
                        <div style={{ textAlign: "left", minWidth: 0 }}>
                          <div style={searchTitleStyle}>{ticket.id}</div>
                          <div style={searchMetaStyle}>
                            Cliente: {ticket.customer_name}
                          </div>
                          <div style={searchMetaStyle}>
                            Total: ${money(ticket.total)}
                          </div>
                        </div>

                        <div style={badgeStyle}>Abrir</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div style={rightColumnStyle}>
              <div style={panelStyle}>
                <div style={panelHeaderStyle}>
                  <div>
                    <h2 style={panelTitleStyle}>Detalle del ticket</h2>
                    <p style={panelSubtitleStyle}>
                      Por ahora es una base visual estable
                    </p>
                  </div>
                </div>

                {!selectedTicket ? (
                  <div style={emptyBoxStyle}>
                    Selecciona un ticket para verlo aquí
                  </div>
                ) : (
                  <>
                    <div style={ticketHeaderStyle}>
                      <div>
                        <div style={ticketTitleStyle}>{selectedTicket.id}</div>
                        <div style={ticketMetaStyle}>
                          Cliente: <b>{selectedTicket.customer_name}</b>
                        </div>
                        <div style={ticketMetaStyle}>
                          Estado: <b>{selectedTicket.status}</b>
                        </div>
                      </div>

                      <div style={ticketTotalStyle}>
                        ${money(selectedTicket.total)}
                      </div>
                    </div>

                    <div style={actionsGridStyle}>
                      <button
                        onClick={() => simulateAction("Aquí irá cobrar en efectivo")}
                        style={successButtonStyle}
                      >
                        Cobrar efectivo
                      </button>

                      <button
                        onClick={() => simulateAction("Aquí irá cobrar con tarjeta")}
                        style={infoButtonStyle}
                      >
                        Cobrar tarjeta
                      </button>

                      <button
                        onClick={() => simulateAction("Aquí irá cobrar por transferencia")}
                        style={secondaryActionButtonStyle}
                      >
                        Transferencia
                      </button>

                      <button
                        onClick={() => simulateAction("Aquí irá mandar a crédito")}
                        style={warningButtonStyle}
                      >
                        Mandar a crédito
                      </button>
                    </div>

                    <button
                      onClick={() => simulateAction("Aquí irá cancelar ticket")}
                      style={dangerButtonStyle}
                    >
                      Cancelar ticket
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div style={mainGridStyle}>
            <div style={leftColumnStyle}>
              <div style={panelStyle}>
                <div style={panelHeaderStyle}>
                  <div>
                    <h2 style={panelTitleStyle}>Encabezado de venta manual</h2>
                    <p style={panelSubtitleStyle}>
                      Respaldo para caja cuando falle ticket o lector
                    </p>
                  </div>
                </div>

                <div style={fieldBlockStyle}>
                  <div style={fieldLabelStyle}>Cliente</div>
                  <input
                    placeholder="Nombre del cliente o público general"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    style={inputStyle}
                  />
                </div>

                <div style={fieldBlockStyle}>
                  <div style={fieldLabelStyle}>Notas</div>
                  <textarea
                    placeholder="Observaciones de caja"
                    value={manualNotes}
                    onChange={(e) => setManualNotes(e.target.value)}
                    style={textareaStyle}
                  />
                </div>
              </div>

              <div style={panelStyle}>
                <div style={panelHeaderStyle}>
                  <div>
                    <h2 style={panelTitleStyle}>Renglones</h2>
                    <p style={panelSubtitleStyle}>
                      Después conectaremos catálogo y captura por estación
                    </p>
                  </div>
                </div>

                <button onClick={addManualLine} style={primaryActionButtonStyle}>
                  + Agregar renglón
                </button>

                <div style={{ marginTop: 14 }}>
                  {manualLines.length === 0 ? (
                    <div style={emptyBoxStyle}>Todavía no agregas renglones</div>
                  ) : (
                    manualLines.map((line) => (
                      <div key={line.id} style={manualRowStyle}>
                        <input
                          value={line.product}
                          onChange={(e) =>
                            updateManualLine(line.id, "product", e.target.value)
                          }
                          placeholder="Producto"
                          style={inputMiniStyle}
                        />

                        <input
                          value={line.kilos}
                          onChange={(e) =>
                            updateManualLine(line.id, "kilos", e.target.value)
                          }
                          placeholder="Kilos"
                          style={inputMiniStyle}
                        />

                        <input
                          value={line.price}
                          onChange={(e) =>
                            updateManualLine(line.id, "price", e.target.value)
                          }
                          placeholder="Precio"
                          style={inputMiniStyle}
                        />

                        <button
                          onClick={() => removeManualLine(line.id)}
                          style={dangerMiniButtonStyle}
                        >
                          X
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div style={rightColumnStyle}>
              <div style={panelStyle}>
                <div style={panelHeaderStyle}>
                  <div>
                    <h2 style={panelTitleStyle}>Resumen de venta manual</h2>
                    <p style={panelSubtitleStyle}>
                      Esta es la base estable del fallback de caja
                    </p>
                  </div>
                </div>

                <div style={summaryCardStyle}>
                  <div style={summaryRowStyle}>
                    <span>Cliente</span>
                    <b>{customerName || "Público general"}</b>
                  </div>

                  <div style={summaryRowStyle}>
                    <span>Renglones</span>
                    <b>{manualLines.length}</b>
                  </div>

                  <div style={summaryRowStyle}>
                    <span>Total</span>
                    <b>${money(manualTotal)}</b>
                  </div>
                </div>

                <div style={actionsGridStyle}>
                  <button
                    onClick={() => simulateAction("Aquí irá registrar venta en efectivo")}
                    style={successButtonStyle}
                  >
                    Cobrar efectivo
                  </button>

                  <button
                    onClick={() => simulateAction("Aquí irá registrar venta con tarjeta")}
                    style={infoButtonStyle}
                  >
                    Cobrar tarjeta
                  </button>

                  <button
                    onClick={() => simulateAction("Aquí irá registrar transferencia")}
                    style={secondaryActionButtonStyle}
                  >
                    Transferencia
                  </button>

                  <button
                    onClick={() => simulateAction("Aquí irá mandar la venta manual a crédito")}
                    style={warningButtonStyle}
                  >
                    Crédito
                  </button>
                </div>

                <button
                  onClick={clearManualSale}
                  style={dangerButtonStyle}
                >
                  Limpiar venta manual
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  padding: 16,
  background: `linear-gradient(180deg, ${COLORS.bgSoft} 0%, ${COLORS.bg} 100%)`,
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
  maxWidth: 1480,
  margin: "0 auto",
  position: "relative",
  zIndex: 2,
};

const topBarStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  flexWrap: "wrap",
  marginBottom: 20,
};

const tabsCardStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  background: COLORS.card,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 22,
  padding: 12,
  boxShadow: COLORS.shadow,
  marginBottom: 20,
};

const tabButtonStyle: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: 14,
  border: "none",
  cursor: "pointer",
  fontWeight: 800,
};

const mainGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.1fr) minmax(360px, 0.9fr)",
  gap: 20,
  alignItems: "start",
};

const leftColumnStyle: React.CSSProperties = {
  display: "grid",
  gap: 20,
};

const rightColumnStyle: React.CSSProperties = {
  display: "grid",
  gap: 20,
};

const panelStyle: React.CSSProperties = {
  background: COLORS.card,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 24,
  padding: 18,
  boxShadow: COLORS.shadow,
};

const panelHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  marginBottom: 14,
};

const panelTitleStyle: React.CSSProperties = {
  margin: 0,
  color: COLORS.text,
};

const panelSubtitleStyle: React.CSSProperties = {
  margin: "6px 0 0 0",
  color: COLORS.muted,
  fontSize: 14,
};

const fieldBlockStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

const fieldLabelStyle: React.CSSProperties = {
  color: COLORS.muted,
  fontWeight: 700,
  fontSize: 14,
};

const primaryActionButtonStyle: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: 14,
  border: "none",
  background: `linear-gradient(180deg, ${COLORS.primary} 0%, ${COLORS.primaryDark} 100%)`,
  color: "white",
  cursor: "pointer",
  fontWeight: 800,
  boxShadow: "0 8px 18px rgba(123, 34, 24, 0.20)",
};

const secondaryActionButtonStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 14,
  border: `1px solid ${COLORS.border}`,
  background: "white",
  color: COLORS.text,
  cursor: "pointer",
  fontWeight: 700,
};

const successButtonStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 14,
  border: "none",
  background: "rgba(31,122,77,0.12)",
  color: COLORS.success,
  cursor: "pointer",
  fontWeight: 800,
};

const infoButtonStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 14,
  border: "none",
  background: "rgba(53,92,125,0.12)",
  color: COLORS.info,
  cursor: "pointer",
  fontWeight: 800,
};

const warningButtonStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 14,
  border: "none",
  background: "rgba(166,106,16,0.12)",
  color: COLORS.warning,
  cursor: "pointer",
  fontWeight: 800,
};

const dangerButtonStyle: React.CSSProperties = {
  width: "100%",
  marginTop: 12,
  padding: "12px 14px",
  borderRadius: 14,
  border: "none",
  background: "rgba(180,35,24,0.10)",
  color: COLORS.danger,
  cursor: "pointer",
  fontWeight: 800,
};

const secondaryButtonStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "12px 18px",
  borderRadius: 14,
  border: `1px solid ${COLORS.border}`,
  background: "rgba(255,255,255,0.75)",
  color: COLORS.text,
  textDecoration: "none",
  fontWeight: 700,
};

const listWrapStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const searchResultCardStyle: React.CSSProperties = {
  width: "100%",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: 14,
  borderRadius: 16,
  border: `1px solid ${COLORS.border}`,
  background: COLORS.bgSoft,
  cursor: "pointer",
};

const searchTitleStyle: React.CSSProperties = {
  fontWeight: 800,
  color: COLORS.text,
};

const searchMetaStyle: React.CSSProperties = {
  color: COLORS.muted,
  fontSize: 13,
  marginTop: 4,
};

const badgeStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  background: "rgba(123, 34, 24, 0.10)",
  color: COLORS.primary,
  flexShrink: 0,
};

const miniTitleStyle: React.CSSProperties = {
  color: COLORS.text,
  fontWeight: 800,
  marginBottom: 10,
  fontSize: 18,
};

const ticketHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  padding: 14,
  borderRadius: 18,
  background: COLORS.bgSoft,
  border: `1px solid ${COLORS.border}`,
  marginBottom: 14,
};

const ticketTitleStyle: React.CSSProperties = {
  color: COLORS.text,
  fontWeight: 800,
  fontSize: 22,
  lineHeight: 1.1,
};

const ticketMetaStyle: React.CSSProperties = {
  color: COLORS.muted,
  fontSize: 14,
  marginTop: 6,
};

const ticketTotalStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 16,
  background: COLORS.primary,
  color: "white",
  fontWeight: 800,
  fontSize: 22,
  whiteSpace: "nowrap",
};

const summaryCardStyle: React.CSSProperties = {
  background: COLORS.bgSoft,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 18,
  padding: 14,
  display: "grid",
  gap: 10,
};

const summaryRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  color: COLORS.text,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 14,
  borderRadius: 16,
  border: `1px solid ${COLORS.border}`,
  boxSizing: "border-box",
  outline: "none",
  background: "rgba(255,255,255,0.82)",
  color: COLORS.text,
  fontSize: 15,
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 110,
  padding: 14,
  borderRadius: 16,
  border: `1px solid ${COLORS.border}`,
  boxSizing: "border-box",
  outline: "none",
  background: "rgba(255,255,255,0.82)",
  color: COLORS.text,
  fontSize: 15,
  resize: "vertical",
};

const manualRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.4fr) 120px 120px auto",
  gap: 10,
  alignItems: "center",
  padding: 12,
  background: COLORS.bgSoft,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 16,
  marginBottom: 10,
};

const inputMiniStyle: React.CSSProperties = {
  width: "100%",
  padding: 10,
  borderRadius: 12,
  border: `1px solid ${COLORS.border}`,
  boxSizing: "border-box",
  outline: "none",
  background: "white",
  color: COLORS.text,
  fontSize: 14,
};

const dangerMiniButtonStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "none",
  background: "rgba(180,35,24,0.10)",
  color: COLORS.danger,
  cursor: "pointer",
  fontWeight: 800,
};

const selectedBoxStyle: React.CSSProperties = {
  marginTop: 14,
  padding: 14,
  borderRadius: 16,
  background: "rgba(123,34,24,0.08)",
  border: `1px solid ${COLORS.border}`,
  color: COLORS.text,
};

const emptyBoxStyle: React.CSSProperties = {
  padding: 16,
  borderRadius: 18,
  background: COLORS.bgSoft,
  border: `1px dashed ${COLORS.border}`,
  color: COLORS.muted,
};

const actionsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
  marginTop: 16,
};