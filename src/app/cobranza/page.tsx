"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";

type TabMode = "ticket" | "manual";
type PaymentMethod = "efectivo" | "tarjeta" | "transferencia" | "credito";

type OrderItem = {
  id?: string;
  product: string;
  kilos: number;
  price: number;
  prepared_kilos?: number | null;
  sale_type?: "kg" | "pieza" | null;
};

type Ticket = {
  id: string;
  customer_id?: string | null;
  customer_name?: string | null;
  status?: string | null;
  source?: string | null;
  notes?: string | null;
  created_at?: string | null;
  payment_status?: string | null;
  payment_method?: string | null;
  paid_at?: string | null;
  canceled_at?: string | null;
  order_items?: OrderItem[];
};

type Customer = {
  id: string;
  name: string;
  credit_enabled?: boolean | null;
  credit_days?: number | null;
  customer_type?: string | null;
};

type ManualLine = {
  id: string;
  product: string;
  kilos: string;
  price: string;
};

const COLORS = {
  bg: "#f7f1e8",
  bgSoft: "#fbf8f3",
  card: "rgba(255,255,255,0.92)",
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

function money(value?: number | null) {
  return Number(value || 0).toFixed(2);
}
function shortId(id: string) {
  return id.slice(0, 6);
}

function ticketFolio(id: string) {
  return `TK-${shortId(id)}`;
}

/**
 * Extrae un posible ID de ticket desde cualquier texto ingresado:
 * - UUID completo (ej: "a1b2c3d4-e5f6-7890-abcd-ef1234567890")
 * - Folio TK-xxxxxx (extrae los 6 chars)
 * - Solo los primeros 6 chars del ID
 * - URL que contenga un UUID (ej: texto de QR con URL)
 * - Texto con formato libre del QR
 */
function extractTicketId(raw: string): { full: string | null; short: string | null } {
  const text = raw.trim();
  if (!text) return { full: null, short: null };

  // Patrón UUID (8-4-4-4-12)
  const uuidMatch = text.match(
    /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
  );
  if (uuidMatch) {
    return { full: uuidMatch[1].toLowerCase(), short: uuidMatch[1].slice(0, 6).toLowerCase() };
  }

  // Patrón TK-xxxxxx
  const tkMatch = text.match(/TK-([0-9a-f]{4,8})/i);
  if (tkMatch) {
    return { full: null, short: tkMatch[1].toLowerCase().slice(0, 6) };
  }

  // Si parece un fragmento hex (6+ chars, solo hex)
  const hexClean = text.replace(/^tk-/i, "").trim();
  if (/^[0-9a-f]{6,}$/i.test(hexClean)) {
    return { full: hexClean.length >= 32 ? hexClean.toLowerCase() : null, short: hexClean.slice(0, 6).toLowerCase() };
  }

  // Fallback: devolver como short para búsqueda parcial
  return { full: null, short: text.toLowerCase().slice(0, 20) };
}

function todayDateString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDaysToDate(dateString: string, days: number) {
  const base = new Date(`${dateString}T12:00:00`);
  if (isNaN(base.getTime())) return dateString;
  base.setDate(base.getDate() + days);
  const y = base.getFullYear();
  const m = `${base.getMonth() + 1}`.padStart(2, "0");
  const d = `${base.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function makeLineId() {
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function CobranzaPage() {
  const supabase = getSupabaseClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<TabMode>("ticket");

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [ticketSearch, setTicketSearch] = useState("");
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  const [customerName, setCustomerName] = useState("");
  const [manualNotes, setManualNotes] = useState("");
  const [manualLines, setManualLines] = useState<ManualLine[]>([]);
  const [customerMode, setCustomerMode] = useState<"general" | "existente">("general");
const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
const [showNewCustomer, setShowNewCustomer] = useState(false);
const [newCustomerName, setNewCustomerName] = useState("");
const [newCustomerPhone, setNewCustomerPhone] = useState("");

  // Descuento
  const [discountMode, setDiscountMode] = useState<"none" | "percent" | "amount">("none");
  const [discountValue, setDiscountValue] = useState("");
  const [showPrintTicket, setShowPrintTicket] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    const { data: ticketsData, error: ticketsError } = await supabase
      .from("orders")
      .select(
        "id, customer_id, customer_name, status, source, notes, created_at, payment_status, payment_method, paid_at, canceled_at, order_items(*)"
      )
      .order("created_at", { ascending: false })
      .limit(40);

    const { data: customersData, error: customersError } = await supabase
      .from("customers")
      .select("id, name, credit_enabled, credit_days, customer_type")
      .order("name", { ascending: true });

    if (ticketsError || customersError) {
      console.log(ticketsError || customersError);
      alert("No se pudo cargar cobranza");
      setLoading(false);
      return;
    }

    const pending = ((ticketsData as Ticket[]) || []).filter((ticket) => {
      return ticket.payment_status !== "pagado" && ticket.payment_status !== "cancelado";
    });

    setTickets(pending);
    setCustomers((customersData as Customer[]) || []);
    setLoading(false);
  }

  function ticketTotal(ticket: Ticket | null) {
    if (!ticket) return 0;
    return (ticket.order_items || []).reduce((acc, item) => {
      // Usar prepared_kilos (peso real ajustado) si existe, si no el original
      const kg = Number(item.prepared_kilos || item.kilos || 0);
      return acc + kg * Number(item.price || 0);
    }, 0);
  }

  function getCustomerType(ticket: Ticket | null): string | null {
    if (!ticket?.customer_id) return null;
    const c = customers.find((cu) => cu.id === ticket.customer_id);
    return c?.customer_type || null;
  }

  function calcDiscount(subtotal: number): number {
    if (discountMode === "none" || !discountValue) return 0;
    const val = Number(discountValue.replace(",", "."));
    if (!val || val <= 0) return 0;
    if (discountMode === "percent") return Math.min(subtotal, subtotal * (val / 100));
    return Math.min(subtotal, val); // amount mode
  }

  function ticketFinalTotal(ticket: Ticket | null): number {
    const sub = ticketTotal(ticket);
    return Math.max(0, sub - calcDiscount(sub));
  }

  const filteredTickets = useMemo(() => {
  const qRaw = ticketSearch.trim();
  if (!qRaw) return tickets;

  const q = qRaw.toLowerCase();
  const { full, short: shortCode } = extractTicketId(qRaw);

  return tickets.filter((ticket) => {
    const id = String(ticket.id).toLowerCase();
    const short = id.slice(0, 6);
    const folio = `tk-${short}`;
    const name = (ticket.customer_name || "").toLowerCase();

    // Match por UUID completo
    if (full && id === full) return true;
    // Match por short code
    if (shortCode && short.includes(shortCode)) return true;
    // Match por folio
    if (folio.includes(q)) return true;
    // Match por nombre de cliente
    if (name.includes(q)) return true;
    // Match parcial por ID
    if (id.includes(q)) return true;

    return false;
  });
}, [tickets, ticketSearch]);

  async function openTicket(id: string) {
    const { data, error } = await supabase
      .from("orders")
      .select(
        "id, customer_id, customer_name, status, source, notes, created_at, payment_status, payment_method, paid_at, canceled_at, order_items(*)"
      )
      .eq("id", id)
      .single();

    if (error || !data) {
      console.log(error);
      alert("No se pudo abrir el ticket");
      return;
    }

    setSelectedTicket(data as Ticket);
    setDiscountMode("none");
    setDiscountValue("");
  }

  /**
   * Búsqueda directa en Supabase cuando no hay match local.
   * Acepta UUID completo, folio TK-xxx, o short ID.
   * Retorna true si encontró y abrió el ticket.
   */
  async function searchTicketDirect(rawInput: string): Promise<boolean> {
    const { full, short: shortCode } = extractTicketId(rawInput);

    // 1) Si tenemos UUID completo, buscar directo por ID
    if (full) {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, customer_id, customer_name, status, source, notes, created_at, payment_status, payment_method, paid_at, canceled_at, order_items(*)"
        )
        .eq("id", full)
        .single();

      if (!error && data) {
        setSelectedTicket(data as Ticket);
        return true;
      }
    }

    // 2) Si tenemos short code, buscar tickets cuyo ID empiece con ese código
    if (shortCode && shortCode.length >= 4) {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, customer_id, customer_name, status, source, notes, created_at, payment_status, payment_method, paid_at, canceled_at, order_items(*)"
        )
        .ilike("id", `${shortCode}%`)
        .order("created_at", { ascending: false })
        .limit(5);

      if (!error && data && data.length === 1) {
        setSelectedTicket(data[0] as Ticket);
        return true;
      }

      if (!error && data && data.length > 1) {
        // Múltiples resultados — no abrir automáticamente
        alert(`Se encontraron ${data.length} tickets con ese folio. Intenta con el ID completo.`);
        return false;
      }
    }

    return false;
  }

  async function markTicketPaid(method: Exclude<PaymentMethod, "credito">) {
    if (!selectedTicket) return;

    setSaving(true);

    const subtotal = ticketTotal(selectedTicket);
    const descuento = calcDiscount(subtotal);
    const finalTotal = Math.max(0, subtotal - descuento);

    const orderUpdate: any = {
      payment_status: "pagado",
      payment_method: method,
      paid_at: new Date().toISOString(),
    };

    // Guardar info de descuento en notes si existe
    if (descuento > 0) {
      const discountNote = discountMode === "percent"
        ? `Descuento ${discountValue}% = -$${descuento.toFixed(2)}`
        : `Descuento -$${descuento.toFixed(2)}`;
      const existing = selectedTicket.notes || "";
      orderUpdate.notes = existing ? `${existing} | ${discountNote}` : discountNote;
    }

    const { error } = await supabase
      .from("orders")
      .update(orderUpdate)
      .eq("id", selectedTicket.id);

    if (error) {
      console.log(error);
      alert("No se pudo registrar el pago");
      setSaving(false);
      return;
    }

    const { error: cashError } = await supabase
      .from("cash_movements")
      .insert([
        {
          type: "venta",
          source: "cobranza",
          amount: Number(finalTotal.toFixed(2)),
          payment_method: method,
          reference_id: selectedTicket.id,
        },
      ]);

    if (cashError) {
      console.log(cashError);
      alert("Se marcó como pagado, pero falló el movimiento de caja");
      setSaving(false);
      return;
    }

    // Mostrar ticket imprimible
    setShowPrintTicket(true);
    setSaving(false);
  }

  function closePrintAndReset() {
    setShowPrintTicket(false);
    setSelectedTicket(null);
    setDiscountMode("none");
    setDiscountValue("");
    loadData();
  }

  async function cancelTicket() {
    if (!selectedTicket) return;
    if (!confirm("¿Cancelar ticket?")) return;

    setSaving(true);

    const { error } = await supabase
      .from("orders")
      .update({
        payment_status: "cancelado",
        canceled_at: new Date().toISOString(),
      })
      .eq("id", selectedTicket.id);

    if (error) {
      console.log(error);
      alert("No se pudo cancelar");
      setSaving(false);
      return;
    }

    alert("Ticket cancelado");
    setSelectedTicket(null);
    await loadData();
    setSaving(false);
  }

  async function sendTicketToCredit() {
    if (!selectedTicket) return;

    if (!selectedTicket.customer_id) {
      alert("Este ticket no tiene cliente ligado");
      return;
    }

    const customer = customers.find((c) => c.id === selectedTicket.customer_id);

    if (!customer) {
      alert("No encontramos el cliente del ticket");
      return;
    }

    if (!customer.credit_enabled) {
      alert("Ese cliente no tiene crédito activo");
      return;
    }

    setSaving(true);

    const noteDate = todayDateString();
    const dueDate = addDaysToDate(
      noteDate,
      Number(customer.credit_days || 0) > 0 ? Number(customer.credit_days) : 7
    );
    const total = ticketTotal(selectedTicket);

    const { data: noteData, error: noteError } = await supabase
      .from("cxc_notes")
      .insert([
        {
          customer_id: customer.id,
          customer_name: customer.name,
          note_number: `TK-${selectedTicket.id}`,
          note_date: noteDate,
          due_date: dueDate,
          source_type: "ticket",
          subtotal: Number(total.toFixed(2)),
          discount_amount: 0,
          total_amount: Number(total.toFixed(2)),
          balance_due: Number(total.toFixed(2)),
          status: "abierta",
          notes: selectedTicket.notes || null,
        },
      ])
      .select("*")
      .single();

    if (noteError || !noteData) {
      console.log(noteError);
      alert("No se pudo generar la nota de crédito");
      setSaving(false);
      return;
    }

    const noteItems = (selectedTicket.order_items || []).map((item) => {
      const kg = Number(item.prepared_kilos || item.kilos || 0);
      return {
        cxc_note_id: noteData.id,
        product: item.product,
        quantity: Number(kg.toFixed(3)),
        unit: "kg",
        price: Number(Number(item.price || 0).toFixed(2)),
        line_total: Number((kg * Number(item.price || 0)).toFixed(2)),
      };
    });

    if (noteItems.length > 0) {
      const { error: noteItemsError } = await supabase
        .from("cxc_note_items")
        .insert(noteItems);

      if (noteItemsError) {
        console.log(noteItemsError);
        alert("La nota se creó, pero fallaron los renglones");
        setSaving(false);
        return;
      }
    }

    const { error: orderError } = await supabase
      .from("orders")
      .update({
        payment_status: "credito_autorizado",
        payment_method: "credito",
        paid_at: new Date().toISOString(),
      })
      .eq("id", selectedTicket.id);

    if (orderError) {
      console.log(orderError);
      alert("La nota se creó, pero no se actualizó el ticket");
      setSaving(false);
      return;
    }

    alert("Ticket enviado a crédito");
    setSelectedTicket(null);
    await loadData();
    setSaving(false);
  }

  function addManualLine() {
    setManualLines((prev) => [
      ...prev,
      { id: makeLineId(), product: "", kilos: "1", price: "0" },
    ]);
  }

  function updateManualLine(
    id: string,
    field: "product" | "kilos" | "price",
    value: string
  ) {
    setManualLines((prev) =>
      prev.map((line) => (line.id === id ? { ...line, [field]: value } : line))
    );
  }

  function removeManualLine(id: string) {
    setManualLines((prev) => prev.filter((line) => line.id !== id));
  }

  function clearManualSale() {
  setCustomerMode("general");
  setSelectedCustomerId("");
  setCustomerName("");
  setManualNotes("");
  setManualLines([]);
}
async function createNewCustomer() {
  if (!newCustomerName.trim()) {
    alert("El nombre es obligatorio");
    return;
  }

  const { data, error } = await supabase
    .from("customers")
    .insert([
      {
        name: newCustomerName.trim(),
        phone: newCustomerPhone.trim() || null,
      },
    ])
    .select()
    .single();

  if (error || !data) {
    console.log(error);
    alert("No se pudo crear el cliente");
    return;
  }

  setCustomers((prev) => [...prev, data as Customer]);
  setSelectedCustomerId(data.id);
  setCustomerMode("existente");
  setShowNewCustomer(false);
  setNewCustomerName("");
  setNewCustomerPhone("");

  alert("Cliente creado correctamente");
}
async function saveManualCredit() {
  if (manualLines.length === 0) {
    alert("Agrega al menos un renglón");
    return;
  }

  if (customerMode !== "existente" || !selectedCustomerId) {
    alert("Para mandar a crédito debes seleccionar un cliente existente");
    return;
  }

  const selected = customers.find((c) => c.id === selectedCustomerId);

  if (!selected) {
    alert("No encontramos el cliente seleccionado");
    return;
  }

  if (!selected.credit_enabled) {
    alert("Ese cliente no tiene crédito activo");
    return;
  }

  const validLines = manualLines.every((line) => {
    return (
      line.product.trim() &&
      Number(line.kilos || 0) > 0 &&
      Number(line.price || 0) >= 0
    );
  });

  if (!validLines) {
    alert("Revisa producto, kilos y precio en todos los renglones");
    return;
  }

  setSaving(true);

  const cleanCustomerName = selected.name;
  const customerId = selected.id;

  const { data: orderData, error: orderError } = await supabase
    .from("orders")
    .insert([
      {
        customer_id: customerId,
        customer_name: cleanCustomerName,
        status: "terminado",
        source: "caja_manual",
        notes: manualNotes.trim() || null,
        payment_status: "credito_autorizado",
        payment_method: "credito",
        paid_at: new Date().toISOString(),
      },
    ])
    .select()
    .single();

  if (orderError || !orderData) {
    console.log(orderError);
    alert("No se pudo guardar la venta a crédito");
    setSaving(false);
    return;
  }

  const itemsPayload = manualLines.map((line) => ({
    order_id: orderData.id,
    product: line.product.trim(),
    kilos: Number(Number(line.kilos || 0).toFixed(3)),
    price: Number(Number(line.price || 0).toFixed(2)),
  }));

  const { error: itemsError } = await supabase
    .from("order_items")
    .insert(itemsPayload);

  if (itemsError) {
    console.log(itemsError);
    alert("La venta se guardó, pero fallaron los renglones");
    setSaving(false);
    return;
  }

  const noteDate = todayDateString();
  const dueDate = addDaysToDate(
    noteDate,
    Number(selected.credit_days || 0) > 0 ? Number(selected.credit_days) : 7
  );

  const { data: noteData, error: noteError } = await supabase
    .from("cxc_notes")
    .insert([
      {
        customer_id: customerId,
        customer_name: cleanCustomerName,
        note_number: `VM-${orderData.id}`,
        note_date: noteDate,
        due_date: dueDate,
        source_type: "venta_manual",
        subtotal: Number(manualTotal.toFixed(2)),
        discount_amount: 0,
        total_amount: Number(manualTotal.toFixed(2)),
        balance_due: Number(manualTotal.toFixed(2)),
        status: "abierta",
        notes: manualNotes.trim() || null,
      },
    ])
    .select("*")
    .single();

  if (noteError || !noteData) {
    console.log(noteError);
    alert("La venta se guardó, pero no se pudo crear la nota de crédito");
    setSaving(false);
    return;
  }

  const noteItems = manualLines.map((line) => ({
    cxc_note_id: noteData.id,
    product: line.product.trim(),
    quantity: Number(Number(line.kilos || 0).toFixed(3)),
    unit: "kg",
    price: Number(Number(line.price || 0).toFixed(2)),
    line_total: Number(
      (Number(line.kilos || 0) * Number(line.price || 0)).toFixed(2)
    ),
  }));

  const { error: noteItemsError } = await supabase
    .from("cxc_note_items")
    .insert(noteItems);

  if (noteItemsError) {
    console.log(noteItemsError);
    alert("La nota se creó, pero fallaron los renglones de CxC");
    setSaving(false);
    return;
  }

  alert("Venta mandada a crédito correctamente");
  clearManualSale();
  await loadData();
  setSaving(false);
}
async function saveManualSale(method: Exclude<PaymentMethod, "credito">) {
  if (manualLines.length === 0) {
    alert("Agrega al menos un renglón");
    return;
  }

  const validLines = manualLines.every((line) => {
    return (
      line.product.trim() &&
      Number(line.kilos || 0) > 0 &&
      Number(line.price || 0) >= 0
    );
  });

  if (!validLines) {
    alert("Revisa producto, kilos y precio en todos los renglones");
    return;
  }

  setSaving(true);

  let cleanCustomerName = "PUBLICO GENERAL";
let customerId: string | null = null;

if (customerMode === "existente" && selectedCustomerId) {
  const selected = customers.find(c => c.id === selectedCustomerId);

  if (selected) {
    cleanCustomerName = selected.name;
    customerId = selected.id;
  }
}

  const { data: orderData, error: orderError } = await supabase
    .from("orders")
    .insert([
      {
  customer_id: customerId,
  customer_name: cleanCustomerName,
        status: "terminado",
        source: "caja_manual",
        notes: manualNotes.trim() || null,
        payment_status: "pagado",
        payment_method: method,
        paid_at: new Date().toISOString(),
      },
    ])
    .select()
    .single();

  if (orderError || !orderData) {
    console.log(orderError);
    alert("No se pudo guardar la venta manual");
    setSaving(false);
    return;
  }

  const itemsPayload = manualLines.map((line) => ({
    order_id: orderData.id,
    product: line.product.trim(),
    kilos: Number(Number(line.kilos || 0).toFixed(3)),
    price: Number(Number(line.price || 0).toFixed(2)),
  }));

  const { error: itemsError } = await supabase
    .from("order_items")
    .insert(itemsPayload);

  if (itemsError) {
    console.log(itemsError);
    alert("La venta se guardó, pero fallaron los renglones");
    setSaving(false);
    return;
  }

  const { error: cashError } = await supabase
  .from("cash_movements")
  .insert([
    {
      type: "venta",
      source: "cobranza",
      amount: Number(manualTotal.toFixed(2)),
      payment_method: method,
      reference_id: orderData.id,
    },
  ]);

if (cashError) {
  console.log(cashError);
  alert("La venta se guardó, pero falló el movimiento de caja");
  setSaving(false);
  return;
}
  alert("Venta manual registrada");

  clearManualSale();
  await loadData();
  setSaving(false);
}

  const manualTotal = useMemo(() => {
    return manualLines.reduce((acc, line) => {
      return acc + Number(line.kilos || 0) * Number(line.price || 0);
    }, 0);
  }, [manualLines]);

  if (loading) {
    return (
      <div style={loadingPageStyle}>
        <div style={loadingCardStyle}>Cargando cobranza...</div>
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
            <h1 style={{ margin: 0, color: COLORS.text }}>Cobranza</h1>
            <p style={{ margin: "6px 0 0 0", color: COLORS.muted }}>
              Tickets reales conectados a Supabase
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/" style={secondaryButtonStyle}>Inicio</Link>
            <Link href="/pedidos" style={secondaryButtonStyle}>Pedidos</Link>
            <Link href="/admin/cxc" style={secondaryButtonStyle}>CxC</Link>
            <Link href="/admin/dashboard" style={secondaryButtonStyle}>Dashboard</Link>
            <Link href="/admin/caja" style={secondaryButtonStyle}>Caja</Link>
          </div>
        </div>

        <div style={tabsCardStyle}>
          <button
            onClick={() => setTab("ticket")}
            style={{
              ...tabButtonStyle,
              background: tab === "ticket" ? COLORS.primary : "white",
              color: tab === "ticket" ? "white" : COLORS.text,
            }}
          >
            Ticket existente
          </button>

          <button
            onClick={() => setTab("manual")}
            style={{
              ...tabButtonStyle,
              background: tab === "manual" ? COLORS.primary : "white",
              color: tab === "manual" ? "white" : COLORS.text,
            }}
          >
            Venta manual
          </button>
        </div>

        {tab === "ticket" ? (
          <div style={mainGridStyle}>
            <div style={leftColumnStyle}>
              <div style={panelStyle}>
                <div style={panelHeaderStyle}>
                  <div>
                    <h2 style={panelTitleStyle}>Buscar ticket</h2>
                    <p style={panelSubtitleStyle}>
                      Ya conectado a órdenes reales
                    </p>
                  </div>
                </div>

                <input
  placeholder="Escanea QR, folio TK-xxx, ID o nombre de cliente"
  value={ticketSearch}
  onChange={(e) => {
    setTicketSearch(e.target.value);
  }}
  autoFocus
  onKeyDown={async (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const raw = ticketSearch.trim();
      if (!raw) return;

      const { full, short: shortCode } = extractTicketId(raw);

      // 1) Buscar match local primero (rápido)
      const localMatch = tickets.find((ticket) => {
        const id = String(ticket.id).toLowerCase();
        const short = id.slice(0, 6);
        if (full && id === full) return true;
        if (shortCode && short === shortCode) return true;
        if (id.includes(raw.toLowerCase())) return true;
        return false;
      });

      if (localMatch) {
        openTicket(localMatch.id);
        setTicketSearch("");
        return;
      }

      // 2) Si no hay match local, buscar directo en Supabase
      const found = await searchTicketDirect(raw);
      if (found) {
        setTicketSearch("");
      } else {
        // 3) Si tampoco hay en Supabase, puede ser nombre de cliente
        // (el filtro visual de la lista ya lo muestra)
        if (!full && !shortCode) return;
        alert("No se encontró ticket con ese folio o ID");
      }
    }
  }}
  style={inputStyle}
/>
                <div style={{ marginTop: 14 }}>
                  <div style={miniTitleStyle}>Pendientes recientes</div>

                  <div style={listWrapStyle}>
                    {filteredTickets.length === 0 ? (
                      <div style={emptyBoxStyle}>No hay tickets pendientes</div>
                    ) : (
                      filteredTickets.map((ticket) => (
                        <button
                          key={ticket.id}
                          onClick={() => openTicket(ticket.id)}
                          style={searchResultCardStyle}
                        >
                          <div style={{ textAlign: "left", minWidth: 0 }}>
                            <div style={searchTitleStyle}>{ticketFolio(ticket.id)}</div>
                            <div style={searchMetaStyle}>
                              Cliente: {ticket.customer_name || "Mostrador"}
                            </div>
                            <div style={searchMetaStyle}>
                              Total: ${money(ticketTotal(ticket))}
                            </div>
                          </div>

                          <div style={badgeStyle}>Abrir</div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div style={rightColumnStyle}>
              <div style={panelStyle}>
                <div style={panelHeaderStyle}>
                  <div>
                    <h2 style={panelTitleStyle}>Detalle del ticket</h2>
                    <p style={panelSubtitleStyle}>Cobro real del ticket</p>
                  </div>
                </div>

                {!selectedTicket ? (
                  <div style={emptyBoxStyle}>Selecciona un ticket para verlo aquí</div>
                ) : (
                  <>
                    <div style={ticketHeaderStyle}>
                      <div>
                        <div style={ticketTitleStyle}>{ticketFolio(selectedTicket.id)}</div>
                        <div style={ticketMetaStyle}>
                          Cliente: <b>{selectedTicket.customer_name || "Mostrador"}</b>
                        </div>
                        <div style={ticketMetaStyle}>
                          Estado: <b>{selectedTicket.payment_status || "pendiente"}</b>
                        </div>
                      </div>

                      <div style={ticketTotalStyle}>
                        ${money(ticketFinalTotal(selectedTicket))}
                      </div>
                    </div>

                    <div style={{ marginTop: 12 }}>
                      {(selectedTicket.order_items || []).length === 0 ? (
                        <div style={emptyBoxStyle}>Este ticket no tiene artículos</div>
                      ) : (
                        (selectedTicket.order_items || []).map((item, index) => (
                          <div key={index} style={itemRowStyle}>
                            <div>
                              <div style={itemNameStyle}>{item.product}</div>
                              <div style={itemMetaStyle}>
                                {item.prepared_kilos && item.prepared_kilos !== item.kilos
                                  ? `${item.prepared_kilos} kg (pedido: ${item.kilos} kg)`
                                  : `${item.kilos} kg`} · ${money(item.price)}
                              </div>
                            </div>

                            <div style={itemTotalStyle}>
                              ${money(Number(item.prepared_kilos || item.kilos || 0) * Number(item.price || 0))}
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Badge mayoreo */}
                    {getCustomerType(selectedTicket) === "mayoreo" && (
                      <div style={mayoreoBadgeStyle}>
                        Este cliente es <b>mayoreo</b> — descuento del 10% ya aplicado en precios
                      </div>
                    )}

                    {/* Sección de descuento */}
                    <div style={discountSectionStyle}>
                      <div style={{ fontWeight: 700, color: COLORS.text, marginBottom: 8 }}>
                        Descuento adicional
                      </div>

                      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                        <button
                          onClick={() => { setDiscountMode("none"); setDiscountValue(""); }}
                          style={{
                            ...discountTabStyle,
                            background: discountMode === "none" ? COLORS.primary : "white",
                            color: discountMode === "none" ? "white" : COLORS.text,
                          }}
                        >
                          Sin descuento
                        </button>
                        <button
                          onClick={() => setDiscountMode("percent")}
                          style={{
                            ...discountTabStyle,
                            background: discountMode === "percent" ? COLORS.primary : "white",
                            color: discountMode === "percent" ? "white" : COLORS.text,
                          }}
                        >
                          % Porcentaje
                        </button>
                        <button
                          onClick={() => setDiscountMode("amount")}
                          style={{
                            ...discountTabStyle,
                            background: discountMode === "amount" ? COLORS.primary : "white",
                            color: discountMode === "amount" ? "white" : COLORS.text,
                          }}
                        >
                          $ Cantidad
                        </button>
                      </div>

                      {discountMode !== "none" && (
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder={discountMode === "percent" ? "Ej: 10" : "Ej: 50.00"}
                          value={discountValue}
                          onChange={(e) => setDiscountValue(e.target.value)}
                          style={inputStyle}
                        />
                      )}
                    </div>

                    {/* Resumen de cobro */}
                    <div style={discountSummaryStyle}>
                      <div style={summaryRowStyle}>
                        <span>Subtotal</span>
                        <span>${money(ticketTotal(selectedTicket))}</span>
                      </div>
                      {calcDiscount(ticketTotal(selectedTicket)) > 0 && (
                        <div style={{ ...summaryRowStyle, color: COLORS.success }}>
                          <span>Descuento {discountMode === "percent" ? `(${discountValue}%)` : ""}</span>
                          <span>-${money(calcDiscount(ticketTotal(selectedTicket)))}</span>
                        </div>
                      )}
                      <div style={{ ...summaryRowStyle, fontWeight: 800, fontSize: 18 }}>
                        <span>Total a cobrar</span>
                        <span>${money(ticketFinalTotal(selectedTicket))}</span>
                      </div>
                    </div>

                    <div style={actionsGridStyle}>
                      <button
                        onClick={() => markTicketPaid("efectivo")}
                        style={successButtonStyle}
                        disabled={saving}
                      >
                        Cobrar efectivo
                      </button>

                      <button
                        onClick={() => markTicketPaid("tarjeta")}
                        style={infoButtonStyle}
                        disabled={saving}
                      >
                        Cobrar tarjeta
                      </button>

                      <button
                        onClick={() => markTicketPaid("transferencia")}
                        style={secondaryActionButtonStyle}
                        disabled={saving}
                      >
                        Transferencia
                      </button>

                      <button
                        onClick={sendTicketToCredit}
                        style={warningButtonStyle}
                        disabled={saving}
                      >
                        Mandar a crédito
                      </button>
                    </div>

                    <button
                      onClick={cancelTicket}
                      style={dangerButtonStyle}
                      disabled={saving}
                    >
                      Cancelar ticket
                    </button>

                    {/* Modal ticket imprimible */}
                    {showPrintTicket && selectedTicket && (
                      <div style={printOverlayStyle}>
                        <div style={printModalStyle}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                            <button
                              onClick={() => {
                                const el = document.getElementById("printable-ticket");
                                if (el) {
                                  const win = window.open("", "_blank", "width=400,height=600");
                                  if (win) {
                                    // Reemplazar src relativo por absoluto para el logo
                                    let html = el.innerHTML;
                                    html = html.replace(
                                      /src="\/logo\.png"/g,
                                      `src="${window.location.origin}/logo.png"`
                                    );
                                    win.document.write(`<html><head><title>Ticket</title><style>
                                      body { font-family: monospace; font-size: 12px; width: 280px; margin: 0 auto; padding: 10px; }
                                      .center { text-align: center; }
                                      img { display: block; margin: 0 auto 4px auto; }
                                      .line { border-top: 1px dashed #000; margin: 6px 0; }
                                      .row { display: flex; justify-content: space-between; margin: 2px 0; }
                                      @media print { button { display: none; } }
                                    </style></head><body>`);
                                    win.document.write(html);
                                    win.document.write("</body></html>");
                                    win.document.close();
                                    // Esperar a que cargue el logo antes de imprimir
                                    win.onload = () => win.print();
                                  }
                                }
                              }}
                              style={successButtonStyle}
                            >
                              Imprimir ticket
                            </button>
                            <button onClick={closePrintAndReset} style={secondaryActionButtonStyle}>
                              Cerrar
                            </button>
                          </div>

                          <div id="printable-ticket" style={{ fontFamily: "monospace", fontSize: 12, maxWidth: 300 }}>
                            <div style={{ textAlign: "center", marginBottom: 8 }}>
                              <img
                                src="/logo.png"
                                alt="Sergio's Carnicería"
                                style={{ width: 120, height: "auto", marginBottom: 4 }}
                                data-print-src={`${typeof window !== "undefined" ? window.location.origin : ""}/logo.png`}
                              />
                              <div style={{ fontWeight: 800, fontSize: 14 }}>SERGIO&apos;S CARNICERÍA</div>
                              <div style={{ fontSize: 11, color: "#666" }}>sergioscarniceria.com</div>
                            </div>

                            <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

                            <div style={{ marginBottom: 4 }}>
                              <b>Folio:</b> {ticketFolio(selectedTicket.id)}
                            </div>
                            <div style={{ marginBottom: 4 }}>
                              <b>Cliente:</b> {selectedTicket.customer_name || "Mostrador"}
                            </div>
                            <div style={{ marginBottom: 4 }}>
                              <b>Fecha:</b> {new Date().toLocaleDateString("es-MX")} {new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                            </div>

                            {getCustomerType(selectedTicket) === "mayoreo" && (
                              <div style={{ background: "#f0e6d0", padding: "3px 6px", borderRadius: 4, fontSize: 11, margin: "4px 0" }}>
                                Cliente mayoreo — precios con 10% desc.
                              </div>
                            )}

                            <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

                            {(selectedTicket.order_items || []).map((item, i) => {
                              const kg = Number(item.prepared_kilos || item.kilos || 0);
                              const lineTotal = kg * Number(item.price || 0);
                              return (
                                <div key={i} style={{ marginBottom: 6 }}>
                                  <div style={{ fontWeight: 700 }}>{item.product}</div>
                                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                                    <span>
                                      {kg} kg x ${money(item.price)}
                                      {item.prepared_kilos && item.prepared_kilos !== item.kilos
                                        ? ` (ped: ${item.kilos})`
                                        : ""}
                                    </span>
                                    <span>${money(lineTotal)}</span>
                                  </div>
                                </div>
                              );
                            })}

                            <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

                            <div style={{ display: "flex", justifyContent: "space-between", margin: "2px 0" }}>
                              <span>Subtotal</span>
                              <span>${money(ticketTotal(selectedTicket))}</span>
                            </div>

                            {calcDiscount(ticketTotal(selectedTicket)) > 0 && (
                              <div style={{ display: "flex", justifyContent: "space-between", margin: "2px 0", color: "#1f7a4d" }}>
                                <span>Descuento {discountMode === "percent" ? `(${discountValue}%)` : ""}</span>
                                <span>-${money(calcDiscount(ticketTotal(selectedTicket)))}</span>
                              </div>
                            )}

                            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 16, margin: "8px 0" }}>
                              <span>TOTAL</span>
                              <span>${money(ticketFinalTotal(selectedTicket))}</span>
                            </div>

                            <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

                            <div style={{ textAlign: "center", fontSize: 11, color: "#666" }}>
                              ¡Gracias por su compra!
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div style={mainGridStyle}>
            <div style={leftColumnStyle}>
              <div style={panelStyle}>
                <div style={panelHeaderStyle}>
                  <div>
                    <h2 style={panelTitleStyle}>Venta manual</h2>
                    <p style={panelSubtitleStyle}>Respaldo temporal de caja</p>
                  </div>
                </div>

                <div style={fieldBlockStyle}>
  <div style={fieldLabelStyle}>Cliente</div>

  <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
    <button
      onClick={() => setCustomerMode("general")}
      style={{
        ...tabButtonStyle,
        background: customerMode === "general" ? COLORS.primary : "white",
        color: customerMode === "general" ? "white" : COLORS.text,
      }}
    >
      Público en general
    </button>

    <button
      onClick={() => setCustomerMode("existente")}
      style={{
        ...tabButtonStyle,
        background: customerMode === "existente" ? COLORS.primary : "white",
        color: customerMode === "existente" ? "white" : COLORS.text,
      }}
    >
      Cliente existente
    </button>
  </div>
{showNewCustomer && (
  <div
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.35)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999,
      padding: 16,
    }}
  >
    <div
      style={{
        width: "100%",
        maxWidth: 420,
        background: "white",
        borderRadius: 20,
        padding: 20,
        boxShadow: COLORS.shadow,
        border: `1px solid ${COLORS.border}`,
      }}
    >
      <h3 style={{ marginTop: 0, color: COLORS.text }}>Cliente nuevo</h3>

      <div style={fieldBlockStyle}>
        <div style={fieldLabelStyle}>Nombre</div>
        <input
          value={newCustomerName}
          onChange={(e) => setNewCustomerName(e.target.value)}
          placeholder="Nombre del cliente"
          style={inputStyle}
        />
      </div>

      <div style={fieldBlockStyle}>
        <div style={fieldLabelStyle}>Teléfono</div>
        <input
          value={newCustomerPhone}
          onChange={(e) => setNewCustomerPhone(e.target.value)}
          placeholder="Teléfono"
          style={inputStyle}
        />
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <button
          onClick={createNewCustomer}
          style={successButtonStyle}
        >
          Guardar cliente
        </button>

        <button
          onClick={() => setShowNewCustomer(false)}
          style={secondaryActionButtonStyle}
        >
          Cancelar
        </button>
      </div>
    </div>
  </div>
)}
  {customerMode === "existente" ? (
    <>
      <select
        value={selectedCustomerId}
        onChange={(e) => setSelectedCustomerId(e.target.value)}
        style={inputStyle}
      >
        <option value="">Seleccionar cliente</option>
        {customers.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      <button
        onClick={() => setShowNewCustomer(true)}
        style={secondaryActionButtonStyle}
      >
        + Cliente nuevo
      </button>
    </>
  ) : (
    <div style={{ color: COLORS.muted }}>
      Se registrará como público en general
    </div>
  )}
</div>

                <div style={fieldBlockStyle}>
                  <div style={fieldLabelStyle}>Notas</div>
                  <textarea
                    placeholder="Observaciones"
                    value={manualNotes}
                    onChange={(e) => setManualNotes(e.target.value)}
                    style={textareaStyle}
                  />
                </div>

                <button onClick={addManualLine} style={primaryActionButtonStyle}>
                  + Agregar renglón
                </button>

                <div style={{ marginTop: 14 }}>
                  {manualLines.length === 0 ? (
                    <div style={emptyBoxStyle}>Todavía no agregas renglones</div>
                  ) : (
                    manualLines.map((line) => (
                      <div key={line.id} style={manualRowStyle}>
                        <input
                          value={line.product}
                          onChange={(e) =>
                            updateManualLine(line.id, "product", e.target.value)
                          }
                          placeholder="Producto"
                          style={inputMiniStyle}
                        />

                        <input
                          value={line.kilos}
                          onChange={(e) =>
                            updateManualLine(line.id, "kilos", e.target.value)
                          }
                          placeholder="Kilos"
                          style={inputMiniStyle}
                        />

                        <input
                          value={line.price}
                          onChange={(e) =>
                            updateManualLine(line.id, "price", e.target.value)
                          }
                          placeholder="Precio"
                          style={inputMiniStyle}
                        />

                        <button
                          onClick={() => removeManualLine(line.id)}
                          style={dangerMiniButtonStyle}
                        >
                          X
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div style={rightColumnStyle}>
              <div style={panelStyle}>
                <div style={panelHeaderStyle}>
                  <div>
                    <h2 style={panelTitleStyle}>Resumen venta manual</h2>
                    <p style={panelSubtitleStyle}>Solo visual por ahora</p>
                  </div>
                </div>

                <div style={summaryCardStyle}>
                  <div style={summaryRowStyle}>
                    <span>Cliente</span>
                    <b>{customerMode === "existente"
  ? customers.find((c) => c.id === selectedCustomerId)?.name || "Cliente existente"
  : "Público general"}</b>
                  </div>

                  <div style={summaryRowStyle}>
                    <span>Renglones</span>
                    <b>{manualLines.length}</b>
                  </div>

                  <div style={summaryRowStyle}>
                    <span>Total</span>
                    <b>${money(manualTotal)}</b>
                  </div>
                </div>
                <div style={actionsGridStyle}>
  <button
    onClick={() => saveManualSale("efectivo")}
    style={successButtonStyle}
    disabled={saving}
  >
    Cobrar efectivo
  </button>

  <button
    onClick={() => saveManualSale("tarjeta")}
    style={infoButtonStyle}
    disabled={saving}
  >
    Cobrar tarjeta
  </button>

  <button
    onClick={() => saveManualSale("transferencia")}
    style={secondaryActionButtonStyle}
    disabled={saving}
  >
    Transferencia
  </button>

  <button
    onClick={saveManualCredit}
    style={warningButtonStyle}
    disabled={saving}
  >
    Crédito
  </button>
</div>

                <button onClick={clearManualSale} style={dangerButtonStyle}>
                  Limpiar venta manual
                </button>
              </div>
            </div>
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
  padding: 20,
  borderRadius: 18,
  background: COLORS.card,
  border: `1px solid ${COLORS.border}`,
  boxShadow: COLORS.shadow,
};

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  padding: 16,
  background: `linear-gradient(180deg, ${COLORS.bgSoft} 0%, ${COLORS.bg} 100%)`,
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
  maxWidth: 1480,
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

const tabsCardStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  background: COLORS.card,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 22,
  padding: 12,
  boxShadow: COLORS.shadow,
  marginBottom: 20,
};

const tabButtonStyle: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: 14,
  border: "none",
  cursor: "pointer",
  fontWeight: 800,
};

const mainGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.1fr) minmax(360px, 0.9fr)",
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
  border: `1px solid ${COLORS.border}`,
  borderRadius: 24,
  padding: 18,
  boxShadow: COLORS.shadow,
};

const panelHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
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

const fieldBlockStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  marginBottom: 14,
};

const fieldLabelStyle: React.CSSProperties = {
  color: COLORS.muted,
  fontWeight: 700,
  fontSize: 14,
};

const primaryActionButtonStyle: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: 14,
  border: "none",
  background: `linear-gradient(180deg, ${COLORS.primary} 0%, ${COLORS.primaryDark} 100%)`,
  color: "white",
  cursor: "pointer",
  fontWeight: 800,
  boxShadow: "0 8px 18px rgba(123, 34, 24, 0.20)",
};

const secondaryActionButtonStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 14,
  border: `1px solid ${COLORS.border}`,
  background: "white",
  color: COLORS.text,
  cursor: "pointer",
  fontWeight: 700,
};

const successButtonStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 14,
  border: "none",
  background: "rgba(31,122,77,0.12)",
  color: COLORS.success,
  cursor: "pointer",
  fontWeight: 800,
};

const infoButtonStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 14,
  border: "none",
  background: "rgba(53,92,125,0.12)",
  color: COLORS.info,
  cursor: "pointer",
  fontWeight: 800,
};

const warningButtonStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 14,
  border: "none",
  background: "rgba(166,106,16,0.12)",
  color: COLORS.warning,
  cursor: "pointer",
  fontWeight: 800,
};

const dangerButtonStyle: React.CSSProperties = {
  width: "100%",
  marginTop: 12,
  padding: "12px 14px",
  borderRadius: 14,
  border: "none",
  background: "rgba(180,35,24,0.10)",
  color: COLORS.danger,
  cursor: "pointer",
  fontWeight: 800,
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

const listWrapStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const searchResultCardStyle: React.CSSProperties = {
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

const searchTitleStyle: React.CSSProperties = {
  fontWeight: 800,
  color: COLORS.text,
};

const searchMetaStyle: React.CSSProperties = {
  color: COLORS.muted,
  fontSize: 13,
  marginTop: 4,
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

const miniTitleStyle: React.CSSProperties = {
  color: COLORS.text,
  fontWeight: 800,
  marginBottom: 10,
  fontSize: 18,
};

const ticketHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  padding: 14,
  borderRadius: 18,
  background: COLORS.bgSoft,
  border: `1px solid ${COLORS.border}`,
  marginBottom: 14,
};

const ticketTitleStyle: React.CSSProperties = {
  color: COLORS.text,
  fontWeight: 800,
  fontSize: 22,
  lineHeight: 1.1,
};

const ticketMetaStyle: React.CSSProperties = {
  color: COLORS.muted,
  fontSize: 14,
  marginTop: 6,
};

const ticketTotalStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 16,
  background: COLORS.primary,
  color: "white",
  fontWeight: 800,
  fontSize: 22,
  whiteSpace: "nowrap",
};

const itemRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  padding: 14,
  background: COLORS.bgSoft,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 16,
  marginBottom: 10,
};

const itemNameStyle: React.CSSProperties = {
  color: COLORS.text,
  fontWeight: 700,
  fontSize: 16,
};

const itemMetaStyle: React.CSSProperties = {
  color: COLORS.muted,
  fontSize: 13,
  marginTop: 4,
};

const itemTotalStyle: React.CSSProperties = {
  color: COLORS.text,
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const summaryCardStyle: React.CSSProperties = {
  background: COLORS.bgSoft,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 18,
  padding: 14,
  display: "grid",
  gap: 10,
};

const summaryRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  color: COLORS.text,
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

const manualRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.4fr) 120px 120px auto",
  gap: 10,
  alignItems: "center",
  padding: 12,
  background: COLORS.bgSoft,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 16,
  marginBottom: 10,
};

const inputMiniStyle: React.CSSProperties = {
  width: "100%",
  padding: 10,
  borderRadius: 12,
  border: `1px solid ${COLORS.border}`,
  boxSizing: "border-box",
  outline: "none",
  background: "white",
  color: COLORS.text,
  fontSize: 14,
};

const dangerMiniButtonStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "none",
  background: "rgba(180,35,24,0.10)",
  color: COLORS.danger,
  cursor: "pointer",
  fontWeight: 800,
};

const emptyBoxStyle: React.CSSProperties = {
  padding: 16,
  borderRadius: 18,
  background: COLORS.bgSoft,
  border: `1px dashed ${COLORS.border}`,
  color: COLORS.muted,
};

const actionsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
  marginTop: 16,
};

const mayoreoBadgeStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 14,
  background: "rgba(166,106,16,0.12)",
  color: COLORS.warning,
  fontWeight: 600,
  fontSize: 14,
  marginTop: 12,
};

const discountSectionStyle: React.CSSProperties = {
  marginTop: 14,
  padding: 14,
  borderRadius: 18,
  background: COLORS.bgSoft,
  border: `1px solid ${COLORS.border}`,
};

const discountTabStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 12,
  border: `1px solid ${COLORS.border}`,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 13,
};

const discountSummaryStyle: React.CSSProperties = {
  marginTop: 14,
  padding: 14,
  borderRadius: 18,
  background: COLORS.bgSoft,
  border: `1px solid ${COLORS.border}`,
  display: "grid",
  gap: 8,
};

const printOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.4)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
  padding: 16,
};

const printModalStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 420,
  maxHeight: "90vh",
  overflowY: "auto",
  background: "white",
  borderRadius: 20,
  padding: 20,
  boxShadow: COLORS.shadow,
  border: `1px solid ${COLORS.border}`,
};