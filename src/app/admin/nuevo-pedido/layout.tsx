import AccessGate from "@/components/AccessGate";

export default function NuevoPedidoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AccessGate
      allowedRoles={["admin"]}
      title="Nuevo Pedido"
      subtitle="Solo administradores"
    >
      {children}
    </AccessGate>
  );
}
