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

export default function AdminClientesPage() {
  const supabase = getSupabaseClient();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    loadCustomers();
  }, []);

  async function loadCustomers() {
    const { data } = await supabase
      .from("customers")
      .select("*")
      .order("name");

    setCustomers((data as Customer[]) || []);
    setLoading(false);
  }

  async function updateType(id: string, type: string) {
    setUpdatingId(id);

    const { error } = await supabase
      .from("customers")
      .update({ customer_type: type })
      .eq("id", id);

    if (error) {
      alert("Error al actualizar");
      setUpdatingId(null);
      return;
    }

    setCustomers((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, customer_type: type } : c
      )
    );

    setUpdatingId(null);
  }

  async function deleteCustomer(id: string) {
    if (!confirm("¿Eliminar cliente?")) return;

    const { error } = await supabase
      .from("customers")
      .delete()
      .eq("id", id);

    if (error) {
      alert("No se puede eliminar (tiene pedidos)");
      return;
    }

    setCustomers((prev) => prev.filter((c) => c.id !== id));
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return customers.filter((c) =>
      `${c.name} ${c.phone} ${c.email} ${c.business_name}`
        .toLowerCase()
        .includes(q)
    );
  }, [customers, search]);

  if (loading) return <div style={{ padding: 20 }}>Cargando...</div>;

  return (
    <div style={{ padding: 20 }}>
      <h1>Clientes</h1>

      <input
        placeholder="Buscar cliente"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          width: "100%",
          padding: 12,
          marginBottom: 20,
          borderRadius: 10,
          border: "1px solid #ccc",
        }}
      />

      <div style={{ display: "grid", gap: 12 }}>
        {filtered.map((c) => (
          <div
            key={c.id}
            style={{
              border: "1px solid #ddd",
              padding: 16,
              borderRadius: 12,
            }}
          >
            <b>{c.name}</b>

            <div>{c.phone}</div>
            <div>{c.email}</div>

            {/* 🔥 SELECTOR */}
            <div style={{ marginTop: 10 }}>
              <select
                value={c.customer_type || "menudeo"}
                onChange={(e) => updateType(c.id, e.target.value)}
                disabled={updatingId === c.id}
                style={{
                  padding: 8,
                  borderRadius: 8,
                  border: "1px solid #ccc",
                }}
              >
                <option value="menudeo">Menudeo</option>
                <option value="mayoreo">Mayoreo</option>
              </select>
            </div>

            <button
              onClick={() => deleteCustomer(c.id)}
              style={{
                marginTop: 10,
                background: "red",
                color: "white",
                border: "none",
                padding: "8px 12px",
                borderRadius: 8,
              }}
            >
              Eliminar
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}