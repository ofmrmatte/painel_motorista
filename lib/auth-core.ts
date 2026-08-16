import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const PIN_PATTERN = /^\d{4}$/;
const HASH_PREFIX = "scrypt:v1";
export const MAX_FAILED_ATTEMPTS = 5;
export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

export function normalizeDriverCode(value: unknown) {
  return String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]+/g, "");
}

export function normalizeBaseKey(value: unknown) {
  return String(value ?? "").trim().toUpperCase().replace(/\s+/g, " ");
}

export function validatePin(pin: unknown) {
  return PIN_PATTERN.test(String(pin ?? ""));
}

export function createOpaqueToken() {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string, pepper: string) {
  return createHash("sha256").update(`${token}:${pepper}`).digest("hex");
}

export async function hashPin(pin: string, pepper: string) {
  if (!validatePin(pin)) throw new Error("PIN_INVALID");
  const salt = randomBytes(16);
  const derived = (await scrypt(`${pin}:${pepper}`, salt, 64)) as Buffer;
  return `${HASH_PREFIX}:${salt.toString("base64url")}:${derived.toString("base64url")}`;
}

export async function verifyPin(pin: string, storedHash: string, pepper: string) {
  if (!validatePin(pin)) return false;
  const [scheme, version, saltText, hashText] = storedHash.split(":");
  if (`${scheme}:${version}` !== HASH_PREFIX || !saltText || !hashText) return false;
  const salt = Buffer.from(saltText, "base64url");
  const expected = Buffer.from(hashText, "base64url");
  const actual = (await scrypt(`${pin}:${pepper}`, salt, expected.byteLength)) as Buffer;
  return actual.byteLength === expected.byteLength && timingSafeEqual(actual, expected);
}

export function isRateLimited(failedAttempts: Array<{ created_at?: string | null; success?: boolean | null }>, now = Date.now()) {
  const recentFailures = failedAttempts.filter((attempt) => {
    if (attempt.success) return false;
    const created = new Date(attempt.created_at ?? 0).getTime();
    return Number.isFinite(created) && now - created <= RATE_LIMIT_WINDOW_MS;
  });
  return recentFailures.length >= MAX_FAILED_ATTEMPTS;
}

export function genericAuthError() {
  return "Nao foi possivel validar os dados informados.";
}

