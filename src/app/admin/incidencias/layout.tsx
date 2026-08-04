import AccessGate from "@/components/AccessGate";

export default function IncidenciasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AccessGate
      allowedRoles={["admin"]}
      title="Incidencias de personal"
      subtitle="Solo administradores"
    >
      {children}
    </AccessGate>
  );
}
