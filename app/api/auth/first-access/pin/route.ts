import { NextResponse } from "next/server";
import { z } from "zod";
import { genericAuthError, hashPin, validatePin } from "@/lib/auth-core";
import { loadEffectiveDriverPortalAccess } from "@/lib/driver-access";
import { consumeSetupToken, recordAuthAttempt, requestOrigin, setDriverSession } from "@/lib/driver-session";
import { textValue } from "@/lib/format";
import { createAdminClient, pinPepper } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  pin: z.string(),
  confirmPin: z.string(),
});

export async function POST(request: Request) {
  const origin = await requestOrigin();
  let driverId: string | null = null;
  let driverCode = "";
  try {
    const parsed = schema.parse(await request.json());
    if (!validatePin(parsed.pin) || parsed.pin !== parsed.confirmPin) throw new Error("PIN_INVALID");
    const setup = await consumeSetupToken();
    if (!setup) throw new Error("setup_expired");
    driverId = textValue(setup.driver_id);
    const driver = setup.alc_drivers as Record<string, unknown> | null;
    driverCode = textValue(driver?.driver_code);
    if (!driver || textValue(driver.portal_status) === "active" || textValue(driver.portal_status) === "blocked") throw new Error("not_allowed");
    const access = await loadEffectiveDriverPortalAccess(driver);
    if (!access.allowed) throw new Error(access.reason);

    const admin = createAdminClient();
    const existing = await admin.from("driver_portal_credentials").select("driver_id").eq("driver_id", driverId).maybeSingle();
    if (existing.error) throw new Error(existing.error.message);
    if (existing.data && textValue(driver.portal_status) !== "reset_required") throw new Error("already_active");

    const now = new Date().toISOString();
    const credential = await admin.from("driver_portal_credentials").upsert({
      driver_id: driverId,
      pin_hash: await hashPin(parsed.pin, pinPepper()),
      failed_attempts: 0,
      locked_until: null,
      activated_at: now,
      pin_updated_at: now,
      updated_at: now,
    }, { onConflict: "driver_id" });
    if (credential.error) throw new Error(credential.error.message);
    const updated = await admin.from("alc_drivers").update({
      portal_status: "active",
      status: "active",
      activated_at: now,
      updated_at: now,
    }).eq("id", driverId);
    if (updated.error) throw new Error(updated.error.message);
    await setDriverSession(driverId, { reason: "first_access" });
    await recordAuthAttempt({ kind: "pin_create", driverCode, driverId, success: true, origin });
    await admin.from("driver_portal_audit_events").insert({ actor_driver_id: driverId, action: "driver_pin_created", entity_table: "alc_drivers", entity_id: driverId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    await recordAuthAttempt({ kind: "pin_create", driverCode, driverId, success: false, failureReason: error instanceof Error ? error.message : "unknown", origin });
    return NextResponse.json({ error: genericAuthError() }, { status: 400 });
  }
}
