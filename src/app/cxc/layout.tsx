import AccessGate from "@/components/AccessGate";

export default function CxcLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AccessGate
      allowedRoles={["admin", "cajera"]}
      title="Cuentas por cobrar"
      subtitle="Ingresa tu PIN para continuar"
    >
      {children}
    </AccessGate>
  );
}
