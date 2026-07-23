import AccessGate from "@/components/AccessGate";

export default function ProveedoresLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AccessGate
      allowedRoles={["admin", "contabilidad"]}
      title="Proveedores"
      subtitle="Solo administradores y contabilidad"
    >
      {children}
    </AccessGate>
  );
}
