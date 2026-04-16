import AccessGate from "@/components/AccessGate";

export default function NuevoPedidoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AccessGate
      allowedRoles={["admin", "cajera"]}
      title="Nuevo Pedido"
      subtitle="Acceso para administradores y cajeras"
    >
      {children}
    </AccessGate>
  );
}
