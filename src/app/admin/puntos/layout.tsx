import AccessGate from "@/components/AccessGate";

export default function PuntosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AccessGate
      allowedRoles={["admin"]}
      title="Programa de puntos"
      subtitle="Solo administradores"
    >
      {children}
    </AccessGate>
  );
}
