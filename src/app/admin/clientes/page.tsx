"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { exportToExcel } from "@/lib/exportExcel";
import { getAdminSecret } from "@/lib/admin-secret";
import CustomerCard from "@/components/CustomerCard";

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  business_name?: string | null;
  customer_type?: string | null;
  discount_percent?: number | null;
  address?: string | null;
  created_at?: string | null;
  credit_enabled?: boolean | null;
  credit_limit?: number | null;
  credit_days?: number | null;
  portal_password?: string | null;
  client_pin?: string | null;
};

const COLORS = {
  bg: "#f7f1e8",
  bgSoft: "#fbf8f3",
  card: "rgba(255,255,255,0.82)",
  cardStrong: "rgba(255,255,255,0.92)",
  border: "rgba(92, 27, 17, 0.10)",
  text: "#3b1c16",
  muted: "#7a5a52",
  primary: "#7b2218",
  primaryDark: "#5a190f",
  success: "#1f7a4d",
  warning: "#a66a10",
  danger: "#b42318",
  shadow: "0 10px 30px rgba(91, 25, 15, 0.08)",
};

function money(value?: number | null) {
  return String(Math.ceil(Number(value || 0)));
}

export default function AdminClientesPage() {
  const supabase = getSupabaseClient();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Portal access
  const [portalCustomer, setPortalCustomer] = useState<Customer | null>(null);
  const [portalPassword, setPortalPassword] = useState("");
  const [portalEmail, setPortalEmail] = useState("");
  const [portalSaving, setPortalSaving] = useState(false);
  const [portalAccess, setPortalAccess] = useState<Record<string, boolean>>({});

  // QR cliente
  const [qrCustomer, setQrCustomer] = useState<Customer | null>(null);

  // Change password
  const [passwordCustomer, setPasswordCustomer] = useState<Customer | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  // Modal Nuevo cliente
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [savingNewCustomer, setSavingNewCustomer] = useState(false);
  const [ncName, setNcName] = useState("");
  const [ncPhone, setNcPhone] = useState("");
  const [ncEmail, setNcEmail] = useState("");
  const [ncBusiness, setNcBusiness] = useState("");
  const [ncAddress, setNcAddress] = useState("");
  const [ncType, setNcType] = useState("menudeo");
  const [ncDiscount, setNcDiscount] = useState<number>(10);
  const [ncGenerarPin, setNcGenerarPin] = useState(true);
  const [ncError, setNcError] = useState("");
  const [ncResult, setNcResult] = useState<{ name: string; pin?: string; phone?: string | null } | null>(null);

  useEffect(() => {
    loadCustomers();
  }, []);

  async function loadCustomers() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("name", { ascending: true })
        .limit(500);

      if (error) {
        console.log(error);
        return;
      }

      setCustomers((data as Customer[]) || []);

      // Check which customers have portal access
      const { data: profiles } = await supabase
        .from("customer_profiles")
        .select("customer_id")
        .limit(500);

      if (profiles) {
        const accessMap: Record<string, boolean> = {};
        for (const p of profiles) {
          if (p.customer_id) accessMap[p.customer_id] = true;
        }
        setPortalAccess(accessMap);
      }
    } catch (err) {
      console.log("Error loading customers:", err);
    } finally {
      setLoading(false);
    }
  }

  async function createPortalAccess() {
    if (!portalCustomer) return;
    if (!portalPassword || portalPassword.length < 6) {
      alert("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (!portalCustomer.phone && !portalEmail.trim()) {
      alert("El cliente necesita al menos un teléfono o correo para crear la cuenta");
      return;
    }

    setPortalSaving(true);

    try {
      const res = await fetch("/api/portal/crear-acceso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: portalCustomer.id,
          customer_name: portalCustomer.name,
          phone: portalCustomer.phone || "",
          email: portalEmail.trim() || portalCustomer.email || "",
          password: portalPassword,
          secret: getAdminSecret(),
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        alert(result.error || "Error al crear acceso");
        setPortalSaving(false);
        return;
      }

      alert(result.message);
      setPortalAccess((prev) => ({ ...prev, [portalCustomer.id]: true }));
      setPortalCustomer(null);
      setPortalPassword("");
      setPortalEmail("");
    } catch (err) {
      console.error(err);
      alert("Error de conexión");
    }

    setPortalSaving(false);
  }

  async function changePassword() {
    if (!passwordCustomer) return;
    if (!newPassword || newPassword.length < 6) {
      setPasswordError("Mínimo 6 caracteres");
      return;
    }

    setPasswordSaving(true);
    setPasswordError("");

    try {
      const res = await fetch("/api/portal/cambiar-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: passwordCustomer.id,
          new_password: newPassword,
          secret: getAdminSecret(),
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        setPasswordError(result.error || "Error al cambiar contraseña");
        setPasswordSaving(false);
        return;
      }

      // Update local state
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === passwordCustomer.id ? { ...c, portal_password: newPassword } : c
        )
      );

      alert("Contraseña cambiada. Nueva contraseña: " + newPassword);
      setPasswordCustomer(null);
      setNewPassword("");
    } catch {
      setPasswordError("Error de conexión");
    }

    setPasswordSaving(false);
  }

  function updateLocalCustomer(
    id: string,
    field: keyof Customer,
    value: string | number | boolean | null
  ) {
    setCustomers((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  }

  async function updateType(id: string, type: string) {
    setUpdatingId(id);
    const newDiscount = type === "mayoreo" ? 10 : 0;

    const { error } = await supabase
      .from("customers")
      .update({ customer_type: type, discount_percent: newDiscount })
      .eq("id", id);

    if (error) {
      console.log(error);
      alert("Error al actualizar tipo de cliente");
      setUpdatingId(null);
      return;
    }

    setCustomers((prev) =>
      prev.map((c) => (c.id === id ? { ...c, customer_type: type, discount_percent: newDiscount } : c))
    );

    setUpdatingId(null);
  }

  async function updateDiscount(id: string, pct: number) {
    setUpdatingId(id);

    const { error } = await supabase
      .from("customers")
      .update({ discount_percent: pct })
      .eq("id", id);

    if (error) {
      console.log(error);
      alert("Error al actualizar descuento");
      setUpdatingId(null);
      return;
    }

    setCustomers((prev) =>
      prev.map((c) => (c.id === id ? { ...c, discount_percent: pct } : c))
    );

    setUpdatingId(null);
  }

  async function saveCreditConfig(customer: Customer) {
    setUpdatingId(customer.id);

    const { error } = await supabase
      .from("customers")
      .update({
        credit_enabled: !!customer.credit_enabled,
        credit_limit: Number(customer.credit_limit || 0),
        credit_days: Number(customer.credit_days || 0),
      })
      .eq("id", customer.id);

    if (error) {
      console.log(error);
      alert("Error al guardar la configuración de crédito");
      setUpdatingId(null);
      return;
    }

    setUpdatingId(null);
    alert("Crédito actualizado correctamente");
  }

  async function deleteCustomer(id: string, name: string) {
    if (!confirm(`\u00bfEliminar cliente "${name}" y todos sus datos (pedidos, cr\u00e9ditos, cuenta)?`)) return;

    setDeletingId(id);

    try {
      const res = await fetch("/api/portal/eliminar-cliente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_id: id, secret: getAdminSecret() }),
      });
      const result = await res.json();

      if (!res.ok || !result.success) {
        alert(result.error || "No se pudo eliminar el cliente");
        setDeletingId(null);
        return;
      }

      setCustomers((prev) => prev.filter((c) => c.id !== id));
    } catch {
      alert("Error de conexi\u00f3n al eliminar");
    }
    setDeletingId(null);
  }

  async function saveCustomerEdit() {
    if (!editingCustomer) return;
    if (!editingCustomer.name.trim()) {
      alert("El nombre es obligatorio");
      return;
    }

    setSavingEdit(true);

    const { error } = await supabase
      .from("customers")
      .update({
        name: editingCustomer.name.trim(),
        phone: editingCustomer.phone?.trim() || null,
        email: editingCustomer.email?.trim() || null,
        business_name: editingCustomer.business_name?.trim() || null,
        address: editingCustomer.address?.trim() || null,
      })
      .eq("id", editingCustomer.id);

    if (error) {
      console.log(error);
      alert("No se pudo guardar los cambios");
      setSavingEdit(false);
      return;
    }

    setCustomers((prev) =>
      prev.map((c) =>
        c.id === editingCustomer.id
          ? {
              ...c,
              name: editingCustomer.name.trim(),
              phone: editingCustomer.phone?.trim() || null,
              email: editingCustomer.email?.trim() || null,
              business_name: editingCustomer.business_name?.trim() || null,
              address: editingCustomer.address?.trim() || null,
            }
          : c
      )
    );

    setSavingEdit(false);
    setEditingCustomer(null);
    alert("Cliente actualizado");
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();

    if (!q) return customers;

    return customers.filter((c) =>
      `${c.name ?? ""} ${c.phone ?? ""} ${c.email ?? ""} ${c.business_name ?? ""} ${c.address ?? ""}`
        .toLowerCase()
        .includes(q)
    );
  }, [customers, search]);

  const creditEnabledCount = useMemo(() => {
    return customers.filter((c) => Boolean(c.credit_enabled)).length;
  }, [customers]);

  if (loading) {
    return (
      <div style={loadingPageStyle}>
        <div style={loadingCardStyle}>Cargando clientes...</div>
      </div>
    );
  }

  async function crearNuevoCliente() {
    if (!ncName.trim()) { setNcError("El nombre es obligatorio"); return; }
    setNcError("");
    setSavingNewCustomer(true);
    try {
      const res = await fetch("/api/admin/clientes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": getAdminSecret(),
        },
        body: JSON.stringify({
          name: ncName.trim(),
          phone: ncPhone.trim() || null,
          email: ncEmail.trim() || null,
          business_name: ncBusiness.trim() || null,
          address: ncAddress.trim() || null,
          customer_type: ncType,
          discount_percent: ncType === "mayoreo" ? ncDiscount : null,
          generar_pin: ncGenerarPin,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        setNcError(result.error || "Error al crear");
        setSavingNewCustomer(false);
        return;
      }
      // Mostrar resultado con PIN si aplica
      setNcResult({
        name: result.customer?.name || ncName.trim(),
        phone: result.customer?.phone,
        pin: result.customer?.client_pin,
      });
      // Recargar lista
      await loadCustomers();
    } catch (err: any) {
      setNcError("Error: " + (err.message || "desconocido"));
    } finally {
      setSavingNewCustomer(false);
    }
  }

  function resetNuevoClienteForm() {
    setNcName("");
    setNcPhone("");
    setNcEmail("");
    setNcBusiness("");
    setNcAddress("");
    setNcType("menudeo");
    setNcDiscount(10);
    setNcGenerarPin(true);
    setNcError("");
    setNcResult(null);
  }

  return (
    <div style={pageStyle}>
      <div style={glowTopLeft} />
      <div style={glowTopRight} />

      <div style={shellStyle}>
        <div style={topBarStyle}>
          <div>
            <h1 style={{ margin: 0, color: COLORS.text }}>Clientes</h1>
            <p style={{ margin: "6px 0 0 0", color: COLORS.muted }}>
              Administración de cartera, mayoreo y crédito
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={() => {
                const headers = ["Nombre", "Teléfono", "Correo", "Negocio", "Dirección", "Tipo", "Crédito activo", "Límite crédito", "Días crédito", "Portal activo"];
                const rows = customers.map((c) => [
                  c.name,
                  c.phone || "",
                  c.email || "",
                  c.business_name || "",
                  c.address || "",
                  c.customer_type || "menudeo",
                  c.credit_enabled ? "Sí" : "No",
                  c.credit_limit ?? "",
                  c.credit_days ?? "",
                  portalAccess[c.id] ? "Sí" : "No",
                ]);
                const fecha = new Date().toISOString().slice(0, 10);
                exportToExcel(`clientes_${fecha}`, "Clientes", headers, rows as any);
              }}
              style={secondaryButtonStyle}
            >
              Exportar Excel
            </button>
            <button
              onClick={() => { resetNuevoClienteForm(); setShowNewCustomer(true); }}
              style={{
                ...secondaryButtonStyle,
                background: "#7b2218",
                color: "white",
                border: "none",
              }}
            >
              + Nuevo cliente
            </button>
            <Link href="/" style={secondaryButtonStyle}>
              Inicio
            </Link>
            <Link href="/pedidos" style={secondaryButtonStyle}>
              Pedidos
            </Link>
            <Link href="/admin/nuevo-pedido" style={secondaryButtonStyle}>
              Nuevo pedido
            </Link>
            <Link href="/cxc" style={secondaryButtonStyle}>
              CxC
            </Link>
            <Link href="/admin/dashboard" style={secondaryButtonStyle}>
              Dashboard
            </Link>
          </div>
        </div>

        <div style={summaryGridStyle}>
          <div style={summaryCardStyle}>
            <div style={summaryLabelStyle}>Clientes totales</div>
            <div style={summaryValueStyle}>{customers.length}</div>
          </div>

          <div style={summaryCardStyle}>
            <div style={summaryLabelStyle}>Resultados visibles</div>
            <div style={summaryValueStyle}>{filtered.length}</div>
          </div>

          <div style={summaryCardStyle}>
            <div style={summaryLabelStyle}>Clientes con crédito</div>
            <div style={summaryValueStyle}>{creditEnabledCount}</div>
          </div>
        </div>

        <div style={searchCardStyle}>
          <input
            placeholder="Buscar cliente por nombre, teléfono, correo, negocio o dirección"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={inputStyle}
          />
        </div>

        {filtered.length === 0 ? (
          <div style={emptyBoxStyle}>No hay clientes para mostrar</div>
        ) : (
          <div style={gridStyle}>
            {filtered.map((c) => (
              <div key={c.id} style={cardStyle}>
                <div style={cardTopStyle}>
                  <div style={{ minWidth: 0 }}>
                    <div style={customerNameStyle}>{c.name}</div>

                    {c.business_name ? (
                      <div style={metaTextStyle}>Negocio: {c.business_name}</div>
                    ) : null}

                    <div style={badgesRowStyle}>
                      <div style={typeBadgeStyle}>
                        {c.customer_type || "menudeo"}
                      </div>

                      {c.credit_enabled ? (
                        <div style={creditEnabledBadgeStyle}>Crédito activo</div>
                      ) : (
                        <div style={creditDisabledBadgeStyle}>Sin crédito</div>
                      )}

                      {portalAccess[c.id] ? (
                        <div style={portalActiveBadgeStyle}>Portal activo</div>
                      ) : (
                        <div style={portalInactiveBadgeStyle}>Sin portal</div>
                      )}
                    </div>
                  </div>
                </div>

                <div style={infoBoxStyle}>
                  <div style={infoRowStyle}>
                    <span style={labelStyle}>Teléfono</span>
                    <span style={valueStyle}>{c.phone || "Sin teléfono"}</span>
                  </div>

                  <div style={infoRowStyle}>
                    <span style={labelStyle}>Correo</span>
                    <span style={valueStyle}>{c.email || "Sin correo"}</span>
                  </div>

                  <div style={infoRowStyle}>
                    <span style={labelStyle}>Dirección</span>
                    <span style={valueStyle}>{c.address || "Sin dirección"}</span>
                  </div>
                </div>

                {portalAccess[c.id] && (
                  <div style={portalCredentialsBoxStyle}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ color: "#355c7d", fontWeight: 700, fontSize: 13 }}>
                        Acceso portal
                      </span>
                      <button
                        onClick={() => {
                          setPasswordCustomer({ ...c });
                          setNewPassword("");
                          setPasswordError("");
                        }}
                        style={changePasswordBtnStyle}
                      >
                        Cambiar contraseña
                      </button>
                    </div>
                    <div style={{ color: COLORS.text, fontSize: 14, marginTop: 6 }}>
                      <b>Usuario:</b> {c.phone || c.email || "---"}
                    </div>
                    <div style={{ color: COLORS.text, fontSize: 14, marginTop: 2 }}>
                      <b>Contraseña:</b> {c.portal_password || "(no guardada)"}
                    </div>
                    {c.client_pin && (
                      <div style={{ color: COLORS.text, fontSize: 14, marginTop: 2 }}>
                        <b>PIN:</b> <span style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 800, letterSpacing: 4 }}>{c.client_pin}</span>
                      </div>
                    )}
                  </div>
                )}

                <div style={quickLinksWrapStyle}>
                  <button
                    onClick={() => setEditingCustomer({ ...c })}
                    style={miniEditButtonStyle}
                  >
                    Editar datos
                  </button>

                  {!portalAccess[c.id] && (
                    <button
                      onClick={() => {
                        setPortalCustomer({ ...c });
                        setPortalEmail(c.email || "");
                        setPortalPassword("");
                      }}
                      style={portalButtonStyle}
                    >
                      Crear acceso portal
                    </button>
                  )}

                  <Link
                    href={`/cxc/nueva-nota?customer_id=${c.id}`}
                    style={miniLinkButtonStyle}
                  >
                    Nueva nota
                  </Link>

                  <Link
                    href={`/cxc/nuevo-pago?customer_id=${c.id}`}
                    style={miniLinkButtonStyle}
                  >
                    Nuevo pago
                  </Link>

                  <Link
                    href={`/cxc/estado-cuenta?customer_id=${c.id}`}
                    style={miniPrimaryLinkButtonStyle}
                  >
                    Estado de cuenta
                  </Link>

                  <button
                    onClick={() => setQrCustomer({ ...c })}
                    style={miniEditButtonStyle}
                  >
                    Ver tarjeta
                  </button>

                  {c.phone && c.client_pin && (
                    <button
                      onClick={() => {
                        const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
                        const link = `${baseUrl}/cliente?tel=${encodeURIComponent(c.phone!)}&pin=${c.client_pin}`;
                        const msg = `Hola ${c.name}, entra a tu portal de Sergio's Carnicería con este link:\n\n${link}\n\nTu PIN: ${c.client_pin}`;
                        const waUrl = `https://wa.me/52${c.phone!.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`;
                        window.open(waUrl, "_blank");
                      }}
                      style={whatsappButtonStyle}
                    >
                      Enviar link WhatsApp
                    </button>
                  )}
                </div>

                <div style={actionsWrapStyle}>
                  <div style={fieldBlockStyle}>
                    <div style={fieldLabelStyle}>Tipo de cliente</div>
                    <select
                      value={c.customer_type || "menudeo"}
                      onChange={(e) => updateType(c.id, e.target.value)}
                      disabled={updatingId === c.id}
                      style={selectStyle}
                    >
                      <option value="menudeo">Menudeo</option>
                      <option value="mayoreo">Mayoreo</option>
                    </select>

                    {c.customer_type === "mayoreo" && (
                      <div style={{ marginTop: 8, padding: "10px 12px", borderRadius: 12, background: "rgba(166,106,16,0.08)", border: "1px solid rgba(166,106,16,0.2)" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#a66a10", marginBottom: 6 }}>
                          Descuento mayoreo
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          {[5, 10, 15].map((pct) => (
                            <button
                              key={pct}
                              onClick={() => updateDiscount(c.id, pct)}
                              disabled={updatingId === c.id}
                              style={{
                                flex: 1,
                                padding: "8px 0",
                                borderRadius: 10,
                                border: (c.discount_percent || 0) === pct ? "none" : "1px solid rgba(92,27,17,0.10)",
                                background: (c.discount_percent || 0) === pct ? "#a66a10" : "white",
                                color: (c.discount_percent || 0) === pct ? "white" : "#3b1c16",
                                fontWeight: 800,
                                fontSize: 15,
                                cursor: "pointer",
                              }}
                            >
                              {pct}%
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={creditBoxStyle}>
                    <div style={creditHeaderStyle}>
                      <div style={fieldLabelStyle}>Configuración de crédito</div>

                      <label style={switchLabelStyle}>
                        <input
                          type="checkbox"
                          checked={!!c.credit_enabled}
                          onChange={(e) =>
                            updateLocalCustomer(c.id, "credit_enabled", e.target.checked)
                          }
                        />
                        <span>Activar crédito</span>
                      </label>
                    </div>

                    <div style={creditGridStyle}>
                      <div style={fieldBlockStyle}>
                        <div style={fieldLabelStyle}>Límite de crédito</div>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={c.credit_limit ?? 0}
                          onChange={(e) =>
                            updateLocalCustomer(
                              c.id,
                              "credit_limit",
                              Number(e.target.value || 0)
                            )
                          }
                          style={textInputStyle}
                          placeholder="0.00"
                        />
                      </div>

                      <div style={fieldBlockStyle}>
                        <div style={fieldLabelStyle}>Días de crédito</div>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={c.credit_days ?? 0}
                          onChange={(e) =>
                            updateLocalCustomer(
                              c.id,
                              "credit_days",
                              Number(e.target.value || 0)
                            )
                          }
                          style={textInputStyle}
                          placeholder="0"
                        />
                      </div>
                    </div>

                    <div style={creditPreviewBoxStyle}>
                      <div style={creditPreviewRowStyle}>
                        <span>Crédito</span>
                        <b>{c.credit_enabled ? "Activo" : "Inactivo"}</b>
                      </div>

                      <div style={creditPreviewRowStyle}>
                        <span>Límite</span>
                        <b>${money(c.credit_limit)}</b>
                      </div>

                      <div style={creditPreviewRowStyle}>
                        <span>Días</span>
                        <b>{Number(c.credit_days || 0)}</b>
                      </div>
                    </div>

                    <button
                      onClick={() => saveCreditConfig(c)}
                      disabled={updatingId === c.id}
                      style={{
                        ...saveCreditButtonStyle,
                        opacity: updatingId === c.id ? 0.65 : 1,
                      }}
                    >
                      {updatingId === c.id ? "Guardando..." : "Guardar crédito"}
                    </button>
                  </div>

                  <button
                    onClick={() => deleteCustomer(c.id, c.name)}
                    disabled={deletingId === c.id}
                    style={{
                      ...dangerButtonStyle,
                      opacity: deletingId === c.id ? 0.65 : 1,
                    }}
                  >
                    {deletingId === c.id ? "Eliminando..." : "Eliminar cliente"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal Tarjeta de cliente */}
        {qrCustomer && (
          <CustomerCard
            name={qrCustomer.name}
            phone={qrCustomer.phone}
            email={qrCustomer.email}
            password={qrCustomer.portal_password}
            customerId={qrCustomer.id}
            onClose={() => setQrCustomer(null)}
          />
        )}

        {passwordCustomer && (
          <div style={modalOverlayStyle}>
            <div style={modalCardStyle}>
              <h2 style={{ margin: "0 0 6px 0", color: COLORS.text }}>
                Cambiar contraseña
              </h2>
              <p style={{ color: COLORS.muted, margin: "0 0 16px 0", fontSize: 14 }}>
                {passwordCustomer.name}
              </p>

              {passwordError && (
                <div style={{ padding: 12, borderRadius: 12, background: "rgba(180,35,24,0.08)", border: "1px solid rgba(180,35,24,0.15)", color: "#b42318", fontSize: 14, fontWeight: 600, marginBottom: 14 }}>
                  {passwordError}
                </div>
              )}

              <div style={{ marginBottom: 12 }}>
                <div style={fieldLabelStyle}>Contraseña actual</div>
                <div style={{ padding: 12, borderRadius: 14, background: COLORS.bgSoft, border: `1px solid ${COLORS.border}`, color: COLORS.text, fontSize: 15 }}>
                  {passwordCustomer.portal_password || "(no guardada — se asignó antes de esta función)"}
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={fieldLabelStyle}>Nueva contraseña *</div>
                <input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={textInputStyle}
                  placeholder="Mínimo 6 caracteres"
                />
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={changePassword}
                  disabled={passwordSaving}
                  style={{ ...saveEditButtonStyle, opacity: passwordSaving ? 0.65 : 1 }}
                >
                  {passwordSaving ? "Cambiando..." : "Cambiar contraseña"}
                </button>
                <button
                  onClick={() => setPasswordCustomer(null)}
                  style={cancelEditButtonStyle}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {portalCustomer && (
          <div style={modalOverlayStyle}>
            <div style={modalCardStyle}>
              <h2 style={{ margin: "0 0 6px 0", color: COLORS.text }}>
                Crear acceso al portal
              </h2>
              <p style={{ color: COLORS.muted, margin: "0 0 18px 0", fontSize: 14 }}>
                El cliente podrá hacer pedidos desde su celular
              </p>

              <div style={portalInfoBoxStyle}>
                <div style={{ fontWeight: 800, color: COLORS.text, fontSize: 18 }}>
                  {portalCustomer.name}
                </div>
                <div style={{ color: COLORS.muted, marginTop: 4 }}>
                  Tel: {portalCustomer.phone || "Sin teléfono"}
                </div>
              </div>

              <div style={editFieldBlockStyle}>
                <div style={fieldLabelStyle}>
                  Correo electrónico (opcional)
                </div>
                <input
                  value={portalEmail}
                  onChange={(e) => setPortalEmail(e.target.value)}
                  style={textInputStyle}
                  placeholder="correo@ejemplo.com"
                />
                <div style={{ color: COLORS.muted, fontSize: 12, marginTop: 2 }}>
                  Si no tiene correo, el cliente entrará con su teléfono
                </div>
              </div>

              <div style={editFieldBlockStyle}>
                <div style={fieldLabelStyle}>Contraseña *</div>
                <input
                  type="text"
                  value={portalPassword}
                  onChange={(e) => setPortalPassword(e.target.value)}
                  style={textInputStyle}
                  placeholder="Mínimo 6 caracteres"
                />
                <div style={{ color: COLORS.muted, fontSize: 12, marginTop: 2 }}>
                  Ponle algo fácil de recordar para el cliente
                </div>
              </div>

              <div style={portalPreviewBoxStyle}>
                <div style={{ fontWeight: 700, color: COLORS.text, marginBottom: 6 }}>
                  Datos de acceso:
                </div>
                <div style={{ color: COLORS.muted, fontSize: 14 }}>
                  <b>Usuario:</b>{" "}
                  {portalEmail.trim()
                    ? portalEmail.trim()
                    : portalCustomer.phone
                      ? portalCustomer.phone
                      : "Necesita teléfono o correo"}
                </div>
                <div style={{ color: COLORS.muted, fontSize: 14, marginTop: 4 }}>
                  <b>Contraseña:</b> {portalPassword || "---"}
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                <button
                  onClick={createPortalAccess}
                  disabled={portalSaving}
                  style={{
                    ...saveEditButtonStyle,
                    opacity: portalSaving ? 0.65 : 1,
                  }}
                >
                  {portalSaving ? "Creando..." : "Crear acceso"}
                </button>

                <button
                  onClick={() => {
                    setPortalCustomer(null);
                    setPortalPassword("");
                    setPortalEmail("");
                  }}
                  style={cancelEditButtonStyle}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {editingCustomer && (
          <div style={modalOverlayStyle}>
            <div style={modalCardStyle}>
              <h2 style={{ margin: "0 0 16px 0", color: COLORS.text }}>
                Editar cliente
              </h2>

              <div style={editFieldBlockStyle}>
                <div style={fieldLabelStyle}>Nombre *</div>
                <input
                  value={editingCustomer.name}
                  onChange={(e) =>
                    setEditingCustomer({ ...editingCustomer, name: e.target.value })
                  }
                  style={textInputStyle}
                  placeholder="Nombre del cliente"
                />
              </div>

              <div style={editFieldBlockStyle}>
                <div style={fieldLabelStyle}>Teléfono</div>
                <input
                  value={editingCustomer.phone || ""}
                  onChange={(e) =>
                    setEditingCustomer({ ...editingCustomer, phone: e.target.value })
                  }
                  style={textInputStyle}
                  placeholder="Teléfono"
                />
              </div>

              <div style={editFieldBlockStyle}>
                <div style={fieldLabelStyle}>Correo</div>
                <input
                  value={editingCustomer.email || ""}
                  onChange={(e) =>
                    setEditingCustomer({ ...editingCustomer, email: e.target.value })
                  }
                  style={textInputStyle}
                  placeholder="Correo electrónico"
                />
              </div>

              <div style={editFieldBlockStyle}>
                <div style={fieldLabelStyle}>Nombre de negocio</div>
                <input
                  value={editingCustomer.business_name || ""}
                  onChange={(e) =>
                    setEditingCustomer({ ...editingCustomer, business_name: e.target.value })
                  }
                  style={textInputStyle}
                  placeholder="Nombre del negocio"
                />
              </div>

              <div style={editFieldBlockStyle}>
                <div style={fieldLabelStyle}>Dirección</div>
                <input
                  value={editingCustomer.address || ""}
                  onChange={(e) =>
                    setEditingCustomer({ ...editingCustomer, address: e.target.value })
                  }
                  style={textInputStyle}
                  placeholder="Dirección de entrega"
                />
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                <button
                  onClick={saveCustomerEdit}
                  disabled={savingEdit}
                  style={saveEditButtonStyle}
                >
                  {savingEdit ? "Guardando..." : "Guardar cambios"}
                </button>

                <button
                  onClick={() => setEditingCustomer(null)}
                  style={cancelEditButtonStyle}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* Modal Nuevo cliente */}
      {showNewCustomer && (
        <div
          onClick={() => !savingNewCustomer && !ncResult && setShowNewCustomer(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000, padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "white", borderRadius: 18, padding: 22,
              width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto",
              boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
            }}
          >
            {!ncResult ? (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <h2 style={{ margin: 0, color: "#3b1c16", fontSize: 20 }}>Nuevo cliente</h2>
                  <button onClick={() => setShowNewCustomer(false)} style={{ background: "transparent", border: "none", fontSize: 22, cursor: "pointer", color: "#7a5a52" }}>×</button>
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: "#7a5a52", display: "block", marginBottom: 4 }}>Nombre *</label>
                    <input value={ncName} onChange={(e) => setNcName(e.target.value)} placeholder="Ej. Juan Pérez" style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(92,27,17,0.15)", fontSize: 14, color: "#3b1c16", background: "white", boxSizing: "border-box" }} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, color: "#7a5a52", display: "block", marginBottom: 4 }}>Teléfono</label>
                      <input value={ncPhone} onChange={(e) => setNcPhone(e.target.value)} placeholder="10 dígitos" style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(92,27,17,0.15)", fontSize: 14, color: "#3b1c16", background: "white", boxSizing: "border-box" }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, color: "#7a5a52", display: "block", marginBottom: 4 }}>Correo</label>
                      <input value={ncEmail} onChange={(e) => setNcEmail(e.target.value)} placeholder="correo@dominio.com" style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(92,27,17,0.15)", fontSize: 14, color: "#3b1c16", background: "white", boxSizing: "border-box" }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: "#7a5a52", display: "block", marginBottom: 4 }}>Negocio</label>
                    <input value={ncBusiness} onChange={(e) => setNcBusiness(e.target.value)} placeholder="Ej. Restaurante Umami" style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(92,27,17,0.15)", fontSize: 14, color: "#3b1c16", background: "white", boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: "#7a5a52", display: "block", marginBottom: 4 }}>Dirección</label>
                    <input value={ncAddress} onChange={(e) => setNcAddress(e.target.value)} placeholder="Colonia, ciudad, referencias" style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(92,27,17,0.15)", fontSize: 14, color: "#3b1c16", background: "white", boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: "#7a5a52", display: "block", marginBottom: 4 }}>Tipo de cliente</label>
                    <select value={ncType} onChange={(e) => setNcType(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(92,27,17,0.15)", fontSize: 14, color: "#3b1c16", background: "white", boxSizing: "border-box" }}>
                      <option value="menudeo">Menudeo</option>
                      <option value="mayoreo">Mayoreo</option>
                    </select>
                  </div>

                  {ncType === "mayoreo" && (
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, color: "#a66a10", display: "block", marginBottom: 6 }}>Descuento mayoreo (%)</label>
                      <div style={{ display: "flex", gap: 6 }}>
                        {[5, 10, 15].map((v) => (
                          <button
                            key={v}
                            onClick={() => setNcDiscount(v)}
                            style={{
                              flex: 1, padding: "10px 12px", borderRadius: 10,
                              border: ncDiscount === v ? "2px solid #a66a10" : "1px solid rgba(92,27,17,0.15)",
                              background: ncDiscount === v ? "#a66a10" : "white",
                              color: ncDiscount === v ? "white" : "#3b1c16",
                              fontWeight: 700, cursor: "pointer",
                            }}
                          >
                            {v}%
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <label style={{
                    display: "flex", alignItems: "center", gap: 8, padding: 10, borderRadius: 10,
                    background: ncGenerarPin ? "rgba(31,122,77,0.06)" : "rgba(0,0,0,0.02)",
                    border: `1px solid ${ncGenerarPin ? "rgba(31,122,77,0.25)" : "rgba(0,0,0,0.06)"}`,
                    cursor: "pointer",
                  }}>
                    <input type="checkbox" checked={ncGenerarPin} onChange={(e) => setNcGenerarPin(e.target.checked)} style={{ width: 18, height: 18, cursor: "pointer" }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#3b1c16" }}>Generar PIN de portal automáticamente</div>
                      <div style={{ fontSize: 11, color: "#7a5a52", marginTop: 2 }}>El cliente podrá entrar en sergioscarniceria.com/cliente con tel + PIN de 4 dígitos. Contraseña inicial: 123456</div>
                    </div>
                  </label>

                  {ncError && (
                    <div style={{ padding: 10, background: "rgba(180,35,24,0.08)", color: "#b42318", borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
                      {ncError}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                    <button onClick={() => setShowNewCustomer(false)} disabled={savingNewCustomer} style={{ flex: 1, padding: "12px 16px", borderRadius: 10, border: "1px solid rgba(92,27,17,0.15)", background: "white", color: "#3b1c16", fontWeight: 700, cursor: "pointer" }}>
                      Cancelar
                    </button>
                    <button onClick={crearNuevoCliente} disabled={savingNewCustomer} style={{ flex: 1, padding: "12px 16px", borderRadius: 10, border: "none", background: "#7b2218", color: "white", fontWeight: 800, cursor: savingNewCustomer ? "default" : "pointer", opacity: savingNewCustomer ? 0.6 : 1 }}>
                      {savingNewCustomer ? "Guardando..." : "Crear cliente"}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div>
                <div style={{ textAlign: "center", padding: 12, marginBottom: 14, background: "rgba(31,122,77,0.08)", borderRadius: 12 }}>
                  <div style={{ fontSize: 40 }}>✅</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#1f7a4d", marginTop: 4 }}>Cliente creado</div>
                  <div style={{ fontSize: 14, color: "#3b1c16", marginTop: 4 }}>{ncResult.name}</div>
                </div>

                {ncResult.pin && (
                  <div style={{ padding: 14, background: "#fbf8f3", borderRadius: 12, marginBottom: 12, border: "1px solid rgba(92,27,17,0.12)" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#7a5a52", marginBottom: 6 }}>DATOS DE ACCESO AL PORTAL</div>
                    <div style={{ fontSize: 13, marginBottom: 4 }}><b>URL:</b> sergioscarniceria.com/cliente</div>
                    <div style={{ fontSize: 13, marginBottom: 4 }}><b>Teléfono:</b> {ncResult.phone || "—"}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "#7b2218", marginTop: 6, letterSpacing: 4 }}>PIN: {ncResult.pin}</div>
                    <div style={{ fontSize: 11, color: "#7a5a52", marginTop: 6 }}>Contraseña alternativa inicial: <b>123456</b></div>
                  </div>
                )}

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => { setNcResult(null); resetNuevoClienteForm(); }}
                    style={{ flex: 1, padding: "12px 16px", borderRadius: 10, border: "1px solid rgba(92,27,17,0.15)", background: "white", color: "#3b1c16", fontWeight: 700, cursor: "pointer" }}
                  >
                    Crear otro
                  </button>
                  <button
                    onClick={() => { setShowNewCustomer(false); setNcResult(null); resetNuevoClienteForm(); }}
                    style={{ flex: 1, padding: "12px 16px", borderRadius: 10, border: "none", background: "#7b2218", color: "white", fontWeight: 800, cursor: "pointer" }}
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const loadingPageStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: `linear-gradient(180deg, ${COLORS.bgSoft} 0%, ${COLORS.bg} 100%)`,
  fontFamily: "Arial, sans-serif",
};

const loadingCardStyle: React.CSSProperties = {
  padding: "18px 22px",
  borderRadius: 18,
  background: COLORS.cardStrong,
  border: `1px solid ${COLORS.border}`,
  boxShadow: COLORS.shadow,
  color: COLORS.text,
};

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: `linear-gradient(180deg, ${COLORS.bgSoft} 0%, ${COLORS.bg} 100%)`,
  padding: 16,
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
  maxWidth: 1400,
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

const summaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 16,
  marginBottom: 16,
};

const summaryCardStyle: React.CSSProperties = {
  background: COLORS.cardStrong,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 22,
  padding: 18,
  boxShadow: COLORS.shadow,
};

const summaryLabelStyle: React.CSSProperties = {
  color: COLORS.muted,
  fontSize: 14,
  marginBottom: 8,
};

const summaryValueStyle: React.CSSProperties = {
  color: COLORS.text,
  fontSize: 30,
  fontWeight: 800,
  lineHeight: 1.1,
};

const searchCardStyle: React.CSSProperties = {
  background: COLORS.cardStrong,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 22,
  padding: 16,
  boxShadow: COLORS.shadow,
  marginBottom: 18,
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

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
  gap: 16,
};

const cardStyle: React.CSSProperties = {
  background: COLORS.card,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 24,
  padding: 18,
  boxShadow: COLORS.shadow,
};

const cardTopStyle: React.CSSProperties = {
  marginBottom: 14,
};

const customerNameStyle: React.CSSProperties = {
  color: COLORS.text,
  fontWeight: 800,
  fontSize: 24,
  lineHeight: 1.2,
  marginBottom: 8,
};

const metaTextStyle: React.CSSProperties = {
  color: COLORS.muted,
  fontSize: 14,
  marginBottom: 8,
};

const badgesRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const typeBadgeStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  background: "rgba(123, 34, 24, 0.10)",
  color: COLORS.primary,
  textTransform: "capitalize",
};

const creditEnabledBadgeStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  background: "rgba(31, 122, 77, 0.10)",
  color: COLORS.success,
};

const creditDisabledBadgeStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  background: "rgba(166, 106, 16, 0.12)",
  color: COLORS.warning,
};

const infoBoxStyle: React.CSSProperties = {
  background: COLORS.bgSoft,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 18,
  padding: 14,
};

const infoRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "90px 1fr",
  gap: 10,
  padding: "8px 0",
  borderBottom: `1px solid ${COLORS.border}`,
};

const labelStyle: React.CSSProperties = {
  color: COLORS.muted,
  fontWeight: 700,
};

const valueStyle: React.CSSProperties = {
  color: COLORS.text,
  wordBreak: "break-word",
};

const quickLinksWrapStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  marginTop: 14,
};

const miniLinkButtonStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "10px 12px",
  borderRadius: 12,
  border: `1px solid ${COLORS.border}`,
  background: "white",
  color: COLORS.text,
  textDecoration: "none",
  fontWeight: 700,
  fontSize: 14,
};

const miniPrimaryLinkButtonStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "10px 12px",
  borderRadius: 12,
  border: "none",
  background: `linear-gradient(180deg, ${COLORS.primary} 0%, ${COLORS.primaryDark} 100%)`,
  color: "white",
  textDecoration: "none",
  fontWeight: 700,
  fontSize: 14,
  boxShadow: "0 8px 18px rgba(123, 34, 24, 0.20)",
};

const actionsWrapStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
  marginTop: 14,
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

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 14,
  border: `1px solid ${COLORS.border}`,
  background: "white",
  color: COLORS.text,
  fontWeight: 700,
  outline: "none",
};

const creditBoxStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
  padding: 14,
  borderRadius: 18,
  background: COLORS.bgSoft,
  border: `1px solid ${COLORS.border}`,
};

const creditHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
};

const switchLabelStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  color: COLORS.text,
  fontWeight: 700,
  fontSize: 14,
};

const creditGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 12,
};

const textInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 14,
  border: `1px solid ${COLORS.border}`,
  background: "white",
  color: COLORS.text,
  outline: "none",
  boxSizing: "border-box",
  fontSize: 14,
};

const creditPreviewBoxStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  padding: 12,
  borderRadius: 14,
  background: "rgba(255,255,255,0.8)",
  border: `1px solid ${COLORS.border}`,
};

const creditPreviewRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  color: COLORS.text,
};

const saveCreditButtonStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 16px",
  borderRadius: 14,
  border: "none",
  background: "rgba(31,122,77,0.12)",
  color: COLORS.success,
  cursor: "pointer",
  fontWeight: 700,
};

const dangerButtonStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 16px",
  borderRadius: 14,
  border: "none",
  background: "rgba(180,35,24,0.10)",
  color: COLORS.danger,
  cursor: "pointer",
  fontWeight: 700,
};

const emptyBoxStyle: React.CSSProperties = {
  padding: 18,
  borderRadius: 18,
  background: COLORS.bgSoft,
  border: `1px dashed ${COLORS.border}`,
  color: COLORS.muted,
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

const miniEditButtonStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "8px 14px",
  borderRadius: 12,
  border: `1px solid ${COLORS.border}`,
  background: "rgba(123, 34, 24, 0.08)",
  color: COLORS.primary,
  textDecoration: "none",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
};

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.4)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
  padding: 16,
};

const modalCardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 480,
  background: "white",
  borderRadius: 22,
  padding: 24,
  boxShadow: COLORS.shadow,
  border: `1px solid ${COLORS.border}`,
  maxHeight: "90vh",
  overflowY: "auto",
};

const editFieldBlockStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  marginBottom: 12,
};

const saveEditButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: "12px 16px",
  borderRadius: 14,
  border: "none",
  background: `linear-gradient(180deg, ${COLORS.primary} 0%, ${COLORS.primaryDark} 100%)`,
  color: "white",
  cursor: "pointer",
  fontWeight: 700,
  boxShadow: "0 8px 18px rgba(123, 34, 24, 0.20)",
};

const cancelEditButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: "12px 16px",
  borderRadius: 14,
  border: `1px solid ${COLORS.border}`,
  background: "white",
  color: COLORS.text,
  cursor: "pointer",
  fontWeight: 700,
};

const portalActiveBadgeStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  background: "rgba(53, 92, 125, 0.12)",
  color: "#355c7d",
};

const portalInactiveBadgeStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  background: "rgba(0,0,0,0.05)",
  color: "#999",
};

const portalButtonStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "8px 14px",
  borderRadius: 12,
  border: "none",
  background: "rgba(53, 92, 125, 0.12)",
  color: "#355c7d",
  textDecoration: "none",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
};

const portalInfoBoxStyle: React.CSSProperties = {
  padding: 14,
  borderRadius: 16,
  background: COLORS.bgSoft,
  border: `1px solid ${COLORS.border}`,
  marginBottom: 16,
};

const changePasswordBtnStyle: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: 10,
  border: "none",
  background: "rgba(53, 92, 125, 0.15)",
  color: "#355c7d",
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer",
};

const portalCredentialsBoxStyle: React.CSSProperties = {
  padding: 12,
  borderRadius: 14,
  background: "rgba(53, 92, 125, 0.06)",
  border: "1px solid rgba(53, 92, 125, 0.12)",
  marginTop: 12,
};

const portalPreviewBoxStyle: React.CSSProperties = {
  padding: 14,
  borderRadius: 16,
  background: "rgba(53, 92, 125, 0.06)",
  border: "1px solid rgba(53, 92, 125, 0.15)",
  marginTop: 12,
};

const whatsappButtonStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "8px 14px",
  borderRadius: 12,
  border: "none",
  background: "#25D366",
  color: "white",
  textDecoration: "none",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
  boxShadow: "0 4px 12px rgba(37, 211, 102, 0.3)",
};