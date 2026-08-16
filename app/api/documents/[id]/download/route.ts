import { NextResponse } from "next/server";
import { driverOwnsRecord } from "@/lib/authorization";
import { currentDriver } from "@/lib/driver-session";
import { textValue } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

type DbRow = Record<string, unknown>;

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const driver = await currentDriver();
    if (!driver) return NextResponse.json({ error: "Sessao expirada." }, { status: 401 });
    const { id } = await context.params;
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("driver_payment_documents")
      .select("*,driver_payment_document_versions:driver_payment_document_versions!driver_payment_document_versions_document_id_fkey(*)")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data || !driverOwnsRecord(driver, data)) {
      return NextResponse.json({ error: "Documento nao encontrado." }, { status: 404 });
    }
    const versions = (data.driver_payment_document_versions as DbRow[] | null) ?? [];
    const version = versions.find((item) => textValue(item.id) === textValue(data.active_version_id)) ?? versions.find((item) => textValue(item.status) === "active");
    if (!version) return NextResponse.json({ error: "Versao ativa nao encontrada." }, { status: 404 });
    const signed = await admin.storage.from("driver-payments").createSignedUrl(textValue(version.storage_path), 300);
    if (signed.error) throw new Error(signed.error.message);
    await admin.from("driver_portal_audit_events").insert({
      actor_driver_id: textValue(driver.id),
      action: "driver_payment_signed_url_created",
      entity_table: "driver_payment_documents",
      entity_id: id,
      after_data: { versionId: textValue(version.id) },
    });
    return NextResponse.json({ url: signed.data.signedUrl, expiresIn: 300 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao abrir PDF." }, { status: 403 });
  }
}
