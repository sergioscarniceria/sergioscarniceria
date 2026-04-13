import AccessGate from "@/components/AccessGate";

export default function PedidosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AccessGate
      allowedRoles={["admin", "empleado"]}
      title="Pedidos"
      subtitle="Ingresa tu PIN para continuar"
    >
      {children}
    </AccessGate>
  );
}
