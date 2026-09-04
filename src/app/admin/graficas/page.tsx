"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";

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

// Paleta para hasta 10 series, distinguibles entre si
const SERIE_COLORS = [
  "#7b2218", "#1f7a4d", "#355c7d", "#a66a10", "#8e44ad",
  "#c0392b", "#16a085", "#2c3e50", "#d35400", "#7f8c8d",
];

const MAX_SERIES = 10;

type Tab = "productos" | "clientes";
type Gran = "dia" | "semana" | "mes";
type Metrica = "importe" | "cantidad";

type SerieProducto = {
  periodo: string; producto: string; unidad: string;
  cantidad: number; cantidad_kg: number; cantidad_pza: number;
  importe: number; tickets: number;
};
type SerieCliente = {
  periodo: string; cliente: string; importe: number; tickets: number;
};
type CatalogoItem = { clave: string; importe: number; tickets: number };
type TopProducto = {
  producto: string; unidad: string; cantidad: number;
  cantidad_kg: number; cantidad_pza: number;
  importe: number; tickets: number; pct: number;
};
type FilaGrafica = {
  periodo: string;
  etiqueta: string;
  [serie: string]: string | number;
};

type DiaSemana = {
  dow: number; dia: string; tickets: number;
  importe: number; importe_prom: number; dias_calendario: number;
};

function money(n: number) {
  return Number(n || 0).toLocaleString("es-MX", {
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  });
}

function cantidadFmt(n: number, unidad: string) {
  const v = Number(n || 0);
  if (unidad === "pza") return `${v.toLocaleString("es-MX", { maximumFractionDigits: 0 })} pza`;
  return `${v.toLocaleString("es-MX", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg`;
}

// Un mismo producto puede venderse por kg y por pieza (ej. Rib eye).
// Sumarlos no significa nada, asi que se muestran por separado.
function ambasUnidades(kg: number, pza: number) {
  const partes: string[] = [];
  if (Number(kg || 0) > 0) partes.push(cantidadFmt(kg, "kg"));
  if (Number(pza || 0) > 0) partes.push(cantidadFmt(pza, "pza"));
  return partes.length > 0 ? partes.join(" + ") : "—";
}

function hoy() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function hace(dias: number) {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function inicioAnio() {
  return `${new Date().getFullYear()}-01-01`;
}

// Etiqueta corta del eje X segun la granularidad
function etiquetaPeriodo(iso: string, gran: Gran) {
  const [y, m, d] = iso.split("-").map(Number);
  const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  if (gran === "mes") return `${MESES[m - 1]} ${String(y).slice(2)}`;
  return `${d} ${MESES[m - 1]}`;
}

// Normaliza para buscar sin acentos ni mayusculas
function norm(t: string) {
  return (t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export default function GraficasPage() {
  const supabase = getSupabaseClient();

  const [tab, setTab] = useState<Tab>("productos");
  const [gran, setGran] = useState<Gran>("dia");
  const [metrica, setMetrica] = useState<Metrica>("importe");
  const [desde, setDesde] = useState(hace(89));
  const [hasta, setHasta] = useState(hoy());

  const [catalogo, setCatalogo] = useState<CatalogoItem[]>([]);
  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [todosClientes, setTodosClientes] = useState(false);

  const [serieProd, setSerieProd] = useState<SerieProducto[]>([]);
  const [serieCli, setSerieCli] = useState<SerieCliente[]>([]);
  const [topProd, setTopProd] = useState<TopProducto[]>([]);
  const [diaSemana, setDiaSemana] = useState<DiaSemana[]>([]);

  const [cargandoCatalogo, setCargandoCatalogo] = useState(true);
  const [cargandoSerie, setCargandoSerie] = useState(false);

  // ── Catalogo del buscador ────────────────────────────────
  const cargarCatalogo = useCallback(async () => {
    setCargandoCatalogo(true);
    try {
      const { data, error } = await supabase.rpc("catalogo_graficas", {
        p_tipo: tab === "clientes" ? "cliente" : "producto",
        p_from: desde || null,
        p_to: hasta || null,
      });
      if (error) { console.log(error); setCatalogo([]); return; }
      setCatalogo((data || []).map((r: Record<string, unknown>) => ({
        clave: String(r.clave || ""),
        importe: Number(r.importe || 0),
        tickets: Number(r.tickets || 0),
      })));
    } finally {
      setCargandoCatalogo(false);
    }
  }, [supabase, tab, desde, hasta]);

  useEffect(() => { cargarCatalogo(); }, [cargarCatalogo]);

  // Al cambiar de pestaña se limpia la seleccion
  useEffect(() => {
    setSeleccion([]);
    setBusqueda("");
    setTodosClientes(false);
    setSerieProd([]);
    setSerieCli([]);
    setTopProd([]);
    setDiaSemana([]);
  }, [tab]);

  // ── Series ───────────────────────────────────────────────
  const cargarSerie = useCallback(async () => {
    const hayFiltro = seleccion.length > 0 || (tab === "clientes" && todosClientes);
    if (!hayFiltro) {
      setSerieProd([]); setSerieCli([]); setTopProd([]); setDiaSemana([]);
      return;
    }

    setCargandoSerie(true);
    try {
      if (tab === "productos") {
        const { data, error } = await supabase.rpc("serie_ventas_producto", {
          p_productos: seleccion,
          p_from: desde || null,
          p_to: hasta || null,
          p_gran: gran,
        });
        if (error) { console.log(error); setSerieProd([]); }
        else {
          setSerieProd((data || []).map((r: Record<string, unknown>) => ({
            periodo: String(r.periodo || ""),
            producto: String(r.producto || ""),
            unidad: String(r.unidad || "kg"),
            cantidad: Number(r.cantidad || 0),
            cantidad_kg: Number(r.cantidad_kg || 0),
            cantidad_pza: Number(r.cantidad_pza || 0),
            importe: Number(r.importe || 0),
            tickets: Number(r.tickets || 0),
          })));
        }
      } else {
        const clientes = todosClientes ? null : seleccion;
        const [serieRes, topRes, dowRes] = await Promise.all([
          supabase.rpc("serie_ventas_cliente", {
            p_clientes: clientes, p_from: desde || null, p_to: hasta || null, p_gran: gran,
          }),
          supabase.rpc("top_productos_cliente", {
            p_clientes: clientes, p_from: desde || null, p_to: hasta || null, p_limit: 15,
          }),
          supabase.rpc("ventas_por_dia_semana", {
            p_clientes: clientes, p_from: desde || null, p_to: hasta || null,
          }),
        ]);

        setSerieCli(!serieRes.error ? (serieRes.data || []).map((r: Record<string, unknown>) => ({
          periodo: String(r.periodo || ""),
          cliente: String(r.cliente || ""),
          importe: Number(r.importe || 0),
          tickets: Number(r.tickets || 0),
        })) : []);

        setTopProd(!topRes.error ? (topRes.data || []).map((r: Record<string, unknown>) => ({
          producto: String(r.producto || ""),
          unidad: String(r.unidad || "kg"),
          cantidad: Number(r.cantidad || 0),
          cantidad_kg: Number(r.cantidad_kg || 0),
          cantidad_pza: Number(r.cantidad_pza || 0),
          importe: Number(r.importe || 0),
          tickets: Number(r.tickets || 0),
          pct: Number(r.pct || 0),
        })) : []);

        setDiaSemana(!dowRes.error ? (dowRes.data || []).map((r: Record<string, unknown>) => ({
          dow: Number(r.dow || 0),
          dia: String(r.dia || ""),
          tickets: Number(r.tickets || 0),
          importe: Number(r.importe || 0),
          importe_prom: Number(r.importe_prom || 0),
          dias_calendario: Number(r.dias_calendario || 0),
        })) : []);
      }
    } finally {
      setCargandoSerie(false);
    }
  }, [supabase, tab, seleccion, todosClientes, desde, hasta, gran]);

  useEffect(() => { cargarSerie(); }, [cargarSerie]);

  // ── Buscador ─────────────────────────────────────────────
  const sugerencias = useMemo(() => {
    const q = norm(busqueda.trim());
    const base = catalogo.filter((c) => !seleccion.includes(c.clave));
    if (!q) return base.slice(0, 12);
    return base.filter((c) => norm(c.clave).includes(q)).slice(0, 30);
  }, [catalogo, busqueda, seleccion]);

  function agregar(clave: string) {
    if (seleccion.length >= MAX_SERIES) return;
    if (seleccion.includes(clave)) return;
    setSeleccion((prev) => [...prev, clave]);
    setBusqueda("");
    setTodosClientes(false);
  }

  function quitar(clave: string) {
    setSeleccion((prev) => prev.filter((s) => s !== clave));
  }

  const colorDe = useCallback(
    (clave: string) => SERIE_COLORS[seleccion.indexOf(clave) % SERIE_COLORS.length],
    [seleccion]
  );

  // ── Datos para la grafica ────────────────────────────────
  const datosGrafica = useMemo(() => {
    const porPeriodo = new Map<string, Record<string, string | number>>();

    if (tab === "productos") {
      for (const r of serieProd) {
        if (!porPeriodo.has(r.periodo)) porPeriodo.set(r.periodo, { periodo: r.periodo });
        const fila = porPeriodo.get(r.periodo)!;
        fila[r.producto] = metrica === "importe" ? r.importe : r.cantidad;
      }
    } else {
      for (const r of serieCli) {
        if (!porPeriodo.has(r.periodo)) porPeriodo.set(r.periodo, { periodo: r.periodo });
        const fila = porPeriodo.get(r.periodo)!;
        fila[r.cliente] = r.importe;
      }
    }

    return Array.from(porPeriodo.values())
      .sort((a, b) => String(a.periodo).localeCompare(String(b.periodo)))
      .map((f) => ({
        ...f,
        etiqueta: etiquetaPeriodo(String(f.periodo), gran),
      })) as FilaGrafica[];
  }, [tab, serieProd, serieCli, metrica, gran]);

  // Series realmente presentes en la grafica
  const seriesActivas = useMemo(() => {
    if (tab === "productos") return seleccion;
    if (todosClientes) return ["MOSTRADOR", ...seleccion].filter((s, i, a) => a.indexOf(s) === i);
    return seleccion;
  }, [tab, seleccion, todosClientes]);

  // Series de clientes cuando esta activo "todos": las que devolvio la BD
  const seriesGrafica = useMemo(() => {
    if (tab === "clientes" && todosClientes) {
      const set = new Set(serieCli.map((r) => r.cliente));
      return Array.from(set).slice(0, MAX_SERIES);
    }
    return seriesActivas;
  }, [tab, todosClientes, serieCli, seriesActivas]);

  // ── Totales del periodo ──────────────────────────────────
  const totales = useMemo(() => {
    if (tab === "productos") {
      const map = new Map<string, { cantidad: number; cantidad_kg: number; cantidad_pza: number; importe: number; tickets: number; unidad: string }>();
      for (const r of serieProd) {
        const prev = map.get(r.producto)
          || { cantidad: 0, cantidad_kg: 0, cantidad_pza: 0, importe: 0, tickets: 0, unidad: r.unidad };
        map.set(r.producto, {
          cantidad: prev.cantidad + r.cantidad,
          cantidad_kg: prev.cantidad_kg + r.cantidad_kg,
          cantidad_pza: prev.cantidad_pza + r.cantidad_pza,
          importe: prev.importe + r.importe,
          tickets: prev.tickets + r.tickets,
          unidad: r.unidad,
        });
      }
      return Array.from(map.entries()).map(([clave, v]) => ({ clave, ...v }))
        .sort((a, b) => b.importe - a.importe);
    }
    const map = new Map<string, { importe: number; tickets: number }>();
    for (const r of serieCli) {
      const prev = map.get(r.cliente) || { importe: 0, tickets: 0 };
      map.set(r.cliente, { importe: prev.importe + r.importe, tickets: prev.tickets + r.tickets });
    }
    return Array.from(map.entries())
      .map(([clave, v]) => ({ clave, cantidad: 0, cantidad_kg: 0, cantidad_pza: 0, unidad: "", ...v }))
      .sort((a, b) => b.importe - a.importe);
  }, [tab, serieProd, serieCli]);

  const mejorDia = useMemo(() => {
    if (diaSemana.length === 0) return null;
    return diaSemana.reduce((a, b) => (b.importe > a.importe ? b : a));
  }, [diaSemana]);

  const haySeleccion = seleccion.length > 0 || (tab === "clientes" && todosClientes);
  const etiquetaTipo = tab === "productos" ? "producto" : "cliente";

  return (
    <div style={{ minHeight: "100vh", background: C.bg, padding: 16, fontFamily: "system-ui, -apple-system, Arial, sans-serif" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>

        {/* Encabezado */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <div>
            <h1 style={{ margin: 0, color: C.text, fontSize: 24 }}>Gráficas</h1>
            <p style={{ margin: "4px 0 0", color: C.muted, fontSize: 13 }}>
              Cómo se comportan tus productos y tus clientes con el paso del tiempo
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href="/admin/dashboard" style={navBtn}>Dashboard</Link>
            <Link href="/admin/categorias" style={navBtn}>Categorías</Link>
            <Link href="/" style={navBtn}>Inicio</Link>
          </div>
        </div>

        {/* Pestañas */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {([["productos", "Productos"], ["clientes", "Clientes"]] as [Tab, string][]).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{
                flex: 1, padding: "12px 16px", borderRadius: 12, cursor: "pointer",
                border: `2px solid ${tab === id ? C.primary : C.border}`,
                background: tab === id ? C.primary : "white",
                color: tab === id ? "white" : C.text,
                fontWeight: 800, fontSize: 15,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Controles */}
        <div style={{ background: C.cardStrong, borderRadius: 14, padding: 14, border: `1px solid ${C.border}`, boxShadow: C.shadow, marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
            <label style={lbl}>Desde:</label>
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} style={inp} />
            <label style={lbl}>Hasta:</label>
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} style={inp} />

            <button onClick={() => { setDesde(hace(29)); setHasta(hoy()); setGran("dia"); }} style={chipBtn(false)}>30 días</button>
            <button onClick={() => { setDesde(hace(89)); setHasta(hoy()); setGran("dia"); }} style={chipBtn(false)}>90 días</button>
            <button onClick={() => { setDesde(inicioAnio()); setHasta(hoy()); setGran("mes"); }} style={chipBtn(false)}>Este año</button>
            <button onClick={() => { setDesde(""); setHasta(""); setGran("mes"); }} style={chipBtn(false)}>Todo</button>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <label style={lbl}>Agrupar por:</label>
            {(["dia", "semana", "mes"] as Gran[]).map((g) => (
              <button key={g} onClick={() => setGran(g)} style={chipBtn(gran === g)}>
                {g === "dia" ? "Día" : g === "semana" ? "Semana" : "Mes"}
              </button>
            ))}

            {tab === "productos" && (
              <>
                <span style={{ width: 14 }} />
                <label style={lbl}>Medir:</label>
                <button onClick={() => setMetrica("importe")} style={chipBtn(metrica === "importe")}>Dinero ($)</button>
                <button onClick={() => setMetrica("cantidad")} style={chipBtn(metrica === "cantidad")}>Cantidad (kg / pza)</button>
              </>
            )}
          </div>
        </div>

        {/* Buscador y selección */}
        <div style={{ background: C.cardStrong, borderRadius: 14, padding: 14, border: `1px solid ${C.border}`, boxShadow: C.shadow, marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
            <div style={{ fontWeight: 800, color: C.text, fontSize: 14 }}>
              Compara hasta {MAX_SERIES} {tab === "productos" ? "productos" : "clientes"}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {tab === "clientes" && (
                <button
                  onClick={() => { setTodosClientes((v) => !v); setSeleccion([]); }}
                  style={chipBtn(todosClientes)}
                >
                  Todos los clientes
                </button>
              )}
              {seleccion.length > 0 && (
                <button onClick={() => setSeleccion([])} style={{ ...chipBtn(false), color: C.danger }}>
                  Limpiar
                </button>
              )}
            </div>
          </div>

          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder={tab === "productos" ? "Escribe un producto… ej. Longaniza" : "Escribe un cliente… ej. Montebello"}
            style={{ ...inp, width: "100%", padding: "11px 12px", fontSize: 15 }}
          />

          {/* Chips seleccionados */}
          {seleccion.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
              {seleccion.map((s) => (
                <span key={s} style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "6px 10px", borderRadius: 999, fontSize: 13, fontWeight: 700,
                  background: `${colorDe(s)}18`, color: colorDe(s),
                  border: `1.5px solid ${colorDe(s)}55`,
                }}>
                  {s}
                  <button onClick={() => quitar(s)} style={{
                    border: "none", background: "transparent", cursor: "pointer",
                    color: colorDe(s), fontWeight: 900, fontSize: 15, lineHeight: 1, padding: 0,
                  }}>×</button>
                </span>
              ))}
            </div>
          )}

          {/* Sugerencias */}
          {seleccion.length < MAX_SERIES && (
            <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap", maxHeight: 150, overflowY: "auto" }}>
              {cargandoCatalogo ? (
                <span style={{ color: C.muted, fontSize: 13 }}>Cargando catálogo…</span>
              ) : sugerencias.length === 0 ? (
                <span style={{ color: C.muted, fontSize: 13 }}>
                  Sin resultados para “{busqueda}” en este rango de fechas
                </span>
              ) : (
                sugerencias.map((s) => (
                  <button key={s.clave} onClick={() => agregar(s.clave)} style={{
                    padding: "6px 10px", borderRadius: 999, cursor: "pointer",
                    border: `1px solid ${C.border}`, background: "white",
                    color: C.text, fontSize: 12.5, fontWeight: 600,
                  }}>
                    {s.clave}
                    <span style={{ color: C.muted, fontWeight: 500 }}> · ${money(s.importe)}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Estado vacío */}
        {!haySeleccion && (
          <div style={{
            background: C.cardStrong, borderRadius: 14, padding: 40, textAlign: "center",
            border: `1px solid ${C.border}`, boxShadow: C.shadow, color: C.muted,
          }}>
            Busca y selecciona al menos un {etiquetaTipo} arriba para ver su gráfica.
          </div>
        )}

        {/* Gráfica principal */}
        {haySeleccion && (
          <div style={{ background: C.cardStrong, borderRadius: 14, padding: 16, border: `1px solid ${C.border}`, boxShadow: C.shadow, marginBottom: 14 }}>
            <div style={{ fontWeight: 800, color: C.text, fontSize: 15, marginBottom: 4 }}>
              {tab === "productos"
                ? (metrica === "importe" ? "Venta en dinero" : "Cantidad vendida")
                : "Compras del cliente"}
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>
              Agrupado por {gran === "dia" ? "día" : gran === "semana" ? "semana" : "mes"}
              {desde && hasta ? ` · del ${desde} al ${hasta}` : " · todo el histórico"}
            </div>

            {cargandoSerie ? (
              <div style={{ height: 340, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted }}>
                Cargando…
              </div>
            ) : datosGrafica.length === 0 ? (
              <div style={{ height: 340, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted }}>
                No hay ventas en este rango de fechas
              </div>
            ) : (
              <div style={{ width: "100%", height: 360 }}>
                <ResponsiveContainer>
                  <LineChart data={datosGrafica} margin={{ top: 6, right: 12, left: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(92,27,17,0.10)" />
                    <XAxis dataKey="etiqueta" tick={{ fontSize: 11, fill: C.muted }} minTickGap={18} />
                    <YAxis
                      tick={{ fontSize: 11, fill: C.muted }}
                      tickFormatter={(v: number) =>
                        tab === "productos" && metrica === "cantidad"
                          ? String(Math.round(v))
                          : `$${money(v)}`
                      }
                      width={64}
                    />
                    <Tooltip
                      formatter={(value: unknown, name: unknown) => {
                        const v = Number(value || 0);
                        const serie = String(name ?? "");
                        if (tab === "productos" && metrica === "cantidad") {
                          const u = serieProd.find((r) => r.producto === serie)?.unidad || "kg";
                          return [cantidadFmt(v, u), serie];
                        }
                        return [`$${money(v)}`, serie];
                      }}
                      contentStyle={{
                        borderRadius: 10, border: `1px solid ${C.border}`,
                        fontSize: 13, boxShadow: C.shadow,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    {seriesGrafica.map((s, i) => (
                      <Line
                        key={s}
                        type="monotone"
                        dataKey={s}
                        name={s}
                        stroke={SERIE_COLORS[i % SERIE_COLORS.length]}
                        strokeWidth={2.2}
                        dot={datosGrafica.length <= 40 ? { r: 2.5 } : false}
                        activeDot={{ r: 5 }}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* Resumen del periodo */}
        {haySeleccion && totales.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, marginBottom: 14 }}>
            {totales.slice(0, MAX_SERIES).map((t, i) => (
              <div key={t.clave} style={{
                background: C.cardStrong, borderRadius: 12, padding: 14,
                border: `1px solid ${C.border}`, boxShadow: C.shadow,
                borderLeft: `4px solid ${SERIE_COLORS[i % SERIE_COLORS.length]}`,
              }}>
                <div style={{ fontSize: 12, color: C.muted, fontWeight: 700, marginBottom: 4 }}>{t.clave}</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: C.text }}>${money(t.importe)}</div>
                <div style={{ fontSize: 11.5, color: C.muted, marginTop: 3 }}>
                  {tab === "productos" && `${ambasUnidades(t.cantidad_kg, t.cantidad_pza)} · `}
                  {t.tickets} tickets
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Solo CLIENTES: qué compra y qué día ────────────── */}
        {haySeleccion && tab === "clientes" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14, marginBottom: 14 }}>

            {/* Día de la semana */}
            <div style={{ background: C.cardStrong, borderRadius: 14, padding: 16, border: `1px solid ${C.border}`, boxShadow: C.shadow }}>
              <div style={{ fontWeight: 800, color: C.text, fontSize: 15 }}>¿Qué día compra más?</div>
              {mejorDia && (
                <div style={{ fontSize: 12.5, color: C.success, fontWeight: 700, marginTop: 3, marginBottom: 10 }}>
                  Su mejor día es el {mejorDia.dia} · ${money(mejorDia.importe)} en total
                  {mejorDia.dias_calendario > 0 && ` · $${money(mejorDia.importe_prom)} en promedio por ${mejorDia.dia.toLowerCase()}`}
                </div>
              )}
              {diaSemana.length === 0 ? (
                <div style={{ color: C.muted, fontSize: 13, padding: 20, textAlign: "center" }}>Sin datos</div>
              ) : (
                <div style={{ width: "100%", height: 240 }}>
                  <ResponsiveContainer>
                    <BarChart data={diaSemana} margin={{ top: 6, right: 8, left: 4, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(92,27,17,0.10)" />
                      <XAxis dataKey="dia" tick={{ fontSize: 10.5, fill: C.muted }} interval={0} />
                      <YAxis tick={{ fontSize: 11, fill: C.muted }} tickFormatter={(v: number) => `$${money(v)}`} width={62} />
                      <Tooltip
                        formatter={(v: unknown) => [`$${money(Number(v || 0))}`, "Vendido"]}
                        contentStyle={{ borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 13 }}
                      />
                      <Bar dataKey="importe" fill={C.primary} radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Top productos */}
            <div style={{ background: C.cardStrong, borderRadius: 14, padding: 16, border: `1px solid ${C.border}`, boxShadow: C.shadow }}>
              <div style={{ fontWeight: 800, color: C.text, fontSize: 15, marginBottom: 10 }}>¿Qué es lo que más compra?</div>
              {topProd.length === 0 ? (
                <div style={{ color: C.muted, fontSize: 13, padding: 20, textAlign: "center" }}>Sin datos</div>
              ) : (
                <div style={{ display: "grid", gap: 6, maxHeight: 260, overflowY: "auto" }}>
                  {topProd.map((p, i) => (
                    <div key={p.producto} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      gap: 10, padding: "8px 10px", borderRadius: 9,
                      background: i === 0 ? "rgba(31,122,77,0.07)" : "white",
                      border: `1px solid ${C.border}`,
                    }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 700, color: C.text, fontSize: 13 }}>
                          {i + 1}. {p.producto}
                        </div>
                        <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>
                          {ambasUnidades(p.cantidad_kg, p.cantidad_pza)} · {p.tickets} tickets · {p.pct}% de su gasto
                        </div>
                      </div>
                      <div style={{ fontWeight: 800, color: C.success, fontSize: 14, flexShrink: 0 }}>
                        ${money(p.importe)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tabla de detalle */}
        {haySeleccion && datosGrafica.length > 0 && (
          <div style={{ background: C.cardStrong, borderRadius: 14, padding: 16, border: `1px solid ${C.border}`, boxShadow: C.shadow, marginBottom: 30 }}>
            <div style={{ fontWeight: 800, color: C.text, fontSize: 15, marginBottom: 10 }}>
              Detalle {gran === "dia" ? "día por día" : gran === "semana" ? "semana por semana" : "mes por mes"}
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={th}>{gran === "mes" ? "Mes" : gran === "semana" ? "Semana del" : "Día"}</th>
                    {seriesGrafica.map((s, i) => (
                      <th key={s} style={{ ...th, textAlign: "right", color: SERIE_COLORS[i % SERIE_COLORS.length] }}>
                        {s}
                      </th>
                    ))}
                    <th style={{ ...th, textAlign: "right" }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {[...datosGrafica].reverse().map((fila) => {
                    const total = seriesGrafica.reduce((a, s) => a + Number(fila[s] || 0), 0);
                    return (
                      <tr key={String(fila.periodo)}>
                        <td style={{ ...td, fontWeight: 700 }}>{String(fila.periodo)}</td>
                        {seriesGrafica.map((s) => {
                          const v = Number(fila[s] || 0);
                          const u = serieProd.find((r) => r.producto === s)?.unidad || "kg";
                          return (
                            <td key={s} style={{ ...td, textAlign: "right" }}>
                              {v === 0 ? <span style={{ color: "rgba(122,90,82,0.4)" }}>—</span>
                                : tab === "productos" && metrica === "cantidad"
                                  ? cantidadFmt(v, u)
                                  : `$${money(v)}`}
                            </td>
                          );
                        })}
                        <td style={{ ...td, textAlign: "right", fontWeight: 800 }}>
                          {tab === "productos" && metrica === "cantidad"
                            ? total.toLocaleString("es-MX", { maximumFractionDigits: 1 })
                            : `$${money(total)}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const navBtn: React.CSSProperties = {
  padding: "8px 14px", borderRadius: 10, background: "white",
  border: `1px solid ${C.border}`, color: C.text,
  textDecoration: "none", fontWeight: 700, fontSize: 13,
};

const lbl: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: C.muted };

const inp: React.CSSProperties = {
  padding: "8px 10px", borderRadius: 9, border: `1px solid ${C.border}`,
  background: "white", color: C.text, fontSize: 13.5,
};

function chipBtn(activo: boolean): React.CSSProperties {
  return {
    padding: "7px 13px", borderRadius: 999, cursor: "pointer",
    border: `1.5px solid ${activo ? C.primary : C.border}`,
    background: activo ? C.primary : "white",
    color: activo ? "white" : C.text,
    fontWeight: 700, fontSize: 12.5,
  };
}

const th: React.CSSProperties = {
  textAlign: "left", padding: "9px 10px", borderBottom: `2px solid ${C.border}`,
  color: C.muted, fontSize: 12, fontWeight: 800, whiteSpace: "nowrap",
};

const td: React.CSSProperties = {
  padding: "8px 10px", borderBottom: `1px solid ${C.border}`,
  color: C.text, whiteSpace: "nowrap",
};
