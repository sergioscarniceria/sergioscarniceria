import AccessGate from "@/components/AccessGate";

export default function PreciosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AccessGate
      allowedRoles={["admin"]}
      title="Administración de precios"
      subtitle="Solo administradores"
    >
      {children}
    </AccessGate>
  );
}
