import { Argon2id } from "oslo/password";

// Password policy (basic). Adjust as needed.
const MIN_LENGTH = 8;

export function validatePassword(password: string): { valid: boolean; reason?: string } {
  if (typeof password !== "string" || password.length < MIN_LENGTH) {
    return { valid: false, reason: `Password must be at least ${MIN_LENGTH} characters` };
  }
  return { valid: true };
}

const argon2id = new Argon2id({
  // Defaults are sensible; you may tune for your infra if needed
  // memorySizeKB: 19456,
  // iterations: 2,
  // hashLength: 32,
  // parallelism: 1,
});

/**
 * Hash a plaintext password using Argon2id (oslo/password).
 */
export async function hashPassword(plain: string): Promise<string> {
  const { valid, reason } = validatePassword(plain);
  if (!valid) throw new Error(reason);
  return await argon2id.hash(plain);
}

/**
 * Verify a plaintext password against an Argon2id hash.
 */
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (typeof plain !== "string" || plain.length === 0) return false;
  if (typeof hash !== "string" || hash.length === 0) return false;
  return await argon2id.verify(hash, plain);
}
