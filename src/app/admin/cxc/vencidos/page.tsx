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
  due_date?: string | null;
  source_type: string;
  subtotal: number;
  discount_amount: number;
  total_amount: number;
  balance_due: number;
  status: string;
  notes?: string | null;
  created_at?: string | null;
};

type OverdueCustomer = {
  customer_id: string;
  customer_name: string;
  phone?: string | null;
  email?: string | null;
  credit_limit: number;
  credit_days: number;
  overdue_notes: number;
  overdue_amount: number;
  oldest_due_date?: string | null;
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

function todayDateOnly() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isOverdue(note: CxcNote) {
  if (Number(note.balance_due || 0) <= 0) return false;
  const due = normalizeDateOnly(note.due_date || note.note_date);
  if (!due) return false;
  return due < todayDateOnly();
}

export default function CxcVencidosPage() {
  const supabase = getSupabaseClient();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [notes, setNotes] = useState<CxcNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

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
      .gt("balance_due", 0)
      .order("due_date", { ascending: true })
      .order("note_date", { ascending: true });

    if (customersError) {
      console.log(customersError);
      alert("No se pudieron cargar los clientes");
      setLoading(false);
      return;
    }

    if (notesError) {
      console.log(notesError);
      alert("No se pudieron cargar las notas");
      setLoading(false);
      return;
    }

    setCustomers((customersData as Customer[]) || []);
    setNotes((notesData as CxcNote[]) || []);
    setLoading(false);
  }

  const overdueNotes = useMemo(() => {
    return notes.filter((note) => isOverdue(note));
  }, [notes]);

  const overdueCustomers = useMemo(() => {
    const customerMap = new Map(customers.map((c) => [c.id, c]));
    const grouped: Record<string, OverdueCustomer> = {};

    for (const note of overdueNotes) {
      const customer = customerMap.get(note.customer_id);

      if (!grouped[note.customer_id]) {
        grouped[note.customer_id] = {
          customer_id: note.customer_id,
          customer_name: note.customer_name,
          phone: customer?.phone || null,
          email: customer?.email || null,
          credit_limit: Number(customer?.credit_limit || 0),
          credit_days: Number(customer?.credit_days || 0),
          overdue_notes: 0,
          overdue_amount: 0,
          oldest_due_date: note.due_date || note.note_date,
        };
      }

      grouped[note.customer_id].overdue_notes += 1;
      grouped[note.customer_id].overdue_amount += Number(note.balance_due || 0);

      const currentOldest = normalizeDateOnly(grouped[note.customer_id].oldest_due_date);
      const noteDue = normalizeDateOnly(note.due_date || note.note_date);

      if (noteDue && currentOldest && noteDue < currentOldest) {
        grouped[note.customer_id].oldest_due_date = noteDue;
      }
    }

    return Object.values(grouped).sort((a, b) => b.overdue_amount - a.overdue_amount);
  }, [overdueNotes, customers]);

  const filteredOverdueCustomers = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return overdueCustomers;

    return overdueCustomers.filter((customer) => {
      return (
        (customer.customer_name || "").toLowerCase().includes(q) ||
        (customer.phone || "").toLowerCase().includes(q) ||
        (customer.email || "").toLowerCase().includes(q)
      );
    });
  }, [overdueCustomers, search]);

  const filteredOverdueNotes = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return overdueNotes;

    return overdueNotes.filter((note) => {
      return (
        (note.customer_name || "").toLowerCase().includes(q) ||
        (note.note_number || "").toLowerCase().includes(q) ||
        (note.notes || "").toLowerCase().includes(q)
      );
    });
  }, [overdueNotes, search]);

  const stats = useMemo(() => {
    const overdueAmount = overdueNotes.reduce(
      (acc, note) => acc + Number(note.balance_due || 0),
      0
    );

    return {
      overdueCustomers: overdueCustomers.length,
      overdueNotes: overdueNotes.length,
      overdueAmount,
    };
  }, [overdueCustomers, overdueNotes]);

  if (loading) {
    return (
      <div style={loadingPageStyle}>
        <div style={loadingCardStyle}>Cargando vencidos...</div>
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
            <h1 style={{ margin: 0, color: COLORS.text }}>Clientes vencidos</h1>
            <p style={{ margin: "6px 0 0 0", color: COLORS.muted }}>
              Vista rápida de clientes y notas con adeudos vencidos
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/admin/cxc" style={secondaryButtonStyle}>
              Volver a CxC
            </Link>
            <Link href="/admin/cxc/estado-cuenta" style={secondaryButtonStyle}>
              Estado de cuenta
            </Link>
            <Link href="/admin/dashboard" style={secondaryButtonStyle}>
              Dashboard
            </Link>
          </div>
        </div>

        <div style={summaryGridStyle}>
          <div style={summaryCardStyle}>
            <div style={summaryLabelStyle}>Clientes vencidos</div>
            <div style={summaryValueStyle}>{stats.overdueCustomers}</div>
          </div>

          <div style={summaryCardStyle}>
            <div style={summaryLabelStyle}>Notas vencidas</div>
            <div style={summaryValueStyle}>{stats.overdueNotes}</div>
          </div>

          <div style={summaryCardStyle}>
            <div style={summaryLabelStyle}>Monto vencido</div>
            <div style={summaryValueStyle}>${stats.overdueAmount.toFixed(2)}</div>
          </div>
        </div>

        <div style={toolbarCardStyle}>
          <input
            placeholder="Buscar cliente, teléfono, correo o folio"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div style={doubleGridStyle}>
          <div style={panelStyle}>
            <div style={panelHeaderStyle}>
              <div>
                <h2 style={panelTitleStyle}>Clientes con adeudo vencido</h2>
                <p style={panelSubtitleStyle}>
                  Ordenados por mayor monto vencido
                </p>
              </div>
            </div>

            {filteredOverdueCustomers.length === 0 ? (
              <div style={emptyBoxStyle}>No hay clientes vencidos</div>
            ) : (
              <div style={cardsListStyle}>
                {filteredOverdueCustomers.map((customer) => (
                  <div key={customer.customer_id} style={entryCardStyle}>
                    <div style={entryHeaderStyle}>
                      <div style={{ minWidth: 0 }}>
                        <div style={entryTitleStyle}>{customer.customer_name}</div>
                        {customer.phone ? (
                          <div style={metaTextStyle}>Tel: {customer.phone}</div>
                        ) : null}
                        {customer.email ? (
                          <div style={metaTextStyle}>Correo: {customer.email}</div>
                        ) : null}
                      </div>

                      <div
                        style={{
                          ...statusBadgeStyle,
                          background: "rgba(180,35,24,0.10)",
                          color: COLORS.danger,
                        }}
                      >
                        Vencido
                      </div>
                    </div>

                    <div style={metaWrapStyle}>
                      <span style={metaPillStyle}>
                        Monto vencido: <b>${customer.overdue_amount.toFixed(2)}</b>
                      </span>
                      <span style={metaPillStyle}>
                        Notas: <b>{customer.overdue_notes}</b>
                      </span>
                      <span style={metaPillStyle}>
                        Más antigua: <b>{formatDate(customer.oldest_due_date)}</b>
                      </span>
                    </div>

                    <div style={metaTextStyle}>
                      Límite: <b>${customer.credit_limit.toFixed(2)}</b> · Días:{" "}
                      <b>{customer.credit_days}</b>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={panelStyle}>
            <div style={panelHeaderStyle}>
              <div>
                <h2 style={panelTitleStyle}>Notas vencidas</h2>
                <p style={panelSubtitleStyle}>
                  Detalle individual de cada nota vencida
                </p>
              </div>
            </div>

            {filteredOverdueNotes.length === 0 ? (
              <div style={emptyBoxStyle}>No hay notas vencidas</div>
            ) : (
              <div style={cardsListStyle}>
                {filteredOverdueNotes.map((note) => (
                  <div key={note.id} style={entryCardStyle}>
                    <div style={entryHeaderStyle}>
                      <div style={{ minWidth: 0 }}>
                        <div style={entryTitleStyle}>
                          {note.note_number || "Sin folio"}
                        </div>
                        <div style={metaTextStyle}>
                          Cliente: <b>{note.customer_name}</b>
                        </div>
                        <div style={metaTextStyle}>
                          Fecha: <b>{formatDate(note.note_date)}</b>
                        </div>
                        <div style={metaTextStyle}>
                          Vence: <b>{formatDate(note.due_date || note.note_date)}</b>
                        </div>
                      </div>

                      <div
                        style={{
                          ...statusBadgeStyle,
                          background: "rgba(180,35,24,0.10)",
                          color: COLORS.danger,
                        }}
                      >
                        Vencida
                      </div>
                    </div>

                    <div style={metaWrapStyle}>
                      <span style={metaPillStyle}>
                        Total: <b>${Number(note.total_amount || 0).toFixed(2)}</b>
                      </span>
                      <span style={metaPillStyle}>
                        Saldo: <b>${Number(note.balance_due || 0).toFixed(2)}</b>
                      </span>
                      <span style={metaPillStyle}>
                        Descuento: <b>${Number(note.discount_amount || 0).toFixed(2)}</b>
                      </span>
                    </div>

                    {note.notes ? (
                      <div style={notesStyle}>
                        <b>Notas:</b> {note.notes}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
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

const doubleGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
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

const cardsListStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const entryCardStyle: React.CSSProperties = {
  padding: 14,
  borderRadius: 18,
  background: COLORS.bgSoft,
  border: `1px solid ${COLORS.border}`,
};

const entryHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  marginBottom: 10,
};

const entryTitleStyle: React.CSSProperties = {
  color: COLORS.text,
  fontWeight: 800,
  fontSize: 18,
};

const metaTextStyle: React.CSSProperties = {
  color: COLORS.muted,
  fontSize: 14,
  marginTop: 4,
};

const metaWrapStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginTop: 10,
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

const statusBadgeStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  textTransform: "capitalize",
  flexShrink: 0,
};

const notesStyle: React.CSSProperties = {
  marginTop: 10,
  padding: 12,
  borderRadius: 14,
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