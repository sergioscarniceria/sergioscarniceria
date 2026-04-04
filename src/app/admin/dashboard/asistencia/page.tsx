"use client";

import { useEffect, useMemo, useState } from "react";

type Evento = {
  id: string;
  tipo_evento: string;
  timestamp_evento: string;
  foto_url: string | null;
  empleados?: {
    nombre?: string;
  } | null;
};

const pageStyle: React.CSSProperties = {
  padding: 24,
  background: "#f7f3ee",
  minHeight: "100vh",
  color: "#2f1e18",
};

const titleStyle: React.CSSProperties = {
  fontSize: 32,
  fontWeight: 800,
  margin: 0,
};

const subtitleStyle: React.CSSProperties = {
  marginTop: 6,
  color: "#7b6258",
  fontSize: 15,
};

const cardsRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 16,
  marginTop: 24,
  marginBottom: 24,
};

const statCardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #eadfd7",
  borderRadius: 18,
  padding: 18,
  boxShadow: "0 6px 20px rgba(70,40,20,0.05)",
};

const statLabelStyle: React.CSSProperties = {
  fontSize: 14,
  color: "#8b6f63",
  marginBottom: 10,
};

const statValueStyle: React.CSSProperties = {
  fontSize: 34,
  fontWeight: 800,
  lineHeight: 1,
};

const panelStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #eadfd7",
  borderRadius: 20,
  padding: 20,
  boxShadow: "0 6px 20px rgba(70,40,20,0.05)",
};

const filtersRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 14,
  marginBottom: 20,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid #d8c7bc",
  background: "#fff",
  fontSize: 15,
  color: "#2f1e18",
  outline: "none",
};

const tableWrapStyle: React.CSSProperties = {
  overflowX: "auto",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  fontSize: 14,
  color: "#8b6f63",
  fontWeight: 700,
  padding: "12px 10px",
  borderBottom: "1px solid #eee2d9",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "14px 10px",
  borderBottom: "1px solid #f2e8e1",
  verticalAlign: "middle",
};

const photoThumbStyle: React.CSSProperties = {
  width: 76,
  height: 76,
  objectFit: "cover",
  borderRadius: 12,
  border: "1px solid #eadfd7",
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "none",
  background: "#7b2517",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid #d8c7bc",
  background: "#fff",
  color: "#2f1e18",
  fontWeight: 700,
  cursor: "pointer",
};

const badgeBaseStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "8px 12px",
  borderRadius: 999,
  fontSize: 13,
  fontWeight: 700,
};

const detailSectionStyle: React.CSSProperties = {
  marginTop: 26,
  background: "#fff",
  border: "1px solid #eadfd7",
  borderRadius: 20,
  padding: 20,
  boxShadow: "0 6px 20px rgba(70,40,20,0.05)",
};

const detailHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 18,
};

const detailGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 14,
};

const detailCardStyle: React.CSSProperties = {
  border: "1px solid #eee2d9",
  borderRadius: 16,
  padding: 14,
  display: "flex",
  gap: 16,
  alignItems: "center",
  background: "#fcfaf8",
};

const detailImageStyle: React.CSSProperties = {
  width: 120,
  height: 120,
  objectFit: "cover",
  borderRadius: 14,
  border: "1px solid #eadfd7",
};

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.55)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
  zIndex: 1000,
};

const modalCardStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: 18,
  padding: 18,
  maxWidth: 900,
  width: "100%",
  boxShadow: "0 16px 40px rgba(0,0,0,0.25)",
};

const modalImageStyle: React.CSSProperties = {
  width: "100%",
  maxHeight: "75vh",
  objectFit: "contain",
  borderRadius: 14,
  background: "#f7f3ee",
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

function getTipoLabel(tipo: string) {
  if (tipo === "entrada") return "Entrada";
  if (tipo === "salida") return "Salida";
  if (tipo === "break_out") return "Salida al baño";
  if (tipo === "break_in") return "Regreso";
  return tipo;
}

function getTipoBadgeStyle(tipo: string): React.CSSProperties {
  if (tipo === "entrada") {
    return {
      ...badgeBaseStyle,
      background: "#e3f3e7",
      color: "#1f6a35",
    };
  }

  if (tipo === "salida") {
    return {
      ...badgeBaseStyle,
      background: "#fde7e3",
      color: "#9a2e1f",
    };
  }

  if (tipo === "break_out") {
    return {
      ...badgeBaseStyle,
      background: "#fff2d9",
      color: "#9b6511",
    };
  }

  if (tipo === "break_in") {
    return {
      ...badgeBaseStyle,
      background: "#e3edf9",
      color: "#2c5d99",
    };
  }

  return {
    ...badgeBaseStyle,
    background: "#efefef",
    color: "#555",
  };
}

export default function AsistenciaDashboard() {
  const [data, setData] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [empleadoFiltro, setEmpleadoFiltro] = useState("todos");
  const [tipoFiltro, setTipoFiltro] = useState("todos");
  const [busqueda, setBusqueda] = useState("");
  const [empleadoActivo, setEmpleadoActivo] = useState<string | null>(null);
  const [fotoActiva, setFotoActiva] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/asistencia/listar")
      .then((res) => res.json())
      .then((res) => {
        setData(res.data || []);
        setLoading(false);
      })
      .catch(() => {
        setData([]);
        setLoading(false);
      });
  }, []);

  const empleadosUnicos = useMemo(() => {
    const nombres = Array.from(
      new Set(data.map((item) => item.empleados?.nombre || "Sin nombre"))
    );
    return nombres.sort((a, b) => a.localeCompare(b));
  }, [data]);

  const datosFiltrados = useMemo(() => {
    return data.filter((item) => {
      const nombre = item.empleados?.nombre || "Sin nombre";
      const coincideEmpleado =
        empleadoFiltro === "todos" || nombre === empleadoFiltro;

      const coincideTipo =
        tipoFiltro === "todos" || item.tipo_evento === tipoFiltro;

      const coincideBusqueda =
        busqueda.trim() === "" ||
        nombre.toLowerCase().includes(busqueda.toLowerCase());

      return coincideEmpleado && coincideTipo && coincideBusqueda;
    });
  }, [data, empleadoFiltro, tipoFiltro, busqueda]);

  const eventosEmpleadoActivo = useMemo(() => {
    if (!empleadoActivo) return [];
    return data.filter(
      (item) => (item.empleados?.nombre || "Sin nombre") === empleadoActivo
    );
  }, [data, empleadoActivo]);

  const totalMovimientos = datosFiltrados.length;

  const totalEmpleadosConRegistros = useMemo(() => {
    const nombres = new Set(
      datosFiltrados.map((item) => item.empleados?.nombre || "Sin nombre")
    );
    return nombres.size;
  }, [datosFiltrados]);

  const totalEntradas = useMemo(() => {
    return datosFiltrados.filter((item) => item.tipo_evento === "entrada").length;
  }, [datosFiltrados]);

  const totalSalidas = useMemo(() => {
    return datosFiltrados.filter((item) => item.tipo_evento === "salida").length;
  }, [datosFiltrados]);

  if (loading) {
    return <div style={pageStyle}>Cargando asistencias...</div>;
  }

  return (
    <div style={pageStyle}>
      <h1 style={titleStyle}>Dashboard de Asistencia</h1>
      <div style={subtitleStyle}>
        Aquí puedes revisar movimientos, fotos y desglose por empleado.
      </div>

      <div style={cardsRowStyle}>
        <div style={statCardStyle}>
          <div style={statLabelStyle}>Total movimientos</div>
          <div style={statValueStyle}>{totalMovimientos}</div>
        </div>

        <div style={statCardStyle}>
          <div style={statLabelStyle}>Empleados con registros</div>
          <div style={statValueStyle}>{totalEmpleadosConRegistros}</div>
        </div>

        <div style={statCardStyle}>
          <div style={statLabelStyle}>Entradas</div>
          <div style={statValueStyle}>{totalEntradas}</div>
        </div>

        <div style={statCardStyle}>
          <div style={statLabelStyle}>Salidas</div>
          <div style={statValueStyle}>{totalSalidas}</div>
        </div>
      </div>

      <div style={panelStyle}>
        <div style={filtersRowStyle}>
          <div>
            <div style={{ marginBottom: 8, fontWeight: 700 }}>Buscar empleado</div>
            <input
              style={inputStyle}
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Escribe un nombre..."
            />
          </div>

          <div>
            <div style={{ marginBottom: 8, fontWeight: 700 }}>Filtrar por empleado</div>
            <select
              style={inputStyle}
              value={empleadoFiltro}
              onChange={(e) => setEmpleadoFiltro(e.target.value)}
            >
              <option value="todos">Todos</option>
              {empleadosUnicos.map((nombre) => (
                <option key={nombre} value={nombre}>
                  {nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ marginBottom: 8, fontWeight: 700 }}>Filtrar por tipo</div>
            <select
              style={inputStyle}
              value={tipoFiltro}
              onChange={(e) => setTipoFiltro(e.target.value)}
            >
              <option value="todos">Todos</option>
              <option value="entrada">Entrada</option>
              <option value="salida">Salida</option>
              <option value="break_out">Salida al baño</option>
              <option value="break_in">Regreso</option>
            </select>
          </div>

          <div>
            <div style={{ marginBottom: 8, fontWeight: 700 }}>Limpiar filtros</div>
            <button
              style={{ ...secondaryButtonStyle, width: "100%", height: 46 }}
              onClick={() => {
                setBusqueda("");
                setEmpleadoFiltro("todos");
                setTipoFiltro("todos");
              }}
            >
              Restablecer
            </button>
          </div>
        </div>

        <div style={tableWrapStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Empleado</th>
                <th style={thStyle}>Tipo</th>
                <th style={thStyle}>Hora</th>
                <th style={thStyle}>Foto</th>
                <th style={thStyle}>Acción</th>
              </tr>
            </thead>

            <tbody>
              {datosFiltrados.map((item) => (
                <tr key={item.id}>
                  <td style={tdStyle}>
                    {item.empleados?.nombre || "Sin nombre"}
                  </td>
                  <td style={tdStyle}>
                    <span style={getTipoBadgeStyle(item.tipo_evento)}>
                      {getTipoLabel(item.tipo_evento)}
                    </span>
                  </td>
                  <td style={tdStyle}>{formatDateTime(item.timestamp_evento)}</td>
                  <td style={tdStyle}>
                    {item.foto_url ? (
                      <img
                        src={item.foto_url}
                        alt="foto"
                        style={photoThumbStyle}
                        onClick={() => setFotoActiva(item.foto_url)}
                      />
                    ) : (
                      "Sin foto"
                    )}
                  </td>
                  <td style={tdStyle}>
                    <button
                      style={primaryButtonStyle}
                      onClick={() =>
                        setEmpleadoActivo(item.empleados?.nombre || "Sin nombre")
                      }
                    >
                      Ver desglose
                    </button>
                  </td>
                </tr>
              ))}

              {datosFiltrados.length === 0 && (
                <tr>
                  <td style={tdStyle} colSpan={5}>
                    No hay registros con esos filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {empleadoActivo && (
        <div style={detailSectionStyle}>
          <div style={detailHeaderStyle}>
            <h2 style={{ margin: 0 }}>Desglose de {empleadoActivo}</h2>

            <button
              style={secondaryButtonStyle}
              onClick={() => setEmpleadoActivo(null)}
            >
              Cerrar
            </button>
          </div>

          <div style={detailGridStyle}>
            {eventosEmpleadoActivo.map((item) => (
              <div key={item.id} style={detailCardStyle}>
                {item.foto_url ? (
                  <img
                    src={item.foto_url}
                    alt="foto empleado"
                    style={detailImageStyle}
                    onClick={() => setFotoActiva(item.foto_url)}
                  />
                ) : (
                  <div style={{ width: 120 }}>Sin foto</div>
                )}

                <div>
                  <div style={{ marginBottom: 8 }}>
                    <strong>Tipo:</strong> {getTipoLabel(item.tipo_evento)}
                  </div>
                  <div>
                    <strong>Hora:</strong> {formatDateTime(item.timestamp_evento)}
                  </div>
                </div>
              </div>
            ))}

            {eventosEmpleadoActivo.length === 0 && (
              <div>No hay movimientos para este empleado.</div>
            )}
          </div>
        </div>
      )}

      {fotoActiva && (
        <div style={modalOverlayStyle} onClick={() => setFotoActiva(null)}>
          <div style={modalCardStyle} onClick={(e) => e.stopPropagation()}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <strong>Foto de asistencia</strong>

              <button
                style={secondaryButtonStyle}
                onClick={() => setFotoActiva(null)}
              >
                Cerrar
              </button>
            </div>

            <img src={fotoActiva} alt="foto grande" style={modalImageStyle} />
          </div>
        </div>
      )}
    </div>
  );
}