import { normalizeDriverCode } from "@/lib/auth-core";
import { numberValue, textValue } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase-admin";

type DbRow = Record<string, unknown>;

function pnrStatusToTicket(status: string) {
  const normalized = status.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  if (normalized.includes("AGUARDANDO")) return "aguardando_comprovante";
  if (normalized.includes("PENAL")) return "com_penalidade";
  if (normalized.includes("FATUR")) return "enviado_faturamento";
  if (normalized.includes("ANUL")) return "anulado";
  if (normalized.includes("RESOL") || normalized.includes("CONCL")) return "resolvido";
  return "pendente";
}

export async function loadDriverPortalPayload(driver: DbRow) {
  const admin = createAdminClient();
  const driverId = textValue(driver.id);
  const driverCode = textValue(driver.driver_code);
  const [prefatura, pnr, risk, documents, disputes, notifications] = await Promise.all([
    admin.from("prefatura_records").select("id,shipment_id,route_id,operation,route_date,base_key,base_name,sigla,driver_id,driver_name,value,created_at").eq("driver_id", driverCode).limit(500),
    admin.from("pnr_records").select("id,shipment_id,route_id,status,case_date,base_key,sigla,driver_id,purchase_value,created_at").eq("driver_id", driverCode).limit(500),
    admin.from("risk_lm_records").select("id,shipment_id,route_id,failure_date,base_key,sigla,driver_id,gmv_brl,failure_reason,created_at").eq("driver_id", driverCode).limit(500),
    admin.from("driver_payment_documents").select("*,driver_payment_document_versions(id,version_number,status,created_at)").eq("driver_id", driverId).in("status", ["published", "superseded"]).order("created_at", { ascending: false }).limit(200),
    admin.from("driver_disputes").select("*,driver_payment_documents(title),driver_dispute_messages(*)").eq("driver_id", driverId).order("created_at", { ascending: false }).limit(200),
    admin.from("driver_notifications").select("*").eq("driver_id", driverId).order("created_at", { ascending: false }).limit(100),
  ]);
  for (const result of [prefatura, pnr, risk, documents, disputes, notifications]) if (result.error) throw new Error(result.error.message);

  const tickets = [
    ...((prefatura.data ?? []) as DbRow[]).map((row) => {
      const operation = textValue(row.operation);
      const date = textValue(row.route_date) || textValue(row.created_at);
      return {
        id: `prefatura:${textValue(row.id)}`,
        type: operation === "PNR" ? "pnr" : "pacote_perdido",
        operationalId: textValue(row.shipment_id),
        routeId: textValue(row.route_id),
        baseKey: textValue(row.base_key),
        baseName: textValue(row.base_name) || textValue(row.base_key),
        sigla: textValue(row.sigla),
        driverCode,
        driverName: textValue(row.driver_name),
        date,
        value: numberValue(row.value),
        status: "com_penalidade",
        source: "prefatura",
        detail: operation === "PNR" ? "Desconto PNR vinculado ao pacote." : "Pacote perdido lançado para conferencia.",
      };
    }),
    ...((pnr.data ?? []) as DbRow[]).map((row) => {
      const status = pnrStatusToTicket(textValue(row.status));
      return {
        id: `pnr:${textValue(row.id)}`,
        type: status === "aguardando_comprovante" ? "aguardando_comprovante" : "pnr",
        operationalId: textValue(row.shipment_id),
        routeId: textValue(row.route_id),
        baseKey: textValue(row.base_key),
        baseName: textValue(row.base_key),
        sigla: textValue(row.sigla),
        driverCode,
        driverName: textValue(driver.full_name),
        date: textValue(row.case_date) || textValue(row.created_at),
        value: numberValue(row.purchase_value),
        status,
        source: "pnr",
        detail: textValue(row.status) || "Status operacional recebido no relatorio PNR.",
      };
    }),
    ...((risk.data ?? []) as DbRow[]).map((row) => ({
      id: `risk:${textValue(row.id)}`,
      type: "pendente",
      operationalId: textValue(row.shipment_id),
      routeId: textValue(row.route_id),
      baseKey: textValue(row.base_key),
      baseName: textValue(row.base_key),
      sigla: textValue(row.sigla),
      driverCode,
      driverName: textValue(driver.full_name),
      date: textValue(row.failure_date) || textValue(row.created_at),
      value: numberValue(row.gmv_brl),
      status: "pendente",
      source: "risk",
      detail: textValue(row.failure_reason) || "Ocorrencia operacional em acompanhamento.",
    })),
  ].sort((a, b) => textValue(b.date).localeCompare(textValue(a.date)));

  return {
    driver: {
      id: driverId,
      driverCode: normalizeDriverCode(driverCode),
      fullName: textValue(driver.full_name),
      baseKey: textValue(driver.base_key),
      sigla: textValue(driver.sigla),
      portalStatus: textValue(driver.portal_status),
    },
    tickets,
    documents: documents.data ?? [],
    disputes: disputes.data ?? [],
    notifications: notifications.data ?? [],
  };
}

