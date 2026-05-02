import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // jsPDF usa fflate que tiene Worker threads en Node.
  // Marcarlo como externo evita que Turbopack lo bundlee en SSR.
  serverExternalPackages: ["jspdf", "fflate"],
};

export default nextConfig;
