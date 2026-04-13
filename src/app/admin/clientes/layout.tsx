import AccessGate from "@/components/AccessGate";

export default function ClientesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AccessGate
      allowedRoles={["admin"]}
      title="Clientes"
      subtitle="Solo administradores"
    >
      {children}
    </AccessGate>
  );
}
