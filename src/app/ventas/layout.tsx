import AccessGate from "@/components/AccessGate";

export default function VentasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AccessGate
      allowedRoles={["admin", "empleado"]}
      title="Ventas Mostrador"
      subtitle="Ingresa tu PIN para continuar"
    >
      {children}
    </AccessGate>
  );
}
