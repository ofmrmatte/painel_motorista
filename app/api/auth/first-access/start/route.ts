import { NextResponse } from "next/server";
import { z } from "zod";
import { genericAuthError, isRateLimited, normalizeBaseKey, normalizeDriverCode } from "@/lib/auth-core";
import { createSetupToken, recentFailedAttempts, recordAuthAttempt, requestOrigin } from "@/lib/driver-session";
import { textValue } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  driverCode: z.string().min(1),
  baseKey: z.string().min(1),
});

export async function POST(request: Request) {
  const origin = await requestOrigin();
  let driverCode = "";
  let baseKey = "";
  let driverId: string | null = null;
  try {
    const parsed = schema.parse(await request.json());
    driverCode = normalizeDriverCode(parsed.driverCode);
    baseKey = normalizeBaseKey(parsed.baseKey);
    if (!driverCode || !baseKey) throw new Error("invalid_input");
    const [driverFailures, originFailures, combinedFailures] = await Promise.all([
      recentFailedAttempts("first_access", { driverCode }),
      recentFailedAttempts("first_access", { origin }),
      recentFailedAttempts("first_access", { driverCode, origin }),
    ]);
    if (isRateLimited(driverFailures) || isRateLimited(originFailures) || isRateLimited(combinedFailures)) throw new Error("rate_limited");

    const admin = createAdminClient();
    const { data: driver, error } = await admin.from("alc_drivers").select("*").eq("driver_code", driverCode).maybeSingle();
    if (error) throw new Error(error.message);
    driverId = textValue(driver?.id) || null;
    const driverBase = normalizeBaseKey(driver?.base_key);
    const portalStatus = textValue(driver?.portal_status);
    const eligible = Boolean(driver?.portal_eligible);
    if (!driver || driverBase !== baseKey || !eligible || portalStatus === "blocked" || portalStatus === "inactive") {
      throw new Error("not_allowed");
    }
    if (portalStatus === "active") {
      await recordAuthAttempt({ kind: "first_access", driverCode, baseKey, driverId, success: false, failureReason: "already_active", origin });
      return NextResponse.json({ error: "Este acesso ja foi ativado. Entre com seu PIN ou solicite redefinicao ao responsavel." }, { status: 409 });
    }
    const credential = await admin.from("driver_portal_credentials").select("driver_id").eq("driver_id", textValue(driver.id)).maybeSingle();
    if (credential.error) throw new Error(credential.error.message);
    if (credential.data && portalStatus !== "reset_required") {
      await recordAuthAttempt({ kind: "first_access", driverCode, baseKey, driverId, success: false, failureReason: "credential_exists", origin });
      return NextResponse.json({ error: "Este acesso ja foi ativado. Entre com seu PIN ou solicite redefinicao ao responsavel." }, { status: 409 });
    }

    await createSetupToken(textValue(driver.id), origin);
    await recordAuthAttempt({ kind: "first_access", driverCode, baseKey, driverId, success: true, origin });
    return NextResponse.json({ ok: true });
  } catch (error) {
    await recordAuthAttempt({ kind: "first_access", driverCode, baseKey, driverId, success: false, failureReason: error instanceof Error ? error.message : "unknown", origin });
    return NextResponse.json({ error: genericAuthError() }, { status: 400 });
  }
}
