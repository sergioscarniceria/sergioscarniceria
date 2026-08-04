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

type PuntoRow = {
  customer_id: string;
  nombre: string;
  telefono: string | null;
  puntos_balance: number;
  puntos_ganados: number;
  puntos_canjeados: number;
  valor_en_pesos: number;
  ultima_actividad: string | null;
  total_compras: number;
};

type Config = {
  puntos_por_peso: number;
  valor_punto: number;
  minimo_canje: number;
  canje_activo: boolean;
};

function money(n: number) {
  return Number(n || 0).toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtDate(v?: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("es-MX", {
    timeZone: "America/Mexico_City", day: "2-digit", month: "short", year: "numeric",
  });
}

export default function PuntosPage() {
  const supabase = getSupabaseClient();

  const [rows, setRows] = useState<PuntoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [config, setConfig] = useState<Config>({
    puntos_por_peso: 0.01, valor_punto: 1, minimo_canje: 50, canje_activo: false,
  });
  const [savingConfig, setSavingConfig] = useState(false);
  const [configMsg, setConfigMsg] = useState("");

  const loadConfig = useCallback(async () => {
    const { data } = await supabase.from("loyalty_config").select("*").eq("id", 1).single();
    if (data) {
      setConfig({
        puntos_por_peso: Number(data.puntos_por_peso || 0.01),
        valor_punto: Number(data.valor_punto || 1),
        minimo_canje: Number(data.minimo_canje || 50),
        canje_activo: Boolean(data.canje_activo),
      });
    }
  }, [supabase]);

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("resumen_puntos_clientes", {
        p_search: search.trim() || null,
      });
      if (error) {
        console.log("Error:", error);
        setRows([]);
      } else {
        setRows(
          (data || []).map((r: Record<string, unknown>) => ({
            customer_id: String(r.customer_id),
            nombre: String(r.nombre || ""),
            telefono: r.telefono ? String(r.telefono) : null,
            puntos_balance: Number(r.puntos_balance || 0),
            puntos_ganados: Number(r.puntos_ganados || 0),
            puntos_canjeados: Number(r.puntos_canjeados || 0),
            valor_en_pesos: Number(r.valor_en_pesos || 0),
            ultima_actividad: r.ultima_actividad ? String(r.ultima_actividad) : null,
            total_compras: Number(r.total_compras || 0),
          }))
        );
      }
    } finally {
      setLoading(false);
    }
  }, [supabase, search]);

  useEffect(() => { loadConfig(); }, [loadConfig]);
  useEffect(() => {
    const t = setTimeout(() => { loadRows(); }, 350);
    return () => clearTimeout(t);
  }, [loadRows]);

  async function guardarConfig() {
    setSavingConfig(true);
    setConfigMsg("");
    const { error } = await supabase
      .from("loyalty_config")
      .update({
        puntos_por_peso: config.puntos_por_peso,
        valor_punto: config.valor_punto,
        minimo_canje: config.minimo_canje,
        canje_activo: config.canje_activo,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
    if (error) {
      setConfigMsg("Error: " + error.message);
    } else {
      setConfigMsg("Configuración guardada");
      await loadRows();
      setTimeout(() => setConfigMsg(""), 2500);
    }
    setSavingConfig(false);
  }

  const totales = useMemo(() => ({
    clientes: rows.length,
    puntos: rows.reduce((a, r) => a + r.puntos_balance, 0),
    valor: rows.reduce((a, r) => a + r.valor_en_pesos, 0),
    canjeados: rows.reduce((a, r) => a + r.puntos_canjeados, 0),
  }), [rows]);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, padding: 16, fontFamily: "system-ui, -apple-system, Arial, sans-serif" }}>
      <div style={{ maxWidth: 1150, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <div>
            <h1 style={{ margin: 0, color: C.text, fontSize: 24 }}>Programa de puntos</h1>
            <p style={{ margin: "4px 0 0", color: C.muted, fontSize: 13 }}>
              Puntos acumulados por cliente y configuración del programa
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href="/admin/clientes" style={navBtn}>Clientes</Link>
            <Link href="/admin/dashboard" style={navBtn}>Dashboard</Link>
            <Link href="/" style={navBtn}>Inicio</Link>
          </div>
        </div>

        {/* Totales */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 16 }}>
          <Stat label="Clientes con puntos" value={String(totales.clientes)} />
          <Stat label="Puntos activos" value={money(totales.puntos)} color={C.info} />
          <Stat label="Valor en pesos" value={`$${money(totales.valor)}`} color={C.danger} />
          <Stat label="Puntos canjeados" value={money(totales.canjeados)} color={C.success} />
        </div>

        {/* Configuración */}
        <div style={{ background: C.cardStrong, borderRadius: 16, padding: 18, border: `1px solid ${C.border}`, marginBottom: 16, boxShadow: C.shadow }}>
          <h2 style={{ margin: "0 0 12px", fontSize: 17, color: C.text }}>Configuración del programa</h2>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={lbl}>Puntos por cada $100 vendidos</label>
              <input
                type="number" step="0.1" min="0"
                value={(config.puntos_por_peso * 100).toFixed(1)}
                onChange={(e) => setConfig({ ...config, puntos_por_peso: Number(e.target.value) / 100 })}
                style={inp}
              />
              <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>
                Ej. 1 = el cliente gana 1 punto por cada $100 de compra
              </div>
            </div>

            <div>
              <label style={lbl}>Valor de cada punto (pesos)</label>
              <input
                type="number" step="0.5" min="0"
                value={config.valor_punto}
                onChange={(e) => setConfig({ ...config, valor_punto: Number(e.target.value) })}
                style={inp}
              />
              <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>
                Cuánto descuenta cada punto al canjear
              </div>
            </div>

            <div>
              <label style={lbl}>Mínimo de puntos para canjear</label>
              <input
                type="number" step="10" min="0"
                value={config.minimo_canje}
                onChange={(e) => setConfig({ ...config, minimo_canje: Number(e.target.value) })}
                style={inp}
              />
              <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>
                = ${money(config.minimo_canje * config.valor_punto)} de descuento
              </div>
            </div>
          </div>

          <label style={{
            display: "flex", alignItems: "center", gap: 10, padding: 12, borderRadius: 10,
            background: config.canje_activo ? "rgba(31,122,77,0.07)" : "rgba(0,0,0,0.03)",
            border: `1px solid ${config.canje_activo ? "rgba(31,122,77,0.25)" : C.border}`,
            cursor: "pointer", marginBottom: 12,
          }}>
            <input
              type="checkbox"
              checked={config.canje_activo}
              onChange={(e) => setConfig({ ...config, canje_activo: e.target.checked })}
              style={{ width: 20, height: 20, cursor: "pointer" }}
            />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
                Permitir canje de puntos en caja
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                Si está apagado, los clientes siguen acumulando pero no pueden canjear todavía
              </div>
            </div>
          </label>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button onClick={guardarConfig} disabled={savingConfig} style={{
              padding: "11px 20px", borderRadius: 10, border: "none",
              background: C.primary, color: "white", fontWeight: 800, fontSize: 14,
              cursor: savingConfig ? "default" : "pointer", opacity: savingConfig ? 0.6 : 1,
            }}>
              {savingConfig ? "Guardando..." : "Guardar configuración"}
            </button>
            {configMsg && (
              <span style={{ fontSize: 13, fontWeight: 700, color: configMsg.startsWith("Error") ? C.danger : C.success }}>
                {configMsg}
              </span>
            )}
          </div>

          {/* Simulación */}
          <div style={{ marginTop: 14, padding: 12, background: "rgba(53,92,125,0.05)", borderRadius: 10, fontSize: 13, color: C.text }}>
            <b style={{ color: C.info }}>Ejemplo:</b> un cliente que compra <b>$1,000</b> gana{" "}
            <b>{(1000 * config.puntos_por_peso).toFixed(0)} puntos</b> = ${money(1000 * config.puntos_por_peso * config.valor_punto)} para su próxima compra.
            {" "}Su pasivo total actual es de <b>${money(totales.valor)}</b>.
          </div>
        </div>

        {/* Buscador */}
        <input
          placeholder="Buscar cliente por nombre o teléfono..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%", padding: "12px 14px", borderRadius: 12,
            border: `1px solid ${C.border}`, fontSize: 15, color: C.text,
            background: "white", boxSizing: "border-box", marginBottom: 14,
          }}
        />

        {/* Lista */}
        <div style={{ background: C.cardStrong, borderRadius: 16, border: `1px solid ${C.border}`, boxShadow: C.shadow, overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: C.muted }}>Cargando...</div>
          ) : rows.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: C.muted }}>
              {search ? `Sin resultados para "${search}"` : "Ningún cliente tiene puntos todavía"}
            </div>
          ) : (
            rows.map((r, i) => (
              <div key={r.customer_id} style={{
                padding: "14px 18px",
                borderTop: i === 0 ? "none" : `1px solid ${C.border}`,
                display: "flex", justifyContent: "space-between", alignItems: "center",
                gap: 12, flexWrap: "wrap",
              }}>
                <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                  <div style={{ fontWeight: 800, color: C.text, fontSize: 15 }}>
                    <span style={{ color: C.muted, fontSize: 12, marginRight: 8 }}>#{i + 1}</span>
                    {r.nombre}
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>
                    {r.telefono || "sin teléfono"} · Compras: ${money(r.total_compras)}
                    {r.ultima_actividad && ` · Últ. punto: ${fmtDate(r.ultima_actividad)}`}
                  </div>
                  {r.puntos_canjeados > 0 && (
                    <div style={{ fontSize: 11, color: C.success, marginTop: 2, fontWeight: 600 }}>
                      Ya canjeó {money(r.puntos_canjeados)} puntos
                    </div>
                  )}
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: C.info }}>
                    {money(r.puntos_balance)}
                    <span style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}> pts</span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.danger }}>
                    ${money(r.valor_en_pesos)}
                  </div>
                </div>
              </div>
            ))
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
      <div style={{ fontSize: 24, fontWeight: 900, color: color || C.text, marginTop: 4 }}>{value}</div>
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

const inp: React.CSSProperties = {
  width: "100%", padding: "10px 12px", borderRadius: 10,
  border: `1px solid ${C.border}`, fontSize: 15, fontWeight: 700, color: C.text,
  background: "white", boxSizing: "border-box",
};
