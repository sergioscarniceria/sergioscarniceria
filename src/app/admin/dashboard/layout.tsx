import AccessGate from "@/components/AccessGate";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AccessGate
      allowedRoles={["admin"]}
      title="Dashboard"
      subtitle="Solo administradores"
    >
      {children}
    </AccessGate>
  );
}
