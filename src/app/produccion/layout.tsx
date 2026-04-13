import AccessGate from "@/components/AccessGate";

export default function ProduccionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AccessGate
      allowedRoles={["admin", "empleado"]}
      title="Producción"
      subtitle="Ingresa tu PIN para continuar"
    >
      {children}
    </AccessGate>
  );
}
