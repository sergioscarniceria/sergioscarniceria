import AccessGate from "@/components/AccessGate";

export default function DisplayAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AccessGate
      allowedRoles={["admin"]}
      title="Pantalla cliente"
      subtitle="Solo administradores"
    >
      {children}
    </AccessGate>
  );
}
