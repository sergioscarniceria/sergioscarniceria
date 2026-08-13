"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";

const C = {
  bg: "#f7f1e8",
  cardStrong: "rgba(255,255,255,0.97)",
  border: "rgba(92,27,17,0.10)",
  text: "#3b1c16",
  muted: "#7a5a52",
  primary: "#7b2218",
  success: "#1f7a4d",
  warning: "#a66a10",
  danger: "#b42318",
  info: "#355c7d",
  shadow: "0 10px 30px rgba(91,25,15,0.08)",
};

type Producto = {
  id: string;
  name: string;
  category: string | null;
  price: number;
  purchase_price: number | null;
  fixed_piece_price: number | null;
  sale_type: string | null;
  is_fixed_price_by_piece: boolean | null;
  is_active: boolean | null;
};

type Edit = {
  costo: string;
  margen: string;
  precio: string;
  modo: "margen" | "manual";
};

function money(n: number) {
  return Number(n || 0).toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function calcMargen(precio: number, costo: number): number {
  if (!precio || precio <= 0) return 0;
  return ((precio - costo) / precio) * 100;
}

function precioDesdeMargen(costo: number, margenPct: number): number {
  const m = margenPct / 100;
  if (m >= 1) return costo * 10;
  return costo / (1 - m);
}

export default function PreciosPage() {
  const supabase = getSupabaseClient();

  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string>("Pollos y Mariscos");
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  // Margen objetivo global
  const [margenObjetivo, setMargenObjetivo] = useState("38");

  const loadProductos = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, category, price, purchase_price, fixed_piece_price, sale_type, is_fixed_price_by_piece, is_active")
        .eq("is_active", true)
        .order("name", { ascending: true })
        .limit(500);
      if (!error && data) {
        setProductos(data as Producto[]);
      }
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { loadProductos(); }, [loadProductos]);

  const categorias = useMemo(() => {
    const set = new Set<string>();
    productos.forEach((p) => { if (p.category) set.add(p.category); });
    return ["Todas", ...Array.from(set).sort()];
  }, [productos]);

  const filtrados = useMemo(() => {
    let r = productos;
    if (catFilter !== "Todas") r = r.filter((p) => p.category === catFilter);
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      r = r.filter((p) => p.name.toLowerCase().includes(q));
    }
    return r;
  }, [productos, catFilter, search]);

  function getEdit(p: Producto): Edit {
    if (edits[p.id]) return edits[p.id];
    const costo = Number(p.purchase_price || 0);
    const precio = Number(p.price || 0);
    return {
      costo: costo > 0 ? String(costo) : "",
      margen: costo > 0 && precio > 0 ? calcMargen(precio, costo).toFixed(1) : "",
      precio: String(precio),
      modo: "margen",
    };
  }

  function setEdit(id: string, patch: Partial<Edit>) {
    setEdits((prev) => {
      const cur = prev[id] || { costo: "", margen: "", precio: "", modo: "margen" as const };
      return { ...prev, [id]: { ...cur, ...patch } };
    });
  }

  // Cuando cambia costo o margen, recalcular precio
  function onCostoChange(p: Producto, valor: string) {
    const e = getEdit(p);
    const costo = Number(valor || 0);
    if (e.modo === "margen" && e.margen) {
      const nuevoPrecio = precioDesdeMargen(costo, Number(e.margen));
      setEdit(p.id, { costo: valor, precio: String(Math.ceil(nuevoPrecio)) });
    } else {
      const nuevoMargen = calcMargen(Number(e.precio || 0), costo);
      setEdit(p.id, { costo: valor, margen: nuevoMargen.toFixed(1) });
    }
  }

  function onMargenChange(p: Producto, valor: string) {
    const e = getEdit(p);
    const costo = Number(e.costo || 0);
    const nuevoPrecio = precioDesdeMargen(costo, Number(valor || 0));
    setEdit(p.id, { margen: valor, precio: String(Math.ceil(nuevoPrecio)), modo: "margen" });
  }

  function onPrecioChange(p: Producto, valor: string) {
    const e = getEdit(p);
    const costo = Number(e.costo || 0);
    const nuevoMargen = calcMargen(Number(valor || 0), costo);
    setEdit(p.id, { precio: valor, margen: nuevoMargen.toFixed(1), modo: "manual" });
  }

  function aplicarMargenObjetivo(p: Producto) {
    const e = getEdit(p);
    const costo = Number(e.costo || 0);
    if (costo <= 0) {
      setMsg("Primero captura el costo de " + p.name);
      setTimeout(() => setMsg(""), 3000);
      return;
    }
    const nuevoPrecio = precioDesdeMargen(costo, Number(margenObjetivo));
    setEdit(p.id, { margen: margenObjetivo, precio: String(Math.ceil(nuevoPrecio)), modo: "margen" });
  }

  async function guardar(p: Producto) {
    const e = getEdit(p);
    const costo = Number(e.costo || 0);
    const precio = Number(e.precio || 0);

    if (precio < 1) {
      setMsg("El precio debe ser mínimo $1");
      setTimeout(() => setMsg(""), 3000);
      return;
    }

    setSavingId(p.id);
    const payload: Record<string, number | null> = {
      price: precio,
      purchase_price: costo > 0 ? costo : null,
    };
    // Si es producto por pieza, sincronizar fixed_piece_price
    if (p.sale_type === "pieza" || p.is_fixed_price_by_piece) {
      payload.fixed_piece_price = precio;
    }

    const { error } = await supabase.from("products").update(payload).eq("id", p.id);
    if (error) {
      setMsg("Error: " + error.message);
    } else {
      setMsg(`${p.name} actualizado`);
      setEdits((prev) => {
        const n = { ...prev };
        delete n[p.id];
        return n;
      });
      await loadProductos();
      setTimeout(() => setMsg(""), 2500);
    }
    setSavingId(null);
  }

  const resumen = useMemo(() => {
    const conCosto = filtrados.filter((p) => Number(p.purchase_price || 0) > 0);
    const margenProm = conCosto.length > 0
      ? conCosto.reduce((a, p) => a + calcMargen(Number(p.price), Number(p.purchase_price)), 0) / conCosto.length
      : 0;
    return {
      total: filtrados.length,
      conCosto: conCosto.length,
      sinCosto: filtrados.length - conCosto.length,
      margenProm,
    };
  }, [filtrados]);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, padding: 16, fontFamily: "system-ui, -apple-system, Arial, sans-serif" }}>
      <div style={{ maxWidth: 1150, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <div>
            <h1 style={{ margin: 0, color: C.text, fontSize: 24 }}>Administración de precios</h1>
            <p style={{ margin: "4px 0 0", color: C.muted, fontSize: 13 }}>
              Captura el costo y ajusta el precio de venta por margen o manual
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href="/admin/productos" style={navBtn}>Productos</Link>
            <Link href="/admin/categorias" style={navBtn}>Categorías</Link>
            <Link href="/admin/dashboard" style={navBtn}>Dashboard</Link>
          </div>
        </div>

        {/* Margen objetivo */}
        <div style={{ background: C.cardStrong, borderRadius: 16, padding: 16, border: `1px solid ${C.border}`, marginBottom: 16, boxShadow: C.shadow }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <label style={lbl}>Margen objetivo (%)</label>
              <input
                type="number" step="1" min="1" max="95"
                value={margenObjetivo}
                onChange={(e) => setMargenObjetivo(e.target.value)}
                style={{ ...inp, width: 100, fontSize: 18, textAlign: "center" }}
              />
            </div>
            <div style={{ flex: 1, minWidth: 200, fontSize: 13, color: C.muted, paddingTop: 18 }}>
              Usa el botón <b style={{ color: C.primary }}>Aplicar {margenObjetivo}%</b> en cada producto para recalcular
              su precio con este margen sobre el costo capturado.
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div style={{ background: C.cardStrong, borderRadius: 16, padding: 14, border: `1px solid ${C.border}`, marginBottom: 16, boxShadow: C.shadow }}>
          <input
            placeholder="Buscar producto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ ...inp, width: "100%", marginBottom: 10 }}
          />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {categorias.map((c) => (
              <button
                key={c}
                onClick={() => setCatFilter(c)}
                style={{
                  padding: "7px 13px", borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: "pointer",
                  border: catFilter === c ? "none" : `1px solid ${C.border}`,
                  background: catFilter === c ? C.primary : "white",
                  color: catFilter === c ? "white" : C.text,
                }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Resumen */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 16 }}>
          <Stat label="Productos" value={String(resumen.total)} />
          <Stat label="Con costo" value={String(resumen.conCosto)} color={C.success} />
          <Stat label="Sin costo" value={String(resumen.sinCosto)} color={resumen.sinCosto > 0 ? C.warning : C.muted} />
          <Stat label="Margen promedio" value={`${resumen.margenProm.toFixed(1)}%`} color={C.info} />
        </div>

        {msg && (
          <div style={{
            padding: "10px 16px", borderRadius: 10, marginBottom: 14, fontWeight: 700, fontSize: 14,
            background: msg.startsWith("Error") ? "rgba(180,35,24,0.08)" : "rgba(31,122,77,0.08)",
            color: msg.startsWith("Error") ? C.danger : C.success,
          }}>
            {msg}
          </div>
        )}

        {/* Lista */}
        <div style={{ background: C.cardStrong, borderRadius: 16, border: `1px solid ${C.border}`, boxShadow: C.shadow, overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: C.muted }}>Cargando...</div>
          ) : filtrados.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: C.muted }}>Sin productos</div>
          ) : (
            filtrados.map((p, i) => {
              const e = getEdit(p);
              const costoNum = Number(e.costo || 0);
              const precioNum = Number(e.precio || 0);
              const margenNum = Number(e.margen || 0);
              const ganancia = precioNum - costoNum;
              const cambiado = !!edits[p.id];
              const precioOriginal = Number(p.price || 0);
              const diff = precioNum - precioOriginal;

              return (
                <div key={p.id} style={{
                  padding: "14px 18px",
                  borderTop: i === 0 ? "none" : `1px solid ${C.border}`,
                  background: cambiado ? "rgba(166,106,16,0.05)" : "transparent",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                    <div style={{ flex: "1 1 180px", minWidth: 0 }}>
                      <div style={{ fontWeight: 800, color: C.text, fontSize: 15 }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                        {p.category || "sin categoría"}
                        {" · "}
                        {p.sale_type === "pieza" || p.is_fixed_price_by_piece ? "por pieza" : "por kg"}
                        {" · precio actual: "}<b>${money(precioOriginal)}</b>
                      </div>
                    </div>
                    <button
                      onClick={() => aplicarMargenObjetivo(p)}
                      style={{
                        padding: "7px 13px", borderRadius: 9, border: `1px solid ${C.border}`,
                        background: "white", color: C.primary, fontWeight: 700, fontSize: 12, cursor: "pointer",
                      }}
                    >
                      Aplicar {margenObjetivo}%
                    </button>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 10, alignItems: "end" }}>
                    <div>
                      <label style={lblSm}>Costo</label>
                      <input
                        type="number" step="0.01" min="0"
                        value={e.costo}
                        onChange={(ev) => onCostoChange(p, ev.target.value)}
                        placeholder="0"
                        style={inpSm}
                      />
                    </div>
                    <div>
                      <label style={lblSm}>Margen %</label>
                      <input
                        type="number" step="0.1" min="0" max="99"
                        value={e.margen}
                        onChange={(ev) => onMargenChange(p, ev.target.value)}
                        placeholder="0"
                        style={{ ...inpSm, color: margenNum > 0 ? C.info : C.text }}
                      />
                    </div>
                    <div>
                      <label style={lblSm}>Precio venta</label>
                      <input
                        type="number" step="1" min="1"
                        value={e.precio}
                        onChange={(ev) => onPrecioChange(p, ev.target.value)}
                        style={{ ...inpSm, fontWeight: 800, color: C.primary }}
                      />
                    </div>
                    <div style={{ paddingBottom: 2 }}>
                      <div style={lblSm}>Ganancia</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: ganancia > 0 ? C.success : C.danger, paddingTop: 6 }}>
                        ${money(ganancia)}
                      </div>
                    </div>
                    <div style={{ paddingBottom: 2 }}>
                      {cambiado && diff !== 0 && (
                        <div style={{ fontSize: 12, fontWeight: 700, color: diff > 0 ? C.success : C.danger, paddingTop: 20 }}>
                          {diff > 0 ? "▲" : "▼"} ${money(Math.abs(diff))}
                        </div>
                      )}
                    </div>
                    <div>
                      <button
                        onClick={() => guardar(p)}
                        disabled={savingId === p.id || !cambiado}
                        style={{
                          width: "100%", padding: "10px 12px", borderRadius: 9, border: "none",
                          background: cambiado ? C.primary : "rgba(0,0,0,0.06)",
                          color: cambiado ? "white" : C.muted,
                          fontWeight: 800, fontSize: 13,
                          cursor: cambiado && savingId !== p.id ? "pointer" : "default",
                          opacity: savingId === p.id ? 0.6 : 1,
                        }}
                      >
                        {savingId === p.id ? "..." : "Guardar"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: C.cardStrong, borderRadius: 14, padding: 14, border: `1px solid ${C.border}`, boxShadow: C.shadow }}>
      <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: color || C.text, marginTop: 4 }}>{value}</div>
    </div>
  );
}

const navBtn: React.CSSProperties = {
  padding: "9px 16px", borderRadius: 12, border: `1px solid ${C.border}`,
  background: "white", color: C.text, textDecoration: "none", fontWeight: 700, fontSize: 13,
};

const lbl: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, color: C.muted, display: "block", marginBottom: 4,
};

const lblSm: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: C.muted, display: "block", marginBottom: 3, textTransform: "uppercase",
};

const inp: React.CSSProperties = {
  padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.border}`,
  fontSize: 15, color: C.text, background: "white", boxSizing: "border-box",
};

const inpSm: React.CSSProperties = {
  width: "100%", padding: "9px 10px", borderRadius: 8, border: `1px solid ${C.border}`,
  fontSize: 15, fontWeight: 700, color: C.text, background: "white", boxSizing: "border-box",
};
