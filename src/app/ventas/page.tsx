"use client";

import { useMemo, useState } from "react";

type Item = {
  id: string;
  product: string;
  kilos: number;
  price: number;
};

type Product = {
  name: string;
  price: number;
};

const CATEGORIES: Record<string, Product[]> = {
  Res: [
    { name: "Bistec", price: 180 },
    { name: "Molida", price: 140 },
  ],
  "Carne para asar": [
    { name: "Arrachera", price: 320 },
  ],
  Cerdo: [
    { name: "Costilla", price: 160 },
  ],
  Embutidos: [
    { name: "Longaniza", price: 120 },
  ],
  Complementos: [],
};

function makeId() {
  return `${Date.now()}-${Math.random()}`;
}

export default function VentasPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [kilos, setKilos] = useState("");

  function addItem() {
    if (!selectedProduct || !kilos) return;

    const product =
      selectedCategory && CATEGORIES[selectedCategory]
        ? CATEGORIES[selectedCategory].find((p) => p.name === selectedProduct)
        : null;

    if (!product) return;

    setItems((prev) => [
      ...prev,
      {
        id: makeId(),
        product: product.name,
        kilos: Number(kilos),
        price: product.price,
      },
    ]);

    setKilos("");
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  const total = useMemo(() => {
    return items.reduce((acc, item) => acc + item.kilos * item.price, 0);
  }, [items]);

  return (
    <div style={{ padding: 20 }}>
      <h1>Ventas Mostrador</h1>
      <p>Agrega, pesa y cobra 🔥</p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 20,
        }}
      >
        {/* PRODUCTOS */}
        <div>
          <h3>Productos</h3>

          {!selectedCategory ? (
            <>
              {Object.keys(CATEGORIES).map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    setSelectedCategory(cat);
                    setSelectedProduct("");
                  }}
                  style={{
                    display: "block",
                    marginBottom: 10,
                    padding: 16,
                    width: "100%",
                    fontSize: 18,
                    cursor: "pointer",
                  }}
                >
                  {cat}
                </button>
              ))}
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setSelectedCategory(null);
                  setSelectedProduct("");
                }}
                style={{
                  display: "block",
                  marginBottom: 10,
                  padding: 12,
                  width: "100%",
                  cursor: "pointer",
                }}
              >
                ← Volver
              </button>

              {CATEGORIES[selectedCategory].length === 0 ? (
                <div>No hay productos en esta categoría</div>
              ) : (
                CATEGORIES[selectedCategory].map((p) => (
                  <button
                    key={p.name}
                    onClick={() => setSelectedProduct(p.name)}
                    style={{
                      display: "block",
                      marginBottom: 10,
                      padding: 12,
                      width: "100%",
                      cursor: "pointer",
                      border:
                        selectedProduct === p.name
                          ? "2px solid #7b2218"
                          : "1px solid #ccc",
                      background: selectedProduct === p.name ? "#fff7f5" : "white",
                    }}
                  >
                    {p.name} - ${p.price}
                  </button>
                ))
              )}
            </>
          )}
        </div>

        {/* ORDEN */}
        <div>
          <h3>Orden</h3>

          <div style={{ marginBottom: 10 }}>
            <strong>Producto:</strong>{" "}
            {selectedProduct || "Ninguno seleccionado"}
          </div>

          <input
            placeholder="Kilos"
            value={kilos}
            onChange={(e) => setKilos(e.target.value)}
            style={{ width: "100%", padding: 10, marginBottom: 10 }}
          />

          <button onClick={addItem} style={{ cursor: "pointer" }}>
            Agregar
          </button>

          <div style={{ marginTop: 20 }}>
            {items.length === 0 ? (
              <div>No hay productos agregados</div>
            ) : (
              items.map((item) => (
                <div
                  key={item.id}
                  style={{
                    marginBottom: 10,
                    padding: 10,
                    border: "1px solid #ddd",
                    borderRadius: 8,
                  }}
                >
                  <div>{item.product}</div>
                  <div>
                    {item.kilos} kg x ${item.price}
                  </div>
                  <div>${(item.kilos * item.price).toFixed(2)}</div>

                  <button
                    onClick={() => removeItem(item.id)}
                    style={{ marginTop: 8, cursor: "pointer" }}
                  >
                    Eliminar
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* TOTAL */}
        <div>
          <h3>Total</h3>

          <div style={{ fontSize: 28 }}>${total.toFixed(2)}</div>

          <button style={{ marginTop: 20, cursor: "pointer" }}>
            Imprimir ticket
          </button>
        </div>
      </div>
    </div>
  );
}