import { describe, expect, it } from "vitest";
import { getEffectiveDriverPortalAccess, isDriverPortalBlockingStatus } from "@/lib/driver-access";

describe("acesso efetivo do portal do motorista", () => {
  it("login exige base liberada e motorista elegivel", () => {
    expect(getEffectiveDriverPortalAccess({ portal_status: "active", portal_eligible: true }, true).allowed).toBe(true);
    expect(getEffectiveDriverPortalAccess({ portal_status: "active", portal_eligible: true }, false)).toMatchObject({
      allowed: false,
      reason: "base_disabled",
    });
    expect(getEffectiveDriverPortalAccess({ portal_status: "active", portal_eligible: false }, true)).toMatchObject({
      allowed: false,
      reason: "driver_not_eligible",
    });
  });

  it("primeiro acesso exige base liberada e bloqueio individual prevalece", () => {
    expect(getEffectiveDriverPortalAccess({ portal_status: "not_activated", portal_eligible: true }, true).allowed).toBe(true);
    expect(getEffectiveDriverPortalAccess({ portal_status: "not_activated", portal_eligible: true }, false).allowed).toBe(false);
    expect(getEffectiveDriverPortalAccess({ portal_status: "blocked", portal_eligible: true }, true).allowed).toBe(false);
  });

  it("sessao existente deixa de ser valida quando base ou elegibilidade caem", () => {
    expect(getEffectiveDriverPortalAccess({ portal_status: "active", portal_eligible: true }, false).allowed).toBe(false);
    expect(getEffectiveDriverPortalAccess({ portal_status: "active", portal_eligible: false }, true).allowed).toBe(false);
  });

  it("reconhece status bloqueadores", () => {
    expect(isDriverPortalBlockingStatus("blocked")).toBe(true);
    expect(isDriverPortalBlockingStatus("inactive")).toBe(true);
    expect(isDriverPortalBlockingStatus("reset_required")).toBe(false);
  });
});
