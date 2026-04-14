"use client";

import { useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";

export default function InventarioLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    const role = sessionStorage.getItem("pin_role");
    if (role === "admin") {
      setOk(true);
    } else {
      router.replace("/");
    }
  }, [router]);

  if (!ok) return null;
  return <>{children}</>;
}
