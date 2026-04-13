import AccessGate from "@/components/AccessGate";

export default function RepartidoresLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AccessGate
      allowedRoles={["admin", "empleado"]}
      title="Repartidores"
      subtitle="Ingresa tu PIN para continuar"
    >
      {children}
    </AccessGate>
  );
}
