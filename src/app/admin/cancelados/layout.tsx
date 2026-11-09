import AccessGate from "@/components/AccessGate";

export default function CanceladosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AccessGate
      allowedRoles={["admin"]}
      title="Cancelados"
      subtitle="Solo administradores"
    >
      {children}
    </AccessGate>
  );
}
