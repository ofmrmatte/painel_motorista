import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./profile-stage.css";

export const metadata: Metadata = {
  title: "Portal do Motorista ALC",
  description: "Portal mobile de pagamentos, pendencias e contestacoes dos motoristas ALC.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Motorista ALC",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#111111",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
