import AccessGate from "@/components/AccessGate";

export default function RecetarioLayout({ children }: { children: React.ReactNode }) {
  return (
    <AccessGate allowedRoles={["admin"]} title="Recetario" subtitle="Solo administradores">
      {children}
    </AccessGate>
  );
}
