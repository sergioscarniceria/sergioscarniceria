import AccessGate from "@/components/AccessGate";

export default function PedidosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AccessGate
      scope="operation"
      title="Acceso a Pedidos"
      subtitle="Esta sección es solo para operación interna."
    >
      {children}
    </AccessGate>
  );
}