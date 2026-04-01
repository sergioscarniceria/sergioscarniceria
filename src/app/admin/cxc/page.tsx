"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";

type Customer = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  credit_enabled?: boolean | null;
  credit_limit?: number | null;
  credit_days?: number | null;
};

type CxcNote = {
  id: string;
  customer_id: string;
  customer_name: string;
  note_number?: string | null;
  note_date: string;
  source_type: string;
  subtotal: number;
  discount_amount: number;
  total_amount: number;
  balance_due: number;
  status: string;
  notes?: string | null;
  due_date?: string | null;
  created_at?: string | null;
};

type CustomerSummary = {
  customer_id: string;
  customer_name: string;
  phone?: string | null;
  email?: string | null;
  credit_enabled: boolean;
  credit_limit: number;
  credit_days: number;
  open_notes: number;
  total_due: number;
  overdue_due: number;
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
  info: "#355c7d",
  shadow: "0 10px 30px rgba(91, 25, 15, 0.08)",
};

function normalizeDateOnly(value?: string | null) {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

function formatDate(value?: string | null) {
  const normalized = normalizeDateOnly(value);
  if (!normalized) return "Sin fecha";
  const date = new Date(`${normalized}T12:00:00`);
  if (isNaN(date.getTime())) return normalized;
  return date.toLocaleDateString();
}

function todayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isOverdue(note: CxcNote) {
  if (!note.balance_due || Number(note.balance_due) <= 0) return false;
  const due = normalizeDateOnly(note.due_date || note.note_date);
  if (!due) return false;
  return due < todayDateString();
}

export default function AdminCxcPage() {
  const supabase = getSupabaseClient();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [notes, setNotes] = useState<CxcNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [customerFilter, setCustomerFilter] = useState("todos");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    const { data: customersData, error: customersError } = await supabase
      .from("customers")
      .select("id, name, phone, email, credit_enabled, credit_limit, credit_days")
      .order("name", { ascending: true });

    const { data: notesData, error: notesError } = await supabase
      .from("cxc_notes")
      .select("*")
      .order("note_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (customersError) {
      console.log(customersError);
      alert("No se pudieron cargar los clientes");
      setLoading(false);
      return;
    }

    if (notesError) {
      console.log(notesError);
      alert("No se pudieron cargar las cuentas por cobrar");
      setLoading(false);
      return;
    }

    setCustomers((customersData as Customer[]) || []);
    setNotes((notesData as CxcNote[]) || []);
    setLoading(false);
  }

  const customerSummaries = useMemo(() => {
    const notesByCustomer: Record<string, CxcNote[]> = {};

    for (const note of notes) {
      if (!notesByCustomer[note.customer_id]) {
        notesByCustomer[note.customer_id] = [];
      }
      notesByCustomer[note.customer_id].push(note);
    }

    return customers
      .map((customer) => {
        const customerNotes = (notesByCustomer[customer.id] || []).filter(
          (note) => Number(note.balance_due || 0) > 0
        );

        const totalDue = customerNotes.reduce(
          (acc, note) => acc + Number(note.balance_due || 0),
          0
        );

        const overdueDue = customerNotes
          .filter((note) => isOverdue(note))
          .reduce((acc, note) => acc + Number(note.balance_due || 0), 0);

        return {
          customer_id: customer.id,
          customer_name: customer.name,
          phone: customer.phone || null,
          email: customer.email || null,
          credit_enabled: Boolean(customer.credit_enabled),
          credit_limit: Number(customer.credit_limit || 0),
          credit_days: Number(customer.credit_days || 0),
          open_notes: customerNotes.length,
          total_due: totalDue,
          overdue_due: overdueDue,
        } satisfies CustomerSummary;
      })
      .filter((row) => row.open_notes > 0 || row.credit_enabled)
      .sort((a, b) => b.total_due - a.total_due);
  }, [customers, notes]);

  const openNotes = useMemo(() => {
    return notes.filter((note) => Number(note.balance_due || 0) > 0);
  }, [notes]);

  const filteredCustomers = useMemo(() => {
    let result = customerSummaries;

    if (customerFilter === "con_saldo") {
      result = result.filter((c) => c.total_due > 0);
    }

    if (customerFilter === "vencidos") {
      result = result.filter((c) => c.overdue_due > 0);
    }

    if (customerFilter === "credito_activo") {
      result = result.filter((c) => c.credit_enabled);
    }

    const q = search.toLowerCase().trim();
    if (!q) return result;

    return result.filter((c) => {
      return (
        (c.customer_name || "").toLowerCase().includes(q) ||
        (c.phone || "").toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q)
      );
    });
  }, [customerSummaries, customerFilter, search]);

  const filteredOpenNotes = useMemo(() => {
    const q = search.toLowerCase().trim();

    return openNotes.filter((note) => {
      const customerMatches =
        customerFilter === "todos" ||
        (customerFilter === "con_saldo" && Number(note.balance_due || 0) > 0) ||
        (customerFilter === "vencidos" && isOverdue(note)) ||
        (customerFilter === "credito_activo" &&
          customers.some((c) => c.id === note.customer_id && c.credit_enabled));

      if (!customerMatches) return false;

      if (!q) return true;

      return (
        (note.customer_name || "").toLowerCase().includes(q) ||
        (note.note_number || "").toLowerCase().includes(q) ||
        (note.source_type || "").toLowerCase().includes(q) ||
        (note.notes || "").toLowerCase().includes(q)
      );
    });
  }, [openNotes, search, customerFilter, customers]);

  const stats = useMemo(() => {
    const totalDue = openNotes.reduce(
      (acc, note) => acc + Number(note.balance_due || 0),
      0
    );

    const overdueDue = openNotes
      .filter((note) => isOverdue(note))
      .reduce((acc, note) => acc + Number(note.balance_due || 0), 0);

    return {
      customersWithBalance: customerSummaries.filter((c) => c.total_due > 0).length,
      openNotes: openNotes.length,
      totalDue,
      overdueDue,
    };
  }, [openNotes, customerSummaries]);

  function noteStatusStyle(note: CxcNote): React.CSSProperties {
    if (Number(note.balance_due || 0) <= 0 || note.status === "pagada") {
      return {
        background: "rgba(31,122,77,0.12)",
        color: COLORS.success,
      };
    }

    if (isOverdue(note)) {
      return {
        background: "rgba(180,35,24,0.10)",
        color: COLORS.danger,
      };
    }

    if (note.status === "abonada") {
      return {
        background: "rgba(166,106,16,0.12)",
        color: COLORS.warning,
      };
    }

    return {
      background: "rgba(53,92,125,0.12)",
      color: COLORS.info,
    };
  }

  if (loading) {
    return (
      <div style={loadingPageStyle}>
        <div style={loadingCardStyle}>Cargando cuentas por cobrar...</div>
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
            <h1 style={{ margin: 0, color: COLORS.text }}>Cuentas por cobrar</h1>
            <p style={{ margin: "6px 0 0 0", color: COLORS.muted }}>
              Base preparada para crédito manual hoy e integración automática después
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/" style={secondaryButtonStyle}>Inicio</Link>
            <Link href="/admin/dashboard" style={secondaryButtonStyle}>Dashboard</Link>
            <Link href="/pedidos" style={secondaryButtonStyle}>Pedidos</Link>
            <Link href="/admin/cxc/nueva" style={primaryButtonStyle}>+ Nueva nota</Link>
            <Link href="/admin/cxc/pagos" style={secondaryActionButtonStyle}>Registrar pago</Link>
            <Link href="/admin/caja" style={secondaryButtonStyle}>Caja</Link>
          </div>
        </div>

        <div style={summaryGridStyle}>
          <div style={summaryCardStyle}>
            <div style={summaryLabelStyle}>Clientes con saldo</div>
            <div style={summaryValueStyle}>{stats.customersWithBalance}</div>
          </div>

          <div style={summaryCardStyle}>
            <div style={summaryLabelStyle}>Notas abiertas</div>
            <div style={summaryValueStyle}>{stats.openNotes}</div>
          </div>

          <div style={summaryCardStyle}>
            <div style={summaryLabelStyle}>Saldo pendiente</div>
            <div style={summaryValueStyle}>${stats.totalDue.toFixed(2)}</div>
          </div>

          <div style={summaryCardStyle}>
            <div style={summaryLabelStyle}>Saldo vencido</div>
            <div style={summaryValueStyle}>${stats.overdueDue.toFixed(2)}</div>
          </div>
        </div>

        <div style={toolbarCardStyle}>
          <div style={toolbarGridStyle}>
            <input
              placeholder="Buscar cliente, nota, referencia o correo"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={inputStyle}
            />

            <div style={filtersWrapStyle}>
              {[
                { key: "todos", label: "Todos" },
                { key: "con_saldo", label: "Con saldo" },
                { key: "vencidos", label: "Vencidos" },
                { key: "credito_activo", label: "Crédito activo" },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setCustomerFilter(f.key)}
                  style={{
                    ...filterButtonStyle,
                    background: customerFilter === f.key ? COLORS.primary : "white",
                    color: customerFilter === f.key ? "white" : COLORS.text,
                    border:
                      customerFilter === f.key
                        ? "none"
                        : `1px solid ${COLORS.border}`,
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={doubleGridStyle}>
          <div style={panelStyle}>
            <h2 style={panelTitleStyle}>Clientes con crédito / saldo</h2>

            {filteredCustomers.length === 0 ? (
              <div style={emptyBoxStyle}>No hay clientes para mostrar</div>
            ) : (
              filteredCustomers.map((customer) => (
                <div key={customer.customer_id} style={customerRowStyle}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={customerNameStyle}>{customer.customer_name}</div>

                    <div style={customerMetaWrapStyle}>
                      <span style={metaPillStyle}>
                        Saldo: <b>${customer.total_due.toFixed(2)}</b>
                      </span>

                      <span style={metaPillStyle}>
                        Notas abiertas: <b>{customer.open_notes}</b>
                      </span>

                      <span style={metaPillStyle}>
                        Crédito: <b>{customer.credit_enabled ? "Sí" : "No"}</b>
                      </span>

                      <span style={metaPillStyle}>
                        Días crédito: <b>{customer.credit_days}</b>
                      </span>

                      <span style={metaPillStyle}>
                        Límite: <b>${customer.credit_limit.toFixed(2)}</b>
                      </span>
                    </div>

                    {customer.phone ? (
                      <div style={metaTextStyle}>Tel: {customer.phone}</div>
                    ) : null}

                    {customer.email ? (
                      <div style={metaTextStyle}>Correo: {customer.email}</div>
                    ) : null}

                    {customer.overdue_due > 0 ? (
                      <div style={dangerTextStyle}>
                        Vencido: ${customer.overdue_due.toFixed(2)}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={panelStyle}>
            <h2 style={panelTitleStyle}>Notas abiertas</h2>

            {filteredOpenNotes.length === 0 ? (
              <div style={emptyBoxStyle}>No hay notas abiertas</div>
            ) : (
              filteredOpenNotes.map((note) => (
                <div key={note.id} style={noteCardStyle}>
                  <div style={noteHeaderStyle}>
                    <div style={{ minWidth: 0 }}>
                      <div style={customerNameStyle}>{note.customer_name}</div>
                      <div style={noteNumberStyle}>
                        {note.note_number || "Sin folio"} · {note.source_type}
                      </div>
                    </div>

                    <div
                      style={{
                        ...statusBadgeStyle,
                        ...noteStatusStyle(note),
                      }}
                    >
                      {Number(note.balance_due || 0) <= 0
                        ? "pagada"
                        : isOverdue(note)
                        ? "vencida"
                        : note.status}
                    </div>
                  </div>

                  <div style={noteMetaGridStyle}>
                    <div style={metaPillStyle}>
                      Fecha: <b>{formatDate(note.note_date)}</b>
                    </div>

                    <div style={metaPillStyle}>
                      Vence: <b>{formatDate(note.due_date || note.note_date)}</b>
                    </div>

                    <div style={metaPillStyle}>
                      Total: <b>${Number(note.total_amount || 0).toFixed(2)}</b>
                    </div>

                    <div style={metaPillStyle}>
                      Saldo: <b>${Number(note.balance_due || 0).toFixed(2)}</b>
                    </div>
                  </div>

                  {Number(note.discount_amount || 0) > 0 ? (
                    <div style={metaTextStyle}>
                      Descuento aplicado: ${Number(note.discount_amount || 0).toFixed(2)}
                    </div>
                  ) : null}

                  {note.notes ? (
                    <div style={notesStyle}>
                      <b>Notas:</b> {note.notes}
                    </div>
                  ) : null}
                </div>
              ))
            )}
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
  maxWidth: 1450,
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
  marginBottom: 20,
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
  fontSize: 32,
  fontWeight: 800,
};

const toolbarCardStyle: React.CSSProperties = {
  background: COLORS.cardStrong,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 24,
  padding: 18,
  boxShadow: COLORS.shadow,
  marginBottom: 20,
};

const toolbarGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(280px, 1fr)",
  gap: 14,
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

const filtersWrapStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const filterButtonStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  cursor: "pointer",
  fontWeight: 700,
};

const doubleGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
  gap: 20,
};

const panelStyle: React.CSSProperties = {
  background: COLORS.card,
  backdropFilter: "blur(10px)",
  border: `1px solid ${COLORS.border}`,
  borderRadius: 24,
  padding: 18,
  boxShadow: COLORS.shadow,
};

const panelTitleStyle: React.CSSProperties = {
  marginTop: 0,
  marginBottom: 16,
  color: COLORS.text,
};

const customerRowStyle: React.CSSProperties = {
  padding: 16,
  borderRadius: 18,
  background: COLORS.bgSoft,
  border: `1px solid ${COLORS.border}`,
  marginBottom: 12,
};

const customerNameStyle: React.CSSProperties = {
  color: COLORS.text,
  fontWeight: 800,
  fontSize: 20,
  lineHeight: 1.2,
  marginBottom: 8,
};

const customerMetaWrapStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginBottom: 10,
};

const metaPillStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "8px 12px",
  borderRadius: 999,
  background: "white",
  border: `1px solid ${COLORS.border}`,
  color: COLORS.text,
  fontSize: 13,
};

const metaTextStyle: React.CSSProperties = {
  color: COLORS.muted,
  fontSize: 14,
  marginTop: 6,
};

const dangerTextStyle: React.CSSProperties = {
  color: COLORS.danger,
  fontWeight: 700,
  marginTop: 8,
  fontSize: 14,
};

const noteCardStyle: React.CSSProperties = {
  padding: 16,
  borderRadius: 18,
  background: COLORS.bgSoft,
  border: `1px solid ${COLORS.border}`,
  marginBottom: 12,
};

const noteHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  marginBottom: 12,
};

const noteNumberStyle: React.CSSProperties = {
  color: COLORS.muted,
  fontSize: 14,
};

const statusBadgeStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  textTransform: "capitalize",
  flexShrink: 0,
};

const noteMetaGridStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginBottom: 10,
};

const notesStyle: React.CSSProperties = {
  marginTop: 10,
  padding: 14,
  borderRadius: 16,
  background: "rgba(255,255,255,0.7)",
  border: `1px solid ${COLORS.border}`,
  color: COLORS.text,
};

const emptyBoxStyle: React.CSSProperties = {
  padding: 16,
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

const primaryButtonStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "12px 18px",
  borderRadius: 14,
  border: "none",
  background: `linear-gradient(180deg, ${COLORS.primary} 0%, ${COLORS.primaryDark} 100%)`,
  color: "white",
  textDecoration: "none",
  fontWeight: 700,
  boxShadow: "0 8px 18px rgba(123, 34, 24, 0.20)",
};

const secondaryActionButtonStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "12px 18px",
  borderRadius: 14,
  border: `1px solid ${COLORS.border}`,
  background: "white",
  color: COLORS.text,
  textDecoration: "none",
  fontWeight: 700,
};