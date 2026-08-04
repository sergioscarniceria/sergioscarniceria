import AccessGate from "@/components/AccessGate";

export default function HistorialClientesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AccessGate
      allowedRoles={["admin"]}
      title="Historial de clientes"
      subtitle="Solo administradores"
    >
      {children}
    </AccessGate>
  );
}
