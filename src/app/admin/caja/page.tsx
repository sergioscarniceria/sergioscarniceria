"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";

type Movement = {
  id: string;
  type: string;
  amount: number;
  payment_method: string;
  created_at: string;
};

export default function CajaPage() {
  const supabase = getSupabaseClient();

  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadToday();
  }, []);

  async function loadToday() {
    setLoading(true);

    const today = new Date();
    const start = new Date(today.setHours(0, 0, 0, 0)).toISOString();
    const end = new Date().toISOString();

    const { data, error } = await supabase
      .from("cash_movements")
      .select("*")
      .gte("created_at", start)
      .lte("created_at", end);

    if (error) {
      console.log(error);
      alert("Error cargando caja");
      setLoading(false);
      return;
    }

    setMovements(data || []);
    setLoading(false);
  }

  function sumBy(method: string) {
    return movements
      .filter((m) => m.payment_method === method)
      .reduce((acc, m) => acc + Number(m.amount || 0), 0);
  }

  const efectivo = sumBy("efectivo");
  const tarjeta = sumBy("tarjeta");
  const transferencia = sumBy("transferencia");

  const total = efectivo + tarjeta + transferencia;

  if (loading) return <div style={{ padding: 20 }}>Cargando corte...</div>;

  return (
    <div style={{ padding: 30 }}>
      <h1>Corte del día</h1>

      <div style={{ marginTop: 20 }}>
        <h2>💵 Efectivo: ${efectivo.toFixed(2)}</h2>
        <h2>💳 Tarjeta: ${tarjeta.toFixed(2)}</h2>
        <h2>🔄 Transferencia: ${transferencia.toFixed(2)}</h2>
      </div>

      <hr style={{ margin: "20px 0" }} />

      <h1>💰 TOTAL: ${total.toFixed(2)}</h1>

      <div style={{ marginTop: 30 }}>
        <h3>Movimientos del día:</h3>

        {movements.map((m) => (
          <div key={m.id}>
            {m.type} - {m.payment_method} - ${m.amount}
          </div>
        ))}
      </div>
    </div>
  );
}