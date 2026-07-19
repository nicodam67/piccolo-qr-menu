import "server-only";

import argon2, { type HashOptions } from "argon2";

export const DUMMY_PASSWORD_HASH =
  "$argon2id$v=19$m=65536,p=1,t=3$Uqg/3SOyZ1MbElzg2ailAg$P4raBLlTaUysAzGPu0N+q6OraQHcPmotGRsqHgerchE";

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 1,
} satisfies HashOptions;

export function hashPassword(password: string) {
  return argon2.hash(password, ARGON2_OPTIONS);
}

export async function verifyPasswordHash(hash: string, password: string) {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}
