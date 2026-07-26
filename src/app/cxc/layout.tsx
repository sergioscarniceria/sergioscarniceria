import AccessGate from "@/components/AccessGate";

export default function CxcLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AccessGate
      allowedRoles={["admin", "cajera", "contabilidad"]}
      title="Cuentas por cobrar"
      subtitle="Ingresa tu PIN para continuar"
    >
      {children}
    </AccessGate>
  );
}
