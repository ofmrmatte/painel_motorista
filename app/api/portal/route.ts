import { NextResponse } from "next/server";
import { currentDriver } from "@/lib/driver-session";
import { loadDriverPortalPayload } from "@/lib/portal-data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const driver = await currentDriver();
    if (!driver) return NextResponse.json({ error: "Sessao expirada." }, { status: 401 });
    return NextResponse.json(await loadDriverPortalPayload(driver));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao carregar portal." }, { status: 500 });
  }
}

