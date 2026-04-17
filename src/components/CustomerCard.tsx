"use client";

import { useRef } from "react";

type CustomerCardProps = {
  name: string;
  phone?: string | null;
  email?: string | null;
  password?: string | null;
  customerId: string;
  onClose: () => void;
};

const C = {
  bg: "#f7f1e8",
  card: "#fffaf5",
  primary: "#7b2218",
  primaryDark: "#5a190f",
  text: "#3b1c16",
  muted: "#7a5a52",
  border: "rgba(92, 27, 17, 0.15)",
  gold: "#c9a94e",
};

export default function CustomerCard({ name, phone, email, password, customerId, onClose }: CustomerCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  function printCard() {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent("CLI-" + customerId)}`;
    const printWin = window.open("", "_blank", "width=500,height=380");
    if (!printWin) return;

    printWin.document.write(`<!DOCTYPE html><html><head><title>Tarjeta - ${name}</title>
<style>
  @page { size: 86mm 54mm; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #eee; }
  .card {
    width: 86mm; height: 54mm; background: linear-gradient(135deg, #fffaf5 0%, #f7f1e8 60%, #f0e6d6 100%);
    border-radius: 10px; padding: 10px 14px; position: relative; overflow: hidden;
    border: 1.5px solid rgba(92,27,17,0.12); display: flex; gap: 10px;
  }
  .card::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 5px;
    background: linear-gradient(90deg, #7b2218, #c9a94e, #7b2218);
  }
  .left { flex: 1; display: flex; flex-direction: column; justify-content: center; padding-top: 4px; }
  .right { display: flex; flex-direction: column; align-items: center; justify-content: center; }
  .shop-name { font-size: 9px; text-transform: uppercase; letter-spacing: 2px; color: #7b2218; font-weight: 700; margin-bottom: 6px; }
  .customer-name { font-size: 15px; font-weight: 800; color: #3b1c16; margin-bottom: 8px; line-height: 1.2; }
  .field { margin-bottom: 4px; }
  .label { font-size: 7px; text-transform: uppercase; letter-spacing: 1px; color: #7a5a52; font-weight: 600; }
  .value { font-size: 10px; color: #3b1c16; font-weight: 600; }
  .qr img { width: 72px; height: 72px; border-radius: 6px; border: 1px solid rgba(92,27,17,0.1); }
  .qr-label { font-size: 7px; color: #7a5a52; font-family: monospace; margin-top: 3px; }
  .footer { position: absolute; bottom: 4px; left: 14px; right: 14px; display: flex; justify-content: space-between; align-items: center; }
  .footer-text { font-size: 6.5px; color: #7a5a52; }
</style></head><body>
<div class="card">
  <div class="left">
    <div class="shop-name">Sergio's Carnicer\u00eda</div>
    <div class="customer-name">${name}</div>
    ${phone ? `<div class="field"><div class="label">Tel\u00e9fono</div><div class="value">${phone}</div></div>` : ""}
    ${email ? `<div class="field"><div class="label">Correo</div><div class="value">${email}</div></div>` : ""}
    ${password ? `<div class="field"><div class="label">Contrase\u00f1a</div><div class="value">${password}</div></div>` : ""}
  </div>
  <div class="right">
    <div class="qr"><img src="${qrUrl}" alt="QR" /></div>
    <div class="qr-label">CLI-${customerId.slice(0, 8)}</div>
  </div>
  <div class="footer">
    <span class="footer-text">sergioscarniceria.com</span>
    <span class="footer-text">Tarjeta de cliente</span>
  </div>
</div>
</body></html>`);
    printWin.document.close();
    printWin.onload = () => printWin.print();
  }

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent("CLI-" + customerId)}`;

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 9999, padding: 16,
    }}>
      <div style={{ maxWidth: 420, width: "100%" }}>
        {/* La tarjeta visual */}
        <div ref={cardRef} style={{
          background: `linear-gradient(135deg, ${C.card} 0%, ${C.bg} 60%, #f0e6d6 100%)`,
          borderRadius: 16, padding: "18px 22px", position: "relative", overflow: "hidden",
          border: `1.5px solid ${C.border}`,
          boxShadow: "0 20px 60px rgba(91, 25, 15, 0.15)",
        }}>
          {/* Franja superior */}
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: 5,
            background: `linear-gradient(90deg, ${C.primary}, ${C.gold}, ${C.primary})`,
          }} />

          <div style={{ display: "flex", gap: 16, paddingTop: 6 }}>
            {/* Lado izquierdo - datos */}
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 10, textTransform: "uppercase" as const, letterSpacing: 2,
                color: C.primary, fontWeight: 700, marginBottom: 8,
              }}>
                Sergio&apos;s Carnicería
              </div>
              <div style={{
                fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 12, lineHeight: 1.2,
              }}>
                {name}
              </div>

              {phone && (
                <div style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 9, textTransform: "uppercase" as const, letterSpacing: 1, color: C.muted, fontWeight: 600 }}>Teléfono</div>
                  <div style={{ fontSize: 14, color: C.text, fontWeight: 600 }}>{phone}</div>
                </div>
              )}
              {email && (
                <div style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 9, textTransform: "uppercase" as const, letterSpacing: 1, color: C.muted, fontWeight: 600 }}>Correo</div>
                  <div style={{ fontSize: 14, color: C.text, fontWeight: 600 }}>{email}</div>
                </div>
              )}
              {password && (
                <div style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 9, textTransform: "uppercase" as const, letterSpacing: 1, color: C.muted, fontWeight: 600 }}>Contraseña</div>
                  <div style={{ fontSize: 14, color: C.text, fontWeight: 600 }}>{password}</div>
                </div>
              )}
            </div>

            {/* Lado derecho - QR */}
            <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", justifyContent: "center" }}>
              <img
                src={qrUrl}
                alt="QR cliente"
                style={{ width: 100, height: 100, borderRadius: 10, border: `1px solid ${C.border}` }}
              />
              <div style={{ fontSize: 9, color: C.muted, fontFamily: "monospace", marginTop: 4 }}>
                CLI-{customerId.slice(0, 8)}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{
            display: "flex", justifyContent: "space-between", marginTop: 10,
            paddingTop: 8, borderTop: `1px solid ${C.border}`,
          }}>
            <span style={{ fontSize: 9, color: C.muted }}>sergioscarniceria.com</span>
            <span style={{ fontSize: 9, color: C.muted }}>Tarjeta de cliente</span>
          </div>
        </div>

        {/* Botones debajo de la tarjeta */}
        <div style={{ display: "flex", gap: 10, marginTop: 14, justifyContent: "center", flexWrap: "wrap" as const }}>
          <button
            onClick={() => {
              const msg = `🥩 *Sergio's Carnicería*\n\nTu tarjeta de cliente:\n👤 ${name}\n${phone ? `📱 ${phone}\n` : ""}${email ? `📧 ${email}\n` : ""}${password ? `🔑 Contraseña: ${password}\n` : ""}\nEntra en: sergioscarniceria.com/cliente`;
              const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
              window.open(url, "_blank");
            }}
            style={{
              padding: "12px 20px", borderRadius: 14, border: "none",
              background: "#25D366", color: "white", fontWeight: 700,
              cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", gap: 6,
            }}
          >
            📱 Enviar por WhatsApp
          </button>
          <button
            onClick={printCard}
            style={{
              padding: "12px 20px", borderRadius: 14, border: "none",
              background: `linear-gradient(180deg, ${C.primary} 0%, ${C.primaryDark} 100%)`,
              color: "white", fontWeight: 700, cursor: "pointer", fontSize: 14,
            }}
          >
            🖨 Imprimir
          </button>
          <button
            onClick={onClose}
            style={{
              padding: "12px 20px", borderRadius: 14, border: `1.5px solid ${C.border}`,
              background: "rgba(255,255,255,0.9)", color: C.text, fontWeight: 600,
              cursor: "pointer", fontSize: 14,
            }}
          >
            Continuar
          </button>
        </div>

        <p style={{ textAlign: "center" as const, marginTop: 10, fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
          Env&iacute;ate la tarjeta por WhatsApp para no perder tus datos
        </p>
      </div>
    </div>
  );
}
