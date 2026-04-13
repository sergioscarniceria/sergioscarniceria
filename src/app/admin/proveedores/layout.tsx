import AccessGate from "@/components/AccessGate";

export default function ProveedoresLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AccessGate
      allowedRoles={["admin"]}
      title="Proveedores"
      subtitle="Solo administradores"
    >
      {children}
    </AccessGate>
  );
}
