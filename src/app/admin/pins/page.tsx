"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { getAdminSecret } from "@/lib/admin-secret";

type PinEntry = {
  role: string;
  pin: string;
  label: string;
  updated_at: string;
};

type EmployeeCode = {
  id: string;
  name: string;
  role: string;
  code: string;
  is_active: boolean;
  created_at: string;
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  admin: "Acceso total: dashboards, caja, productos, clientes, asistencia y todos los módulos",
  cajera: "Cobranza y Cuentas por Cobrar (CxC)",
  empleado: "Ventas mostrador, Producción, Pedidos y Repartidores",
};

export default function AdminPinsPage() {
  const supabase = getSupabaseClient();
  const [pins, setPins] = useState<PinEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [newPin, setNewPin] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // Employee codes
  const [empCodes, setEmpCodes] = useState<EmployeeCode[]>([]);
  const [empLoading, setEmpLoading] = useState(true);
  const [editingEmp, setEditingEmp] = useState<string | null>(null);
  const [editEmpName, setEditEmpName] = useState("");
  const [editEmpCode, setEditEmpCode] = useState("");
  const [editEmpRole, setEditEmpRole] = useState("cajera");
  const [showNewEmp, setShowNewEmp] = useState(false);
  const [newEmpName, setNewEmpName] = useState("");
  const [newEmpCode, setNewEmpCode] = useState("");
  const [newEmpRole, setNewEmpRole] = useState("cajera");
  const [empMessage, setEmpMessage] = useState("");

  useEffect(() => {
    fetchPins();
    fetchEmployeeCodes();
  }, []);

  async function fetchPins() {
    try {
      const res = await fetch("/api/auth/pins", {
        headers: { "x-admin-secret": getAdminSecret() },
      });
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
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": getAdminSecret(),
        },
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

  async function fetchEmployeeCodes() {
    setEmpLoading(true);
    const { data } = await supabase
      .from("employee_codes")
      .select("*")
      .order("role")
      .order("name");
    setEmpCodes((data as EmployeeCode[]) || []);
    setEmpLoading(false);
  }

  async function saveEmployeeCode(id: string) {
    if (!editEmpName.trim() || !editEmpCode.trim()) {
      setEmpMessage("Nombre y código son obligatorios");
      return;
    }
    const { error } = await supabase
      .from("employee_codes")
      .update({ name: editEmpName.trim(), code: editEmpCode.trim(), role: editEmpRole })
      .eq("id", id);
    if (error) { setEmpMessage("Error: " + error.message); return; }
    setEmpMessage("Código actualizado");
    setEditingEmp(null);
    fetchEmployeeCodes();
  }

  async function createEmployeeCode() {
    if (!newEmpName.trim() || !newEmpCode.trim()) {
      setEmpMessage("Nombre y código son obligatorios");
      return;
    }
    const { error } = await supabase.from("employee_codes").insert({
      name: newEmpName.trim(),
      code: newEmpCode.trim(),
      role: newEmpRole,
      is_active: true,
    });
    if (error) { setEmpMessage("Error: " + error.message); return; }
    setEmpMessage("Empleado creado");
    setShowNewEmp(false);
    setNewEmpName(""); setNewEmpCode(""); setNewEmpRole("cajera");
    fetchEmployeeCodes();
  }

  async function toggleEmployeeActive(emp: EmployeeCode) {
    await supabase.from("employee_codes").update({ is_active: !emp.is_active }).eq("id", emp.id);
    fetchEmployeeCodes();
  }

  async function deleteEmployeeCode(id: string) {
    if (!confirm("¿Eliminar este código permanentemente?")) return;
    await supabase.from("employee_codes").delete().eq("id", id);
    fetchEmployeeCodes();
  }

  const cajeras = empCodes.filter((e) => e.role === "cajera");
  const carniceros = empCodes.filter((e) => e.role === "carnicero");

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

        {/* ========== CÓDIGOS DE EMPLEADOS ========== */}
        <div style={{ marginTop: 40 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <h2 style={{ color: "#3b1c16", fontSize: 22, fontWeight: 700, margin: 0 }}>Códigos de empleados</h2>
              <p style={{ color: "#7a5a52", fontSize: 13, margin: "4px 0 0" }}>Códigos para identificarse en caja, inventario y mostrador</p>
            </div>
            <button onClick={() => setShowNewEmp(true)} style={{
              padding: "10px 18px", borderRadius: 12, border: "none",
              background: "linear-gradient(180deg, #7b2218 0%, #5a190f 100%)",
              color: "white", fontWeight: 700, cursor: "pointer", fontSize: 13,
            }}>+ Nuevo</button>
          </div>

          {empMessage && (
            <div style={{
              padding: "10px 14px", borderRadius: 10, marginBottom: 14, fontSize: 13, fontWeight: 600,
              background: empMessage.includes("Error") ? "#f8d7da" : "#d4edda",
              color: empMessage.includes("Error") ? "#721c24" : "#155724",
            }}>{empMessage}</div>
          )}

          {/* New employee form */}
          {showNewEmp && (
            <div style={{ background: "white", borderRadius: 16, padding: 18, marginBottom: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", border: "1px solid rgba(92,27,17,0.08)" }}>
              <div style={{ fontWeight: 700, color: "#3b1c16", fontSize: 15, marginBottom: 12 }}>Nuevo empleado</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: "#7a5a52", fontWeight: 700, display: "block", marginBottom: 4 }}>Nombre</label>
                  <input value={newEmpName} onChange={(e) => setNewEmpName(e.target.value)} placeholder="Ej: María" style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(92,27,17,0.15)", fontSize: 14, color: "#3b1c16" }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: "#7a5a52", fontWeight: 700, display: "block", marginBottom: 4 }}>Código</label>
                  <input value={newEmpCode} onChange={(e) => setNewEmpCode(e.target.value)} placeholder="Ej: 1004" style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(92,27,17,0.15)", fontSize: 14, fontFamily: "monospace", letterSpacing: 4, textAlign: "center", color: "#3b1c16" }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: "#7a5a52", fontWeight: 700, display: "block", marginBottom: 4 }}>Rol</label>
                  <select value={newEmpRole} onChange={(e) => setNewEmpRole(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(92,27,17,0.15)", fontSize: 14, color: "#3b1c16" }}>
                    <option value="cajera">Cajera</option>
                    <option value="carnicero">Carnicero</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={createEmployeeCode} style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: "#27ae60", color: "white", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>Guardar</button>
                <button onClick={() => { setShowNewEmp(false); setNewEmpName(""); setNewEmpCode(""); }} style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid rgba(92,27,17,0.15)", background: "white", color: "#7a5a52", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>Cancelar</button>
              </div>
            </div>
          )}

          {/* Cajeras */}
          {cajeras.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#7a5a52", marginBottom: 8 }}>Cajeras — código para identificarse en cobranza y salidas de inventario</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {cajeras.map((emp) => (
                  <div key={emp.id} style={{
                    background: "white", borderRadius: 14, padding: "14px 18px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.06)", border: "1px solid rgba(92,27,17,0.08)",
                    borderLeft: `4px solid ${emp.is_active ? "#1f7a4d" : "#ccc"}`,
                    opacity: emp.is_active ? 1 : 0.6,
                  }}>
                    {editingEmp === emp.id ? (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8, alignItems: "end" }}>
                        <div>
                          <label style={{ fontSize: 11, color: "#7a5a52", fontWeight: 700 }}>Nombre</label>
                          <input value={editEmpName} onChange={(e) => setEditEmpName(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(92,27,17,0.15)", fontSize: 14, color: "#3b1c16" }} />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, color: "#7a5a52", fontWeight: 700 }}>Código</label>
                          <input value={editEmpCode} onChange={(e) => setEditEmpCode(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(92,27,17,0.15)", fontSize: 14, fontFamily: "monospace", letterSpacing: 3, color: "#3b1c16" }} />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, color: "#7a5a52", fontWeight: 700 }}>Rol</label>
                          <select value={editEmpRole} onChange={(e) => setEditEmpRole(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(92,27,17,0.15)", fontSize: 14, color: "#3b1c16" }}>
                            <option value="cajera">Cajera</option>
                            <option value="carnicero">Carnicero</option>
                          </select>
                        </div>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button onClick={() => saveEmployeeCode(emp.id)} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "#27ae60", color: "white", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>OK</button>
                          <button onClick={() => setEditingEmp(null)} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(92,27,17,0.15)", background: "white", color: "#7a5a52", fontWeight: 600, cursor: "pointer", fontSize: 12 }}>X</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <span style={{ fontWeight: 700, color: "#3b1c16", fontSize: 16 }}>{emp.name}</span>
                          <span style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 700, color: "#7b2218", letterSpacing: 3, marginLeft: 16 }}>{emp.code}</span>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => { setEditingEmp(emp.id); setEditEmpName(emp.name); setEditEmpCode(emp.code); setEditEmpRole(emp.role); }} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(123,34,24,0.2)", background: "transparent", color: "#7b2218", fontWeight: 600, cursor: "pointer", fontSize: 12 }}>Editar</button>
                          <button onClick={() => toggleEmployeeActive(emp)} style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: emp.is_active ? "rgba(180,35,24,0.10)" : "rgba(31,122,77,0.12)", color: emp.is_active ? "#b42318" : "#1f7a4d", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>
                            {emp.is_active ? "Desactivar" : "Activar"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Carniceros */}
          {carniceros.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#7a5a52", marginBottom: 8 }}>Carniceros — se identifican en ventas de mostrador</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {carniceros.map((emp) => (
                  <div key={emp.id} style={{
                    background: "white", borderRadius: 14, padding: "14px 18px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.06)", border: "1px solid rgba(92,27,17,0.08)",
                    borderLeft: `4px solid ${emp.is_active ? "#355c7d" : "#ccc"}`,
                    opacity: emp.is_active ? 1 : 0.6,
                  }}>
                    {editingEmp === emp.id ? (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8, alignItems: "end" }}>
                        <div>
                          <label style={{ fontSize: 11, color: "#7a5a52", fontWeight: 700 }}>Nombre</label>
                          <input value={editEmpName} onChange={(e) => setEditEmpName(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(92,27,17,0.15)", fontSize: 14, color: "#3b1c16" }} />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, color: "#7a5a52", fontWeight: 700 }}>Código</label>
                          <input value={editEmpCode} onChange={(e) => setEditEmpCode(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(92,27,17,0.15)", fontSize: 14, fontFamily: "monospace", letterSpacing: 3, color: "#3b1c16" }} />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, color: "#7a5a52", fontWeight: 700 }}>Rol</label>
                          <select value={editEmpRole} onChange={(e) => setEditEmpRole(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(92,27,17,0.15)", fontSize: 14, color: "#3b1c16" }}>
                            <option value="cajera">Cajera</option>
                            <option value="carnicero">Carnicero</option>
                          </select>
                        </div>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button onClick={() => saveEmployeeCode(emp.id)} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "#27ae60", color: "white", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>OK</button>
                          <button onClick={() => setEditingEmp(null)} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(92,27,17,0.15)", background: "white", color: "#7a5a52", fontWeight: 600, cursor: "pointer", fontSize: 12 }}>X</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <span style={{ fontWeight: 700, color: "#3b1c16", fontSize: 16 }}>{emp.name}</span>
                          <span style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 700, color: "#355c7d", letterSpacing: 3, marginLeft: 16 }}>{emp.code}</span>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => { setEditingEmp(emp.id); setEditEmpName(emp.name); setEditEmpCode(emp.code); setEditEmpRole(emp.role); }} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(123,34,24,0.2)", background: "transparent", color: "#7b2218", fontWeight: 600, cursor: "pointer", fontSize: 12 }}>Editar</button>
                          <button onClick={() => toggleEmployeeActive(emp)} style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: emp.is_active ? "rgba(180,35,24,0.10)" : "rgba(31,122,77,0.12)", color: emp.is_active ? "#b42318" : "#1f7a4d", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>
                            {emp.is_active ? "Desactivar" : "Activar"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {empCodes.length === 0 && !empLoading && (
            <div style={{ textAlign: "center", padding: 20, color: "#7a5a52", background: "white", borderRadius: 14 }}>
              No hay códigos de empleados. Crea el primero con el botón + Nuevo
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
