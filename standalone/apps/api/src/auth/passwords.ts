import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";

const passwordIterations = 120_000;
const passwordKeyLength = 32;
const passwordDigest = "sha256";

export interface PasswordRecord {
  hash: string;
  salt: string;
  iterations: number;
}

export function hashPassword(password: string): PasswordRecord {
  const salt = randomBytes(16).toString("hex");
  return {
    hash: derivePasswordHash(password, salt, passwordIterations),
    salt,
    iterations: passwordIterations
  };
}

export function verifyPassword(password: string, record: PasswordRecord): boolean {
  const expected = Buffer.from(record.hash, "hex");
  const actual = Buffer.from(derivePasswordHash(password, record.salt, record.iterations), "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function derivePasswordHash(password: string, salt: string, iterations: number): string {
  return pbkdf2Sync(password, salt, iterations, passwordKeyLength, passwordDigest).toString("hex");
}
