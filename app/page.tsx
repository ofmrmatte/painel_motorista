import { redirect } from "next/navigation";
import { PortalApp } from "@/components/portal-app";
import { currentDriver } from "@/lib/driver-session";
import { loadDriverPortalPayload } from "@/lib/portal-data";

export default async function HomePage() {
  const driver = await currentDriver();
  if (!driver) redirect("/login");
  const payload = await loadDriverPortalPayload(driver);
  return <PortalApp initialData={payload} />;
}
