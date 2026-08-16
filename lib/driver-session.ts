import { cookies, headers } from "next/headers";
import { createOpaqueToken, hashToken, normalizeDriverCode } from "@/lib/auth-core";
import { textValue } from "@/lib/format";
import { createAdminClient, pinPepper } from "@/lib/supabase-admin";

export const SESSION_COOKIE = "alc_driver_session";
export const SETUP_COOKIE = "alc_driver_setup";
const SESSION_DAYS = 14;
const SETUP_MINUTES = 10;

type DbRow = Record<string, unknown>;

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export async function requestOrigin() {
  const headerStore = await headers();
  return textValue(headerStore.get("x-forwarded-for")).split(",")[0]?.trim() || textValue(headerStore.get("x-real-ip")) || "unknown";
}

export async function setDriverSession(driverId: string, metadata: DbRow = {}) {
  const admin = createAdminClient();
  const token = createOpaqueToken();
  const pepper = pinPepper();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
  const { error } = await admin.from("driver_portal_sessions").insert({
    driver_id: driverId,
    token_hash: hashToken(token, pepper),
    expires_at: expiresAt,
    metadata,
  });
  if (error) throw new Error(error.message);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, cookieOptions(SESSION_DAYS * 86400));
}

export async function clearDriverSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    const admin = createAdminClient();
    await admin
      .from("driver_portal_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("token_hash", hashToken(token, pinPepper()))
      .is("revoked_at", null);
  }
  cookieStore.delete(SESSION_COOKIE);
}

export async function createSetupToken(driverId: string, origin: string) {
  const admin = createAdminClient();
  const token = createOpaqueToken();
  const expiresAt = new Date(Date.now() + SETUP_MINUTES * 60000).toISOString();
  const { error } = await admin.from("driver_portal_setup_tokens").insert({
    driver_id: driverId,
    token_hash: hashToken(token, pinPepper()),
    origin,
    expires_at: expiresAt,
  });
  if (error) throw new Error(error.message);
  const cookieStore = await cookies();
  cookieStore.set(SETUP_COOKIE, token, cookieOptions(SETUP_MINUTES * 60));
}

export async function consumeSetupToken() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SETUP_COOKIE)?.value;
  if (!token) return null;
  const admin = createAdminClient();
  const tokenHash = hashToken(token, pinPepper());
  const { data, error } = await admin
    .from("driver_portal_setup_tokens")
    .select("*,alc_drivers(*)")
    .eq("token_hash", tokenHash)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  await admin.from("driver_portal_setup_tokens").update({ used_at: new Date().toISOString() }).eq("id", textValue(data.id));
  cookieStore.delete(SETUP_COOKIE);
  return data as DbRow;
}

export async function currentDriver() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("driver_portal_sessions")
    .select("*,alc_drivers(*)")
    .eq("token_hash", hashToken(token, pinPepper()))
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  await admin
    .from("driver_portal_sessions")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", textValue(data.id));
  const driver = data.alc_drivers as DbRow | null;
  if (!driver || textValue(driver.portal_status) !== "active") return null;
  await admin.from("alc_drivers").update({ last_seen_at: new Date().toISOString() }).eq("id", textValue(driver.id));
  return driver;
}

export async function recordAuthAttempt(input: {
  kind: "first_access" | "login" | "pin_create";
  driverCode?: string;
  baseKey?: string;
  driverId?: string | null;
  success: boolean;
  failureReason?: string;
  origin: string;
}) {
  const admin = createAdminClient();
  await admin.from("driver_portal_auth_attempts").insert({
    kind: input.kind,
    driver_code: normalizeDriverCode(input.driverCode),
    base_key: input.baseKey,
    driver_id: input.driverId,
    success: input.success,
    failure_reason: input.failureReason,
    origin: input.origin,
  });
}

export async function recentFailedAttempts(kind: "first_access" | "login" | "pin_create", driverCode: string, origin: string) {
  const admin = createAdminClient();
  const since = new Date(Date.now() - 15 * 60000).toISOString();
  const { data, error } = await admin
    .from("driver_portal_auth_attempts")
    .select("created_at,success")
    .eq("kind", kind)
    .eq("driver_code", normalizeDriverCode(driverCode))
    .eq("origin", origin)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return data ?? [];
}

