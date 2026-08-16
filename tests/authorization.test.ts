import { describe, expect, it } from "vitest";
import { driverOwnsRecord } from "@/lib/authorization";

describe("autorizacao por propriedade do motorista", () => {
  it("permite somente documento do proprio motorista", () => {
    const driverA = { id: "driver-a" };
    expect(driverOwnsRecord(driverA, { driver_id: "driver-a" })).toBe(true);
    expect(driverOwnsRecord(driverA, { driver_id: "driver-b" })).toBe(false);
    expect(driverOwnsRecord(driverA, { driver_id: "" })).toBe(false);
  });
});

