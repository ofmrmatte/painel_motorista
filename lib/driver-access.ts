import { textValue } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase-admin";

type DbRow = Record<string, unknown>;

export function isDriverPortalBlockingStatus(status: unknown) {
  const normalized = textValue(status).trim().toLowerCase();
  return normalized === "blocked" || normalized === "inactive";
}

export function driverPortalBaseAccessKey(baseKey: unknown, sigla?: unknown) {
  return textValue(sigla).trim().toUpperCase() || textValue(baseKey).trim().toUpperCase();
}

export function getEffectiveDriverPortalAccess(driver: DbRow | null | undefined, baseEnabled: boolean) {
  const portalStatus = textValue(driver?.portal_status);
  const driverEligible = Boolean(driver?.portal_eligible);
  const blockedStatus = isDriverPortalBlockingStatus(portalStatus);
  const allowed = Boolean(baseEnabled && driverEligible && !blockedStatus);
  const reason = !baseEnabled
    ? "base_disabled"
    : !driverEligible
      ? "driver_not_eligible"
      : blockedStatus
        ? "driver_blocked"
        : "allowed";
  return {
    allowed,
    baseEnabled,
    driverEligible,
    portalStatus,
    reason,
  };
}

export async function loadDriverPortalBaseAccessKey(driver: DbRow | null | undefined) {
  const fallback = driverPortalBaseAccessKey(driver?.base_key, driver?.sigla);
  const baseKey = textValue(driver?.base_key);
  if (!baseKey) return fallback;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("operational_bases")
    .select("sigla")
    .eq("base_key", baseKey)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return driverPortalBaseAccessKey(baseKey, textValue(data?.sigla) || driver?.sigla);
}

export async function loadDriverPortalBaseEnabled(baseKey: unknown) {
  const normalized = driverPortalBaseAccessKey(baseKey);
  if (!normalized) return false;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("driver_portal_base_access")
    .select("enabled")
    .eq("base_key", normalized)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data?.enabled);
}

export async function loadEffectiveDriverPortalAccess(driver: DbRow | null | undefined) {
  const accessKey = await loadDriverPortalBaseAccessKey(driver);
  const baseEnabled = await loadDriverPortalBaseEnabled(accessKey);
  return getEffectiveDriverPortalAccess(driver, baseEnabled);
}
