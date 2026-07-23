"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { getAdminSecret } from "@/lib/admin-secret";

// jsPDF desde CDN
function loadJsPDF(): Promise<any> {
  return new Promise((resolve, reject) => {
    if ((window as any).jspdf) { resolve((window as any).jspdf.jsPDF); return; }
    const cdns = [
      "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js",
      "https://unpkg.com/jspdf@2.5.2/dist/jspdf.umd.min.js",
      "https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js",
    ];
    let idx = 0;
    function tryNext() {
      if (idx >= cdns.length) { reject(new Error("No se pudo cargar jsPDF")); return; }
      const sc = document.createElement("script");
      sc.src = cdns[idx++];
      sc.onload = () => {
        if ((window as any).jspdf) resolve((window as any).jspdf.jsPDF);
        else tryNext();
      };
      sc.onerror = () => tryNext();
      document.head.appendChild(sc);
    }
    tryNext();
  });
}

async function loadCarniceriaLogoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch("/logo-sm.png");
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

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

type DayHours = { entrada: string; salida: string } | null;
type Horario = {
  lunes?: DayHours;
  martes?: DayHours;
  miercoles?: DayHours;
  jueves?: DayHours;
  viernes?: DayHours;
  sabado?: DayHours;
  domingo?: DayHours;
};

type Documento = {
  id: string;
  tipo: string; // ine, comprobante, curp, rfc, otro
  nombre: string;
  url: string;
  uploaded_at: string;
};

type Empleado = {
  id: string;
  nombre: string;
  pin: string | null;
  rol: string;
  horario_json: Horario | null;
  dias_descanso_json: string[] | null;
  activo: boolean;
  domicilio?: string | null;
  telefono?: string | null;
  email?: string | null;
  fecha_ingreso?: string | null;
  fecha_nacimiento?: string | null;
  contacto_emergencia?: string | null;
  notas?: string | null;
  documentos?: Documento[] | null;
};

const TIPOS_DOCUMENTO = [
  { value: "ine", label: "INE / Identificación" },
  { value: "comprobante", label: "Comprobante de domicilio" },
  { value: "curp", label: "CURP" },
  { value: "rfc", label: "RFC / Constancia fiscal" },
  { value: "contrato", label: "Contrato" },
  { value: "otro", label: "Otro" },
];

const DIAS_SEMANA: { key: keyof Horario; label: string }[] = [
  { key: "lunes", label: "Lunes" },
  { key: "martes", label: "Martes" },
  { key: "miercoles", label: "Miércoles" },
  { key: "jueves", label: "Jueves" },
  { key: "viernes", label: "Viernes" },
  { key: "sabado", label: "Sábado" },
  { key: "domingo", label: "Domingo" },
];

const ROLE_DESCRIPTIONS: Record<string, string> = {
  admin: "Acceso total: dashboards, caja, productos, clientes, asistencia y todos los módulos",
  cajera: "Cobranza y Cuentas por Cobrar (CxC)",
  empleado: "Ventas mostrador, Producción, Pedidos y Repartidores",
  contabilidad: "Solo Proveedores / Cuentas por Pagar (contadora)",
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

  // ─── Empleados con horarios ───
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [loadingEmpleados, setLoadingEmpleados] = useState(true);
  const [editEmpleado, setEditEmpleado] = useState<Empleado | null>(null);
  const [showNewEmpleado, setShowNewEmpleado] = useState(false);
  const [searchEmp, setSearchEmp] = useState("");
  const [showInactivos, setShowInactivos] = useState(false);
  const [savingEmpleado, setSavingEmpleado] = useState(false);
  const [empleadoMsg, setEmpleadoMsg] = useState("");

  useEffect(() => {
    fetchPins();
    fetchEmployeeCodes();
    fetchEmpleados();
  }, []);

  async function fetchEmpleados() {
    setLoadingEmpleados(true);
    try {
      const res = await fetch("/api/admin/empleados", {
        headers: { "x-admin-secret": getAdminSecret() },
      });
      if (res.ok) {
        const data = await res.json();
        setEmpleados(data as Empleado[]);
      }
    } catch (err) {
      console.error(err);
    }
    setLoadingEmpleados(false);
  }

  async function saveEmpleado(emp: Empleado, isNew: boolean) {
    setSavingEmpleado(true);
    setEmpleadoMsg("");

    if (!emp.nombre.trim()) {
      setEmpleadoMsg("El nombre es obligatorio");
      setSavingEmpleado(false);
      return;
    }
    if (emp.pin && !/^\d{4}$/.test(emp.pin)) {
      setEmpleadoMsg("El PIN debe ser de 4 dígitos");
      setSavingEmpleado(false);
      return;
    }

    // Validación: PIN único entre empleados
    if (emp.pin) {
      const { data: pinExiste } = await supabase
        .from("empleados")
        .select("id")
        .eq("pin", emp.pin)
        .neq("id", emp.id || "00000000-0000-0000-0000-000000000000")
        .maybeSingle();
      if (pinExiste) {
        setEmpleadoMsg("Ese PIN ya está en uso por otro empleado");
        setSavingEmpleado(false);
        return;
      }
    }

    try {
      const payload = {
        nombre: emp.nombre.trim(),
        pin: emp.pin || null,
        rol: emp.rol,
        horario_json: emp.horario_json || {},
        dias_descanso_json: emp.dias_descanso_json || [],
        activo: emp.activo,
        domicilio: emp.domicilio?.trim() || null,
        telefono: emp.telefono?.trim() || null,
        email: emp.email?.trim() || null,
        fecha_ingreso: emp.fecha_ingreso || null,
        fecha_nacimiento: emp.fecha_nacimiento || null,
        contacto_emergencia: emp.contacto_emergencia?.trim() || null,
        notas: emp.notas?.trim() || null,
        documentos: emp.documentos || [],
      };

      const url = "/api/admin/empleados";
      const method = isNew ? "POST" : "PUT";
      const body = isNew ? payload : { id: emp.id, ...payload };
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": getAdminSecret(),
        },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Error del servidor");

      setEmpleadoMsg(isNew ? "Empleado creado correctamente" : "Cambios guardados");
      setEditEmpleado(null);
      setShowNewEmpleado(false);
      await fetchEmpleados();
      await fetchEmployeeCodes();
    } catch (err: any) {
      setEmpleadoMsg("Error: " + (err.message || "desconocido"));
    } finally {
      setSavingEmpleado(false);
    }
  }

  async function exportarFichaEmpleado(emp: Empleado) {
    try {
      const jsPDF = await loadJsPDF();
      const doc = new jsPDF({ unit: "mm", format: "letter" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      let y = 14;

      // Logo (top-left)
      const logoDataUrl = await loadCarniceriaLogoDataUrl();
      if (logoDataUrl) {
        try {
          doc.addImage(logoDataUrl, "PNG", 15, y, 22, 16);
        } catch {
          // ignore
        }
      }

      // Header
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(123, 34, 24);
      doc.text("Ficha de empleado", pageW - 15, y + 6, { align: "right" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(120, 120, 120);
      doc.text(`Generado ${new Date().toLocaleString("es-MX")}`, pageW - 15, y + 12, { align: "right" });
      y += 22;

      // Subtítulo nombre + rol
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(59, 28, 22);
      doc.text(`${emp.nombre} — ${(emp.rol || "").toUpperCase()}`, 15, y);
      y += 8;

      // Helper: seccion titulo
      function sectionTitle(text: string) {
        if (y > pageH - 30) { doc.addPage(); y = 18; }
        doc.setFillColor(123, 34, 24);
        doc.rect(15, y, pageW - 30, 7, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(255, 255, 255);
        doc.text(text, 18, y + 5);
        y += 10;
      }

      // Helper: row label/value
      function row(label: string, value: string) {
        if (y > pageH - 20) { doc.addPage(); y = 18; }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(123, 34, 24);
        doc.text(label, 18, y);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(50, 50, 50);
        const lines = doc.splitTextToSize(value || "—", pageW - 65);
        doc.text(lines, 60, y);
        y += 5 * Math.max(1, lines.length);
        y += 1;
      }

      sectionTitle("Datos personales");
      row("Nombre:", emp.nombre);
      row("Rol:", emp.rol);
      row("PIN:", emp.pin || "—");
      row("Teléfono:", emp.telefono || "—");
      row("Email:", emp.email || "—");
      row("Domicilio:", emp.domicilio || "—");
      row("Nacimiento:", emp.fecha_nacimiento || "—");
      row("Ingreso:", emp.fecha_ingreso || "—");
      row("Contacto emergencia:", emp.contacto_emergencia || "—");
      row("Notas:", emp.notas || "—");

      // Horarios
      sectionTitle("Horarios");
      const dias = DIAS_SEMANA.filter((d) => emp.horario_json && emp.horario_json[d.key]);
      if (dias.length === 0) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(10);
        doc.setTextColor(120, 120, 120);
        doc.text("Sin horarios", 18, y);
        y += 6;
      } else {
        // Tabla simple
        doc.setFillColor(247, 241, 232);
        doc.rect(15, y, pageW - 30, 7, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(59, 28, 22);
        doc.text("Día", 18, y + 5);
        doc.text("Entrada", pageW / 2 - 10, y + 5);
        doc.text("Salida", pageW - 35, y + 5);
        y += 9;
        doc.setFont("helvetica", "normal");
        doc.setTextColor(50, 50, 50);
        for (const d of dias) {
          if (y > pageH - 20) { doc.addPage(); y = 18; }
          const h = emp.horario_json?.[d.key];
          doc.text(d.label, 18, y);
          doc.text(h?.entrada || "—", pageW / 2 - 10, y);
          doc.text(h?.salida || "—", pageW - 35, y);
          y += 6;
          doc.setDrawColor(230, 230, 230);
          doc.line(15, y - 2, pageW - 15, y - 2);
        }
      }

      // Descansos
      const descansosTxt = (emp.dias_descanso_json || []).join(", ") || "Ninguno";
      y += 3;
      row("Días de descanso:", descansosTxt);

      // Documentos
      sectionTitle("Documentos");
      const docs = emp.documentos || [];
      if (docs.length === 0) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(10);
        doc.setTextColor(120, 120, 120);
        doc.text("Sin documentos", 18, y);
      } else {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(50, 50, 50);
        for (const d of docs) {
          if (y > pageH - 20) { doc.addPage(); y = 18; }
          const tipoLabel = TIPOS_DOCUMENTO.find((t) => t.value === d.tipo)?.label || d.tipo;
          doc.text(`• ${tipoLabel}: ${d.nombre}`, 18, y);
          y += 6;
        }
      }

      const safe = (emp.nombre || "empleado").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      const fname = `ficha-${safe || "empleado"}-${new Date().toISOString().slice(0, 10)}.pdf`;
      doc.save(fname);
    } catch (e: any) {
      alert("Error al generar PDF: " + (e?.message || e));
    }
  }

  async function toggleEmpleadoActivo(emp: Empleado, activo: boolean) {
    if (!activo && !confirm(`¿Desactivar a ${emp.nombre}? Podrá ser reactivado después.`)) return;
    setSavingEmpleado(true);
    try {
      const res = await fetch("/api/admin/empleados", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-secret": getAdminSecret() },
        body: JSON.stringify({ id: emp.id, activo }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Error");
      setEmpleadoMsg(`${emp.nombre} ${activo ? "reactivado" : "desactivado"}`);
      await fetchEmpleados();
      await fetchEmployeeCodes();
    } catch (err: any) {
      setEmpleadoMsg("Error: " + (err.message || "desconocido"));
    } finally {
      setSavingEmpleado(false);
    }
  }

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
  const contadores = empCodes.filter((e) => e.role === "contabilidad");

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
          Empleados y colaboradores
        </h1>
        <p style={{ color: "#7a5a52", fontSize: 14, margin: "0 0 24px" }}>
          Gestiona los PINs de acceso por rol, códigos de cada empleado y sus horarios. Todo en un solo lugar.
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
                    <option value="contabilidad">Contabilidad</option>
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
                            <option value="contabilidad">Contabilidad</option>
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
                            <option value="contabilidad">Contabilidad</option>
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

        {/* ═══ SECCIÓN: Empleados con horarios ═══ */}
        <div style={{ marginTop: 32, paddingTop: 24, borderTop: "2px solid rgba(123,34,24,0.10)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
            <div>
              <h2 style={{ color: "#3b1c16", fontSize: 22, fontWeight: 700, margin: 0 }}>👥 Empleados con horarios</h2>
              <p style={{ color: "#7a5a52", fontSize: 13, margin: "4px 0 0" }}>Gestiona horarios, días de descanso y datos completos de tu equipo.</p>
            </div>
            <button
              onClick={() => setShowNewEmpleado(true)}
              style={{ padding: "10px 16px", background: "#7b2218", color: "white", border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 14 }}
            >
              + Nuevo empleado
            </button>
          </div>

          {empleadoMsg && (
            <div style={{ padding: "10px 14px", borderRadius: 10, background: empleadoMsg.includes("Error") ? "#f8d7da" : "#d4edda", color: empleadoMsg.includes("Error") ? "#721c24" : "#155724", fontSize: 13, marginBottom: 12 }}>
              {empleadoMsg}
            </div>
          )}

          {/* Buscador y filtros */}
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <input
              value={searchEmp}
              onChange={(e) => setSearchEmp(e.target.value)}
              placeholder="🔍 Buscar empleado por nombre, rol o teléfono…"
              style={{ flex: 1, minWidth: 200, padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", fontSize: 14, color: "#3b1c16" }}
            />
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#3b1c16", padding: "0 8px" }}>
              <input type="checkbox" checked={showInactivos} onChange={(e) => setShowInactivos(e.target.checked)} />
              Mostrar inactivos
            </label>
          </div>

          {/* Panel de recordatorios (cumpleaños + aniversarios próximos) */}
          {(() => {
            const hoy = new Date();
            const en30dias = new Date(hoy);
            en30dias.setDate(hoy.getDate() + 30);
            const recordatorios: { nombre: string; tipo: string; fecha: string; dias: number }[] = [];
            empleados.filter((e) => e.activo).forEach((e) => {
              const checkDate = (rawDate: string | null | undefined, tipo: string) => {
                if (!rawDate) return;
                const d = new Date(rawDate + "T00:00:00");
                if (isNaN(d.getTime())) return;
                const proxima = new Date(hoy.getFullYear(), d.getMonth(), d.getDate());
                if (proxima < hoy) proxima.setFullYear(hoy.getFullYear() + 1);
                const diff = Math.ceil((proxima.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
                if (diff <= 30) {
                  const fechaStr = proxima.toLocaleDateString("es-MX", { day: "numeric", month: "long" });
                  recordatorios.push({ nombre: e.nombre, tipo, fecha: fechaStr, dias: diff });
                }
              };
              checkDate(e.fecha_nacimiento, "🎂 Cumpleaños");
              if (e.fecha_ingreso) {
                const ing = new Date(e.fecha_ingreso + "T00:00:00");
                const proxima = new Date(hoy.getFullYear(), ing.getMonth(), ing.getDate());
                if (proxima < hoy) proxima.setFullYear(hoy.getFullYear() + 1);
                const anios = proxima.getFullYear() - ing.getFullYear();
                if (anios > 0) checkDate(e.fecha_ingreso, `🎉 ${anios} año${anios > 1 ? "s" : ""} en la empresa`);
              }
            });
            recordatorios.sort((a, b) => a.dias - b.dias);
            if (recordatorios.length === 0) return null;
            return (
              <div style={{ background: "linear-gradient(135deg, #fff4e6 0%, #ffe9cc 100%)", borderRadius: 12, padding: 14, marginBottom: 14, border: "1px solid #d9a96b" }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#7a3a0e", marginBottom: 8 }}>📅 Próximos 30 días</div>
                <div style={{ display: "grid", gap: 4 }}>
                  {recordatorios.map((r, i) => (
                    <div key={i} style={{ fontSize: 12, color: "#5a2e0a" }}>
                      <b>{r.tipo}</b> · {r.nombre} — {r.fecha} {r.dias === 0 ? "(HOY)" : r.dias === 1 ? "(mañana)" : `(en ${r.dias} días)`}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {loadingEmpleados ? (
            <div style={{ textAlign: "center", padding: 20, color: "#7a5a52" }}>Cargando empleados…</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {empleados.filter((emp) => {
                if (!showInactivos && !emp.activo) return false;
                const q = searchEmp.toLowerCase().trim();
                if (!q) return true;
                return (
                  emp.nombre.toLowerCase().includes(q) ||
                  emp.rol.toLowerCase().includes(q) ||
                  (emp.telefono || "").toLowerCase().includes(q)
                );
              }).map((emp) => {
                const dias = DIAS_SEMANA.filter((d) => emp.horario_json && emp.horario_json[d.key]).map((d) => d.label.substring(0, 3)).join(", ");
                const descansos = (emp.dias_descanso_json || []).map((d) => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(", ");
                return (
                  <div key={emp.id} style={{ background: "white", borderRadius: 12, padding: "12px 16px", border: "1px solid rgba(123,34,24,0.10)", opacity: emp.activo ? 1 : 0.55 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: "#3b1c16" }}>
                          {emp.nombre}
                          {!emp.activo && <span style={{ fontSize: 11, fontWeight: 700, color: "#b42318", marginLeft: 8, padding: "2px 8px", background: "rgba(180,35,24,0.10)", borderRadius: 8 }}>INACTIVO</span>}
                        </div>
                        <div style={{ fontSize: 12, color: "#7a5a52", marginTop: 2 }}>
                          <b>{emp.rol}</b> · PIN: <code>{emp.pin || "—"}</code>
                        </div>
                        <div style={{ fontSize: 11, color: "#7a5a52", marginTop: 4 }}>
                          <span style={{ marginRight: 12 }}>📅 Trabaja: {dias || "Sin días"}</span>
                          {descansos && <span>🛏 Descansa: {descansos}</span>}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          onClick={() => setEditEmpleado(JSON.parse(JSON.stringify(emp)))}
                          style={{ padding: "6px 12px", background: "rgba(123,34,24,0.10)", color: "#7b2218", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700 }}
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => exportarFichaEmpleado(emp)}
                          style={{ padding: "6px 12px", background: "rgba(53,92,125,0.10)", color: "#355c7d", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700 }}
                          title="Exportar ficha a PDF"
                        >
                          📄 PDF
                        </button>
                        {emp.activo ? (
                          <button onClick={() => toggleEmpleadoActivo(emp, false)} style={{ padding: "6px 12px", background: "rgba(180,35,24,0.10)", color: "#b42318", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                            Desactivar
                          </button>
                        ) : (
                          <button onClick={() => toggleEmpleadoActivo(emp, true)} style={{ padding: "6px 12px", background: "rgba(31,122,77,0.10)", color: "#1f7a4d", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                            Reactivar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal de edición/creación de empleado */}
        {(editEmpleado || showNewEmpleado) && (
          <EmpleadoModal
            empleado={editEmpleado || { id: "", nombre: "", pin: "", rol: "caja", horario_json: {}, dias_descanso_json: [], activo: true }}
            isNew={!editEmpleado}
            saving={savingEmpleado}
            onClose={() => { setEditEmpleado(null); setShowNewEmpleado(false); }}
            onSave={(emp) => saveEmpleado(emp, !editEmpleado)}
          />
        )}
      </div>
    </div>
  );
}

// ─── Modal de edición de empleado ───
function EmpleadoModal({ empleado, isNew, saving, onClose, onSave }: {
  empleado: Empleado;
  isNew: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: (emp: Empleado) => void;
}) {
  const [form, setForm] = useState<Empleado>(empleado);
  const [tab, setTab] = useState<"datos" | "horarios" | "documentos">("datos");
  const [uploading, setUploading] = useState(false);
  const [docTipo, setDocTipo] = useState("ine");
  const supabase = getSupabaseClient();

  const toggleDescanso = (dia: string) => {
    const desc = form.dias_descanso_json || [];
    if (desc.includes(dia)) {
      setForm({ ...form, dias_descanso_json: desc.filter((d) => d !== dia) });
    } else {
      setForm({ ...form, dias_descanso_json: [...desc, dia] });
    }
  };

  const updateHorario = (dia: keyof Horario, field: "entrada" | "salida", value: string) => {
    const h = { ...(form.horario_json || {}) };
    const current = h[dia] || { entrada: "07:00", salida: "15:30" };
    h[dia] = { ...current, [field]: value };
    setForm({ ...form, horario_json: h });
  };

  const removeHorario = (dia: keyof Horario) => {
    const h = { ...(form.horario_json || {}) };
    h[dia] = null;
    setForm({ ...form, horario_json: h });
  };

  async function uploadDocumento(file: File) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert("El archivo no debe pesar más de 10 MB");
      return;
    }
    setUploading(true);
    try {
      const empId = form.id || "nuevo-" + Date.now();
      const fd = new FormData();
      fd.append("file", file);
      fd.append("emp_id", empId);
      fd.append("tipo", docTipo);

      const res = await fetch("/api/admin/empleados-docs", {
        method: "POST",
        headers: { "x-admin-secret": getAdminSecret() },
        body: fd,
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Error al subir");

      const doc: Documento = {
        id: crypto.randomUUID(),
        tipo: docTipo,
        nombre: file.name,
        url: result.url,
        uploaded_at: new Date().toISOString(),
      };
      setForm({ ...form, documentos: [...(form.documentos || []), doc] });
    } catch (err: any) {
      alert("Error al subir: " + (err.message || "desconocido"));
    } finally {
      setUploading(false);
    }
  }

  async function removeDocumento(doc: Documento) {
    if (!confirm(`¿Eliminar "${doc.nombre}"?`)) return;
    try {
      const pathFromUrl = doc.url.split("/empleados-documentos/")[1];
      if (pathFromUrl) {
        await fetch("/api/admin/empleados-docs", {
          method: "DELETE",
          headers: { "Content-Type": "application/json", "x-admin-secret": getAdminSecret() },
          body: JSON.stringify({ path: pathFromUrl }),
        });
      }
      setForm({ ...form, documentos: (form.documentos || []).filter((d) => d.id !== doc.id) });
    } catch (err: any) {
      alert("Error: " + (err.message || "desconocido"));
    }
  }

  const tabBtn = (id: typeof tab, label: string) => (
    <button onClick={() => setTab(id)} style={{
      padding: "8px 14px", borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer",
      border: tab === id ? "none" : "1px solid #ddd",
      background: tab === id ? "#7b2218" : "white",
      color: tab === id ? "white" : "#3b1c16",
    }}>{label}</button>
  );

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "white", borderRadius: 18, padding: 22, maxWidth: 640, width: "100%", maxHeight: "92vh", overflowY: "auto", boxShadow: "0 20px 50px rgba(0,0,0,0.3)" }}>
        <h2 style={{ margin: "0 0 16px", fontSize: 20, color: "#3b1c16" }}>{isNew ? "Nuevo empleado" : `Editar ${form.nombre}`}</h2>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
          {tabBtn("datos", "📋 Datos personales")}
          {tabBtn("horarios", "🕐 Horarios")}
          {tabBtn("documentos", `📎 Documentos${form.documentos && form.documentos.length > 0 ? ` (${form.documentos.length})` : ""}`)}
        </div>

        {/* ─── TAB DATOS ─── */}
        {tab === "datos" && (
          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#3b1c16", display: "block", marginBottom: 4 }}>Nombre completo *</label>
              <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", fontSize: 14, color: "#3b1c16" }} placeholder="Ej. Manuel Pérez García" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#3b1c16", display: "block", marginBottom: 4 }}>Rol</label>
                <select value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", fontSize: 14, color: "#3b1c16" }}>
                  <option value="caja">Caja</option>
                  <option value="carniceria">Carnicería</option>
                  <option value="administracion">Administración</option>
                  <option value="mostrador">Mostrador</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#3b1c16", display: "block", marginBottom: 4 }}>PIN (4 dígitos)</label>
                <input value={form.pin || ""} onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "").slice(0, 4) })} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", fontSize: 14, color: "#3b1c16" }} placeholder="1234" />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#3b1c16", display: "block", marginBottom: 4 }}>Teléfono</label>
                <input value={form.telefono || ""} onChange={(e) => setForm({ ...form, telefono: e.target.value })} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", fontSize: 14, color: "#3b1c16" }} placeholder="442 123 4567" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#3b1c16", display: "block", marginBottom: 4 }}>Email</label>
                <input type="email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", fontSize: 14, color: "#3b1c16" }} placeholder="correo@ejemplo.com" />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#3b1c16", display: "block", marginBottom: 4 }}>Domicilio</label>
              <textarea value={form.domicilio || ""} onChange={(e) => setForm({ ...form, domicilio: e.target.value })} rows={2} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", fontSize: 14, color: "#3b1c16", resize: "vertical", fontFamily: "inherit" }} placeholder="Calle, número, colonia, ciudad" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#3b1c16", display: "block", marginBottom: 4 }}>Fecha de nacimiento</label>
                <input type="date" value={form.fecha_nacimiento || ""} onChange={(e) => setForm({ ...form, fecha_nacimiento: e.target.value })} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", fontSize: 14, color: "#3b1c16" }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#3b1c16", display: "block", marginBottom: 4 }}>Fecha de ingreso</label>
                <input type="date" value={form.fecha_ingreso || ""} onChange={(e) => setForm({ ...form, fecha_ingreso: e.target.value })} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", fontSize: 14, color: "#3b1c16" }} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#3b1c16", display: "block", marginBottom: 4 }}>Contacto de emergencia</label>
              <input value={form.contacto_emergencia || ""} onChange={(e) => setForm({ ...form, contacto_emergencia: e.target.value })} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", fontSize: 14, color: "#3b1c16" }} placeholder="Nombre y teléfono de familiar" />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#3b1c16", display: "block", marginBottom: 4 }}>Notas</label>
              <textarea value={form.notas || ""} onChange={(e) => setForm({ ...form, notas: e.target.value })} rows={2} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", fontSize: 14, color: "#3b1c16", resize: "vertical", fontFamily: "inherit" }} placeholder="Observaciones, alergias, talla de uniforme, etc." />
            </div>
          </div>
        )}

        {/* ─── TAB HORARIOS ─── */}
        {tab === "horarios" && (
          <>
            <h3 style={{ fontSize: 14, color: "#3b1c16", margin: "0 0 8px" }}>🕐 Horarios por día</h3>
            <div style={{ display: "grid", gap: 6, marginBottom: 16 }}>
              {DIAS_SEMANA.map((d) => {
                const h = form.horario_json?.[d.key];
                const trabaja = !!h;
                return (
                  <div key={d.key} style={{ display: "grid", gridTemplateColumns: "100px 1fr 1fr", gap: 8, alignItems: "center", padding: "6px 0" }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: "#3b1c16" }}>
                      <input type="checkbox" checked={trabaja} onChange={(e) => e.target.checked ? updateHorario(d.key, "entrada", "07:00") : removeHorario(d.key)} style={{ marginRight: 6 }} />
                      {d.label}
                    </label>
                    {trabaja ? (
                      <>
                        <input type="time" value={h?.entrada || "07:00"} onChange={(e) => updateHorario(d.key, "entrada", e.target.value)} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #ddd", fontSize: 13, color: "#3b1c16" }} />
                        <input type="time" value={h?.salida || "15:30"} onChange={(e) => updateHorario(d.key, "salida", e.target.value)} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #ddd", fontSize: 13, color: "#3b1c16" }} />
                      </>
                    ) : (
                      <span style={{ gridColumn: "2 / span 2", color: "#7a5a52", fontSize: 12, fontStyle: "italic" }}>No trabaja este día</span>
                    )}
                  </div>
                );
              })}
            </div>

            <h3 style={{ fontSize: 14, color: "#3b1c16", margin: "16px 0 8px" }}>🛏 Días de descanso oficiales</h3>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {DIAS_SEMANA.map((d) => {
                const isDescanso = (form.dias_descanso_json || []).includes(d.key);
                return (
                  <button key={d.key} onClick={() => toggleDescanso(d.key as string)} style={{ padding: "6px 12px", borderRadius: 20, border: isDescanso ? "none" : "1px solid #ddd", background: isDescanso ? "#7b2218" : "white", color: isDescanso ? "white" : "#3b1c16", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                    {d.label}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* ─── TAB DOCUMENTOS ─── */}
        {tab === "documentos" && (
          <div>
            <p style={{ fontSize: 12, color: "#7a5a52", margin: "0 0 12px" }}>
              Sube fotos o PDFs de INE, comprobante de domicilio, CURP, etc. Máximo 10 MB por archivo.
            </p>

            <div style={{ background: "rgba(123,34,24,0.05)", borderRadius: 10, padding: 12, marginBottom: 16, border: "1px dashed rgba(123,34,24,0.20)" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center", marginBottom: 8 }}>
                <select value={docTipo} onChange={(e) => setDocTipo(e.target.value)} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd", fontSize: 13, color: "#3b1c16" }}>
                  {TIPOS_DOCUMENTO.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <label style={{ padding: "8px 14px", background: "#7b2218", color: "white", borderRadius: 8, cursor: uploading ? "wait" : "pointer", fontSize: 13, fontWeight: 700 }}>
                  {uploading ? "Subiendo..." : "+ Subir archivo"}
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => { if (e.target.files?.[0]) uploadDocumento(e.target.files[0]); e.target.value = ""; }}
                    disabled={uploading}
                    style={{ display: "none" }}
                  />
                </label>
              </div>
              <div style={{ fontSize: 11, color: "#7a5a52" }}>Acepta JPG, PNG, WebP, PDF</div>
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              {(!form.documentos || form.documentos.length === 0) ? (
                <div style={{ textAlign: "center", padding: 20, color: "#7a5a52", background: "rgba(0,0,0,0.02)", borderRadius: 10, fontSize: 13 }}>
                  No hay documentos. Sube el primero con el botón de arriba.
                </div>
              ) : (
                form.documentos.map((doc) => (
                  <div key={doc.id} style={{ background: "white", border: "1px solid #ddd", borderRadius: 10, padding: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#7b2218" }}>
                        {TIPOS_DOCUMENTO.find((t) => t.value === doc.tipo)?.label || doc.tipo}
                      </div>
                      <div style={{ fontSize: 13, color: "#3b1c16", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.nombre}</div>
                      <div style={{ fontSize: 10, color: "#7a5a52" }}>{new Date(doc.uploaded_at).toLocaleDateString("es-MX")}</div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <a href={doc.url} target="_blank" rel="noopener noreferrer" style={{ padding: "6px 10px", background: "rgba(31,122,77,0.10)", color: "#1f7a4d", borderRadius: 8, textDecoration: "none", fontSize: 12, fontWeight: 700 }}>Ver</a>
                      <button onClick={() => removeDocumento(doc)} style={{ padding: "6px 10px", background: "rgba(180,35,24,0.10)", color: "#b42318", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>Eliminar</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(0,0,0,0.08)" }}>
          <button onClick={onClose} disabled={saving} style={{ padding: "10px 18px", background: "#f3f3f3", color: "#3b1c16", border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
          <button onClick={() => onSave(form)} disabled={saving} style={{ padding: "10px 18px", background: "#7b2218", color: "white", border: "none", borderRadius: 10, cursor: saving ? "wait" : "pointer", fontWeight: 700 }}>
            {saving ? "Guardando…" : (isNew ? "Crear empleado" : "Guardar cambios")}
          </button>
        </div>
      </div>
    </div>
  );
}
