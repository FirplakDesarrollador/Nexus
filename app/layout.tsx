import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nexus | Gestión de Compras",
  description: "Sistema premium de gestión de solicitudes de compra y proveedores.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>
        <div className="mesh-bg mesh-1"></div>
        <div className="mesh-bg mesh-2"></div>
        <main>
          {children}
        </main>
      </body>
    </html>
  );
}
