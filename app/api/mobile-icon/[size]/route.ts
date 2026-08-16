import { createElement } from "react";
import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";

const allowedSizes = new Set([180, 192, 512]);

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ size: string }> }) {
  const { size: rawSize } = await context.params;
  const size = Number(rawSize);
  if (!allowedSizes.has(size)) {
    return NextResponse.json({ error: "Tamanho de ícone inválido." }, { status: 404 });
  }

  const maskable = new URL(request.url).searchParams.get("maskable") === "1";
  const logoUrl = new URL("/brand/alc-logo.png", request.url).toString();
  const padding = maskable ? Math.round(size * 0.16) : Math.round(size * 0.07);

  const logo = createElement("img", {
    src: logoUrl,
    width: size - padding * 2,
    height: size - padding * 2,
    style: { objectFit: "contain" },
    alt: "",
  });

  const canvas = createElement(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#ffffff",
        padding,
      },
    },
    logo,
  );

  return new ImageResponse(canvas, { width: size, height: size });
}
