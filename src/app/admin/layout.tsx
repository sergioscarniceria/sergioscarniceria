import AccessGate from "@/components/AccessGate";

export default function ProduccionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AccessGate
      scope="operation"
      title="Acceso a Producción"
      subtitle="Solo personal autorizado puede entrar aquí."
    >
      {children}
    </AccessGate>
  );
}