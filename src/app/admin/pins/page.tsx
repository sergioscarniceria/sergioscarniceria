"use client";

import { useEffect, useState } from "react";

type PinEntry = {
  role: string;
  pin: string;
  label: string;
  updated_at: string;
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  admin: "Acceso total: dashboards, caja, productos, clientes, asistencia y todos los módulos",
  cajera: "Cobranza y Cuentas por Cobrar (CxC)",
  empleado: "Ventas mostrador, Producción, Pedidos y Repartidores",
};

export default function AdminPinsPage() {
  const [pins, setPins] = useState<PinEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [newPin, setNewPin] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchPins();
  }, []);

  async function fetchPins() {
    try {
      const res = await fetch("/api/auth/pins");
      if (res.ok) {
        const data = await res.json();
        setPins(data);
      }
    } catch {
      console.error("Error fetching pins");
    }
    setLoading(false);
  }

  async function savePin(role: string) {
    if (!/^\d{4}$/.test(newPin)) {
      setMessage("El PIN debe ser de 4 dígitos");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const res = await fetch("/api/auth/pins", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, pin: newPin }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.error || "Error al guardar");
      } else {
        setMessage("PIN actualizado correctamente");
        setEditing(null);
        setNewPin("");
        fetchPins();
        // Limpiar sesión para que todos tengan que re-autenticarse
        window.sessionStorage.removeItem("pin_role");
      }
    } catch {
      setMessage("Error de conexión");
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "#7a5a52" }}>
        Cargando...
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f7f1e8",
        padding: "24px 16px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: 540, margin: "0 auto" }}>
        <a
          href="/admin/dashboard"
          style={{
            color: "#7b2218",
            textDecoration: "none",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          ← Dashboard
        </a>

        <h1
          style={{
            color: "#3b1c16",
            fontSize: 24,
            fontWeight: 700,
            margin: "16px 0 8px",
          }}
        >
          Gestión de PINs
        </h1>
        <p style={{ color: "#7a5a52", fontSize: 14, margin: "0 0 24px" }}>
          Configura los PINs de acceso para cada rol. Los PINs deben ser de 4
          dígitos y no pueden repetirse entre roles.
        </p>

        {message && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              background: message.includes("correctamente")
                ? "#d4edda"
                : "#f8d7da",
              color: message.includes("correctamente") ? "#155724" : "#721c24",
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 16,
            }}
          >
            {message}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {pins.map((p) => (
            <div
              key={p.role}
              style={{
                background: "white",
                borderRadius: 16,
                padding: "18px 20px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                border: "1px solid rgba(92,27,17,0.08)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 6,
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: 17,
                      fontWeight: 700,
                      color: "#3b1c16",
                    }}
                  >
                    {p.label}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      color: "#7b2218",
                      background: "rgba(123,34,24,0.08)",
                      padding: "2px 8px",
                      borderRadius: 6,
                      marginLeft: 8,
                      fontWeight: 600,
                    }}
                  >
                    {p.role}
                  </span>
                </div>
                {editing !== p.role && (
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontSize: 22,
                      fontWeight: 700,
                      color: "#3b1c16",
                      letterSpacing: 4,
                    }}
                  >
                    {p.pin}
                  </span>
                )}
              </div>

              <p
                style={{
                  fontSize: 13,
                  color: "#8b7355",
                  margin: "0 0 12px",
                  lineHeight: 1.4,
                }}
              >
                {ROLE_DESCRIPTIONS[p.role] || ""}
              </p>

              {editing === p.role ? (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="Nuevo PIN"
                    value={newPin}
                    onChange={(e) =>
                      setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))
                    }
                    autoFocus
                    style={{
                      flex: 1,
                      padding: "10px 14px",
                      borderRadius: 10,
                      border: "1px solid rgba(92,27,17,0.15)",
                      fontSize: 18,
                      fontFamily: "monospace",
                      letterSpacing: 6,
                      textAlign: "center",
                    }}
                  />
                  <button
                    onClick={() => savePin(p.role)}
                    disabled={saving || newPin.length !== 4}
                    style={{
                      padding: "10px 18px",
                      borderRadius: 10,
                      border: "none",
                      background:
                        newPin.length === 4 ? "#27ae60" : "#ccc",
                      color: "white",
                      fontWeight: 700,
                      cursor: newPin.length === 4 ? "pointer" : "default",
                      fontSize: 14,
                    }}
                  >
                    {saving ? "..." : "Guardar"}
                  </button>
                  <button
                    onClick={() => {
                      setEditing(null);
                      setNewPin("");
                      setMessage("");
                    }}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 10,
                      border: "1px solid rgba(92,27,17,0.15)",
                      background: "white",
                      color: "#7a5a52",
                      fontWeight: 600,
                      cursor: "pointer",
                      fontSize: 14,
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setEditing(p.role);
                    setNewPin("");
                    setMessage("");
                  }}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 10,
                    border: "1px solid rgba(123,34,24,0.2)",
                    background: "transparent",
                    color: "#7b2218",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  Cambiar PIN
                </button>
              )}
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: 32,
            padding: "14px 18px",
            background: "rgba(123,34,24,0.04)",
            borderRadius: 12,
            border: "1px solid rgba(123,34,24,0.08)",
          }}
        >
          <p
            style={{
              fontSize: 13,
              color: "#7a5a52",
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            <strong>Nota:</strong> Al cambiar un PIN, todas las sesiones
            activas con ese rol deberán ingresar el nuevo PIN. Los PINs se
            guardan de forma segura en la base de datos.
          </p>
        </div>
      </div>
    </div>
  );
}
