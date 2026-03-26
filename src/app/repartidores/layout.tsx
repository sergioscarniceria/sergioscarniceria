import AccessGate from "@/components/AccessGate";

export default function RepartidoresLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AccessGate
      scope="operation"
      title="Acceso a Repartidores"
      subtitle="Esta sección está protegida para uso interno."
    >
      {children}
    </AccessGate>
  );
}