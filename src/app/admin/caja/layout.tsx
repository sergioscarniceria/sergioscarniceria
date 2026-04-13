import AccessGate from "@/components/AccessGate";

export default function CajaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AccessGate
      allowedRoles={["admin"]}
      title="Caja"
      subtitle="Solo administradores"
    >
      {children}
    </AccessGate>
  );
}
