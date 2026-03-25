"use client";

import { useEffect, useState } from "react";

type AccessGateProps = {
  scope: "operation" | "admin";
  title: string;
  subtitle: string;
  children: React.ReactNode;
};

const COLORS = {
  bg: "#f7f1e8",
  bgSoft: "#fbf8f3",
  card: "rgba(255,255,255,0.9)",
  border: "rgba(92, 27, 17, 0.10)",
  text: "#3b1c16",
  muted: "#7a5a52",
  primary: "#7b2218",
  primaryDark: "#5a190f",
  shadow: "0 10px 30px rgba(91, 25, 15, 0.08)",
};

export default function AccessGate({
  scope,
  title,
  subtitle,
  children,
}: AccessGateProps) {
  const [allowed, setAllowed] = useState(false);
  const [password, setPassword] = useState("");
  const [ready, setReady] = useState(false);

  const storageKey = `access_${scope}`;
  const expectedPassword =
    scope === "operation"
      ? process.env.NEXT_PUBLIC_OPERATION_PASSWORD
      : process.env.NEXT_PUBLIC_ADMIN_PASSWORD;

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved === "ok") {
      setAllowed(true);
    }
    setReady(true);
  }, [storageKey]);

  function handleAccess() {
    if (!expectedPassword) {
      alert("Falta configurar la contraseña en .env.local");
      return;
    }

    if (password === expectedPassword) {
      localStorage.setItem(storageKey, "ok");
      setAllowed(true);
      return;
    }

    alert("Contraseña incorrecta");
  }

  if (!ready) {
    return null;
  }

  if (allowed) {
    return <>{children}</>;
  }

  return (
    <div style={pageStyle}>
      <div style={glowTopLeft} />
      <div style={glowTopRight} />

      <div style={cardStyle}>
        <img
          src="/logo.png"
          alt="Sergios Carnicería"
          style={{
            width: 160,
            height: "auto",
            display: "block",
            margin: "0 auto 18px auto",
          }}
        />

        <h1 style={titleStyle}>{title}</h1>
        <p style={subtitleStyle}>{subtitle}</p>

        <input
          type="password"
          placeholder="Escribe la contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
        />

        <button onClick={handleAccess} style={buttonStyle}>
          Entrar
        </button>
      </div>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: `linear-gradient(180deg, ${COLORS.bgSoft} 0%, ${COLORS.bg} 100%)`,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
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

const cardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 460,
  background: COLORS.card,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 28,
  padding: 30,
  boxShadow: COLORS.shadow,
  textAlign: "center",
  position: "relative",
  zIndex: 2,
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  color: COLORS.text,
  fontSize: 32,
};

const subtitleStyle: React.CSSProperties = {
  marginTop: 10,
  marginBottom: 20,
  color: COLORS.muted,
  lineHeight: 1.5,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 14,
  borderRadius: 16,
  border: `1px solid ${COLORS.border}`,
  boxSizing: "border-box",
  outline: "none",
  marginBottom: 14,
  background: "rgba(255,255,255,0.9)",
  color: COLORS.text,
  fontSize: 15,
};

const buttonStyle: React.CSSProperties = {
  width: "100%",
  padding: "14px 18px",
  borderRadius: 16,
  border: "none",
  background: `linear-gradient(180deg, ${COLORS.primary} 0%, ${COLORS.primaryDark} 100%)`,
  color: "white",
  cursor: "pointer",
  fontWeight: 700,
};