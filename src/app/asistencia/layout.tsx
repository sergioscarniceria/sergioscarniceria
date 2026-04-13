import AccessGate from "@/components/AccessGate";

export default function AsistenciaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AccessGate
      allowedRoles={["admin"]}
      title="Asistencia"
      subtitle="Solo administradores"
    >
      {children}
    </AccessGate>
  );
}
