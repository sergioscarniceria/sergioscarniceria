"use client";

import Link from "next/link";

export default function PedidosPage() {
  return (
    <div style={{ padding: 20 }}>

      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1>Pedidos</h1>
          <p>Control general y seguimiento</p>
        </div>

        {/* BOTONES */}
        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/">Inicio</Link>
          <Link href="/produccion">Producción</Link>
          <Link href="/admin/dashboard">Dashboard</Link>

          {/* 🔴 ESTE ES EL NUEVO */}
          <Link
            href="/admin/nuevo-pedido"
            style={{
              background: "#7a1f1f",
              color: "white",
              padding: "10px 15px",
              borderRadius: 8,
              fontWeight: "bold"
            }}
          >
            + Nuevo pedido
          </Link>
        </div>
      </div>

      {/* CONTENIDO */}
      <div>
        <p>Aquí van los pedidos...</p>
      </div>

    </div>
  );
}