"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  customer_type: string | null;
  business_name?: string | null;
};

const COLORS = {
  bg: "#f7f1e8",
  bgSoft: "#fbf8f3",
  card: "rgba(255,255,255,0.74)",
  cardStrong: "rgba(255,255,255,0.9)",
  border: "rgba(92, 27, 17, 0.10)",
  text: "#3b1c16",
  muted: "#7a5a52",
  primary: "#7b2218",
  primaryDark: "#5a190f",
  accent: "#d9c9a3",
  success: "#1f7a4d",
  warning: "#a66a10",
  danger: "#b42318",
  shadow: "0 10px 30px rgba(91, 25, 15, 0.08)",
};

export default function AdminClientes() {
  const supabase = getSupabaseClient();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingId, setChangingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [type, setType] = useState("menudeo");

  useEffect(() => {
    loadCustomers();
  }, []);

  async function loadCustomers() {
    setLoading(true);

    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      console.log(error);
      alert("No se pudieron cargar los clientes");
      setLoading(false);
      return;
    }

    setCustomers((data as Customer[]) || []);
    setLoading(false);
  }

  async function toggleType(customer: Customer) {
    const newType =
      customer.customer_type === "mayoreo" ? "menudeo" : "mayoreo";

    setChangingId(customer.id);

    const { error: customerError } = await supabase
      .from("customers")
      .update({ customer_type: newType })
      .eq("id", customer.id);

    if (customerError) {
      console.log(customerError);
      alert("No se pudo cambiar el tipo del cliente");
      setChangingId(null);
      return;
    }

    const { error: profileError } = await supabase
      .from("customer_profiles")
      .update({ customer_type: newType })
      .eq("customer_id", customer.id);

    if (profileError) {
      console.log(profileError);
      alert("Se cambió en customers, pero falló en customer_profiles");
      setChangingId(null);
      await loadCustomers();
      return;
    }

    setChangingId(null);
    await loadCustomers();
  }

  async function createCustomer() {
    if (!name || !email || !password) {
      alert("Faltan datos");
      return;
    }

    setSaving(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error || !data.user) {
      console.log(error);
      alert("Error creando usuario");
      setSaving(false);
      return;
    }

    const user = data.user;

    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .insert([
        {
          name,
          phone,
          business_name: name,
          email,
          customer_type: type,
        },
      ])
      .select()
      .single();

    if (customerError || !customer) {
      console.log(customerError);
      alert("Error creando cliente");
      setSaving(false);
      return;
    }

    const { error: profileError } = await supabase
      .from("customer_profiles")
      .insert([
        {
          id: user.id,
          customer_id: customer.id,
          full_name: name,
          phone,
          email,
          customer_type: type,
          role: "customer",
        },
      ]);

    if (profileError) {
      console.log(profileError);
      alert("Error creando perfil");
      setSaving(false);
      return;
    }

    await supabase.from("loyalty_accounts").insert([
      {
        customer_id: customer.id,
      },
    ]);

    alert("Cliente creado correctamente");

    setName("");
    setPhone("");
    setEmail("");
    setPassword("");
    setType("menudeo");

    setSaving(false);
    loadCustomers();
  }

  const filteredCustomers = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return customers;

    return customers.filter((c) => {
      return (
        (c.name || "").toLowerCase().includes(q) ||
        (c.phone || "").toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q) ||
        (c.business_name || "").toLowerCase().includes(q)
      );
    });
  }, [customers, search]);

  if (loading) {
    return (
      <div style={loadingPageStyle}>
        <div style={loadingCardStyle}>Cargando...</div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={glowTopLeft} />
      <div style={glowTopRight} />

      <div style={shellStyle}>
        <div style={topBarStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <img
              src="/logo.png"
              alt="Sergios Carnicería"
              style={{
                width: 110,
                height: "auto",
                display: "block",
              }}
            />

            <div>
              <h1 style={{ margin: 0, color: COLORS.text }}>Admin clientes</h1>
              <p style={{ color: COLORS.muted, margin: "6px 0 0 0" }}>
                Alta manual y control de mayoreo / menudeo
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/" style={secondaryButtonStyle}>
              Inicio
            </Link>
            <Link href="/pedidos" style={secondaryButtonStyle}>
              Pedidos
            </Link>
            <Link href="/produccion" style={secondaryButtonStyle}>
              Producción
            </Link>
            <Link href="/admin/dashboard" style={secondaryButtonStyle}>
              Dashboard
            </Link>
          </div>
        </div>

        <div style={mainGridStyle}>
          <div style={panelStyle}>
            <div style={panelHeaderStyle}>
              <div>
                <h2 style={panelTitleStyle}>Crear cliente</h2>
                <p style={panelSubtitleStyle}>
                  Alta manual con acceso al portal
                </p>
              </div>
            </div>

            <input
              placeholder="Nombre / empresa"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={inputStyle}
            />

            <input
              placeholder="Teléfono"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={inputStyle}
            />

            <input
              placeholder="Correo (login)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
            />

            <input
              placeholder="Contraseña"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
            />

            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              style={inputStyle}
            >
              <option value="menudeo">Menudeo</option>
              <option value="mayoreo">Mayoreo</option>
            </select>

            <button onClick={createCustomer} style={primaryButtonStyle}>
              {saving ? "Creando..." : "Crear cliente"}
            </button>
          </div>

          <div style={panelStyle}>
            <div style={panelHeaderStyle}>
              <div>
                <h2 style={panelTitleStyle}>Clientes</h2>
                <p style={panelSubtitleStyle}>
                  Busca y cambia el tipo cuando lo necesites
                </p>
              </div>
            </div>

            <input
              placeholder="Buscar por nombre, teléfono o correo"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={inputStyle}
            />

            <div style={{ display: "grid", gap: 12 }}>
              {filteredCustomers.map((c) => (
                <div key={c.id} style={customerCardStyle}>
                  <div style={customerTopStyle}>
                    <div>
                      <div style={customerNameStyle}>{c.name}</div>
                      <div style={customerMetaStyle}>
                        {c.phone || "Sin teléfono"}
                      </div>
                      <div style={customerMetaStyle}>
                        {c.email || "Sin correo"}
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span
                        style={{
                          ...typeBadgeStyle,
                          background:
                            c.customer_type === "mayoreo"
                              ? "rgba(31,122,77,0.12)"
                              : "rgba(123, 34, 24, 0.10)",
                          color:
                            c.customer_type === "mayoreo"
                              ? COLORS.success
                              : COLORS.primary,
                        }}
                      >
                        {c.customer_type || "menudeo"}
                      </span>

                      <button
                        onClick={() => toggleType(c)}
                        disabled={changingId === c.id}
                        style={{
                          ...miniButtonStyle,
                          opacity: changingId === c.id ? 0.7 : 1,
                        }}
                      >
                        {changingId === c.id ? "Cambiando..." : "Cambiar"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {filteredCustomers.length === 0 ? (
                <div style={emptyBoxStyle}>No hay clientes para mostrar</div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
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

const shellStyle: React.CSSProperties = {
  maxWidth: 1440,
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

const mainGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "420px 1fr",
  gap: 20,
  alignItems: "start",
};

const panelStyle: React.CSSProperties = {
  background: COLORS.card,
  backdropFilter: "blur(10px)",
  border: `1px solid ${COLORS.border}`,
  borderRadius: 24,
  padding: 20,
  boxShadow: COLORS.shadow,
};

const panelHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
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

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 14,
  borderRadius: 16,
  border: `1px solid ${COLORS.border}`,
  boxSizing: "border-box",
  outline: "none",
  marginBottom: 12,
  background: "rgba(255,255,255,0.82)",
  color: COLORS.text,
  fontSize: 15,
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "12px 18px",
  borderRadius: 14,
  border: "none",
  background: `linear-gradient(180deg, ${COLORS.primary} 0%, ${COLORS.primaryDark} 100%)`,
  color: "white",
  cursor: "pointer",
  fontWeight: 700,
  boxShadow: "0 8px 18px rgba(123, 34, 24, 0.20)",
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

const customerCardStyle: React.CSSProperties = {
  padding: 16,
  borderRadius: 18,
  background: COLORS.bgSoft,
  border: `1px solid ${COLORS.border}`,
};

const customerTopStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "start",
  gap: 12,
};

const customerNameStyle: React.CSSProperties = {
  color: COLORS.text,
  fontWeight: 800,
  fontSize: 18,
  marginBottom: 6,
};

const customerMetaStyle: React.CSSProperties = {
  color: COLORS.muted,
  fontSize: 14,
  marginBottom: 4,
};

const typeBadgeStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  textTransform: "capitalize",
};

const miniButtonStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "none",
  background: COLORS.primary,
  color: "white",
  cursor: "pointer",
  fontWeight: 700,
};

const emptyBoxStyle: React.CSSProperties = {
  padding: 16,
  borderRadius: 18,
  background: COLORS.bgSoft,
  border: `1px dashed ${COLORS.border}`,
  color: COLORS.muted,
};