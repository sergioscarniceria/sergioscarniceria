import AccessGate from "@/components/AccessGate";

export default function GraficasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AccessGate
      allowedRoles={["admin"]}
      title="Gráficas de comportamiento"
      subtitle="Solo administradores"
    >
      {children}
    </AccessGate>
  );
}
