import AccessGate from "@/components/AccessGate";

export default function CategoriasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AccessGate
      allowedRoles={["admin"]}
      title="Análisis por categoría"
      subtitle="Solo administradores"
    >
      {children}
    </AccessGate>
  );
}
