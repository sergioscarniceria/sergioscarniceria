import AccessGate from "@/components/AccessGate";

export default function AsistenciaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AccessGate
      allowedRoles={["admin", "cajera", "carnicero"]}
      title="Checador"
      subtitle="Ingresa tu PIN para registrar asistencia"
    >
      {children}
    </AccessGate>
  );
}
