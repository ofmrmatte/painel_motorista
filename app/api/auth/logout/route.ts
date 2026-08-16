import { NextResponse } from "next/server";
import { clearDriverSession } from "@/lib/driver-session";

export const dynamic = "force-dynamic";

export async function POST() {
  await clearDriverSession();
  return NextResponse.json({ ok: true });
}

