import { NextResponse } from "next/server";
import { z } from "zod";
import { currentDriver } from "@/lib/driver-session";
import { textValue } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const schema = z.object({ id: z.string().min(1) });

export async function PATCH(request: Request) {
  try {
    const driver = await currentDriver();
    if (!driver) return NextResponse.json({ error: "Sessao expirada." }, { status: 401 });
    const body = schema.parse(await request.json());
    const admin = createAdminClient();
    const updated = await admin
      .from("driver_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", body.id)
      .eq("driver_id", textValue(driver.id))
      .select()
      .maybeSingle();
    if (updated.error) throw new Error(updated.error.message);
    if (!updated.data) return NextResponse.json({ error: "Notificacao nao encontrada." }, { status: 404 });
    return NextResponse.json({ notification: updated.data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao atualizar notificacao." }, { status: 400 });
  }
}

