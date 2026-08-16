import { NextResponse } from "next/server";
import { z } from "zod";
import { driverOwnsRecord } from "@/lib/authorization";
import { currentDriver } from "@/lib/driver-session";
import { numberValue, textValue } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const schema = z.object({
  documentId: z.string().min(1),
  reason: z.string().min(2),
  description: z.string().min(5),
  reference: z.string().optional(),
  amount: z.union([z.string(), z.number()]).optional(),
});

export async function POST(request: Request) {
  try {
    const driver = await currentDriver();
    if (!driver) return NextResponse.json({ error: "Sessao expirada." }, { status: 401 });
    const body = schema.parse(await request.json());
    const admin = createAdminClient();
    const doc = await admin.from("driver_payment_documents").select("*").eq("id", body.documentId).maybeSingle();
    if (doc.error) throw new Error(doc.error.message);
    if (!doc.data || !driverOwnsRecord(driver, doc.data)) {
      return NextResponse.json({ error: "Documento nao encontrado." }, { status: 404 });
    }
    const admins = await admin.from("admin_base_assignments").select("admin_id").eq("base_key", textValue(doc.data.base_key)).eq("active", true).limit(1);
    if (admins.error) throw new Error(admins.error.message);
    const dispute = await admin.from("driver_disputes").insert({
      document_id: body.documentId,
      document_version_id: textValue(doc.data.active_version_id) || null,
      driver_id: textValue(driver.id),
      assigned_admin_id: textValue(admins.data?.[0]?.admin_id) || null,
      base_key: textValue(doc.data.base_key),
      reason: body.reason,
      description: body.description,
      reference: body.reference ?? null,
      amount: body.amount == null || body.amount === "" ? null : numberValue(body.amount),
      status: "aberta",
    }).select().single();
    if (dispute.error) throw new Error(dispute.error.message);
    await admin.from("driver_dispute_messages").insert({ dispute_id: dispute.data.id, author_driver_id: textValue(driver.id), body: body.description });
    await admin.from("driver_portal_audit_events").insert({ actor_driver_id: textValue(driver.id), action: "driver_dispute_opened", entity_table: "driver_disputes", entity_id: dispute.data.id, after_data: dispute.data });
    return NextResponse.json({ dispute: dispute.data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao abrir contestacao." }, { status: 400 });
  }
}
