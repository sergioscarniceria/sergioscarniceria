import AccessGate from "@/components/AccessGate";

export default function GastosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AccessGate
      allowedRoles={["admin"]}
      title="Gastos Externos"
      subtitle="Solo administradores"
    >
      {children}
    </AccessGate>
  );
}
