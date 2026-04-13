import AccessGate from "@/components/AccessGate";

export default function ProductosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AccessGate
      allowedRoles={["admin"]}
      title="Productos"
      subtitle="Solo administradores"
    >
      {children}
    </AccessGate>
  );
}
