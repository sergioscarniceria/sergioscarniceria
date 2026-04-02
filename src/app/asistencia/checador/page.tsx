"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase";

type TipoEvento = "entrada" | "salida" | "break_out" | "break_in";

type Empleado = {
  id: string;
  employee_id_hikvision: number | null;
  nombre: string;
  rol: string;
  activo: boolean;
};

const COLORS = {
  bg: "#f7f1e8",
  bgSoft: "#fbf8f3",
  card: "rgba(255,255,255,0.94)",
  border: "rgba(92, 27, 17, 0.10)",
  text: "#3b1c16",
  muted: "#7a5a52",
  primary: "#7b2218",
  primaryDark: "#5a190f",
  success: "#1f7a4d",
  warning: "#a66a10",
  danger: "#b42318",
  info: "#355c7d",
  shadow: "0 12px 30px rgba(91, 25, 15, 0.10)",
};

function labelTipo(tipo: TipoEvento | null) {
  if (tipo === "entrada") return "Entrada";
  if (tipo === "salida") return "Salida";
  if (tipo === "break_out") return "Salida al baño";
  if (tipo === "break_in") return "Regreso";
  return "Selecciona movimiento";
}

export default function AsistenciaChecadorPage() {
  const supabase = getSupabaseClient();

  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [empleadoId, setEmpleadoId] = useState("");
  const [pin, setPin] = useState("");
  const [tipoEvento, setTipoEvento] = useState<TipoEvento | null>(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    loadEmpleados();

    return () => {
      stopCamera();
    };
  }, []);

  async function loadEmpleados() {
    setLoading(true);

    const { data, error } = await supabase
      .from("empleados")
      .select("id, employee_id_hikvision, nombre, rol, activo")
      .eq("activo", true)
      .order("nombre", { ascending: true });

    if (error) {
      console.log(error);
      alert("No se pudieron cargar los empleados");
      setLoading(false);
      return;
    }

    setEmpleados((data as Empleado[]) || []);
    setLoading(false);
  }

  async function startCamera() {
    try {
      setCameraError("");
      setCapturedPhoto(null);

      if (streamRef.current) {
        stopCamera();
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraReady(true);
    } catch (error) {
      console.log(error);
      setCameraError("No se pudo activar la cámara");
      setCameraReady(false);
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraReady(false);
  }

  function capturePhoto() {
    if (!videoRef.current || !canvasRef.current) {
      alert("La cámara no está lista");
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      alert("No se pudo capturar la foto");
      return;
    }

    ctx.drawImage(video, 0, 0, width, height);
    const base64 = canvas.toDataURL("image/jpeg", 0.85);
    setCapturedPhoto(base64);
  }

  function clearForm() {
    setEmpleadoId("");
    setPin("");
    setTipoEvento(null);
    setCapturedPhoto(null);
    setCameraError("");
    stopCamera();
  }

  const empleadoSeleccionado = useMemo(() => {
    return empleados.find((e) => e.id === empleadoId) || null;
  }, [empleadoId, empleados]);

  async function registrarEvento() {
    if (!empleadoId) {
      alert("Selecciona un empleado");
      return;
    }

    if (!tipoEvento) {
      alert("Selecciona el tipo de movimiento");
      return;
    }

    if (!pin || pin.length !== 4) {
      alert("Ingresa un PIN de 4 dígitos");
      return;
    }

    if (!capturedPhoto) {
      alert("Toma la foto antes de guardar");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/asistencia/registrar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          empleado_id: empleadoId,
          pin,
          tipo_evento: tipoEvento,
          foto_base64: capturedPhoto,
          dispositivo_id: navigator.userAgent,
        }),
      });

      const json = await response.json();

      if (!response.ok) {
        alert(json?.error || "No se pudo registrar la asistencia");
        setSaving(false);
        return;
      }

      alert("Asistencia registrada correctamente");
      clearForm();
    } catch (error) {
      console.log(error);
      alert("Error inesperado al registrar asistencia");
    }

    setSaving(false);
  }

  if (loading) {
    return (
      <div style={loadingPageStyle}>
        <div style={loadingCardStyle}>Cargando checador...</div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={glowTopLeft} />
      <div style={glowTopRight} />

      <div style={shellStyle}>
        <div style={topBarStyle}>
          <div>
            <h1 style={{ margin: 0, color: COLORS.text }}>Checador</h1>
            <p style={{ margin: "6px 0 0 0", color: COLORS.muted }}>
              Registro de asistencia desde iPad
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/admin/asistencia" style={secondaryButtonStyle}>
              Panel asistencia
            </Link>
            <Link href="/" style={secondaryButtonStyle}>
              Inicio
            </Link>
          </div>
        </div>

        <div style={mainGridStyle}>
          <div style={panelStyle}>
            <div style={panelHeaderStyle}>
              <div>
                <h2 style={panelTitleStyle}>1. Selección</h2>
                <p style={panelSubtitleStyle}>Empleado, movimiento y PIN</p>
              </div>
            </div>

            <div style={fieldBlockStyle}>
              <div style={fieldLabelStyle}>Empleado</div>
              <select
                value={empleadoId}
                onChange={(e) => setEmpleadoId(e.target.value)}
                style={inputStyle}
              >
                <option value="">Selecciona empleado</option>
                {empleados.map((empleado) => (
                  <option key={empleado.id} value={empleado.id}>
                    {empleado.nombre} · {empleado.rol}
                  </option>
                ))}
              </select>
            </div>

            <div style={eventButtonsGridStyle}>
              <button
                onClick={() => setTipoEvento("entrada")}
                style={{
                  ...eventButtonStyle,
                  background:
                    tipoEvento === "entrada" ? COLORS.success : "white",
                  color: tipoEvento === "entrada" ? "white" : COLORS.success,
                  borderColor: `${COLORS.success}55`,
                }}
              >
                Entrada
              </button>

              <button
                onClick={() => setTipoEvento("salida")}
                style={{
                  ...eventButtonStyle,
                  background:
                    tipoEvento === "salida" ? COLORS.danger : "white",
                  color: tipoEvento === "salida" ? "white" : COLORS.danger,
                  borderColor: `${COLORS.danger}55`,
                }}
              >
                Salida
              </button>

              <button
                onClick={() => setTipoEvento("break_out")}
                style={{
                  ...eventButtonStyle,
                  background:
                    tipoEvento === "break_out" ? COLORS.warning : "white",
                  color: tipoEvento === "break_out" ? "white" : COLORS.warning,
                  borderColor: `${COLORS.warning}55`,
                }}
              >
                Salida al baño
              </button>

              <button
                onClick={() => setTipoEvento("break_in")}
                style={{
                  ...eventButtonStyle,
                  background:
                    tipoEvento === "break_in" ? COLORS.info : "white",
                  color: tipoEvento === "break_in" ? "white" : COLORS.info,
                  borderColor: `${COLORS.info}55`,
                }}
              >
                Regreso
              </button>
            </div>

            <div style={selectedTypeBoxStyle}>
              Movimiento seleccionado: <b>{labelTipo(tipoEvento)}</b>
            </div>

            <div style={fieldBlockStyle}>
              <div style={fieldLabelStyle}>PIN de 4 dígitos</div>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={(e) =>
                  setPin(e.target.value.replace(/\D/g, "").slice(0, 4))
                }
                placeholder="1234"
                style={pinInputStyle}
              />
            </div>

            {empleadoSeleccionado ? (
              <div style={employeeInfoBoxStyle}>
                <div style={employeeNameStyle}>{empleadoSeleccionado.nombre}</div>
                <div style={employeeMetaStyle}>
                  Rol: <b>{empleadoSeleccionado.rol}</b>
                </div>
              </div>
            ) : (
              <div style={emptyBoxStyle}>Selecciona un empleado para continuar</div>
            )}
          </div>

          <div style={panelStyle}>
            <div style={panelHeaderStyle}>
              <div>
                <h2 style={panelTitleStyle}>2. Foto en vivo</h2>
                <p style={panelSubtitleStyle}>La foto se toma en el momento</p>
              </div>
            </div>

            {!cameraReady && !capturedPhoto ? (
              <button onClick={startCamera} style={primaryActionButtonStyle}>
                Activar cámara
              </button>
            ) : null}

            {cameraError ? (
              <div style={{ ...emptyBoxStyle, color: COLORS.danger }}>
                {cameraError}
              </div>
            ) : null}

            <div style={cameraBoxStyle}>
              {!capturedPhoto ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={videoStyle}
                />
              ) : (
                <img src={capturedPhoto} alt="Foto capturada" style={videoStyle} />
              )}

              <canvas ref={canvasRef} style={{ display: "none" }} />
            </div>

            <div style={cameraButtonsWrapStyle}>
              <button
                onClick={capturePhoto}
                style={successButtonStyle}
                disabled={!cameraReady}
              >
                Tomar foto
              </button>

              <button
                onClick={startCamera}
                style={secondaryActionButtonStyle}
              >
                Repetir cámara
              </button>

              <button
                onClick={clearForm}
                style={dangerButtonStyle}
              >
                Limpiar
              </button>
            </div>

            <button
              onClick={registrarEvento}
              style={saveButtonStyle}
              disabled={saving}
            >
              {saving ? "Guardando..." : "Guardar asistencia"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const loadingPageStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: `linear-gradient(180deg, ${COLORS.bgSoft} 0%, ${COLORS.bg} 100%)`,
  fontFamily: "Arial, sans-serif",
};

const loadingCardStyle: React.CSSProperties = {
  padding: 20,
  borderRadius: 18,
  background: COLORS.card,
  border: `1px solid ${COLORS.border}`,
  boxShadow: COLORS.shadow,
};

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  padding: 16,
  background: `linear-gradient(180deg, ${COLORS.bgSoft} 0%, ${COLORS.bg} 100%)`,
  position: "relative",
  overflow: "hidden",
  fontFamily: "Arial, sans-serif",
};

const glowTopLeft: React.CSSProperties = {
  position: "absolute",
  top: -120,
  left: -100,
  width: 300,
  height: 300,
  borderRadius: "50%",
  background: "rgba(123, 34, 24, 0.08)",
  filter: "blur(45px)",
};

const glowTopRight: React.CSSProperties = {
  position: "absolute",
  top: -80,
  right: -60,
  width: 280,
  height: 280,
  borderRadius: "50%",
  background: "rgba(217, 201, 163, 0.35)",
  filter: "blur(45px)",
};

const shellStyle: React.CSSProperties = {
  maxWidth: 1480,
  margin: "0 auto",
  position: "relative",
  zIndex: 2,
};

const topBarStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  flexWrap: "wrap",
  marginBottom: 20,
};

const mainGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
  gap: 20,
  alignItems: "start",
};

const panelStyle: React.CSSProperties = {
  background: COLORS.card,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 28,
  padding: 20,
  boxShadow: COLORS.shadow,
};

const panelHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  marginBottom: 14,
};

const panelTitleStyle: React.CSSProperties = {
  margin: 0,
  color: COLORS.text,
  fontSize: 28,
};

const panelSubtitleStyle: React.CSSProperties = {
  margin: "6px 0 0 0",
  color: COLORS.muted,
  fontSize: 15,
};

const fieldBlockStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  marginBottom: 16,
};

const fieldLabelStyle: React.CSSProperties = {
  color: COLORS.muted,
  fontWeight: 700,
  fontSize: 15,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 16,
  borderRadius: 18,
  border: `1px solid ${COLORS.border}`,
  boxSizing: "border-box",
  outline: "none",
  background: "white",
  color: COLORS.text,
  fontSize: 18,
};

const pinInputStyle: React.CSSProperties = {
  width: "100%",
  padding: 18,
  borderRadius: 18,
  border: `1px solid ${COLORS.border}`,
  boxSizing: "border-box",
  outline: "none",
  background: "white",
  color: COLORS.text,
  fontSize: 28,
  letterSpacing: 8,
  textAlign: "center",
};

const eventButtonsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 14,
  marginBottom: 16,
};

const eventButtonStyle: React.CSSProperties = {
  minHeight: 88,
  borderRadius: 22,
  border: "2px solid",
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 22,
};

const selectedTypeBoxStyle: React.CSSProperties = {
  padding: 16,
  borderRadius: 18,
  background: COLORS.bgSoft,
  border: `1px solid ${COLORS.border}`,
  color: COLORS.text,
  marginBottom: 16,
  fontSize: 18,
};

const employeeInfoBoxStyle: React.CSSProperties = {
  padding: 16,
  borderRadius: 18,
  background: COLORS.bgSoft,
  border: `1px solid ${COLORS.border}`,
};

const employeeNameStyle: React.CSSProperties = {
  color: COLORS.text,
  fontWeight: 800,
  fontSize: 24,
};

const employeeMetaStyle: React.CSSProperties = {
  color: COLORS.muted,
  marginTop: 6,
  fontSize: 15,
};

const cameraBoxStyle: React.CSSProperties = {
  width: "100%",
  background: "#111",
  borderRadius: 22,
  overflow: "hidden",
  minHeight: 380,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: 14,
};

const videoStyle: React.CSSProperties = {
  width: "100%",
  height: 420,
  objectFit: "cover",
  display: "block",
};

const cameraButtonsWrapStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 12,
  marginBottom: 14,
};

const primaryActionButtonStyle: React.CSSProperties = {
  width: "100%",
  padding: "18px 20px",
  borderRadius: 18,
  border: "none",
  background: `linear-gradient(180deg, ${COLORS.primary} 0%, ${COLORS.primaryDark} 100%)`,
  color: "white",
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 22,
  boxShadow: "0 10px 22px rgba(123, 34, 24, 0.20)",
  marginBottom: 14,
};

const secondaryActionButtonStyle: React.CSSProperties = {
  padding: "14px 16px",
  borderRadius: 16,
  border: `1px solid ${COLORS.border}`,
  background: "white",
  color: COLORS.text,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 16,
};

const successButtonStyle: React.CSSProperties = {
  padding: "14px 16px",
  borderRadius: 16,
  border: "none",
  background: "rgba(31,122,77,0.14)",
  color: COLORS.success,
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 16,
};

const dangerButtonStyle: React.CSSProperties = {
  padding: "14px 16px",
  borderRadius: 16,
  border: "none",
  background: "rgba(180,35,24,0.12)",
  color: COLORS.danger,
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 16,
};

const saveButtonStyle: React.CSSProperties = {
  width: "100%",
  padding: "20px 22px",
  borderRadius: 20,
  border: "none",
  background: `linear-gradient(180deg, ${COLORS.success} 0%, #16603d 100%)`,
  color: "white",
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 24,
  boxShadow: "0 12px 26px rgba(31, 122, 77, 0.24)",
};

const secondaryButtonStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "12px 18px",
  borderRadius: 14,
  border: `1px solid ${COLORS.border}`,
  background: "rgba(255,255,255,0.80)",
  color: COLORS.text,
  textDecoration: "none",
  fontWeight: 700,
};

const emptyBoxStyle: React.CSSProperties = {
  padding: 16,
  borderRadius: 18,
  background: COLORS.bgSoft,
  border: `1px dashed ${COLORS.border}`,
  color: COLORS.muted,
};