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

type CxcPayment = {
  id: string;
  customer_id: string;
  customer_name: string;
  payment_date: string;
  amount: number;
  payment_method?: string | null;
  reference?: string | null;
  notes?: string | null;
  created_at?: string | null;
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

export default function EstadoCuentaAdminPage() {
  const supabase = getSupabaseClient();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [notes, setNotes] = useState<CxcNote[]>([]);
  const [payments, setPayments] = useState<CxcPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    loadCustomers();
  }, []);

  async function loadCustomers() {
    setLoading(true);

    const { data, error } = await supabase
      .from("customers")
      .select("id, name, phone, email, credit_enabled, credit_limit, credit_days")
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

  async function loadCustomerStatement(customer: Customer) {
    setLoading(true);
    setSelectedCustomer(customer);

    const { data: notesData, error: notesError } = await supabase
      .from("cxc_notes")
      .select("*")
      .eq("customer_id", customer.id)
      .order("note_date", { ascending: false })
      .order("created_at", { ascending: false });

    const { data: paymentsData, error: paymentsError } = await supabase
      .from("cxc_payments")
      .select("*")
      .eq("customer_id", customer.id)
      .order("payment_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (notesError) {
      console.log(notesError);
      alert("No se pudieron cargar las notas");
      setLoading(false);
      return;
    }

    if (paymentsError) {
      console.log(paymentsError);
      alert("No se pudieron cargar los pagos");
      setLoading(false);
      return;
    }

    setNotes((notesData as CxcNote[]) || []);
    setPayments((paymentsData as CxcPayment[]) || []);
    setLoading(false);
  }

  const filteredCustomers = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return customers;

    return customers.filter((customer) => {
      return (
        (customer.name || "").toLowerCase().includes(q) ||
        (customer.phone || "").toLowerCase().includes(q) ||
        (customer.email || "").toLowerCase().includes(q)
      );
    });
  }, [customers, search]);

  const openNotes = useMemo(() => {
    return notes.filter((note) => Number(note.balance_due || 0) > 0);
  }, [notes]);

  const overdueNotes = useMemo(() => {
    return openNotes.filter((note) => isOverdue(note));
  }, [openNotes]);

  const paidNotes = useMemo(() => {
    return notes.filter(
      (note) =>
        Number(note.balance_due || 0) <= 0 || note.status === "pagada"
    );
  }, [notes]);

  const totalDebt = useMemo(() => {
    return openNotes.reduce(
      (acc, note) => acc + Number(note.balance_due || 0),
      0
    );
  }, [openNotes]);

  const totalInvoiced = useMemo(() => {
    return notes.reduce(
      (acc, note) => acc + Number(note.total_amount || 0),
      0
    );
  }, [notes]);

  const totalPaid = useMemo(() => {
    return payments.reduce(
      (acc, payment) => acc + Number(payment.amount || 0),
      0
    );
  }, [payments]);

  if (loading && !selectedCustomer && customers.length === 0) {
    return (
      <div style={loadingPageStyle}>
        <div style={loadingCardStyle}>Cargando estado de cuenta...</div>
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
            <h1 style={{ margin: 0, color: COLORS.text }}>
              Estado de cuenta por cliente
            </h1>
            <p style={{ margin: "6px 0 0 0", color: COLORS.muted }}>
              Revisión administrativa completa de notas, pagos y saldo
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/admin/cxc" style={secondaryButtonStyle}>
              Volver a CxC
            </Link>
            <Link href="/admin/dashboard" style={secondaryButtonStyle}>
              Dashboard
            </Link>
          </div>
        </div>

        <div style={mainGridStyle}>
          <div style={leftColumnStyle}>
            <div style={panelStyle}>
              <div style={panelHeaderStyle}>
                <div>
                  <h2 style={panelTitleStyle}>Clientes</h2>
                  <p style={panelSubtitleStyle}>
                    Busca y selecciona el cliente para ver su estado de cuenta
                  </p>
                </div>
              </div>

              <input
                placeholder="Buscar cliente por nombre, teléfono o correo"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={inputStyle}
              />

              {filteredCustomers.length === 0 ? (
                <div style={emptyBoxStyle}>No encontramos clientes</div>
              ) : (
                <div style={customersListStyle}>
                  {filteredCustomers.map((customer) => (
                    <button
                      key={customer.id}
                      onClick={() => loadCustomerStatement(customer)}
                      style={{
                        ...customerRowStyle,
                        background:
                          selectedCustomer?.id === customer.id ? "white" : COLORS.bgSoft,
                        boxShadow:
                          selectedCustomer?.id === customer.id
                            ? "0 8px 20px rgba(91, 25, 15, 0.08)"
                            : "none",
                      }}
                    >
                      <div style={{ textAlign: "left", minWidth: 0 }}>
                        <div style={customerNameStyle}>{customer.name}</div>

                        {customer.phone ? (
                          <div style={metaTextStyle}>Tel: {customer.phone}</div>
                        ) : null}

                        {customer.email ? (
                          <div style={metaTextStyle}>Correo: {customer.email}</div>
                        ) : null}
                      </div>

                      <div style={badgeWrapStyle}>
                        <span style={metaPillStyle}>
                          {customer.credit_enabled ? "Crédito" : "Contado"}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={rightColumnStyle}>
            {!selectedCustomer ? (
              <div style={panelStyle}>
                <div style={emptyBigStyle}>
                  Selecciona un cliente para ver su estado de cuenta.
                </div>
              </div>
            ) : (
              <>
                <div style={summaryGridStyle}>
                  <div style={summaryCardStyle}>
                    <div style={summaryLabelStyle}>Cliente</div>
                    <div style={summaryValueSmallStyle}>{selectedCustomer.name}</div>
                  </div>

                  <div style={summaryCardStyle}>
                    <div style={summaryLabelStyle}>Saldo pendiente</div>
                    <div style={summaryValueStyle}>${Math.ceil(totalDebt)}</div>
                  </div>

                  <div style={summaryCardStyle}>
                    <div style={summaryLabelStyle}>Total facturado</div>
                    <div style={summaryValueStyle}>${Math.ceil(totalInvoiced)}</div>
                  </div>

                  <div style={summaryCardStyle}>
                    <div style={summaryLabelStyle}>Total pagado</div>
                    <div style={summaryValueStyle}>${Math.ceil(totalPaid)}</div>
                  </div>

                  <div style={summaryCardStyle}>
                    <div style={summaryLabelStyle}>Notas abiertas</div>
                    <div style={summaryValueStyle}>{openNotes.length}</div>
                  </div>

                  <div style={summaryCardStyle}>
                    <div style={summaryLabelStyle}>Notas vencidas</div>
                    <div style={summaryValueStyle}>{overdueNotes.length}</div>
                  </div>
                </div>

                <div style={panelStyle}>
                  <div style={panelHeaderStyle}>
                    <div>
                      <h2 style={panelTitleStyle}>Información del cliente</h2>
                      <p style={panelSubtitleStyle}>
                        Datos comerciales del crédito
                      </p>
                    </div>
                  </div>

                  <div style={metaWrapStyle}>
                    <span style={metaPillStyle}>
                      Crédito: <b>{selectedCustomer.credit_enabled ? "Sí" : "No"}</b>
                    </span>
                    <span style={metaPillStyle}>
                      Límite: <b>${Math.ceil(Number(selectedCustomer.credit_limit || 0))}</b>
                    </span>
                    <span style={metaPillStyle}>
                      Días: <b>{Number(selectedCustomer.credit_days || 0)}</b>
                    </span>
                  </div>

                  {selectedCustomer.phone ? (
                    <div style={metaTextStyle}>Teléfono: {selectedCustomer.phone}</div>
                  ) : null}

                  {selectedCustomer.email ? (
                    <div style={metaTextStyle}>Correo: {selectedCustomer.email}</div>
                  ) : null}
                </div>

                <div style={doubleGridStyle}>
                  <div style={panelStyle}>
                    <div style={panelHeaderStyle}>
                      <div>
                        <h2 style={panelTitleStyle}>Notas abiertas</h2>
                        <p style={panelSubtitleStyle}>
                          Notas pendientes o parcialmente pagadas
                        </p>
                      </div>
                    </div>

                    {openNotes.length === 0 ? (
                      <div style={emptyBoxStyle}>No hay notas abiertas</div>
                    ) : (
                      <div style={cardsListStyle}>
                        {openNotes.map((note) => (
                          <div key={note.id} style={entryCardStyle}>
                            <div style={entryHeaderStyle}>
                              <div style={{ minWidth: 0 }}>
                                <div style={entryTitleStyle}>
                                  {note.note_number || "Sin folio"}
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
                                  background: isOverdue(note)
                                    ? "rgba(180,35,24,0.10)"
                                    : note.status === "abonada"
                                    ? "rgba(166,106,16,0.12)"
                                    : "rgba(53,92,125,0.12)",
                                  color: isOverdue(note)
                                    ? COLORS.danger
                                    : note.status === "abonada"
                                    ? COLORS.warning
                                    : COLORS.info,
                                }}
                              >
                                {isOverdue(note) ? "Vencida" : note.status}
                              </div>
                            </div>

                            <div style={metaWrapStyle}>
                              <span style={metaPillStyle}>
                                Total: <b>${Math.ceil(Number(note.total_amount || 0))}</b>
                              </span>
                              <span style={metaPillStyle}>
                                Saldo: <b>${Math.ceil(Number(note.balance_due || 0))}</b>
                              </span>
                              <span style={metaPillStyle}>
                                Descuento: <b>${Math.ceil(Number(note.discount_amount || 0))}</b>
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

                  <div style={panelStyle}>
                    <div style={panelHeaderStyle}>
                      <div>
                        <h2 style={panelTitleStyle}>Pagos realizados</h2>
                        <p style={panelSubtitleStyle}>
                          Historial de pagos del cliente
                        </p>
                      </div>
                    </div>

                    {payments.length === 0 ? (
                      <div style={emptyBoxStyle}>No hay pagos registrados</div>
                    ) : (
                      <div style={cardsListStyle}>
                        {payments.map((payment) => (
                          <div key={payment.id} style={entryCardStyle}>
                            <div style={entryHeaderStyle}>
                              <div style={{ minWidth: 0 }}>
                                <div style={entryTitleStyle}>
                                  Pago del {formatDate(payment.payment_date)}
                                </div>
                                <div style={metaTextStyle}>
                                  Método: <b>{payment.payment_method || "No definido"}</b>
                                </div>
                              </div>

                              <div
                                style={{
                                  ...statusBadgeStyle,
                                  background: "rgba(31,122,77,0.12)",
                                  color: COLORS.success,
                                }}
                              >
                                ${Math.ceil(Number(payment.amount || 0))}
                              </div>
                            </div>

                            {payment.reference ? (
                              <div style={metaTextStyle}>
                                Referencia: <b>{payment.reference}</b>
                              </div>
                            ) : null}

                            {payment.notes ? (
                              <div style={notesStyle}>
                                <b>Notas:</b> {payment.notes}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div style={panelStyle}>
                  <div style={panelHeaderStyle}>
                    <div>
                      <h2 style={panelTitleStyle}>Notas pagadas</h2>
                      <p style={panelSubtitleStyle}>
                        Historial de notas ya liquidadas
                      </p>
                    </div>
                  </div>

                  {paidNotes.length === 0 ? (
                    <div style={emptyBoxStyle}>No hay notas pagadas</div>
                  ) : (
                    <div style={paidNotesGridStyle}>
                      {paidNotes.map((note) => (
                        <div key={note.id} style={entryCardStyle}>
                          <div style={entryHeaderStyle}>
                            <div style={{ minWidth: 0 }}>
                              <div style={entryTitleStyle}>
                                {note.note_number || "Sin folio"}
                              </div>
                              <div style={metaTextStyle}>
                                Fecha: <b>{formatDate(note.note_date)}</b>
                              </div>
                            </div>

                            <div
                              style={{
                                ...statusBadgeStyle,
                                background: "rgba(31,122,77,0.12)",
                                color: COLORS.success,
                              }}
                            >
                              Pagada
                            </div>
                          </div>

                          <div style={metaWrapStyle}>
                            <span style={metaPillStyle}>
                              Total: <b>${Math.ceil(Number(note.total_amount || 0))}</b>
                            </span>
                            <span style={metaPillStyle}>
                              Saldo: <b>${Math.ceil(Number(note.balance_due || 0))}</b>
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
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

const mainGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(320px, 420px) minmax(0, 1fr)",
  gap: 20,
  alignItems: "start",
};

const leftColumnStyle: React.CSSProperties = {
  display: "grid",
  gap: 20,
};

const rightColumnStyle: React.CSSProperties = {
  display: "grid",
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
  marginBottom: 14,
};

const customersListStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  maxHeight: 720,
  overflowY: "auto",
  paddingRight: 4,
};

const customerRowStyle: React.CSSProperties = {
  width: "100%",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  padding: 14,
  borderRadius: 16,
  border: `1px solid ${COLORS.border}`,
  cursor: "pointer",
};

const customerNameStyle: React.CSSProperties = {
  color: COLORS.text,
  fontWeight: 800,
  fontSize: 18,
  lineHeight: 1.2,
};

const badgeWrapStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  flexShrink: 0,
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

const emptyBigStyle: React.CSSProperties = {
  padding: 32,
  borderRadius: 24,
  background: COLORS.bgSoft,
  border: `1px dashed ${COLORS.border}`,
  color: COLORS.muted,
  textAlign: "center",
};

const summaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: 14,
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

const summaryValueSmallStyle: React.CSSProperties = {
  color: COLORS.text,
  fontSize: 22,
  fontWeight: 800,
  lineHeight: 1.2,
};

const doubleGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: 18,
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

const paidNotesGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 12,
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