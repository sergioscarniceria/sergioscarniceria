"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { logAudit } from "@/lib/audit-log";
import QrScanner from "@/components/QrScanner";
import { smartPrintTicket, smartPrintCreditTicket, openCashDrawer, type TicketData } from "@/lib/printer";
import PrinterButton from "@/components/PrinterButton";

type TabMode = "ticket" | "manual" | "historial";
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
  const [showCreditPrint, setShowCreditPrint] = useState(false);
  const [creditPrintTicket, setCreditPrintTicket] = useState<TicketData | null>(null);
  const [showQrScanner, setShowQrScanner] = useState(false);

  // Modo edición de ticket
  const [editMode, setEditMode] = useState(false);
  const [editedItems, setEditedItems] = useState<OrderItem[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);

  // Reset edit mode cuando cambia el ticket seleccionado
  useEffect(() => {
    setEditMode(false);
    setEditedItems([]);
  }, [selectedTicket?.id]);

  // Modo fullscreen POS
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    function onFsChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  // Historial reimpresión
  const [historialSearch, setHistorialSearch] = useState("");
  const [historialResults, setHistorialResults] = useState<Ticket[]>([]);
  const [historialLoading, setHistorialLoading] = useState(false);
  const [historialTicket, setHistorialTicket] = useState<Ticket | null>(null);

  // Identificación cajera
  const [cashierName, setCashierName] = useState("");
  const [cashierCode, setCashierCode] = useState("");
  const [cashierVerified, setCashierVerified] = useState(false);
  const [cashierError, setCashierError] = useState("");

  async function verifyCashier() {
    if (!cashierCode.trim()) { setCashierError("Ingresa tu código"); return; }
    const { data } = await supabase
      .from("employee_codes")
      .select("name, code")
      .eq("code", cashierCode.trim())
      .eq("role", "cajera")
      .eq("is_active", true)
      .single();
    if (!data) { setCashierError("Código incorrecto"); return; }
    setCashierName(data.name);
    setCashierVerified(true);
    setCashierError("");
  }

  // Scanner detection: el escáner USB escribe muy rápido (< 50ms entre chars)
  const scanBufferRef = useRef("");
  const scanTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleScannerInput = useCallback(async (scannedText: string) => {
    const trimmed = scannedText.trim();
    if (!trimmed || trimmed.length < 4) return;

    // Detectar QR de cliente: formato "CLI-<uuid>"
    const clientMatch = trimmed.match(/^CLI-([0-9a-f-]{36})$/i);
    if (clientMatch) {
      const custId = clientMatch[1].toLowerCase();
      // Filtrar tickets del cliente
      const customerTickets = tickets.filter(
        (t) => t.customer_id?.toLowerCase() === custId && t.payment_status !== "pagado" && t.payment_status !== "cancelado"
      );
      if (customerTickets.length === 1) {
        openTicket(customerTickets[0].id);
      } else if (customerTickets.length > 1) {
        // Mostrar tickets filtrados por cliente
        setTicketSearch(custId.slice(0, 8));
      } else {
        // Buscar nombre del cliente para mostrar mensaje
        const cust = customers.find((c) => c.id?.toLowerCase() === custId);
        setTicketSearch(cust ? cust.name : custId.slice(0, 8));
      }
      return;
    }

    // Buscar ticket con el texto escaneado
    const { full, short: shortCode } = extractTicketId(trimmed);

    // Primero buscar en tickets locales
    const localMatch = tickets.find((ticket) => {
      const id = String(ticket.id).toLowerCase();
      const short = id.slice(0, 6);
      if (full && id === full) return true;
      if (shortCode && short === shortCode) return true;
      return false;
    });

    if (localMatch) {
      openTicket(localMatch.id);
      setTicketSearch("");
      return;
    }

    // Si no hay match local, buscar en Supabase
    const found = await searchTicketDirect(trimmed);
    if (found) {
      setTicketSearch("");
    }
  }, [tickets, customers]);

  // Handler para cámara QR
  function handleQrScan(data: string) {
    setShowQrScanner(false);
    handleScannerInput(data);
  }

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
      return (
        ticket.payment_status !== "pagado" &&
        ticket.payment_status !== "cancelado" &&
        ticket.payment_status !== "credito_autorizado" &&
        ticket.payment_status !== "credito"
      );
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
          cashier_name: cashierName || null,
        },
      ]);

    if (cashError) {
      console.log(cashError);
      alert("Se marcó como pagado, pero falló el movimiento de caja");
      setSaving(false);
      return;
    }

    // Descontar inventario de complementos (productos por pieza)
    if (selectedTicket.order_items) {
      for (const item of selectedTicket.order_items) {
        if (item.sale_type === "pieza" && (item as any).quantity) {
          // Buscar producto
          const { data: prod } = await supabase
            .from("products")
            .select("id, stock, category, fixed_piece_price")
            .eq("name", item.product)
            .single();
          if (prod && (prod.category === "Complementos" || (prod.fixed_piece_price !== null && prod.fixed_piece_price > 0))) {
            const prevStock = prod.stock || 0;
            const qty = Number((item as any).quantity || 0);
            const newStock = Math.max(0, prevStock - qty);
            await supabase.from("products").update({ stock: newStock }).eq("id", prod.id);
            await supabase.from("inventory_movements").insert({
              item_type: "complemento",
              item_id: prod.id,
              movement_type: "salida",
              quantity: qty,
              previous_stock: prevStock,
              new_stock: newStock,
              notes: `Venta ticket ${selectedTicket.id.slice(0, 6)}`,
              created_by: cashierName || "cajera",
            });
          }
        }
      }
    }

    // Guardar nombre de cajera en la orden
    if (cashierName) {
      await supabase.from("orders").update({ cashier_name: cashierName }).eq("id", selectedTicket.id);
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

  // ── Edición de ticket ──────────────────────────────────────
  function startEditMode() {
    if (!selectedTicket?.order_items) return;
    setEditedItems(selectedTicket.order_items.map((item) => ({ ...item })));
    setEditMode(true);
  }

  function cancelEditMode() {
    setEditMode(false);
    setEditedItems([]);
  }

  function updateEditedItem(index: number, field: "kilos" | "price", value: string) {
    setEditedItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: Number(value) || 0 };
      // Si editan kilos, también actualizar prepared_kilos para que el total refleje el cambio
      if (field === "kilos") {
        copy[index].prepared_kilos = Number(value) || 0;
      }
      return copy;
    });
  }

  function removeEditedItem(index: number) {
    setEditedItems((prev) => prev.filter((_, i) => i !== index));
  }

  function editedTotal() {
    return editedItems.reduce((sum, item) => {
      const qty = Number(item.prepared_kilos || item.kilos || 0);
      return sum + qty * Number(item.price || 0);
    }, 0);
  }

  async function saveTicketEdits() {
    if (!selectedTicket) return;
    if (editedItems.length === 0) {
      alert("No puedes dejar el ticket sin productos. Mejor cancélalo.");
      return;
    }

    setSavingEdit(true);

    try {
      const originalItems = selectedTicket.order_items || [];

      // 1. Borrar items actuales de este order
      await supabase.from("order_items").delete().eq("order_id", selectedTicket.id);

      // 2. Insertar items editados
      const newItems = editedItems.map((item) => ({
        order_id: selectedTicket.id,
        product: item.product,
        kilos: item.kilos,
        price: item.price,
        prepared_kilos: item.prepared_kilos || null,
        sale_type: item.sale_type || null,
      }));

      const { error: insertError } = await supabase.from("order_items").insert(newItems);

      if (insertError) {
        alert("Error guardando items: " + insertError.message);
        setSavingEdit(false);
        return;
      }

      // 3. Marcar orden como editada + guardar snapshot original
      await supabase
        .from("orders")
        .update({
          edited_at: new Date().toISOString(),
          edited_by: cashierName || "cajera",
          original_items: originalItems,
        })
        .eq("id", selectedTicket.id);

      // 4. Registrar en audit_log
      logAudit({
        action: "orden_editada",
        user_role: "cajera",
        user_label: cashierName || "cajera",
        entity_type: "order",
        entity_id: selectedTicket.id,
        amount: editedTotal(),
        details: {
          original_items: originalItems.map((i) => ({
            product: i.product,
            kilos: i.kilos,
            price: i.price,
            prepared_kilos: i.prepared_kilos,
          })),
          edited_items: editedItems.map((i) => ({
            product: i.product,
            kilos: i.kilos,
            price: i.price,
            prepared_kilos: i.prepared_kilos,
          })),
          original_total: ticketTotal(selectedTicket),
          new_total: editedTotal(),
          difference: editedTotal() - ticketTotal(selectedTicket),
        },
      });

      // 5. Actualizar estado local
      const updatedTicket: Ticket = {
        ...selectedTicket,
        order_items: editedItems,
      };
      setSelectedTicket(updatedTicket);
      setEditMode(false);
      setEditedItems([]);
      await loadData();

      alert("Ticket actualizado correctamente");
    } catch (err) {
      alert("Error al guardar: " + String(err));
    } finally {
      setSavingEdit(false);
    }
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

    // Imprimir 2 tickets con pagaré integrado
    const creditTicket: TicketData = {
      folio: ticketFolio(selectedTicket.id),
      customerName: customer.name,
      attendant: null,
      cashier: null,
      items: (selectedTicket.order_items || []).map((item) => ({
        product: item.product,
        kilos: item.kilos,
        price: item.price,
        quantity: null,
        sale_type: item.sale_type,
        is_fixed_price_piece: false,
        prepared_kilos: item.prepared_kilos,
      })),
      subtotal: total,
      total: total,
      paymentMethod: "credito",
      qrData: selectedTicket.id,
      type: "cobro",
      dueDate: dueDate,
      creditDays: Number(customer.credit_days || 7),
    };
    // Mostrar modal de impresión de crédito con pagaré
    setCreditPrintTicket(creditTicket);
    setShowCreditPrint(true);

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
        cashier_name: cashierName || null,
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

  // Imprimir 2 tickets con pagaré integrado
  const creditTicket: TicketData = {
    folio: ticketFolio(orderData.id),
    customerName: cleanCustomerName,
    attendant: null,
    cashier: cashierName || null,
    items: manualLines.map((ln) => ({
      product: ln.product.trim(),
      kilos: Number(ln.kilos || 0),
      price: Number(ln.price || 0),
      quantity: null,
      sale_type: "kg",
      is_fixed_price_piece: false,
      prepared_kilos: null,
    })),
    subtotal: manualTotal,
    total: manualTotal,
    paymentMethod: "credito",
    qrData: orderData.id,
    type: "cobro",
    dueDate: dueDate,
    creditDays: Number(selected.credit_days || 7),
  };
  // Mostrar modal de impresión de crédito con pagaré
  setCreditPrintTicket(creditTicket);
  setShowCreditPrint(true);

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
        cashier_name: cashierName || null,
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
      cashier_name: cashierName || null,
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

  // Buscar tickets pagados para reimpresión
  async function searchHistorial() {
    const q = historialSearch.trim();
    if (!q) return;
    setHistorialLoading(true);
    setHistorialTicket(null);

    const { full, short: shortCode } = extractTicketId(q);

    // Buscar por ID exacto
    if (full) {
      const { data } = await supabase
        .from("orders")
        .select("id, customer_id, customer_name, status, source, notes, created_at, payment_status, payment_method, paid_at, canceled_at, order_items(*)")
        .eq("id", full)
        .single();
      if (data) {
        setHistorialResults([data as Ticket]);
        setHistorialLoading(false);
        return;
      }
    }

    // Buscar por folio parcial o nombre
    const { data } = await supabase
      .from("orders")
      .select("id, customer_id, customer_name, status, source, notes, created_at, payment_status, payment_method, paid_at, canceled_at, order_items(*)")
      .or(`id.ilike.${shortCode || q}%,customer_name.ilike.%${q}%`)
      .in("payment_status", ["pagado", "credito_autorizado", "credito", "cancelado"])
      .order("created_at", { ascending: false })
      .limit(10);

    setHistorialResults((data as Ticket[]) || []);
    setHistorialLoading(false);
  }

  function selectHistorialTicket(ticket: Ticket) {
    setHistorialTicket(ticket);
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

  // Pantalla de verificación de cajera
  if (!cashierVerified) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(180deg, #fbf8f3 0%, #f7f1e8 100%)`, fontFamily: "Arial, sans-serif" }}>
        <div style={{ background: "rgba(255,255,255,0.92)", borderRadius: 22, padding: 32, maxWidth: 380, width: "90%", boxShadow: "0 10px 30px rgba(91,25,15,0.08)", border: `1px solid rgba(92,27,17,0.10)`, textAlign: "center" }}>
          <img src="/logo.png" alt="Sergios" style={{ width: 80, marginBottom: 16 }} />
          <h2 style={{ margin: "0 0 6px", color: COLORS.text }}>Identificación de cajera</h2>
          <p style={{ margin: "0 0 20px", color: COLORS.muted, fontSize: 14 }}>Ingresa tu código para acceder a cobranza</p>
          <input
            value={cashierCode}
            onChange={(e) => { setCashierCode(e.target.value); setCashierError(""); }}
            onKeyDown={(e) => e.key === "Enter" && verifyCashier()}
            type="password"
            placeholder="Tu código"
            autoFocus
            style={{ width: "100%", padding: "18px 16px", borderRadius: 16, border: `1px solid rgba(92,27,17,0.10)`, outline: "none", fontSize: 22, textAlign: "center", letterSpacing: 8, marginBottom: 12, background: "rgba(255,255,255,0.85)", color: COLORS.text, minHeight: 60 }}
          />
          {cashierError && <p style={{ color: COLORS.danger, fontSize: 14, margin: "0 0 10px", fontWeight: 700 }}>{cashierError}</p>}
          <button onClick={verifyCashier} style={{ width: "100%", padding: "18px", borderRadius: 16, border: "none", background: `linear-gradient(180deg, ${COLORS.primary} 0%, ${COLORS.primaryDark} 100%)`, color: "white", fontWeight: 800, fontSize: 18, cursor: "pointer", minHeight: 60 }}>
            Entrar
          </button>
          <Link href="/" style={{ display: "block", marginTop: 16, color: COLORS.muted, fontSize: 13, textDecoration: "none" }}>Volver al inicio</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <PrinterButton />
      <div style={glowTopLeft} />
      <div style={glowTopRight} />

      <div style={shellStyle}>
        <div style={topBarStyle}>
          <div>
            <h1 style={{ margin: 0, color: COLORS.text }}>Cobranza</h1>
            <p style={{ margin: "6px 0 0 0", color: COLORS.muted }}>
              Cajera: <strong>{cashierName}</strong>
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            {/* Modo fullscreen POS */}
            <button
              onClick={toggleFullscreen}
              style={{
                ...secondaryButtonStyle,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                cursor: "pointer",
              }}
            >
              {isFullscreen ? "⬜ Salir" : "🖥️ POS"}
            </button>
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

          <button
            onClick={() => setTab("historial")}
            style={{
              ...tabButtonStyle,
              background: tab === "historial" ? COLORS.primary : "white",
              color: tab === "historial" ? "white" : COLORS.text,
            }}
          >
            🧾 Reimprimir
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

                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
  placeholder="Escanea QR, folio TK-xxx, ID o nombre"
  value={ticketSearch}
  onChange={(e) => {
    const val = e.target.value;
    setTicketSearch(val);

    // Detección de scanner: acumula caracteres rápidos
    // El scanner "escribe" todo en < 100ms, un humano tarda mucho más
    scanBufferRef.current += val.slice(-1);
    if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
    scanTimerRef.current = setTimeout(() => {
      const buffer = scanBufferRef.current;
      scanBufferRef.current = "";
      // Si se acumularon 8+ chars en < 100ms, es scanner
      if (buffer.length >= 8) {
        handleScannerInput(val);
      }
    }, 100);
  }}
  autoFocus
  onKeyDown={async (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      // Limpiar buffer del scanner
      scanBufferRef.current = "";
      if (scanTimerRef.current) clearTimeout(scanTimerRef.current);

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
        if (!full && !shortCode) return;
        alert("No se encontró ticket con ese folio o ID");
      }
    }
  }}
  style={{ ...inputStyle, flex: 1 }}
/>
                <button
                  onClick={() => setShowQrScanner(true)}
                  title="Escanear QR con cámara"
                  style={{
                    padding: "14px 18px",
                    borderRadius: 14,
                    border: `1px solid ${COLORS.border}`,
                    background: COLORS.primary,
                    color: "white",
                    fontWeight: 800,
                    fontSize: 22,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    minHeight: 52,
                    minWidth: 52,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  📷
                </button>
                </div>
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
                            {ticket.status !== "terminado" && (
                              <div style={{ display: "inline-block", padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: "rgba(166,106,16,0.15)", color: COLORS.warning, marginTop: 4, marginBottom: 2 }}>
                                Pendiente de preparación
                              </div>
                            )}
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
                        {selectedTicket.status !== "terminado" && (
                          <div style={{ display: "inline-block", padding: "5px 14px", borderRadius: 999, fontSize: 13, fontWeight: 700, background: "rgba(166,106,16,0.15)", color: COLORS.warning, marginTop: 6 }}>
                            Pendiente de preparación
                          </div>
                        )}
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={ticketTotalStyle}>
                          ${money(editMode ? editedTotal() : ticketFinalTotal(selectedTicket))}
                        </div>
                        {!editMode && (
                          <button
                            onClick={startEditMode}
                            style={{ background: "none", border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "6px 14px", cursor: "pointer", fontSize: 14, fontWeight: 600, color: COLORS.primary }}
                            title="Editar ticket"
                          >
                            ✏️ Editar
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Barra de edición activa */}
                    {editMode && (
                      <div style={{ background: "rgba(37,99,235,0.08)", border: `1px solid ${COLORS.primary}`, borderRadius: 12, padding: "10px 16px", marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: 700, color: COLORS.primary, fontSize: 14 }}>Modo edición activo</span>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={cancelEditMode} style={{ background: "white", border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                            Cancelar
                          </button>
                          <button onClick={saveTicketEdits} disabled={savingEdit} style={{ background: COLORS.success, color: "white", border: "none", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
                            {savingEdit ? "Guardando..." : "Guardar cambios"}
                          </button>
                        </div>
                      </div>
                    )}

                    <div style={{ marginTop: 12 }}>
                      {editMode ? (
                        /* ── Items en modo edición ── */
                        editedItems.length === 0 ? (
                          <div style={emptyBoxStyle}>Sin productos — agrega al menos uno</div>
                        ) : (
                          editedItems.map((item, index) => (
                            <div key={index} style={{ ...itemRowStyle, flexDirection: "column", gap: 8 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                                <div style={itemNameStyle}>{item.product}</div>
                                <button
                                  onClick={() => removeEditedItem(index)}
                                  style={{ background: "rgba(220,38,38,0.1)", color: COLORS.danger, border: "none", borderRadius: 8, padding: "4px 10px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}
                                >
                                  Quitar
                                </button>
                              </div>
                              <div style={{ display: "flex", gap: 8, alignItems: "center", width: "100%" }}>
                                <div style={{ flex: 1 }}>
                                  <label style={{ fontSize: 11, color: COLORS.muted, fontWeight: 600 }}>
                                    {item.sale_type === "pieza" ? "Cantidad" : "Kilos"}
                                  </label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={item.prepared_kilos ?? item.kilos}
                                    onChange={(e) => updateEditedItem(index, "kilos", e.target.value)}
                                    style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 16, fontWeight: 600 }}
                                  />
                                </div>
                                <div style={{ flex: 1 }}>
                                  <label style={{ fontSize: 11, color: COLORS.muted, fontWeight: 600 }}>Precio</label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={item.price}
                                    onChange={(e) => updateEditedItem(index, "price", e.target.value)}
                                    style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 16, fontWeight: 600 }}
                                  />
                                </div>
                                <div style={{ minWidth: 80, textAlign: "right", fontWeight: 800, fontSize: 16 }}>
                                  ${money(Number(item.prepared_kilos || item.kilos || 0) * Number(item.price || 0))}
                                </div>
                              </div>
                            </div>
                          ))
                        )
                      ) : (
                        /* ── Items en modo lectura ── */
                        (selectedTicket.order_items || []).length === 0 ? (
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
                        )
                      )}
                    </div>

                    {/* Badge mayoreo */}
                    {getCustomerType(selectedTicket) === "mayoreo" && (
                      <div style={mayoreoBadgeStyle}>
                        Este cliente es <b>mayoreo</b> — descuento del 10% ya aplicado en precios
                      </div>
                    )}

                    {/* Sección de descuento y cobro — ocultar en modo edición */}
                    {!editMode && (<>
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
                      <div style={{ ...summaryRowStyle, fontWeight: 800, fontSize: 22 }}>
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
                        💵 Cobrar efectivo
                      </button>

                      <button
                        onClick={() => markTicketPaid("tarjeta")}
                        style={infoButtonStyle}
                        disabled={saving}
                      >
                        💳 Cobrar tarjeta
                      </button>

                      <button
                        onClick={() => markTicketPaid("transferencia")}
                        style={secondaryActionButtonStyle}
                        disabled={saving}
                      >
                        📲 Transferencia
                      </button>

                      <button
                        onClick={sendTicketToCredit}
                        style={warningButtonStyle}
                        disabled={saving}
                      >
                        📋 Mandar a crédito
                      </button>
                    </div>

                    <button
                      onClick={cancelTicket}
                      style={dangerButtonStyle}
                      disabled={saving}
                    >
                      ❌ Cancelar ticket
                    </button>
                    </>)}

                    {/* Modal escáner QR */}
                    {showQrScanner && (
                      <QrScanner
                        onScan={handleQrScan}
                        onClose={() => setShowQrScanner(false)}
                      />
                    )}

                    {/* Modal ticket imprimible */}
                    {showPrintTicket && selectedTicket && (
                      <div style={printOverlayStyle}>
                        <div style={printModalStyle}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                            <button
                              onClick={() => {
                                if (!selectedTicket) return;
                                const disc = calcDiscount(ticketTotal(selectedTicket));
                                const ticketForPrint: TicketData = {
                                  folio: ticketFolio(selectedTicket.id),
                                  customerName: selectedTicket.customer_name,
                                  cashier: cashierName || null,
                                  items: (selectedTicket.order_items || []).map((item: any) => ({
                                    product: item.product,
                                    kilos: item.kilos,
                                    price: item.price,
                                    quantity: item.quantity,
                                    sale_type: item.sale_type,
                                    is_fixed_price_piece: item.is_fixed_price_piece,
                                    prepared_kilos: item.prepared_kilos,
                                  })),
                                  subtotal: ticketTotal(selectedTicket),
                                  discount: disc,
                                  total: ticketFinalTotal(selectedTicket),
                                  qrData: selectedTicket.id,
                                  type: "cobro",
                                };
                                smartPrintTicket(ticketForPrint);
                                // Abrir cajón si está conectada la impresora
                                openCashDrawer().catch(() => {});
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

                            <div style={{ textAlign: "center", margin: "8px 0" }}>
                              <img
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(selectedTicket.id)}`}
                                alt="QR"
                                style={{ width: 100, height: 100 }}
                              />
                            </div>

                            <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

                            <div style={{ textAlign: "center", fontSize: 11, color: "#666" }}>
                              ¡Gracias por su compra!
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Modal ticket crédito con pagaré */}
                    {showCreditPrint && creditPrintTicket && (
                      <div style={printOverlayStyle}>
                        <div style={{ ...printModalStyle, maxWidth: 440 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                            <button
                              onClick={async () => {
                                if (!creditPrintTicket) return;
                                await smartPrintCreditTicket(creditPrintTicket);
                              }}
                              style={successButtonStyle}
                            >
                              Imprimir pagaré
                            </button>
                            <button
                              onClick={() => {
                                setShowCreditPrint(false);
                                setCreditPrintTicket(null);
                                setSelectedTicket(null);
                              }}
                              style={secondaryActionButtonStyle}
                            >
                              Cerrar
                            </button>
                          </div>

                          {/* Vista previa del ticket de crédito con pagaré */}
                          {["NEGOCIO", "CLIENTE"].map((copy) => (
                            <div key={copy} style={{ fontFamily: "monospace", fontSize: 13, color: "#000", maxWidth: 320, margin: "0 auto 16px", padding: 14, border: "2px dashed #999", borderRadius: 8, background: "#fff" }}>
                              <div style={{ textAlign: "center", marginBottom: 8 }}>
                                <img
                                  src="/logo.png"
                                  alt="Sergio's Carnicería"
                                  style={{ width: 120, height: "auto", marginBottom: 4 }}
                                />
                                <div style={{ fontWeight: 900, fontSize: 15, color: "#000" }}>SERGIO&apos;S CARNICERÍA</div>
                                <div style={{ fontSize: 11, color: "#333" }}>sergioscarniceria.com</div>
                              </div>

                              <div style={{ textAlign: "center", background: "#e8e8e8", padding: "5px 8px", borderRadius: 4, fontWeight: 800, fontSize: 14, margin: "6px 0", color: "#000" }}>
                                CRÉDITO ({copy})
                              </div>

                              <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

                              <div style={{ marginBottom: 4, color: "#000" }}>
                                <b>Folio:</b> {creditPrintTicket.folio}
                              </div>
                              <div style={{ marginBottom: 4, color: "#000" }}>
                                <b>Cliente:</b> {creditPrintTicket.customerName || "—"}
                              </div>
                              <div style={{ marginBottom: 4, color: "#000" }}>
                                <b>Fecha:</b> {new Date().toLocaleDateString("es-MX")}
                              </div>
                              {creditPrintTicket.dueDate && (
                                <div style={{ marginBottom: 4, color: "#000" }}>
                                  <b>Vence:</b> {creditPrintTicket.dueDate} ({creditPrintTicket.creditDays || 7} días)
                                </div>
                              )}

                              <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

                              {(creditPrintTicket.items || []).map((item, i) => {
                                const kg = Number(item.prepared_kilos || item.kilos || 0);
                                const lineTotal = kg * Number(item.price || 0);
                                return (
                                  <div key={i} style={{ marginBottom: 6, color: "#000" }}>
                                    <div style={{ fontWeight: 800 }}>{item.product}</div>
                                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                                      <span>{kg} kg x ${money(item.price)}</span>
                                      <span style={{ fontWeight: 700 }}>${money(lineTotal)}</span>
                                    </div>
                                  </div>
                                );
                              })}

                              <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

                              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 900, fontSize: 18, margin: "8px 0", color: "#000" }}>
                                <span>TOTAL</span>
                                <span>${money(creditPrintTicket.total)}</span>
                              </div>

                              <div style={{ display: "flex", justifyContent: "space-between", margin: "2px 0", color: "#000" }}>
                                <span>Método:</span>
                                <span style={{ fontWeight: 800 }}>CRÉDITO</span>
                              </div>

                              {/* PAGARÉ */}
                              <div style={{ borderTop: "3px solid #000", margin: "12px 0 6px" }} />
                              <div style={{ textAlign: "center", fontSize: 18, fontWeight: 900, letterSpacing: 3, margin: "6px 0", color: "#000" }}>
                                PAGARÉ
                              </div>
                              <div style={{ borderTop: "3px solid #000", margin: "6px 0" }} />

                              <p style={{ margin: "6px 0", fontSize: 12, color: "#000" }}>
                                Debo y pagaré incondicionalmente a la orden de:
                              </p>
                              <p style={{ fontWeight: 900, fontSize: 14, margin: "4px 0", color: "#000" }}>
                                SERGIO VEGA MARIN
                              </p>
                              <p style={{ margin: "4px 0", fontSize: 12, color: "#000" }}>
                                La cantidad de:
                              </p>
                              <p style={{ fontWeight: 900, fontSize: 20, margin: "6px 0", textAlign: "center", color: "#000" }}>
                                ${money(creditPrintTicket.total)} MXN
                              </p>
                              <p style={{ margin: "4px 0", fontSize: 11, color: "#000" }}>
                                Pagadero a más tardar el día <b>{creditPrintTicket.dueDate || "—"}</b> en el domicilio del acreedor.
                              </p>

                              <div style={{ margin: "24px 0 8px", textAlign: "center" }}>
                                <div style={{ width: "70%", margin: "0 auto 4px", borderBottom: "2px solid #000", height: 35 }} />
                                <div style={{ fontSize: 12, color: "#000" }}>Firma del deudor</div>
                                <div style={{ fontSize: 12, fontWeight: 800, color: "#000" }}>{creditPrintTicket.customerName || "—"}</div>
                              </div>

                              <div style={{ textAlign: "center", margin: "8px 0" }}>
                                <img
                                  src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(creditPrintTicket.qrData || "")}`}
                                  alt="QR"
                                  style={{ width: 90, height: 90 }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        ) : tab === "manual" ? (
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
    💵 Cobrar efectivo
  </button>

  <button
    onClick={() => saveManualSale("tarjeta")}
    style={infoButtonStyle}
    disabled={saving}
  >
    💳 Cobrar tarjeta
  </button>

  <button
    onClick={() => saveManualSale("transferencia")}
    style={secondaryActionButtonStyle}
    disabled={saving}
  >
    📲 Transferencia
  </button>

  <button
    onClick={saveManualCredit}
    style={warningButtonStyle}
    disabled={saving}
  >
    📋 Crédito
  </button>
</div>

                <button onClick={clearManualSale} style={dangerButtonStyle}>
                  🗑️ Limpiar venta manual
                </button>
              </div>
            </div>
          </div>
        ) : tab === "historial" ? (
          <div style={mainGridStyle}>
            <div style={leftColumnStyle}>
              <div style={panelStyle}>
                <div style={panelHeaderStyle}>
                  <div>
                    <h2 style={panelTitleStyle}>Buscar ticket pagado</h2>
                    <p style={panelSubtitleStyle}>Busca por folio, ID o nombre del cliente</p>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    placeholder="Folio TK-xxx, ID o nombre..."
                    value={historialSearch}
                    onChange={(e) => setHistorialSearch(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && searchHistorial()}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button
                    onClick={searchHistorial}
                    disabled={historialLoading}
                    style={{ ...primaryActionButtonStyle, whiteSpace: "nowrap" }}
                  >
                    {historialLoading ? "⏳" : "🔍 Buscar"}
                  </button>
                </div>

                <div style={{ marginTop: 14 }}>
                  <div style={miniTitleStyle}>Resultados</div>
                  <div style={listWrapStyle}>
                    {historialResults.length === 0 ? (
                      <div style={emptyBoxStyle}>
                        {historialLoading ? "Buscando..." : "Busca un ticket para reimprimir"}
                      </div>
                    ) : (
                      historialResults.map((ticket) => (
                        <button
                          key={ticket.id}
                          onClick={() => selectHistorialTicket(ticket)}
                          style={{
                            ...searchResultCardStyle,
                            border: historialTicket?.id === ticket.id
                              ? `2px solid ${COLORS.primary}`
                              : `1px solid ${COLORS.border}`,
                          }}
                        >
                          <div style={{ textAlign: "left", minWidth: 0 }}>
                            <div style={searchTitleStyle}>{ticketFolio(ticket.id)}</div>
                            <div style={searchMetaStyle}>
                              {ticket.customer_name || "Mostrador"} · ${money(ticketTotal(ticket))}
                            </div>
                            <div style={searchMetaStyle}>
                              {ticket.paid_at
                                ? new Date(ticket.paid_at).toLocaleDateString("es-MX", {
                                    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
                                  })
                                : ticket.created_at
                                ? new Date(ticket.created_at).toLocaleDateString("es-MX", {
                                    day: "2-digit", month: "short", year: "numeric"
                                  })
                                : ""}
                            </div>
                          </div>
                          <div style={{
                            ...badgeStyle,
                            background: ticket.payment_status === "pagado"
                              ? "rgba(31,122,77,0.10)"
                              : ticket.payment_status === "cancelado"
                              ? "rgba(180,35,24,0.10)"
                              : "rgba(166,106,16,0.10)",
                            color: ticket.payment_status === "pagado"
                              ? COLORS.success
                              : ticket.payment_status === "cancelado"
                              ? COLORS.danger
                              : COLORS.warning,
                          }}>
                            {ticket.payment_status === "pagado" ? "💰 Pagado"
                              : ticket.payment_status === "cancelado" ? "❌ Cancelado"
                              : "📋 Crédito"}
                          </div>
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
                    <h2 style={panelTitleStyle}>Vista previa</h2>
                    <p style={panelSubtitleStyle}>Revisa y reimprime el ticket</p>
                  </div>
                </div>

                {!historialTicket ? (
                  <div style={emptyBoxStyle}>Selecciona un ticket para ver el detalle</div>
                ) : (
                  <>
                    <div style={ticketHeaderStyle}>
                      <div>
                        <div style={ticketTitleStyle}>{ticketFolio(historialTicket.id)}</div>
                        <div style={ticketMetaStyle}>
                          Cliente: <b>{historialTicket.customer_name || "Mostrador"}</b>
                        </div>
                        <div style={ticketMetaStyle}>
                          Estado: <b>{historialTicket.payment_status || "—"}</b>
                        </div>
                        <div style={ticketMetaStyle}>
                          Método: <b>{historialTicket.payment_method || "—"}</b>
                        </div>
                      </div>
                      <div style={ticketTotalStyle}>
                        ${money(ticketTotal(historialTicket))}
                      </div>
                    </div>

                    <div style={{ marginTop: 12 }}>
                      {(historialTicket.order_items || []).map((item, index) => (
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
                      ))}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 16 }}>
                      <button
                        onClick={() => {
                          if (!historialTicket) return;
                          const total = ticketTotal(historialTicket);
                          const ticketForPrint: TicketData = {
                            folio: ticketFolio(historialTicket.id),
                            customerName: historialTicket.customer_name,
                            cashier: cashierName || null,
                            items: (historialTicket.order_items || []).map((item: any) => ({
                              product: item.product,
                              kilos: item.kilos,
                              price: item.price,
                              quantity: item.quantity,
                              sale_type: item.sale_type,
                              is_fixed_price_piece: item.is_fixed_price_piece,
                              prepared_kilos: item.prepared_kilos,
                            })),
                            subtotal: total,
                            total: total,
                            qrData: historialTicket.id,
                            type: "cobro",
                          };
                          smartPrintTicket(ticketForPrint);
                        }}
                        style={successButtonStyle}
                      >
                        🖨️ Reimprimir ticket
                      </button>

                      <button
                        onClick={() => {
                          if (!historialTicket) return;
                          const total = ticketTotal(historialTicket);
                          const creditTicket: TicketData = {
                            folio: ticketFolio(historialTicket.id),
                            customerName: historialTicket.customer_name,
                            cashier: cashierName || null,
                            attendant: null,
                            items: (historialTicket.order_items || []).map((item: any) => ({
                              product: item.product,
                              kilos: item.kilos,
                              price: item.price,
                              quantity: item.quantity,
                              sale_type: item.sale_type,
                              is_fixed_price_piece: item.is_fixed_price_piece,
                              prepared_kilos: item.prepared_kilos,
                            })),
                            subtotal: total,
                            total: total,
                            paymentMethod: historialTicket.payment_method || "efectivo",
                            qrData: historialTicket.id,
                            type: "cobro",
                          };
                          smartPrintCreditTicket(creditTicket);
                        }}
                        style={infoButtonStyle}
                      >
                        🧾 Reimprimir con pagaré
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : null}
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
  padding: "16px 24px",
  borderRadius: 14,
  border: "none",
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 16,
  minHeight: 52,
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
  padding: "18px 20px",
  borderRadius: 16,
  border: "none",
  background: `linear-gradient(180deg, ${COLORS.primary} 0%, ${COLORS.primaryDark} 100%)`,
  color: "white",
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 16,
  minHeight: 56,
  boxShadow: "0 8px 18px rgba(123, 34, 24, 0.20)",
};

const secondaryActionButtonStyle: React.CSSProperties = {
  padding: "16px 20px",
  borderRadius: 16,
  border: `1px solid ${COLORS.border}`,
  background: "white",
  color: COLORS.text,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 15,
  minHeight: 52,
};

const successButtonStyle: React.CSSProperties = {
  padding: "18px 20px",
  borderRadius: 16,
  border: "none",
  background: "rgba(31,122,77,0.15)",
  color: COLORS.success,
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 16,
  minHeight: 56,
};

const infoButtonStyle: React.CSSProperties = {
  padding: "18px 20px",
  borderRadius: 16,
  border: "none",
  background: "rgba(53,92,125,0.15)",
  color: COLORS.info,
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 16,
  minHeight: 56,
};

const warningButtonStyle: React.CSSProperties = {
  padding: "18px 20px",
  borderRadius: 16,
  border: "none",
  background: "rgba(166,106,16,0.15)",
  color: COLORS.warning,
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 16,
  minHeight: 56,
};

const dangerButtonStyle: React.CSSProperties = {
  width: "100%",
  marginTop: 12,
  padding: "18px 20px",
  borderRadius: 16,
  border: "none",
  background: "rgba(180,35,24,0.10)",
  color: COLORS.danger,
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 16,
  minHeight: 56,
};

const secondaryButtonStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "14px 20px",
  borderRadius: 14,
  border: `1px solid ${COLORS.border}`,
  background: "rgba(255,255,255,0.75)",
  color: COLORS.text,
  textDecoration: "none",
  fontWeight: 700,
  fontSize: 15,
  minHeight: 48,
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
  padding: 18,
  borderRadius: 16,
  border: `1px solid ${COLORS.border}`,
  background: COLORS.bgSoft,
  cursor: "pointer",
  minHeight: 72,
};

const searchTitleStyle: React.CSSProperties = {
  fontWeight: 800,
  color: COLORS.text,
  fontSize: 17,
};

const searchMetaStyle: React.CSSProperties = {
  color: COLORS.muted,
  fontSize: 14,
  marginTop: 4,
};

const badgeStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "10px 16px",
  borderRadius: 999,
  fontSize: 14,
  fontWeight: 700,
  background: "rgba(123, 34, 24, 0.10)",
  color: COLORS.primary,
  flexShrink: 0,
  minHeight: 40,
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
  padding: "16px 20px",
  borderRadius: 16,
  background: COLORS.primary,
  color: "white",
  fontWeight: 800,
  fontSize: 26,
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
  padding: 16,
  borderRadius: 16,
  border: `1px solid ${COLORS.border}`,
  boxSizing: "border-box",
  outline: "none",
  background: "rgba(255,255,255,0.82)",
  color: COLORS.text,
  fontSize: 17,
  minHeight: 52,
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
  padding: 14,
  borderRadius: 14,
  border: `1px solid ${COLORS.border}`,
  boxSizing: "border-box",
  outline: "none",
  background: "white",
  color: COLORS.text,
  fontSize: 16,
  minHeight: 48,
};

const dangerMiniButtonStyle: React.CSSProperties = {
  padding: "14px 16px",
  borderRadius: 14,
  border: "none",
  background: "rgba(180,35,24,0.10)",
  color: COLORS.danger,
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 16,
  minHeight: 48,
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
  gridTemplateColumns: "1fr 1fr",
  gap: 14,
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
  padding: "12px 16px",
  borderRadius: 14,
  border: `1px solid ${COLORS.border}`,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 14,
  minHeight: 48,
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