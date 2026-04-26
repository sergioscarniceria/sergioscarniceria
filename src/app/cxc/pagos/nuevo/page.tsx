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
  credit_days?: number | null;
};

type CxcNote = {
  id: string;
  customer_id: string;
  customer_name: string;
  note_number?: string | null;
  note_date: string;
  due_date?: string | null;
  total_amount: number;
  balance_due: number;
  status: string;
  notes?: string | null;
};

type PaymentMethod = "efectivo" | "tarjeta" | "transferencia";

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

function money(n: number) { return Math.ceil(n).toLocaleString("en-US"); }

function todayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

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

export default function NuevoPagoCxcPage() {
  const supabase = getSupabaseClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const [openNotes, setOpenNotes] = useState<CxcNote[]>([]);

  const [paymentDate, setPaymentDate] = useState(todayDateString());
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("efectivo");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    loadCustomers();
  }, []);

  async function loadCustomers() {
    setLoading(true);

    const { data, error } = await supabase
      .from("customers")
      .select("id, name, phone, email, credit_enabled, credit_days")
      .eq("credit_enabled", true)
      .order("name", { ascending: true });

    if (error) {
      console.log(error);
      alert("No se pudieron cargar los clientes con crédito");
      setLoading(false);
      return;
    }

    setCustomers((data as Customer[]) || []);
    setLoading(false);
  }

  async function selectCustomer(customer: Customer) {
    setSelectedCustomer(customer);

    const { data, error } = await supabase
      .from("cxc_notes")
      .select("id, customer_id, customer_name, note_number, note_date, due_date, total_amount, balance_due, status, notes")
      .eq("customer_id", customer.id)
      .gt("balance_due", 0)
      .order("note_date", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.log(error);
      alert("No se pudieron cargar las notas abiertas");
      return;
    }

    setOpenNotes((data as CxcNote[]) || []);
  }

  function clearForm() {
    setSelectedCustomer(null);
    setOpenNotes([]);
    setCustomerSearch("");
    setPaymentDate(todayDateString());
    setAmount("");
    setPaymentMethod("efectivo");
    setReference("");
    setNotes("");
  }

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.toLowerCase().trim();
    if (!q) return customers.slice(0, 20);

    return customers
      .filter((customer) => {
        return (
          (customer.name || "").toLowerCase().includes(q) ||
          (customer.phone || "").toLowerCase().includes(q) ||
          (customer.email || "").toLowerCase().includes(q)
        );
      })
      .slice(0, 20);
  }, [customers, customerSearch]);

  const totalPending = useMemo(() => {
    return openNotes.reduce((acc, note) => acc + Number(note.balance_due || 0), 0);
  }, [openNotes]);

  async function savePaymentBase() {
  if (!selectedCustomer) {
    alert("Selecciona un cliente");
    return;
  }

  const paymentAmount = Number(amount || 0);

  if (!paymentAmount || paymentAmount <= 0) {
    alert("Captura un monto válido");
    return;
  }

  if (openNotes.length === 0) {
    alert("Ese cliente no tiene notas abiertas");
    return;
  }

  const totalPendingAmount = openNotes.reduce(
    (acc, note) => acc + Number(note.balance_due || 0),
    0
  );

  if (paymentAmount > Math.ceil(totalPendingAmount)) {
    alert("El monto es mayor al saldo pendiente del cliente");
    return;
  }

  setSaving(true);

  const { data: paymentData, error: paymentError } = await supabase
    .from("cxc_payments")
    .insert([
      {
        customer_id: selectedCustomer.id,
        customer_name: selectedCustomer.name,
        payment_date: paymentDate,
        amount: Number(paymentAmount.toFixed(2)),
        payment_method: paymentMethod,
        reference: reference.trim() || null,
        notes: notes.trim() || null,
      },
    ])
    .select()
    .single();

  if (paymentError || !paymentData) {
    console.log(paymentError);
    alert("No se pudo guardar el pago");
    setSaving(false);
    return;
  }
  const { error: cashMovementError } = await supabase
  .from("cash_movements")
  .insert([
    {
      type: "cxc_pago",
      source: "cxc",
      amount: Number(paymentAmount.toFixed(2)),
      payment_method: paymentMethod,
      reference_id: paymentData.id,
    },
  ]);

if (cashMovementError) {
  console.log(cashMovementError);
  alert("El pago se guardó, pero falló el movimiento de caja");
  setSaving(false);
  return;
}

  let remaining = paymentAmount;

  for (const note of openNotes) {
    if (remaining <= 0) break;

    const currentBalance = Number(note.balance_due || 0);
    if (currentBalance <= 0) continue;

    const amountApplied = Math.min(remaining, currentBalance);
    const newBalance = Number((currentBalance - amountApplied).toFixed(2));

    const { error: updateError } = await supabase
      .from("cxc_notes")
      .update({
        balance_due: newBalance,
        status: newBalance <= 0 ? "pagada" : "abierta",
      })
      .eq("id", note.id);

    if (updateError) {
      console.log(updateError);
      alert("El pago se guardó, pero falló la aplicación a las notas");
      setSaving(false);
      return;
    }

    remaining = Number((remaining - amountApplied).toFixed(2));
  }

  alert("Pago registrado y aplicado correctamente");

  clearForm();
  await loadCustomers();
  setSaving(false);
}

  if (loading) {
    return (
      <div style={loadingPageStyle}>
        <div style={loadingCardStyle}>Cargando nuevo pago...</div>
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
            <h1 style={{ margin: 0, color: COLORS.text }}>Registrar pago CxC</h1>
            <p style={{ margin: "6px 0 0 0", color: COLORS.muted }}>
              Aplica un abono a un cliente con crédito
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/cxc/nueva" style={secondaryButtonStyle}>
              Nueva nota
            </Link>
            <Link href="/cxc/pagos" style={secondaryButtonStyle}>
              Volver a pagos
            </Link>
            <Link href="/cxc" style={secondaryButtonStyle}>
              Volver a CxC
            </Link>
          </div>
        </div>

        <div style={mainGridStyle}>
          <div style={leftColumnStyle}>
            <div style={panelStyle}>
              <div style={panelHeaderStyle}>
                <div>
                  <h2 style={panelTitleStyle}>1. Cliente</h2>
                  <p style={panelSubtitleStyle}>Busca un cliente con crédito activo</p>
                </div>
              </div>

              <input
                placeholder="Buscar cliente por nombre, teléfono o correo"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                style={inputStyle}
              />

              <div style={customersListStyle}>
                {filteredCustomers.length === 0 ? (
                  <div style={emptyBoxStyle}>No encontramos clientes</div>
                ) : (
                  filteredCustomers.map((customer) => (
                    <button
                      key={customer.id}
                      onClick={() => selectCustomer(customer)}
                      style={customerRowStyle}
                    >
                      <div style={{ minWidth: 0, textAlign: "left" }}>
                        <div style={customerNameStyle}>{customer.name}</div>
                        <div style={metaTextStyle}>
                          {customer.phone || "Sin teléfono"}
                        </div>
                      </div>

                      <div style={badgeStyle}>Seleccionar</div>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div style={panelStyle}>
              <div style={panelHeaderStyle}>
                <div>
                  <h2 style={panelTitleStyle}>2. Datos del pago</h2>
                  <p style={panelSubtitleStyle}>Captura el abono del cliente</p>
                </div>
              </div>

              <div style={formGridStyle}>
                <div>
                  <div style={fieldLabelStyle}>Fecha de pago</div>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    style={inputStyle}
                  />
                </div>

                <div>
                  <div style={fieldLabelStyle}>Monto</div>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    style={inputStyle}
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <div style={fieldLabelStyle}>Método de pago</div>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    style={inputStyle}
                  >
                    <option value="efectivo">Efectivo</option>
                    <option value="tarjeta">Tarjeta</option>
                    <option value="transferencia">Transferencia</option>
                  </select>
                </div>

                <div>
                  <div style={fieldLabelStyle}>Referencia</div>
                  <input
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    style={inputStyle}
                    placeholder="Folio, transferencia, terminal..."
                  />
                </div>
              </div>

              <div style={fieldLabelStyle}>Notas</div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={textareaStyle}
                placeholder="Observaciones del pago"
              />

              <div style={buttonRowStyle}>
                <button
                  onClick={clearForm}
                  type="button"
                  style={secondaryGhostButtonStyle}
                >
                  Limpiar
                </button>

                <button
                  onClick={savePaymentBase}
                  disabled={saving}
                  type="button"
                  style={primaryButtonStyle}
                >
                  {saving ? "Guardando..." : "Continuar"}
                </button>
              </div>
            </div>
          </div>

          <div style={rightColumnStyle}>
            <div style={panelStyle}>
              <div style={panelHeaderStyle}>
                <div>
                  <h2 style={panelTitleStyle}>Resumen</h2>
                  <p style={panelSubtitleStyle}>Estado actual del cliente</p>
                </div>
              </div>

              {!selectedCustomer ? (
                <div style={emptyBoxStyle}>Primero selecciona un cliente</div>
              ) : (
                <>
                  <div style={selectedCustomerBoxStyle}>
                    <div style={customerNameBigStyle}>{selectedCustomer.name}</div>
                    <div style={metaTextStyle}>
                      Crédito a {selectedCustomer.credit_days || 0} días
                    </div>
                  </div>

                  <div style={summaryStackStyle}>
                    <div style={summaryRowStyle}>
                      <span>Notas abiertas</span>
                      <b>{openNotes.length}</b>
                    </div>

                    <div style={summaryRowStyle}>
                      <span>Saldo pendiente</span>
                      <b>${money(totalPending)}</b>
                    </div>

                    <div style={summaryRowStyle}>
                      <span>Monto capturado</span>
                      <b>${money(Number(amount || 0))}</b>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div style={panelStyle}>
              <div style={panelHeaderStyle}>
                <div>
                  <h2 style={panelTitleStyle}>Notas abiertas</h2>
                  <p style={panelSubtitleStyle}>Estas son las que vamos a afectar</p>
                </div>
              </div>

              {selectedCustomer && openNotes.length === 0 ? (
                <div style={emptyBoxStyle}>Ese cliente no tiene notas abiertas</div>
              ) : !selectedCustomer ? (
                <div style={emptyBoxStyle}>Selecciona un cliente para ver sus notas</div>
              ) : (
                <div style={notesListStyle}>
                  {openNotes.map((note) => (
                    <div key={note.id} style={noteCardStyle}>
                      <div style={noteHeaderStyle}>
                        <div style={{ minWidth: 0 }}>
                          <div style={noteTitleStyle}>
                            {note.note_number || "Sin folio"}
                          </div>
                          <div style={metaTextStyle}>
                            Fecha: <b>{formatDate(note.note_date)}</b>
                          </div>
                          <div style={metaTextStyle}>
                            Vence: <b>{formatDate(note.due_date || note.note_date)}</b>
                          </div>
                        </div>

                        <div style={amountBadgeStyle}>
                          ${money(note.balance_due)}
                        </div>
                      </div>

                      {note.notes ? (
                        <div style={noteNotesStyle}>
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
  gridTemplateColumns: "minmax(0, 1.08fr) minmax(360px, 0.92fr)",
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

const formGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 14,
};

const fieldLabelStyle: React.CSSProperties = {
  color: COLORS.muted,
  fontSize: 14,
  marginBottom: 8,
  fontWeight: 700,
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

const textareaStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 110,
  padding: 14,
  borderRadius: 16,
  border: `1px solid ${COLORS.border}`,
  boxSizing: "border-box",
  outline: "none",
  background: "rgba(255,255,255,0.82)",
  color: COLORS.text,
  fontSize: 15,
  resize: "vertical",
};

const customersListStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  marginTop: 14,
  maxHeight: 380,
  overflowY: "auto",
};

const customerRowStyle: React.CSSProperties = {
  width: "100%",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: 14,
  borderRadius: 16,
  border: `1px solid ${COLORS.border}`,
  background: COLORS.bgSoft,
  cursor: "pointer",
};

const customerNameStyle: React.CSSProperties = {
  fontWeight: 800,
  color: COLORS.text,
  fontSize: 17,
};

const customerNameBigStyle: React.CSSProperties = {
  fontWeight: 800,
  color: COLORS.text,
  fontSize: 22,
};

const selectedCustomerBoxStyle: React.CSSProperties = {
  padding: 16,
  borderRadius: 18,
  background: COLORS.bgSoft,
  border: `1px solid ${COLORS.border}`,
  marginBottom: 14,
};

const badgeStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  background: "rgba(123, 34, 24, 0.10)",
  color: COLORS.primary,
  flexShrink: 0,
};

const summaryStackStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const summaryRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: 12,
  borderRadius: 14,
  background: COLORS.bgSoft,
  border: `1px solid ${COLORS.border}`,
  color: COLORS.text,
};

const notesListStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const noteCardStyle: React.CSSProperties = {
  padding: 14,
  borderRadius: 18,
  background: COLORS.bgSoft,
  border: `1px solid ${COLORS.border}`,
};

const noteHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  marginBottom: 10,
};

const noteTitleStyle: React.CSSProperties = {
  color: COLORS.text,
  fontWeight: 800,
  fontSize: 18,
};

const amountBadgeStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 16,
  background: COLORS.warning,
  color: "white",
  fontWeight: 800,
  fontSize: 16,
  whiteSpace: "nowrap",
  flexShrink: 0,
};

const noteNotesStyle: React.CSSProperties = {
  marginTop: 10,
  padding: 12,
  borderRadius: 14,
  background: "rgba(255,255,255,0.7)",
  border: `1px solid ${COLORS.border}`,
  color: COLORS.text,
};

const metaTextStyle: React.CSSProperties = {
  color: COLORS.muted,
  fontSize: 14,
  marginTop: 4,
};

const buttonRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  flexWrap: "wrap",
  marginTop: 14,
};

const emptyBoxStyle: React.CSSProperties = {
  padding: 16,
  borderRadius: 18,
  background: COLORS.bgSoft,
  border: `1px dashed ${COLORS.border}`,
  color: COLORS.muted,
};

const secondaryGhostButtonStyle: React.CSSProperties = {
  padding: "12px 18px",
  borderRadius: 14,
  border: `1px solid ${COLORS.border}`,
  background: "rgba(255,255,255,0.75)",
  color: COLORS.text,
  fontWeight: 700,
  cursor: "pointer",
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
  cursor: "pointer",
};