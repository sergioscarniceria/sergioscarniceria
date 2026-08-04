"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { getAdminSecret } from "@/lib/admin-secret";

const C = {
  bg: "#f7f1e8",
  bgSoft: "#fbf8f3",
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

type Resumen = {
  empleado_id: string;
  nombre: string;
  rol: string;
  retardos_mes: number;
  amonestaciones_mes: number;
  faltas_mes: number;
  faltas_por_retardo: number;
  faltas_totales: number;
  cartas_generadas: number;
  enfermedad_usados_anio: number;
  enfermedad_disponibles: number;
  minutos_retardo_mes: number;
};

type Incidencia = {
  id: string;
  empleado_id: string;
  tipo: string;
  fecha: string;
  motivo: string | null;
  minutos_retardo: number | null;
  origen: string;
  registrado_por: string | null;
};

const TIPO_LABEL: Record<string, string> = {
  retardo: "Retardo",
  amonestacion: "Amonestación",
  falta: "Falta",
  enfermedad: "Día de enfermedad",
  carta: "Carta administrativa",
};

const TIPO_COLOR: Record<string, string> = {
  retardo: C.warning,
  amonestacion: C.danger,
  falta: C.danger,
  enfermedad: C.info,
  carta: "#8B0000",
};

function mesActual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function nombreMes(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
}

export default function IncidenciasPage() {
  const supabase = getSupabaseClient();

  const [resumen, setResumen] = useState<Resumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [mes, setMes] = useState(mesActual());
  const [search, setSearch] = useState("");

  // Modal registrar
  const [showModal, setShowModal] = useState(false);
  const [modalEmpleado, setModalEmpleado] = useState<Resumen | null>(null);
  const [tipo, setTipo] = useState("amonestacion");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [motivo, setMotivo] = useState("");
  const [minutos, setMinutos] = useState("");
  const [registradoPor, setRegistradoPor] = useState("");
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState("");

  // Detalle expandido
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<Incidencia[]>([]);
  const [loadingDetalle, setLoadingDetalle] = useState(false);

  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  const loadResumen = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("resumen_incidencias", {
        p_mes: mes,
        p_anio: Number(mes.slice(0, 4)),
      });
      if (error) {
        console.log("Error:", error);
        setResumen([]);
      } else {
        setResumen(
          (data || []).map((r: Record<string, unknown>) => ({
            empleado_id: String(r.empleado_id),
            nombre: String(r.nombre || ""),
            rol: String(r.rol || ""),
            retardos_mes: Number(r.retardos_mes || 0),
            amonestaciones_mes: Number(r.amonestaciones_mes || 0),
            faltas_mes: Number(r.faltas_mes || 0),
            faltas_por_retardo: Number(r.faltas_por_retardo || 0),
            faltas_totales: Number(r.faltas_totales || 0),
            cartas_generadas: Number(r.cartas_generadas || 0),
            enfermedad_usados_anio: Number(r.enfermedad_usados_anio || 0),
            enfermedad_disponibles: Number(r.enfermedad_disponibles || 0),
            minutos_retardo_mes: Number(r.minutos_retardo_mes || 0),
          }))
        );
      }
    } finally {
      setLoading(false);
    }
  }, [supabase, mes]);

  useEffect(() => { loadResumen(); }, [loadResumen]);

  async function sincronizarChecador() {
    setSyncing(true);
    setSyncMsg("");
    try {
      const inicio = mes;
      const d = new Date(`${mes}T12:00:00`);
      d.setMonth(d.getMonth() + 1);
      d.setDate(0);
      const fin = d.toISOString().slice(0, 10);

      const { data, error } = await supabase.rpc("sincronizar_retardos_checador", {
        p_desde: inicio,
        p_hasta: fin,
        p_tolerancia_min: 10,
      });
      if (error) {
        setSyncMsg("Error: " + error.message);
      } else if (data && data.length > 0) {
        setSyncMsg(data[0].detalle || "Sincronizado");
        await loadResumen();
      }
    } catch (err: unknown) {
      setSyncMsg("Error: " + (err instanceof Error ? err.message : "desconocido"));
    } finally {
      setSyncing(false);
    }
  }

  async function toggleDetalle(emp: Resumen) {
    if (expanded === emp.empleado_id) {
      setExpanded(null);
      setDetalle([]);
      return;
    }
    setExpanded(emp.empleado_id);
    setLoadingDetalle(true);
    try {
      const d = new Date(`${mes}T12:00:00`);
      d.setMonth(d.getMonth() + 1);
      d.setDate(0);
      const fin = d.toISOString().slice(0, 10);

      const res = await fetch(
        `/api/admin/incidencias?empleado_id=${emp.empleado_id}&desde=${mes}&hasta=${fin}`,
        { headers: { "x-admin-secret": getAdminSecret() } }
      );
      const data = await res.json();
      setDetalle(Array.isArray(data) ? data : []);
    } finally {
      setLoadingDetalle(false);
    }
  }

  function abrirModal(emp: Resumen) {
    setModalEmpleado(emp);
    setTipo("amonestacion");
    setFecha(new Date().toISOString().slice(0, 10));
    setMotivo("");
    setMinutos("");
    setModalError("");
    setShowModal(true);
  }

  async function guardarIncidencia() {
    if (!modalEmpleado) return;
    if (!registradoPor.trim()) { setModalError("Escribe tu nombre"); return; }
    if (!motivo.trim() && tipo !== "enfermedad") { setModalError("Escribe el motivo"); return; }

    setSaving(true);
    setModalError("");
    try {
      const res = await fetch("/api/admin/incidencias", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-secret": getAdminSecret() },
        body: JSON.stringify({
          empleado_id: modalEmpleado.empleado_id,
          tipo,
          fecha,
          motivo: motivo.trim() || null,
          minutos_retardo: tipo === "retardo" ? Number(minutos || 0) : null,
          registrado_por: registradoPor.trim(),
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        setModalError(result.error || "No se pudo guardar");
        setSaving(false);
        return;
      }
      setShowModal(false);
      await loadResumen();
      if (expanded === modalEmpleado.empleado_id) {
        await toggleDetalle(modalEmpleado);
        await toggleDetalle(modalEmpleado);
      }
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function eliminarIncidencia(id: string) {
    if (!confirm("¿Eliminar esta incidencia?")) return;
    await fetch("/api/admin/incidencias", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", "x-admin-secret": getAdminSecret() },
      body: JSON.stringify({ id }),
    });
    setDetalle((prev) => prev.filter((d) => d.id !== id));
    await loadResumen();
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return resumen;
    const q = search.toLowerCase().trim();
    return resumen.filter((r) => r.nombre.toLowerCase().includes(q) || r.rol.toLowerCase().includes(q));
  }, [resumen, search]);

  const totales = useMemo(() => ({
    retardos: resumen.reduce((a, r) => a + r.retardos_mes, 0),
    amonestaciones: resumen.reduce((a, r) => a + r.amonestaciones_mes, 0),
    faltas: resumen.reduce((a, r) => a + r.faltas_totales, 0),
    cartas: resumen.reduce((a, r) => a + r.cartas_generadas, 0),
  }), [resumen]);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, padding: 16, fontFamily: "system-ui, -apple-system, Arial, sans-serif" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <div>
            <h1 style={{ margin: 0, color: C.text, fontSize: 24 }}>Incidencias de personal</h1>
            <p style={{ margin: "4px 0 0", color: C.muted, fontSize: 13 }}>
              Retardos, amonestaciones, faltas y días de enfermedad — {nombreMes(mes)}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href="/admin/dashboard/asistencia" style={navBtn}>Asistencia</Link>
            <Link href="/admin/pins" style={navBtn}>Empleados</Link>
            <Link href="/" style={navBtn}>Inicio</Link>
          </div>
        </div>

        {/* Reglas */}
        <div style={{
          background: "rgba(166,106,16,0.06)", borderRadius: 12, padding: "12px 16px",
          border: `1px solid rgba(166,106,16,0.20)`, marginBottom: 16, fontSize: 13, color: C.text,
        }}>
          <b style={{ color: C.warning }}>Reglas activas:</b>{" "}
          3 retardos = 1 falta · 5 amonestaciones = 1 carta administrativa · 3 días de enfermedad por año
          (los no usados se suman al aguinaldo) · Los contadores se reinician cada mes
        </div>

        {/* Controles */}
        <div style={{ background: C.cardStrong, borderRadius: 16, padding: 16, border: `1px solid ${C.border}`, marginBottom: 16, boxShadow: C.shadow }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <input
              placeholder="Buscar empleado..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ flex: "1 1 200px", padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, color: C.text, background: "white" }}
            />
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <label style={{ fontSize: 12, color: C.muted, fontWeight: 700 }}>Mes:</label>
              <input
                type="month"
                value={mes.slice(0, 7)}
                onChange={(e) => setMes(`${e.target.value}-01`)}
                style={{ padding: "8px 10px", borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 13, color: C.text, background: "white" }}
              />
            </div>
            <button onClick={sincronizarChecador} disabled={syncing} style={{
              padding: "10px 16px", borderRadius: 10, border: "none",
              background: C.info, color: "white", fontWeight: 700, fontSize: 13,
              cursor: syncing ? "default" : "pointer", opacity: syncing ? 0.6 : 1,
            }}>
              {syncing ? "Sincronizando..." : "Sincronizar retardos del checador"}
            </button>
          </div>
          {syncMsg && (
            <div style={{ marginTop: 10, padding: 8, background: "rgba(53,92,125,0.08)", borderRadius: 8, fontSize: 12, color: C.info }}>
              {syncMsg}
            </div>
          )}
        </div>

        {/* Totales */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 16 }}>
          <Stat label="Retardos" value={totales.retardos} color={C.warning} />
          <Stat label="Amonestaciones" value={totales.amonestaciones} color={C.danger} />
          <Stat label="Faltas totales" value={totales.faltas} color={C.danger} />
          <Stat label="Cartas generadas" value={totales.cartas} color="#8B0000" />
        </div>

        {/* Lista */}
        <div style={{ background: C.cardStrong, borderRadius: 16, border: `1px solid ${C.border}`, boxShadow: C.shadow, overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: C.muted }}>Cargando...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: C.muted }}>Sin empleados</div>
          ) : (
            filtered.map((r, i) => {
              const isOpen = expanded === r.empleado_id;
              const alerta = r.faltas_totales > 0 || r.cartas_generadas > 0;
              return (
                <div key={r.empleado_id} style={{ borderTop: i === 0 ? "none" : `1px solid ${C.border}` }}>
                  <div style={{
                    padding: "14px 18px",
                    background: isOpen ? "rgba(123,34,24,0.04)" : alerta ? "rgba(180,35,24,0.03)" : "transparent",
                    display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap",
                  }}>
                    <div
                      onClick={() => toggleDetalle(r)}
                      style={{ flex: "1 1 200px", minWidth: 0, cursor: "pointer" }}
                    >
                      <div style={{ fontWeight: 800, color: C.text, fontSize: 15 }}>
                        <span style={{ color: C.muted, fontSize: 11, marginRight: 6 }}>{isOpen ? "▼" : "▶"}</span>
                        {r.nombre}
                        <span style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginLeft: 8 }}>{r.rol}</span>
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                        <Chip label={`${r.retardos_mes} retardo${r.retardos_mes === 1 ? "" : "s"}`} color={r.retardos_mes > 0 ? C.warning : C.muted} />
                        <Chip label={`${r.amonestaciones_mes} amonest.`} color={r.amonestaciones_mes > 0 ? C.danger : C.muted} />
                        {r.faltas_totales > 0 && <Chip label={`${r.faltas_totales} falta${r.faltas_totales === 1 ? "" : "s"}`} color={C.danger} strong />}
                        {r.cartas_generadas > 0 && <Chip label={`${r.cartas_generadas} CARTA${r.cartas_generadas === 1 ? "" : "S"}`} color="#8B0000" strong />}
                        <Chip label={`Enfermedad: ${r.enfermedad_disponibles}/3`} color={r.enfermedad_disponibles === 0 ? C.danger : C.info} />
                      </div>
                      {r.faltas_por_retardo > 0 && (
                        <div style={{ fontSize: 11, color: C.danger, marginTop: 4, fontWeight: 600 }}>
                          {r.faltas_por_retardo} falta(s) generada(s) por acumular retardos
                        </div>
                      )}
                    </div>
                    <button onClick={() => abrirModal(r)} style={{
                      padding: "8px 14px", borderRadius: 10, border: "none",
                      background: C.primary, color: "white", fontWeight: 700, fontSize: 13, cursor: "pointer",
                    }}>
                      + Registrar
                    </button>
                  </div>

                  {isOpen && (
                    <div style={{ padding: "0 18px 16px", background: "rgba(123,34,24,0.02)" }}>
                      {loadingDetalle ? (
                        <div style={{ padding: 16, textAlign: "center", color: C.muted, fontSize: 13 }}>Cargando...</div>
                      ) : detalle.length === 0 ? (
                        <div style={{ padding: 16, textAlign: "center", color: C.muted, fontSize: 13 }}>Sin incidencias este mes</div>
                      ) : (
                        <div style={{ display: "grid", gap: 6 }}>
                          {detalle.map((d) => (
                            <div key={d.id} style={{
                              padding: "10px 12px", background: "white", borderRadius: 10,
                              border: `1px solid ${C.border}`, display: "flex",
                              justifyContent: "space-between", alignItems: "center", gap: 10,
                            }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: TIPO_COLOR[d.tipo] || C.text }}>
                                  {TIPO_LABEL[d.tipo] || d.tipo}
                                  {d.minutos_retardo ? ` (${d.minutos_retardo} min)` : ""}
                                  {d.origen === "checador" && (
                                    <span style={{ marginLeft: 8, fontSize: 10, padding: "1px 6px", borderRadius: 5, background: "rgba(53,92,125,0.12)", color: C.info, fontWeight: 700 }}>
                                      AUTO
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                                  {new Date(`${d.fecha}T12:00:00`).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}
                                  {d.registrado_por && ` · ${d.registrado_por}`}
                                </div>
                                {d.motivo && (
                                  <div style={{ fontSize: 12, color: C.text, marginTop: 3 }}>{d.motivo}</div>
                                )}
                              </div>
                              <button onClick={() => eliminarIncidencia(d.id)} style={{
                                padding: "4px 10px", borderRadius: 8, border: `1px solid rgba(180,35,24,0.25)`,
                                background: "transparent", color: C.danger, fontWeight: 700, fontSize: 11, cursor: "pointer",
                              }}>
                                Eliminar
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modal registrar */}
      {showModal && modalEmpleado && (
        <div onClick={() => !saving && setShowModal(false)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16,
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: "white", borderRadius: 18, padding: 22, width: "100%", maxWidth: 460,
            boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div>
                <h2 style={{ margin: 0, color: C.text, fontSize: 19 }}>Registrar incidencia</h2>
                <p style={{ margin: "3px 0 0", color: C.muted, fontSize: 13 }}>{modalEmpleado.nombre}</p>
              </div>
              <button onClick={() => setShowModal(false)} style={{ background: "transparent", border: "none", fontSize: 24, cursor: "pointer", color: C.muted }}>×</button>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <div>
                <label style={lbl}>Tipo *</label>
                <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={inp}>
                  <option value="amonestacion">Amonestación</option>
                  <option value="retardo">Retardo</option>
                  <option value="falta">Falta</option>
                  <option value="enfermedad">Día de enfermedad</option>
                </select>
                {tipo === "enfermedad" && (
                  <div style={{ fontSize: 11, color: modalEmpleado.enfermedad_disponibles > 0 ? C.info : C.danger, marginTop: 4 }}>
                    Disponibles este año: <b>{modalEmpleado.enfermedad_disponibles} de 3</b>
                  </div>
                )}
              </div>

              <div>
                <label style={lbl}>Fecha</label>
                <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={inp} />
              </div>

              {tipo === "retardo" && (
                <div>
                  <label style={lbl}>Minutos de retardo</label>
                  <input type="number" value={minutos} onChange={(e) => setMinutos(e.target.value)} placeholder="Ej. 15" style={inp} />
                </div>
              )}

              <div>
                <label style={lbl}>Motivo {tipo !== "enfermedad" && "*"}</label>
                <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2}
                  placeholder={tipo === "amonestacion" ? "Ej. No usó cofia, dejó el área sucia..." : "Detalle"}
                  style={{ ...inp, resize: "vertical" }} />
              </div>

              <div>
                <label style={lbl}>Tu nombre *</label>
                <input value={registradoPor} onChange={(e) => setRegistradoPor(e.target.value)} placeholder="Quién registra" style={inp} />
              </div>

              {modalError && (
                <div style={{ padding: 10, background: "rgba(180,35,24,0.08)", color: C.danger, borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
                  {modalError}
                </div>
              )}

              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button onClick={() => setShowModal(false)} disabled={saving} style={{
                  flex: 1, padding: "12px", borderRadius: 10, border: `1px solid ${C.border}`,
                  background: "white", color: C.text, fontWeight: 700, cursor: "pointer",
                }}>Cancelar</button>
                <button onClick={guardarIncidencia} disabled={saving} style={{
                  flex: 1, padding: "12px", borderRadius: 10, border: "none",
                  background: C.primary, color: "white", fontWeight: 800,
                  cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1,
                }}>{saving ? "Guardando..." : "Registrar"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: C.cardStrong, borderRadius: 14, padding: 14, border: `1px solid ${C.border}`, boxShadow: C.shadow }}>
      <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 900, color, marginTop: 4 }}>{value}</div>
    </div>
  );
}

function Chip({ label, color, strong }: { label: string; color: string; strong?: boolean }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: strong ? 800 : 600, padding: "3px 9px", borderRadius: 7,
      background: strong ? color : `${color}18`, color: strong ? "white" : color,
    }}>
      {label}
    </span>
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
  border: `1px solid ${C.border}`, fontSize: 14, color: C.text,
  background: "white", boxSizing: "border-box",
};
