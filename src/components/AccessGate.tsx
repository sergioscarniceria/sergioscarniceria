"use client";

import { useEffect, useMemo, useState } from "react";

type AccessGateProps = {
  scope: "operation" | "admin";
  title: string;
  subtitle: string;
  children: React.ReactNode;
};

export default function AccessGate({
  scope,
  title,
  subtitle,
  children,
}: AccessGateProps) {
  const [ready, setReady] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [password, setPassword] = useState("");

  const storageKey = useMemo(() => `access_${scope}`, [scope]);

  const expectedPassword =
    scope === "operation"
      ? process.env.NEXT_PUBLIC_OPERATION_PASSWORD
      : process.env.NEXT_PUBLIC_ADMIN_PASSWORD;

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (saved === "ok") {
      setAllowed(true);
    }
    setReady(true);
  }, [storageKey]);

  function handleAccess() {
    if (!expectedPassword) {
      alert("Falta configurar la contraseña en variables de entorno");
      return;
    }

    if (password === expectedPassword) {
      window.localStorage.setItem(storageKey, "ok");
      setAllowed(true);
    } else {
      alert("Contraseña incorrecta");
    }
  }

  if (!ready) return null;

  if (allowed) {
    return <>{children}</>;
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f7f1e8",
        padding: 24,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "white",
          borderRadius: 24,
          padding: 28,
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
          border: "1px solid rgba(92,27,17,0.10)",
        }}
      >
        <img
          src="/logo.png"
          alt="Sergios Carnicería"
          style={{
            width: 140,
            display: "block",
            margin: "0 auto 18px auto",
          }}
        />

        <h1
          style={{
            margin: 0,
            textAlign: "center",
            color: "#3b1c16",
            fontSize: 28,
          }}
        >
          {title}
        </h1>

        <p
          style={{
            textAlign: "center",
            color: "#7a5a52",
            marginTop: 10,
            marginBottom: 20,
            lineHeight: 1.5,
          }}
        >
          {subtitle}
        </p>

        <input
          type="password"
          placeholder="Escribe la contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            width: "100%",
            padding: 14,
            borderRadius: 14,
            border: "1px solid rgba(92,27,17,0.12)",
            boxSizing: "border-box",
            marginBottom: 12,
            fontSize: 15,
          }}
        />

        <button
          onClick={handleAccess}
          style={{
            width: "100%",
            padding: "14px 16px",
            borderRadius: 14,
            border: "none",
            background: "#7b2218",
            color: "white",
            fontWeight: 700,
            cursor: "pointer",
            fontSize: 15,
          }}
        >
          Entrar
        </button>
      </div>
    </div>
  );
}