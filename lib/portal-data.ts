import { normalizeDriverCode } from "@/lib/auth-core";
import { numberValue, textValue } from "@/lib/format";
import { readPaged } from "@/lib/pagination";
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

function ticketDateSortValue(value: unknown) {
  const text = textValue(value).trim();
  if (!text) return 0;

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));

  const br = text.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return Date.UTC(Number(br[3]), Number(br[2]) - 1, Number(br[1]));

  const parsed = Date.parse(text);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export async function loadDriverPortalPayload(driver: DbRow) {
  const admin = createAdminClient();
  const driverId = textValue(driver.id);
  const driverCode = textValue(driver.driver_code);
  const [prefaturaRows, pnrRows, riskRows, documentRows, disputeRows, notificationRows] = await Promise.all([
    readPaged<DbRow>(async (offset, pageSize) => {
      const { data, error, count } = await admin
        .from("prefatura_records")
        .select("id,shipment_id,route_id,operation,route_date,base_key,base_name,sigla,driver_id,driver_name,value,created_at", { count: "exact" })
        .eq("driver_id", driverCode)
        .order("created_at", { ascending: false })
        .range(offset, offset + pageSize - 1);
      if (error) throw new Error(error.message);
      return { rows: (data ?? []) as DbRow[], count };
    }),
    readPaged<DbRow>(async (offset, pageSize) => {
      const { data, error, count } = await admin
        .from("pnr_records")
        .select("id,shipment_id,route_id,status,case_date,base_key,sigla,driver_id,purchase_value,created_at", { count: "exact" })
        .eq("driver_id", driverCode)
        .order("created_at", { ascending: false })
        .range(offset, offset + pageSize - 1);
      if (error) throw new Error(error.message);
      return { rows: (data ?? []) as DbRow[], count };
    }),
    readPaged<DbRow>(async (offset, pageSize) => {
      const { data, error, count } = await admin
        .from("risk_lm_records")
        .select("id,shipment_id,route_id,failure_date,base_key,sigla,driver_id,gmv_brl,failure_reason,created_at", { count: "exact" })
        .eq("driver_id", driverCode)
        .order("created_at", { ascending: false })
        .range(offset, offset + pageSize - 1);
      if (error) throw new Error(error.message);
      return { rows: (data ?? []) as DbRow[], count };
    }),
    readPaged<DbRow>(async (offset, pageSize) => {
      const { data, error, count } = await admin
        .from("driver_payment_documents")
        .select("*,driver_payment_document_versions:driver_payment_document_versions!driver_payment_document_versions_document_id_fkey(id,version_number,status,created_at)", { count: "exact" })
        .eq("driver_id", driverId)
        .in("status", ["published", "superseded"])
        .order("created_at", { ascending: false })
        .range(offset, offset + pageSize - 1);
      if (error) throw new Error(error.message);
      return { rows: (data ?? []) as DbRow[], count };
    }),
    readPaged<DbRow>(async (offset, pageSize) => {
      const { data, error, count } = await admin
        .from("driver_disputes")
        .select("*,driver_payment_documents(title),driver_dispute_messages(*)", { count: "exact" })
        .eq("driver_id", driverId)
        .order("created_at", { ascending: false })
        .range(offset, offset + pageSize - 1);
      if (error) throw new Error(error.message);
      return { rows: (data ?? []) as DbRow[], count };
    }),
    readPaged<DbRow>(async (offset, pageSize) => {
      const { data, error, count } = await admin
        .from("driver_notifications")
        .select("*", { count: "exact" })
        .eq("driver_id", driverId)
        .order("created_at", { ascending: false })
        .range(offset, offset + pageSize - 1);
      if (error) throw new Error(error.message);
      return { rows: (data ?? []) as DbRow[], count };
    }),
  ]);

  const tickets = [
    ...prefaturaRows.map((row) => {
      const operation = textValue(row.operation);
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
        date: textValue(row.route_date),
        value: numberValue(row.value),
        status: "com_penalidade",
        source: "prefatura",
        detail: operation === "PNR" ? "Desconto PNR vinculado ao pacote." : "Pacote perdido lançado para conferencia.",
      };
    }),
    ...pnrRows.map((row) => {
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
        date: textValue(row.case_date),
        value: numberValue(row.purchase_value),
        status,
        source: "pnr",
        detail: textValue(row.status) || "Status operacional recebido no relatorio PNR.",
      };
    }),
    ...riskRows.map((row) => ({
      id: `risk:${textValue(row.id)}`,
      type: "pendente",
      operationalId: textValue(row.shipment_id),
      routeId: textValue(row.route_id),
      baseKey: textValue(row.base_key),
      baseName: textValue(row.base_key),
      sigla: textValue(row.sigla),
      driverCode,
      driverName: textValue(driver.full_name),
      date: textValue(row.failure_date),
      value: numberValue(row.gmv_brl),
      status: "pendente",
      source: "risk",
      detail: textValue(row.failure_reason) || "Ocorrencia operacional em acompanhamento.",
    })),
  ].sort((a, b) => ticketDateSortValue(b.date) - ticketDateSortValue(a.date));

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
    documents: documentRows.map((row) => ({
      id: textValue(row.id),
      title: textValue(row.title),
      period: textValue(row.period),
      status: textValue(row.status),
      active_version_id: textValue(row.active_version_id),
    })),
    disputes: disputeRows.map((row) => ({
      id: textValue(row.id),
      document_id: textValue(row.document_id),
      reason: textValue(row.reason),
      status: textValue(row.status),
      decision: textValue(row.decision),
      description: textValue(row.description),
      driver_payment_documents: (row.driver_payment_documents as { title?: string } | null) ?? undefined,
    })),
    notifications: notificationRows.map((row) => ({
      id: textValue(row.id),
      title: textValue(row.title),
      body: textValue(row.body),
      read_at: textValue(row.read_at) || null,
    })),
  };
}
