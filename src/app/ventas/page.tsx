"use client";

import { useMemo, useState } from "react";

type Item = {
  id: string;
  product: string;
  kilos: number;
  price: number;
};

const PRODUCTS = [
  { name: "Bistec", price: 180 },
  { name: "Arrachera", price: 320 },
  { name: "Costilla", price: 160 },
  { name: "Molida", price: 140 },
  { name: "Longaniza", price: 120 },
];

function makeId() {
  return `${Date.now()}-${Math.random()}`;
}

export default function VentasPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [kilos, setKilos] = useState("");

  function addItem() {
    if (!selectedProduct || !kilos) return;

    const product = PRODUCTS.find(p => p.name === selectedProduct);
    if (!product) return;

    setItems(prev => [
      ...prev,
      {
        id: makeId(),
        product: product.name,
        kilos: Number(kilos),
        price: product.price,
      }
    ]);

    setKilos("");
  }

  function removeItem(id: string) {
    setItems(prev => prev.filter(i => i.id !== id));
  }

  const total = useMemo(() => {
    return items.reduce((acc, item) => {
      return acc + item.kilos * item.price;
    }, 0);
  }, [items]);

  return (
    <div style={{ padding: 20 }}>
      <h1>Ventas Mostrador</h1>
      <p>Agrega, pesa y cobra 🔥</p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>

        {/* PRODUCTOS */}
        <div>
          <h3>Productos</h3>

          {PRODUCTS.map(p => (
            <button
              key={p.name}
              onClick={() => setSelectedProduct(p.name)}
              style={{
                display: "block",
                marginBottom: 10,
                padding: 12,
                width: "100%"
              }}
            >
              {p.name} - ${p.price}
            </button>
          ))}
        </div>

        {/* ORDEN */}
        <div>
          <h3>Orden</h3>

          <input
            placeholder="Kilos"
            value={kilos}
            onChange={(e) => setKilos(e.target.value)}
            style={{ width: "100%", padding: 10, marginBottom: 10 }}
          />

          <button onClick={addItem}>
            Agregar
          </button>

          <div style={{ marginTop: 20 }}>
            {items.map(item => (
              <div key={item.id} style={{ marginBottom: 10 }}>
                <div>{item.product}</div>
                <div>{item.kilos} kg x ${item.price}</div>
                <div>${(item.kilos * item.price).toFixed(2)}</div>

                <button onClick={() => removeItem(item.id)}>
                  Eliminar
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* TOTAL */}
        <div>
          <h3>Total</h3>

          <div style={{ fontSize: 28 }}>
            ${total.toFixed(2)}
          </div>

          <button style={{ marginTop: 20 }}>
            Imprimir ticket
          </button>
        </div>

      </div>
    </div>
  );
}