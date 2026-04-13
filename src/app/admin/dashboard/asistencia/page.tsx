"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

/* ───── Types ───── */

type Resumen = {
  empleado_id: string;
  fecha: string;
  hora_entrada: string | null;
  hora_salida: string | null;
  minutos_retardo: number | null;
  minutos_fuera: number | null;
  minutos_extra: number | null;
  total_eventos: number | null;
  total_salidas: number | null;
  estatus: string | null;
  empleados?: {
    id?: string;
    nombre?: string;
    rol?: string;
  } | null;
};

type Evento = {
  id: string;
  empleado_id: string;
  tipo_evento: string;
  timestamp_evento: string;
  foto_url: string | null;
  empleados?: { nombre?: string } | null;
};

type Empleado = {
  id: string;
  nombre: string;
  rol: string | null;
  activo: boolean;
};

type EmpleadoResumen = {
  id: string;
  nombre: string;
  rol: string | null;
  diasTrabajados: number;
  diasRetardo: number;
  diasPuntual: number;
  diasIncompletos: number;
  totalRetardo: number;
  totalFuera: number;
  totalExtra: number;
  totalBreaks: number;
  resumenesDiarios: Resumen[];
};

/* ───── Colors ───── */

const C = {
  bg: "#f7f3ee",
  card: "#ffffff",
  border: "#eadfd7",
  text: "#2f1e18",
  muted: "#7b6258",
  primary: "#7b2517",
  primaryDark: "#5a190f",
  success: "#1f6a35",
  successBg: "#e3f3e7",
  warning: "#9b6511",
  warningBg: "#fff2d9",
  danger: "#9a2e1f",
  dangerBg: "#fde7e3",
  info: "#2c5d99",
  infoBg: "#e3edf9",
  shadow: "0 6px 20px rgba(70,40,20,0.05)",
};

/* ───── Helpers ───── */

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function mondayOfWeek() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d.setDate(diff));
  return `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, "0")}-${String(mon.getDate()).padStart(2, "0")}`;
}

function fmtMinutes(mins: number): string {
  if (mins === 0) return "0 min";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

function fmtTime(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  if (isNaN(d.getTime())) return dateStr;
  const dias = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  return `${dias[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
}

function statusColor(estatus: string | null): { bg: string; color: string } {
  if (estatus === "puntual") return { bg: C.successBg, color: C.success };
  if (estatus === "retardo") return { bg: C.warningBg, color: C.warning };
  if (estatus === "jornada incompleta") return { bg: C.dangerBg, color: C.danger };
  if (estatus === "tiempo fuera excedido") return { bg: C.warningBg, color: C.warning };
  if (estatus === "día no laborable") return { bg: C.infoBg, color: C.info };
  return { bg: "#f0f0f0", color: "#666" };
}

function getTipoLabel(tipo: string) {
  if (tipo === "entrada") return "Entrada";
  if (tipo === "salida") return "Salida";
  if (tipo === "break_out") return "Salida al baño";
  if (tipo === "break_in") return "Regreso";
  return tipo;
}

function getTipoBadge(tipo: string): { bg: string; color: string } {
  if (tipo === "entrada") return { bg: C.successBg, color: C.success };
  if (tipo === "salida") return { bg: C.dangerBg, color: C.danger };
  if (tipo === "break_out") return { bg: C.warningBg, color: C.warning };
  if (tipo === "break_in") return { bg: C.infoBg, color: C.info };
  return { bg: "#f0f0f0", color: "#666" };
}

/* ───── Component ───── */

export default function AsistenciaDashboard() {
  const [loading, setLoading] = useState(true);
  const [desde, setDesde] = useState(mondayOfWeek());
  const [hasta, setHasta] = useState(todayStr());
  const [resumenes, setResumenes] = useState<Resumen[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [empleadoActivo, setEmpleadoActivo] = useState<string | null>(null);
  const [fotoActiva, setFotoActiva] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [desde, hasta]);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch(`/api/asistencia/resumen?desde=${desde}&hasta=${hasta}`);
      const json = await res.json();
      setResumenes(json.resumenes || []);
      setEventos(json.eventos || []);
      setEmpleados(json.empleados || []);
    } catch {
      setResumenes([]);
      setEventos([]);
      setEmpleados([]);
    }
    setLoading(false);
  }

  /* Agrupar resúmenes por empleado */
  const empleadosResumen: EmpleadoResumen[] = useMemo(() => {
    const map = new Map<string, EmpleadoResumen>();

    // Inicializar con todos los empleados activos
    for (const emp of empleados) {
      map.set(emp.id, {
        id: emp.id,
        nombre: emp.nombre,
        rol: emp.rol,
        diasTrabajados: 0,
        diasRetardo: 0,
        diasPuntual: 0,
        diasIncompletos: 0,
        totalRetardo: 0,
        totalFuera: 0,
        totalExtra: 0,
        totalBreaks: 0,
        resumenesDiarios: [],
      });
    }

    for (const r of resumenes) {
      let emp = map.get(r.empleado_id);
      if (!emp) {
        emp = {
          id: r.empleado_id,
          nombre: r.empleados?.nombre || "Sin nombre",
          rol: r.empleados?.rol || null,
          diasTrabajados: 0,
          diasRetardo: 0,
          diasPuntual: 0,
          diasIncompletos: 0,
          totalRetardo: 0,
          totalFuera: 0,
          totalExtra: 0,
          totalBreaks: 0,
          resumenesDiarios: [],
        };
        map.set(r.empleado_id, emp);
      }

      emp.resumenesDiarios.push(r);

      if (r.estatus === "día no laborable") continue;

      emp.diasTrabajados++;
      emp.totalRetardo += Number(r.minutos_retardo || 0);
      emp.totalFuera += Number(r.minutos_fuera || 0);
      emp.totalExtra += Number(r.minutos_extra || 0);
      emp.totalBreaks += Number(r.total_salidas || 0);

      if (r.estatus === "puntual") emp.diasPuntual++;
      if (r.estatus === "retardo") emp.diasRetardo++;
      if (r.estatus === "jornada incompleta") emp.diasIncompletos++;
    }

    return Array.from(map.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [resumenes, empleados]);

  /* Totales generales */
  const totalRetardoGlobal = empleadosResumen.reduce((s, e) => s + e.totalRetardo, 0);
  const totalFueraGlobal = empleadosResumen.reduce((s, e) => s + e.totalFuera, 0);

  /* Empleado activo detalle */
  const empActivo = useMemo(() => {
    if (!empleadoActivo) return null;
    return empleadosResumen.find((e) => e.id === empleadoActivo) || null;
  }, [empleadoActivo, empleadosResumen]);

  const eventosActivo = useMemo(() => {
    if (!empleadoActivo) return [];
    return eventos.filter((e) => e.empleado_id === empleadoActivo);
  }, [empleadoActivo, eventos]);

  /* Eventos agrupados por fecha para el desglose */
  const eventosPorFecha = useMemo(() => {
    const map = new Map<string, Evento[]>();
    for (const ev of eventosActivo) {
      const fecha = ev.timestamp_evento.slice(0, 10);
      if (!map.has(fecha)) map.set(fecha, []);
      map.get(fecha)!.push(ev);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [eventosActivo]);

  if (loading) {
    return <div style={pageStyle}><div style={loadingCard}>Cargando asistencias...</div></div>;
  }

  return (
    <div style={pageStyle}>
      {/* Header */}
      <div style={topBar}>
        <div>
          <h1 style={{ margin: 0, color: C.text, fontSize: 28 }}>Dashboard Asistencia</h1>
          <p style={{ margin: "6px 0 0 0", color: C.muted, fontSize: 14 }}>
            Resumen semanal para nómina
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/" style={linkBtn}>Inicio</Link>
          <Link href="/asistencia/checador" style={linkBtn}>Checador</Link>
          <Link href="/admin/dashboard" style={linkBtn}>Dashboard ventas</Link>
        </div>
      </div>

      {/* Filtros de fecha */}
      <div style={filtersCard}>
        <div style={filtersGrid}>
          <div>
            <div style={fieldLabel}>Desde</div>
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <div style={fieldLabel}>Hasta</div>
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <div style={fieldLabel}>Rango rápido</div>
            <button
              style={{ ...secondaryBtn, width: "100%", height: 46 }}
              onClick={() => { setDesde(mondayOfWeek()); setHasta(todayStr()); }}
            >
              Esta semana
            </button>
          </div>
        </div>
      </div>

      {/* Tarjetas resumen global */}
      <div style={statsGrid}>
        <div style={statCard}>
          <div style={statLabel}>Empleados activos</div>
          <div style={statValue}>{empleados.length}</div>
        </div>
        <div style={{ ...statCard, background: totalRetardoGlobal > 0 ? C.warningBg : C.successBg }}>
          <div style={statLabel}>Retardo total (todos)</div>
          <div style={{ ...statValue, color: totalRetardoGlobal > 0 ? C.warning : C.success }}>
            {fmtMinutes(totalRetardoGlobal)}
          </div>
        </div>
        <div style={statCard}>
          <div style={statLabel}>Tiempo fuera total</div>
          <div style={statValue}>{fmtMinutes(totalFueraGlobal)}</div>
        </div>
        <div style={statCard}>
          <div style={statLabel}>Registros en el rango</div>
          <div style={statValue}>{resumenes.length}</div>
        </div>
      </div>

      {/* ═══ VISTA PRINCIPAL: lista de empleados con resumen ═══ */}
      {!empleadoActivo && (
        <div style={panelStyle}>
          <h2 style={{ margin: "0 0 16px 0", color: C.text }}>Resumen por empleado</h2>

          {empleadosResumen.length === 0 ? (
            <div style={emptyBox}>No hay empleados registrados</div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {empleadosResumen.map((emp) => {
                const tiempoPerdido = emp.totalRetardo + emp.totalFuera;
                const perdidoColor = tiempoPerdido > 60 ? C.danger : tiempoPerdido > 0 ? C.warning : C.success;

                return (
                  <div key={emp.id} style={empCard}>
                    <div style={empCardTop}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>{emp.nombre}</div>
                        {emp.rol && <div style={{ color: C.muted, fontSize: 13, marginTop: 2 }}>{emp.rol}</div>}
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 12, color: C.muted }}>Tiempo perdido</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: perdidoColor }}>
                          {fmtMinutes(tiempoPerdido)}
                        </div>
                      </div>
                    </div>

                    <div style={empMetricsGrid}>
                      <div style={metricItem}>
                        <div style={metricLabel}>Días trabajados</div>
                        <div style={metricValue}>{emp.diasTrabajados}</div>
                      </div>
                      <div style={metricItem}>
                        <div style={metricLabel}>Puntual</div>
                        <div style={{ ...metricValue, color: C.success }}>{emp.diasPuntual}</div>
                      </div>
                      <div style={metricItem}>
                        <div style={metricLabel}>Retardos</div>
                        <div style={{ ...metricValue, color: emp.diasRetardo > 0 ? C.warning : C.success }}>
                          {emp.diasRetardo}
                        </div>
                      </div>
                      <div style={metricItem}>
                        <div style={metricLabel}>Min. retardo</div>
                        <div style={{ ...metricValue, color: emp.totalRetardo > 0 ? C.warning : C.text }}>
                          {fmtMinutes(emp.totalRetardo)}
                        </div>
                      </div>
                      <div style={metricItem}>
                        <div style={metricLabel}>Min. fuera</div>
                        <div style={{ ...metricValue, color: emp.totalFuera > 30 ? C.warning : C.text }}>
                          {fmtMinutes(emp.totalFuera)}
                        </div>
                      </div>
                      <div style={metricItem}>
                        <div style={metricLabel}>Breaks</div>
                        <div style={metricValue}>{emp.totalBreaks}</div>
                      </div>
                    </div>

                    <button
                      style={primaryBtn}
                      onClick={() => setEmpleadoActivo(emp.id)}
                    >
                      Ver desglose
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══ VISTA DESGLOSE: detalle de un empleado ═══ */}
      {empleadoActivo && empActivo && (
        <div style={panelStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
            <div>
              <h2 style={{ margin: 0, color: C.text }}>Desglose: {empActivo.nombre}</h2>
              {empActivo.rol && <div style={{ color: C.muted, fontSize: 14, marginTop: 4 }}>{empActivo.rol}</div>}
            </div>
            <button style={secondaryBtn} onClick={() => setEmpleadoActivo(null)}>
              Volver al resumen
            </button>
          </div>

          {/* Métricas del empleado */}
          <div style={{ ...empMetricsGrid, marginBottom: 20 }}>
            <div style={metricItem}>
              <div style={metricLabel}>Días trabajados</div>
              <div style={metricValue}>{empActivo.diasTrabajados}</div>
            </div>
            <div style={metricItem}>
              <div style={metricLabel}>Días puntual</div>
              <div style={{ ...metricValue, color: C.success }}>{empActivo.diasPuntual}</div>
            </div>
            <div style={metricItem}>
              <div style={metricLabel}>Días con retardo</div>
              <div style={{ ...metricValue, color: empActivo.diasRetardo > 0 ? C.warning : C.success }}>
                {empActivo.diasRetardo}
              </div>
            </div>
            <div style={metricItem}>
              <div style={metricLabel}>Jornadas incompletas</div>
              <div style={{ ...metricValue, color: empActivo.diasIncompletos > 0 ? C.danger : C.text }}>
                {empActivo.diasIncompletos}
              </div>
            </div>
            <div style={metricItem}>
              <div style={metricLabel}>Total retardo</div>
              <div style={{ ...metricValue, color: empActivo.totalRetardo > 0 ? C.warning : C.success }}>
                {fmtMinutes(empActivo.totalRetardo)}
              </div>
            </div>
            <div style={metricItem}>
              <div style={metricLabel}>Total fuera (breaks)</div>
              <div style={metricValue}>{fmtMinutes(empActivo.totalFuera)}</div>
            </div>
            <div style={metricItem}>
              <div style={metricLabel}>Veces al baño</div>
              <div style={metricValue}>{empActivo.totalBreaks}</div>
            </div>
            <div style={metricItem}>
              <div style={metricLabel}>Tiempo extra</div>
              <div style={{ ...metricValue, color: empActivo.totalExtra > 0 ? C.info : C.text }}>
                {fmtMinutes(empActivo.totalExtra)}
              </div>
            </div>
          </div>

          {/* Tabla día por día */}
          <h3 style={{ margin: "0 0 12px 0", color: C.text }}>Día por día</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Fecha</th>
                  <th style={thStyle}>Entrada</th>
                  <th style={thStyle}>Salida</th>
                  <th style={thStyle}>Retardo</th>
                  <th style={thStyle}>Fuera</th>
                  <th style={thStyle}>Extra</th>
                  <th style={thStyle}>Breaks</th>
                  <th style={thStyle}>Estatus</th>
                </tr>
              </thead>
              <tbody>
                {empActivo.resumenesDiarios.length === 0 ? (
                  <tr><td style={tdStyle} colSpan={8}>Sin registros en este rango</td></tr>
                ) : (
                  empActivo.resumenesDiarios
                    .sort((a, b) => b.fecha.localeCompare(a.fecha))
                    .map((r) => {
                      const sc = statusColor(r.estatus);
                      return (
                        <tr key={r.fecha}>
                          <td style={{ ...tdStyle, fontWeight: 700 }}>{fmtDate(r.fecha)}</td>
                          <td style={tdStyle}>{fmtTime(r.hora_entrada)}</td>
                          <td style={tdStyle}>{fmtTime(r.hora_salida)}</td>
                          <td style={{ ...tdStyle, color: Number(r.minutos_retardo || 0) > 0 ? C.warning : C.text }}>
                            {fmtMinutes(Number(r.minutos_retardo || 0))}
                          </td>
                          <td style={tdStyle}>{fmtMinutes(Number(r.minutos_fuera || 0))}</td>
                          <td style={{ ...tdStyle, color: Number(r.minutos_extra || 0) > 0 ? C.info : C.text }}>
                            {fmtMinutes(Number(r.minutos_extra || 0))}
                          </td>
                          <td style={tdStyle}>{Number(r.total_salidas || 0)}</td>
                          <td style={tdStyle}>
                            <span style={{ ...badgeBase, background: sc.bg, color: sc.color }}>
                              {r.estatus || "sin dato"}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>

          {/* Eventos detallados agrupados por fecha */}
          <h3 style={{ margin: "24px 0 12px 0", color: C.text }}>Movimientos detallados</h3>
          {eventosPorFecha.length === 0 ? (
            <div style={emptyBox}>No hay movimientos en este rango</div>
          ) : (
            eventosPorFecha.map(([fecha, evts]) => (
              <div key={fecha} style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 700, color: C.text, marginBottom: 8, fontSize: 15 }}>
                  {fmtDate(fecha)}
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {evts.map((ev) => {
                    const tb = getTipoBadge(ev.tipo_evento);
                    return (
                      <div key={ev.id} style={eventRow}>
                        <span style={{ ...badgeBase, background: tb.bg, color: tb.color, fontSize: 12 }}>
                          {getTipoLabel(ev.tipo_evento)}
                        </span>
                        <span style={{ color: C.text, fontWeight: 600 }}>{fmtTime(ev.timestamp_evento)}</span>
                        {ev.foto_url ? (
                          <img
                            src={ev.foto_url}
                            alt="foto"
                            style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover", cursor: "pointer", border: `1px solid ${C.border}` }}
                            onClick={() => setFotoActiva(ev.foto_url)}
                          />
                        ) : (
                          <span style={{ color: C.muted, fontSize: 12 }}>Sin foto</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal foto */}
      {fotoActiva && (
        <div style={modalOverlay} onClick={() => setFotoActiva(null)}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <strong>Foto de asistencia</strong>
              <button style={secondaryBtn} onClick={() => setFotoActiva(null)}>Cerrar</button>
            </div>
            <img src={fotoActiva} alt="foto grande" style={{ width: "100%", maxHeight: "75vh", objectFit: "contain", borderRadius: 14, background: C.bg }} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ───── Styles ───── */

const pageStyle: React.CSSProperties = {
  padding: 20,
  background: C.bg,
  minHeight: "100vh",
  fontFamily: "Arial, sans-serif",
  color: C.text,
};

const loadingCard: React.CSSProperties = {
  padding: 20,
  borderRadius: 18,
  background: C.card,
  border: `1px solid ${C.border}`,
  boxShadow: C.shadow,
};

const topBar: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  flexWrap: "wrap",
  marginBottom: 20,
};

const linkBtn: React.CSSProperties = {
  display: "inline-block",
  padding: "10px 16px",
  borderRadius: 12,
  border: `1px solid ${C.border}`,
  background: "rgba(255,255,255,0.75)",
  color: C.text,
  textDecoration: "none",
  fontWeight: 700,
  fontSize: 14,
};

const filtersCard: React.CSSProperties = {
  background: C.card,
  border: `1px solid ${C.border}`,
  borderRadius: 20,
  padding: 18,
  boxShadow: C.shadow,
  marginBottom: 20,
};

const filtersGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: 14,
};

const fieldLabel: React.CSSProperties = {
  color: C.muted,
  fontSize: 13,
  fontWeight: 700,
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 12,
  border: `1px solid ${C.border}`,
  background: "#fff",
  fontSize: 15,
  color: C.text,
  outline: "none",
  boxSizing: "border-box",
};

const statsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: 14,
  marginBottom: 20,
};

const statCard: React.CSSProperties = {
  background: C.card,
  border: `1px solid ${C.border}`,
  borderRadius: 18,
  padding: 16,
  boxShadow: C.shadow,
};

const statLabel: React.CSSProperties = {
  fontSize: 13,
  color: C.muted,
  marginBottom: 8,
};

const statValue: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 800,
  lineHeight: 1,
  color: C.text,
};

const panelStyle: React.CSSProperties = {
  background: C.card,
  border: `1px solid ${C.border}`,
  borderRadius: 20,
  padding: 20,
  boxShadow: C.shadow,
  marginBottom: 20,
};

const empCard: React.CSSProperties = {
  border: `1px solid ${C.border}`,
  borderRadius: 18,
  padding: 16,
  background: "#fcfaf8",
};

const empCardTop: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  marginBottom: 12,
};

const empMetricsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
  gap: 8,
  marginBottom: 12,
};

const metricItem: React.CSSProperties = {
  background: "#fff",
  border: `1px solid ${C.border}`,
  borderRadius: 12,
  padding: 10,
};

const metricLabel: React.CSSProperties = {
  color: C.muted,
  fontSize: 11,
  marginBottom: 4,
};

const metricValue: React.CSSProperties = {
  color: C.text,
  fontSize: 16,
  fontWeight: 700,
};

const primaryBtn: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: 12,
  border: "none",
  background: `linear-gradient(180deg, ${C.primary} 0%, ${C.primaryDark} 100%)`,
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
  fontSize: 14,
};

const secondaryBtn: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: 12,
  border: `1px solid ${C.border}`,
  background: "#fff",
  color: C.text,
  fontWeight: 700,
  cursor: "pointer",
  fontSize: 14,
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  fontSize: 13,
  color: C.muted,
  fontWeight: 700,
  padding: "10px 8px",
  borderBottom: `1px solid ${C.border}`,
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "12px 8px",
  borderBottom: `1px solid #f2e8e1`,
  verticalAlign: "middle",
  fontSize: 14,
};

const badgeBase: React.CSSProperties = {
  display: "inline-block",
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
};

const eventRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "8px 12px",
  background: "#fcfaf8",
  border: `1px solid ${C.border}`,
  borderRadius: 12,
};

const emptyBox: React.CSSProperties = {
  padding: 16,
  borderRadius: 16,
  background: "#fcfaf8",
  border: `1px dashed ${C.border}`,
  color: C.muted,
};

const modalOverlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.55)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
  zIndex: 1000,
};

const modalCard: React.CSSProperties = {
  background: "#fff",
  borderRadius: 18,
  padding: 18,
  maxWidth: 900,
  width: "100%",
  boxShadow: "0 16px 40px rgba(0,0,0,0.25)",
};
