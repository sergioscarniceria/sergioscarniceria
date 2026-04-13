import Link from "next/link";

export const metadata = {
  title: "Página no encontrada",
};

export default function NotFound() {
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
        404
      </h1>
      <p
        style={{
          fontSize: 20,
          color: "#4a3728",
          margin: "12px 0 8px",
          fontWeight: 600,
        }}
      >
        Página no encontrada
      </p>
      <p
        style={{
          fontSize: 15,
          color: "#8b7355",
          margin: "0 0 32px",
          maxWidth: 400,
        }}
      >
        Lo sentimos, la página que buscas no existe o fue movida.
      </p>
      <Link
        href="/"
        style={{
          background: "#7b2218",
          color: "#fff",
          padding: "12px 32px",
          borderRadius: 10,
          textDecoration: "none",
          fontWeight: 600,
          fontSize: 15,
        }}
      >
        Volver al inicio
      </Link>
    </div>
  );
}
