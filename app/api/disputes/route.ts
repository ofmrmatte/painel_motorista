import { NextResponse } from "next/server";
import { z } from "zod";
import { driverOwnsRecord } from "@/lib/authorization";
import { currentDriver } from "@/lib/driver-session";
import { textValue } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const schema = z.object({
  documentId: z.string().min(1),
  reason: z.string().min(2),
  description: z.string().min(5),
  reference: z.string().optional(),
  amount: z.union([z.string(), z.number()]).optional(),
});

const replySchema = z.object({
  id: z.string().uuid(),
  message: z.string().trim().min(1).max(4000),
});

function parseAmount(value: string | number | undefined) {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const normalized = value.trim().replace(/\s/g, "").replace(/^R\$/i, "").replace(/\./g, "").replace(",", ".").replace(/[^0-9.-]/g, "");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function POST(request: Request) {
  try {
    const driver = await currentDriver();
    if (!driver) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
    const body = schema.parse(await request.json());
    const admin = createAdminClient();
    const doc = await admin.from("driver_payment_documents").select("*").eq("id", body.documentId).maybeSingle();
    if (doc.error) throw new Error(doc.error.message);
    if (!doc.data || !driverOwnsRecord(driver, doc.data)) return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });
    if (textValue(doc.data.status) !== "published") return NextResponse.json({ error: "Este PDF foi substituído e não aceita novas contestações." }, { status: 409 });

    const amount = parseAmount(body.amount);
    if (body.amount != null && body.amount !== "" && amount == null) return NextResponse.json({ error: "Informe um valor válido para a contestação." }, { status: 400 });

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
      reference: body.reference?.trim() || null,
      amount,
      status: "aberta",
    }).select().single();
    if (dispute.error) throw new Error(dispute.error.message);
    await admin.from("driver_dispute_messages").insert({ dispute_id: dispute.data.id, author_driver_id: textValue(driver.id), body: body.description });
    await admin.from("driver_portal_audit_events").insert({ actor_driver_id: textValue(driver.id), action: "driver_dispute_opened", entity_table: "driver_disputes", entity_id: dispute.data.id, after_data: dispute.data });
    return NextResponse.json({ dispute: dispute.data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao abrir contestação." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const driver = await currentDriver();
    if (!driver) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
    const body = replySchema.parse(await request.json());
    const admin = createAdminClient();
    const current = await admin.from("driver_disputes").select("*").eq("id", body.id).eq("driver_id", textValue(driver.id)).maybeSingle();
    if (current.error) throw new Error(current.error.message);
    if (!current.data) return NextResponse.json({ error: "Contestação não encontrada." }, { status: 404 });
    if (["indeferida", "concluida"].includes(textValue(current.data.status))) return NextResponse.json({ error: "Esta contestação já está encerrada." }, { status: 409 });

    const inserted = await admin.from("driver_dispute_messages").insert({ dispute_id: body.id, author_driver_id: textValue(driver.id), body: body.message }).select().single();
    if (inserted.error) throw new Error(inserted.error.message);
    const nextStatus = textValue(current.data.status) === "aguardando_informacao" ? "em_analise" : textValue(current.data.status);
    const updated = await admin.from("driver_disputes").update({ status: nextStatus, updated_at: new Date().toISOString() }).eq("id", body.id).select().single();
    if (updated.error) throw new Error(updated.error.message);
    await admin.from("driver_portal_audit_events").insert({ actor_driver_id: textValue(driver.id), action: "driver_dispute_reply", entity_table: "driver_disputes", entity_id: body.id, before_data: current.data, after_data: updated.data });
    return NextResponse.json({ dispute: updated.data, message: inserted.data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao responder contestação." }, { status: 400 });
  }
}
