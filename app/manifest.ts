import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Portal do Motorista ALC",
    short_name: "Motorista ALC",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f6f3ef",
    theme_color: "#111111",
    icons: [
      { src: "/api/mobile-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/api/mobile-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/api/mobile-icon/512?maskable=1", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
