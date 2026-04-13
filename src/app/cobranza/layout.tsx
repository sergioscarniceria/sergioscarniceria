import AccessGate from "@/components/AccessGate";

export default function CobranzaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AccessGate
      allowedRoles={["admin", "cajera"]}
      title="Cobranza"
      subtitle="Ingresa tu PIN para continuar"
    >
      {children}
    </AccessGate>
  );
}
