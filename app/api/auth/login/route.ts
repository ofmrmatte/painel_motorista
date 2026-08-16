import { NextResponse } from "next/server";
import { z } from "zod";
import { genericAuthError, isRateLimited, normalizeDriverCode, validatePin, verifyPin } from "@/lib/auth-core";
import { loadEffectiveDriverPortalAccess } from "@/lib/driver-access";
import { recentFailedAttempts, recordAuthAttempt, requestOrigin, setDriverSession } from "@/lib/driver-session";
import { textValue } from "@/lib/format";
import { createAdminClient, pinPepper } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  driverCode: z.string().min(1),
  pin: z.string(),
});

export async function POST(request: Request) {
  const origin = await requestOrigin();
  let driverCode = "";
  let driverId: string | null = null;
  try {
    const parsed = schema.parse(await request.json());
    driverCode = normalizeDriverCode(parsed.driverCode);
    if (!driverCode || !validatePin(parsed.pin)) throw new Error("invalid_input");
    const [driverFailures, originFailures, combinedFailures] = await Promise.all([
      recentFailedAttempts("login", { driverCode }),
      recentFailedAttempts("login", { origin }),
      recentFailedAttempts("login", { driverCode, origin }),
    ]);
    if (isRateLimited(driverFailures) || isRateLimited(originFailures) || isRateLimited(combinedFailures)) throw new Error("rate_limited");

    const admin = createAdminClient();
    const driverResult = await admin.from("alc_drivers").select("*").eq("driver_code", driverCode).maybeSingle();
    if (driverResult.error) throw new Error(driverResult.error.message);
    const driver = driverResult.data;
    driverId = textValue(driver?.id) || null;
    if (!driver || !driverId || textValue(driver.portal_status) !== "active") throw new Error("invalid_credentials");
    const access = await loadEffectiveDriverPortalAccess(driver);
    if (!access.allowed) throw new Error(access.reason);
    const credentialResult = await admin.from("driver_portal_credentials").select("*").eq("driver_id", driverId).maybeSingle();
    if (credentialResult.error) throw new Error(credentialResult.error.message);
    const credential = credentialResult.data;
    if (!credential) throw new Error("invalid_credentials");
    const lockedUntil = textValue(credential.locked_until);
    if (lockedUntil && new Date(lockedUntil).getTime() > Date.now()) throw new Error("locked");

    const valid = await verifyPin(parsed.pin, textValue(credential.pin_hash), pinPepper());
    if (!valid) {
      const failedAttempts = Number(credential.failed_attempts ?? 0) + 1;
      await admin.from("driver_portal_credentials").update({
        failed_attempts: failedAttempts,
        locked_until: failedAttempts >= 5 ? new Date(Date.now() + 15 * 60000).toISOString() : null,
        updated_at: new Date().toISOString(),
      }).eq("driver_id", driverId);
      throw new Error("invalid_credentials");
    }

    await admin.from("driver_portal_credentials").update({ failed_attempts: 0, locked_until: null, updated_at: new Date().toISOString() }).eq("driver_id", driverId);
    await setDriverSession(driverId, { reason: "login" });
    await recordAuthAttempt({ kind: "login", driverCode, driverId, success: true, origin });
    await admin.from("driver_portal_audit_events").insert({ actor_driver_id: driverId, action: "driver_login", entity_table: "alc_drivers", entity_id: driverId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    await recordAuthAttempt({ kind: "login", driverCode, driverId, success: false, failureReason: error instanceof Error ? error.message : "unknown", origin });
    return NextResponse.json({ error: genericAuthError() }, { status: 401 });
  }
}
