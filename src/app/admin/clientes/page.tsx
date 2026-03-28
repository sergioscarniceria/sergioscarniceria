"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  business_name?: string | null;
  customer_type?: string | null;
  address?: string | null;
  created_at?: string | null;
};

const COLORS = {
  bg: "#f7f1e8",
  bgSoft: "#fbf8f3",
  card: "rgba(255,255,255,0.80)",
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

export default function AdminClientesPage() {
  const supabase = getSupabaseClient();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  async function deleteCustomer(customer: Customer) {
    const confirmText = `¿Seguro que quieres eliminar a ${customer.name}?`;
    const confirmed = window.confirm(confirmText);

    if (!confirmed) return;

    setDeletingId(customer.id);

    const { error } = await supabase
      .from("customers")
      .delete()
      .eq("id", customer.id);

    if (error) {
      console.log(error);
      alert(
        "No se pudo eliminar el cliente. Puede ser que tenga pedidos o registros relacionados."
      );
      setDeletingId(null);
      return;
    }

    setCustomers((prev) => prev.filter((c) => c.id !== customer.id));
    setDeletingId(null);
    alert("Cliente eliminado correctamente");
  }

  const filteredCustomers = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return customers;

    return customers.filter((c) => {
      return (
        (c.name || "").toLowerCase().includes(q) ||
        (c.phone || "").toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q) ||
        (c.business_name || "").toLowerCase().includes(q) ||
        (c.address || "").toLowerCase().includes(q) ||
        (c.customer_type || "").toLowerCase().includes(q)
      );
    });
  }, [customers, search]);

  if (loading) {
    return (
      <div style={loadingPageStyle}>
        <div style={loadingCardStyle}>Cargando clientes...</div>
      </div>
    );
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
              Administración de cartera de clientes
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/" style={secondaryButtonStyle}>Inicio</Link>
            <Link href="/pedidos" style={secondaryButtonStyle}>Pedidos</Link>
            <Link href="/admin/nuevo-pedido" style={secondaryButtonStyle}>Nuevo pedido</Link>
            <Link href="/admin/dashboard" style={secondaryButtonStyle}>Dashboard</Link>
          </div>
        </div>

        <div style={summaryGridStyle}>
          <div style={summaryCardStyle}>
            <div style={summaryLabelStyle}>Clientes totales</div>
            <div style={summaryValueStyle}>{customers.length}</div>
          </div>

          <div style={summaryCardStyle}>
            <div style={summaryLabelStyle}>Resultados visibles</div>
            <div style={summaryValueStyle}>{filteredCustomers.length}</div>
          </div>
        </div>

        <div style={toolbarCardStyle}>
          <input
            placeholder="Buscar cliente por nombre, teléfono, correo o negocio"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={inputStyle}
          />
        </div>

        {filteredCustomers.length === 0 ? (
          <div style={emptyBoxStyle}>No hay clientes para mostrar</div>
        ) : (
          <div style={gridStyle}>
            {filteredCustomers.map((customer) => (
              <div key={customer.id} style={cardStyle}>
                <div style={cardHeaderStyle}>
                  <div style={{ minWidth: 0 }}>
                    <div style={customerNameStyle}>{customer.name}</div>

                    {customer.business_name ? (
                      <div style={metaTextStyle}>
                        Negocio: <b>{customer.business_name}</b>
                      </div>
                    ) : null}

                    <div style={typeBadgeStyle}>
                      {customer.customer_type || "menudeo"}
                    </div>
                  </div>
                </div>

                <div style={infoBoxStyle}>
                  <div style={infoRowStyle}>
                    <span style={infoLabelStyle}>Teléfono:</span>
                    <span style={infoValueStyle}>{customer.phone || "Sin teléfono"}</span>
                  </div>

                  <div style={infoRowStyle}>
                    <span style={infoLabelStyle}>Correo:</span>
                    <span style={infoValueStyle}>{customer.email || "Sin correo"}</span>
                  </div>

                  <div style={infoRowStyle}>
                    <span style={infoLabelStyle}>Dirección:</span>
                    <span style={infoValueStyle}>{customer.address || "Sin dirección"}</span>
                  </div>

                  {customer.created_at ? (
                    <div style={infoRowStyle}>
                      <span style={infoLabelStyle}>Creado:</span>
                      <span style={infoValueStyle}>
                        {new Date(customer.created_at).toLocaleString()}
                      </span>
                    </div>
                  ) : null}
                </div>

                <div style={actionsWrapStyle}>
                  <button
                    onClick={() => deleteCustomer(customer)}
                    disabled={deletingId === customer.id}
                    style={{
                      ...dangerButtonStyle,
                      opacity: deletingId === customer.id ? 0.6 : 1,
                    }}
                  >
                    {deletingId === customer.id ? "Eliminando..." : "Eliminar cliente"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
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

const toolbarCardStyle: React.CSSProperties = {
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
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: 16,
};

const cardStyle: React.CSSProperties = {
  background: COLORS.card,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 24,
  padding: 18,
  boxShadow: COLORS.shadow,
};

const cardHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
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

const infoLabelStyle: React.CSSProperties = {
  color: COLORS.muted,
  fontWeight: 700,
};

const infoValueStyle: React.CSSProperties = {
  color: COLORS.text,
  wordBreak: "break-word",
};

const actionsWrapStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  marginTop: 14,
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