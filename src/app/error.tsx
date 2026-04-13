"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column" as const,
        alignItems: "center",
        justifyContent: "center",
        background: "#f7f1e8",
        fontFamily: "var(--font-geist-sans), sans-serif",
        padding: "24px",
        textAlign: "center" as const,
      }}
    >
      <img
        src="/logo.png"
        alt="Sergio's Carnicería"
        style={{ width: 80, height: 80, borderRadius: 16, marginBottom: 24 }}
      />
      <h1
        style={{
          fontSize: 72,
          fontWeight: 800,
          color: "#7b2218",
          margin: 0,
          lineHeight: 1,
        }}
      >
        500
      </h1>
      <p
        style={{
          fontSize: 20,
          color: "#4a3728",
          margin: "12px 0 8px",
          fontWeight: 600,
        }}
      >
        Algo salió mal
      </p>
      <p
        style={{
          fontSize: 15,
          color: "#8b7355",
          margin: "0 0 32px",
          maxWidth: 400,
        }}
      >
        Ocurrió un error inesperado. Por favor intenta de nuevo.
      </p>
      <div style={{ display: "flex", gap: 12 }}>
        <button
          onClick={() => reset()}
          style={{
            background: "#7b2218",
            color: "#fff",
            padding: "12px 32px",
            borderRadius: 10,
            border: "none",
            fontWeight: 600,
            fontSize: 15,
            cursor: "pointer",
          }}
        >
          Reintentar
        </button>
        <a
          href="/"
          style={{
            background: "transparent",
            color: "#7b2218",
            padding: "12px 32px",
            borderRadius: 10,
            border: "2px solid #7b2218",
            textDecoration: "none",
            fontWeight: 600,
            fontSize: 15,
          }}
        >
          Ir al inicio
        </a>
      </div>
    </div>
  );
}
