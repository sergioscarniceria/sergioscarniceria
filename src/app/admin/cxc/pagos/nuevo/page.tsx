"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";

type Customer = {
  id: string;
  name: string;
};

type Note = {
  id: string;
  note_number: string;
  note_date: string;
  due_date: string;
  total_amount: number;
  balance_due: number;
  status: string;
};

type ApplyItem = {
  note_id: string;
  note_number: string;
  balance_due: number;
  apply_amount: string;
};

const COLORS = {
  bg: "#f7f1e8",
  bgSoft: "#fbf8f3",
  card: "rgba(255,255,255,0.82)",
  border: "rgba(92, 27, 17, 0.10)",
  text: "#3b1c16",
  muted: "#7a5a52",
  primary: "#7b2218",
  success: "#1f7a4d",
  danger: "#b42318",
  shadow: "0 10px 30px rgba(91, 25, 15, 0.08)",
};

export default function NuevoPagoPage() {
  const supabase = getSupabaseClient();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("efectivo");
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);

  const [applications, setApplications] = useState<ApplyItem[]>([]);

  useEffect(() => {
    loadCustomers();
  }, []);

  async function loadCustomers() {
    const { data } = await supabase
      .from("customers")
      .select("id, name")
      .order("name");

    setCustomers(data || []);
  }

  async function loadNotes(customerId: string) {
    const { data } = await supabase
      .from("cxc_notes")
      .select("*")
      .eq("customer_id", customerId)
      .gt("balance_due", 0)
      .order("note_date");

    const list = data || [];

    setNotes(list);

    setApplications(
      list.map((n) => ({
        note_id: n.id,
        note_number: n.note_number,
        balance_due: n.balance_due,
        apply_amount: "0",
      }))
    );
  }

  function selectCustomer(c: Customer) {
    setSelectedCustomer(c);
    loadNotes(c.id);
  }

  function autoDistribute() {
    let remaining = Number(amount || 0);

    const updated = applications.map((a) => {
      if (remaining <= 0) return { ...a, apply_amount: "0" };

      const apply = Math.min(a.balance_due, remaining);
      remaining -= apply;

      return { ...a, apply_amount: String(apply) };
    });

    setApplications(updated);
  }

  function updateApply(index: number, value: string) {
    const copy = [...applications];
    copy[index].apply_amount = value;
    setApplications(copy);
  }

  const totalApplied = useMemo(() => {
    return applications.reduce(
      (acc, a) => acc + Number(a.apply_amount || 0),
      0
    );
  }, [applications]);

  async function savePayment() {
    if (!selectedCustomer) {
      alert("Selecciona cliente");
      return;
    }

    const paymentAmount = Number(amount);
    if (paymentAmount <= 0) {
      alert("Monto inválido");
      return;
    }

    if (totalApplied > paymentAmount) {
      alert("Estás aplicando más de lo que pagó");
      return;
    }

    setSaving(true);

    const { data: payment } = await supabase
      .from("cxc_payments")
      .insert([
        {
          customer_id: selectedCustomer.id,
          customer_name: selectedCustomer.name,
          amount: paymentAmount,
          payment_method: method,
          reference,
        },
      ])
      .select("*")
      .single();

    for (const a of applications) {
      const apply = Number(a.apply_amount || 0);
      if (apply <= 0) continue;

      await supabase.from("cxc_payment_applications").insert([
        {
          payment_id: payment.id,
          cxc_note_id: a.note_id,
          applied_amount: apply,
        },
      ]);

      const note = notes.find((n) => n.id === a.note_id);
      const newBalance = (note?.balance_due || 0) - apply;

      await supabase
        .from("cxc_notes")
        .update({
          balance_due: newBalance,
          status: newBalance <= 0 ? "pagada" : "abierta",
        })
        .eq("id", a.note_id);
    }

    alert("Pago guardado");
    setSaving(false);
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Nuevo Pago</h1>

      <Link href="/admin/cxc/pagos">← Volver</Link>

      <h3>Cliente</h3>
      {customers.map((c) => (
        <button key={c.id} onClick={() => selectCustomer(c)}>
          {c.name}
        </button>
      ))}

      {selectedCustomer && (
        <>
          <h3>Notas pendientes</h3>

          <input
            placeholder="Monto pago"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />

          <button onClick={autoDistribute}>
            Distribuir automáticamente
          </button>

          {applications.map((a, i) => (
            <div key={a.note_id}>
              {a.note_number} | Saldo: {a.balance_due}
              <input
                value={a.apply_amount}
                onChange={(e) => updateApply(i, e.target.value)}
              />
            </div>
          ))}

          <h3>Total aplicado: {totalApplied}</h3>

          <button onClick={savePayment} disabled={saving}>
            Guardar pago
          </button>
        </>
      )}
    </div>
  );
}