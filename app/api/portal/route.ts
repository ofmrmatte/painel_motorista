import { NextResponse } from "next/server";
import { currentDriver } from "@/lib/driver-session";
import { loadDriverPortalPayload } from "@/lib/portal-data";
import { createAdminClient } from "@/lib/supabase-admin";
import { textValue } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const driver = await currentDriver();
    if (!driver) return NextResponse.json({ error: "Sessao expirada." }, { status: 401 });
    const payload = await loadDriverPortalPayload(driver);
    const admin = createAdminClient();
    const protocols = await admin.from("driver_disputes").select("id,protocol").eq("driver_id", textValue(driver.id));
    if (!protocols.error) {
      const byId = new Map((protocols.data ?? []).map((row) => [textValue(row.id), textValue(row.protocol)]));
      payload.disputes = payload.disputes.map((dispute) => ({ ...dispute, protocol: byId.get(dispute.id) || undefined }));
    }
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao carregar portal." }, { status: 500 });
  }
}
