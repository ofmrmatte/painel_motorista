import { textValue } from "@/lib/format";

export function driverOwnsRecord(driver: Record<string, unknown>, record: Record<string, unknown>) {
  const driverId = textValue(driver.id);
  return Boolean(driverId && textValue(record.driver_id) === driverId);
}

