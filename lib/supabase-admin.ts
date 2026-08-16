import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) throw new Error("Supabase do Portal do Motorista nao configurado.");
  return createClient(url, serviceRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function pinPepper() {
  const pepper = process.env.DRIVER_PORTAL_PIN_PEPPER;
  if (!pepper || pepper.length < 32) throw new Error("DRIVER_PORTAL_PIN_PEPPER precisa ter pelo menos 32 caracteres.");
  return pepper;
}

