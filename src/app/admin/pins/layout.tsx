import AccessGate from "@/components/AccessGate";

export default function PinsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AccessGate
      allowedRoles={["admin"]}
      title="Gestión de PINs"
      subtitle="Solo administradores"
    >
      {children}
    </AccessGate>
  );
}
