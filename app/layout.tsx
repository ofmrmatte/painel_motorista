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
      { url: "/api/mobile-icon/192", sizes: "192x192", type: "image/png" },
      { url: "/api/mobile-icon/512", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/api/mobile-icon/180", sizes: "180x180", type: "image/png" }],
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
