import { describe, expect, it } from "vitest";
import { hashPin, isRateLimited, normalizeBaseKey, normalizeDriverCode, validatePin, verifyPin } from "@/lib/auth-core";

describe("autenticacao PIN do motorista", () => {
  it("aceita exatamente 4 numeros", () => {
    expect(validatePin("1234")).toBe(true);
    expect(validatePin("123")).toBe(false);
    expect(validatePin("12345")).toBe(false);
    expect(validatePin("12A4")).toBe(false);
  });

  it("usa hash forte e compara sem texto puro", async () => {
    const pepper = "pepper-seguro-com-mais-de-trinta-e-dois-caracteres";
    const stored = await hashPin("4321", pepper);
    expect(stored).not.toContain("4321");
    expect(await verifyPin("4321", stored, pepper)).toBe(true);
    expect(await verifyPin("1234", stored, pepper)).toBe(false);
  });

  it("bloqueia por 5 falhas na janela", () => {
    const now = Date.now();
    const attempts = Array.from({ length: 5 }, (_, index) => ({
      success: false,
      created_at: new Date(now - index * 1000).toISOString(),
    }));
    expect(isRateLimited(attempts, now)).toBe(true);
    expect(isRateLimited(attempts.slice(0, 4), now)).toBe(false);
  });

  it("normaliza ID e base sem transformar nome em codigo operacional", () => {
    expect(normalizeDriverCode(" mot-123.0 ")).toBe("MOT1230");
    expect(normalizeBaseKey(" base  sao   paulo ")).toBe("BASE SAO PAULO");
  });
});

