"use client";

import { useEffect, useState, useCallback } from "react";

type AccessGateProps = {
  /** Roles que pueden acceder a esta sección */
  allowedRoles: string[];
  title: string;
  subtitle: string;
  children: React.ReactNode;
};

const SESSION_KEY = "pin_role";

export default function AccessGate({
  allowedRoles,
  title,
  subtitle,
  children,
}: AccessGateProps) {
  const [ready, setReady] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = window.sessionStorage.getItem(SESSION_KEY);
    if (saved && (allowedRoles.includes(saved) || saved === "admin")) {
      setAllowed(true);
    }
    setReady(true);
  }, [allowedRoles]);

  const handleVerify = useCallback(async () => {
    if (pin.length !== 4) {
      setError("Ingresa 4 dígitos");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });

      if (!res.ok) {
        setError("PIN incorrecto");
        setPin("");
        setLoading(false);
        return;
      }

      const data = await res.json();
      const role = data.role as string;

      if (allowedRoles.includes(role) || role === "admin") {
        window.sessionStorage.setItem(SESSION_KEY, role);
        setAllowed(true);
      } else {
        setError("No tienes acceso a esta sección");
        setPin("");
      }
    } catch {
      setError("Error de conexión");
    }
    setLoading(false);
  }, [pin, allowedRoles]);

  // Submit con Enter
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleVerify();
  };

  if (!ready) return null;
  if (allowed) return <>{children}</>;

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
          maxWidth: 380,
          background: "white",
          borderRadius: 24,
          padding: 28,
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
          border: "1px solid rgba(92,27,17,0.10)",
        }}
      >
        <img
          src="/logo.png"
          alt="Sergio's Carnicería"
          style={{
            width: 100,
            display: "block",
            margin: "0 auto 18px auto",
          }}
        />

        <h1
          style={{
            margin: 0,
            textAlign: "center",
            color: "#3b1c16",
            fontSize: 22,
            fontWeight: 700,
          }}
        >
          {title}
        </h1>

        <p
          style={{
            textAlign: "center",
            color: "#7a5a52",
            marginTop: 8,
            marginBottom: 24,
            lineHeight: 1.5,
            fontSize: 14,
          }}
        >
          {subtitle}
        </p>

        {/* PIN Input - 4 cajas */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 10,
            marginBottom: 16,
          }}
        >
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                width: 56,
                height: 64,
                borderRadius: 14,
                border: `2px solid ${pin.length === i ? "#7b2218" : "rgba(92,27,17,0.15)"}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 28,
                fontWeight: 700,
                color: "#3b1c16",
                background: pin.length === i ? "rgba(123,34,24,0.04)" : "#faf8f5",
                transition: "all 0.15s",
              }}
            >
              {pin[i] ? "●" : ""}
            </div>
          ))}
        </div>

        {/* Input oculto para capturar el PIN */}
        <input
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          autoFocus
          value={pin}
          onChange={(e) => {
            const val = e.target.value.replace(/\D/g, "").slice(0, 4);
            setPin(val);
            setError("");
          }}
          onKeyDown={handleKeyDown}
          style={{
            position: "absolute",
            opacity: 0,
            width: 1,
            height: 1,
          }}
        />

        {/* Teclado numérico */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 8,
            maxWidth: 240,
            margin: "0 auto 16px",
          }}
        >
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map(
            (key) =>
              key === "" ? (
                <div key="empty" />
              ) : (
                <button
                  key={key}
                  onClick={() => {
                    if (key === "⌫") {
                      setPin((p) => p.slice(0, -1));
                    } else if (pin.length < 4) {
                      setPin((p) => p + key);
                    }
                    setError("");
                  }}
                  style={{
                    padding: "14px 0",
                    borderRadius: 12,
                    border: "1px solid rgba(92,27,17,0.10)",
                    background: key === "⌫" ? "transparent" : "#faf8f5",
                    fontSize: key === "⌫" ? 20 : 22,
                    fontWeight: 600,
                    color: "#3b1c16",
                    cursor: "pointer",
                  }}
                >
                  {key}
                </button>
              )
          )}
        </div>

        {error && (
          <p
            style={{
              textAlign: "center",
              color: "#c0392b",
              fontSize: 13,
              margin: "0 0 12px",
              fontWeight: 600,
            }}
          >
            {error}
          </p>
        )}

        <button
          onClick={handleVerify}
          disabled={pin.length !== 4 || loading}
          style={{
            width: "100%",
            padding: "14px 16px",
            borderRadius: 14,
            border: "none",
            background: pin.length === 4 ? "#7b2218" : "#ccc",
            color: "white",
            fontWeight: 700,
            cursor: pin.length === 4 ? "pointer" : "default",
            fontSize: 15,
            transition: "background 0.2s",
          }}
        >
          {loading ? "Verificando..." : "Entrar"}
        </button>
      </div>
    </div>
  );
}
