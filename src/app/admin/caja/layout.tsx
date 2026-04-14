import AccessGate from "@/components/AccessGate";

export default function CajaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AccessGate
      allowedRoles={["admin", "cajera"]}
      title="Caja"
      subtitle="Administrador o cajera"
    >
      {children}
    </AccessGate>
  );
}
