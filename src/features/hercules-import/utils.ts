import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";

const UUID_NAMESPACE = "1bc68dc9-6a5c-5fa3-b07e-b7b2d5ee921d";

export function canonicalJson(value: unknown): string {
  if (value === undefined) {
    return "null";
  }
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  return `{${Object.entries(value as Record<string, unknown>)
    .filter(([, nested]) => nested !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, nested]) => `${JSON.stringify(key)}:${canonicalJson(nested)}`)
    .join(",")}}`;
}

export function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function sha256File(path: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) {
    hash.update(chunk as Buffer);
  }
  return hash.digest("hex");
}

function uuidToBytes(uuid: string): Buffer {
  return Buffer.from(uuid.replaceAll("-", ""), "hex");
}

export function deterministicUuid(entityType: string, externalId: string): string {
  const digest = createHash("sha1")
    .update(uuidToBytes(UUID_NAMESPACE))
    .update(`${entityType}:${externalId}`, "utf8")
    .digest()
    .subarray(0, 16);
  digest[6] = (digest[6]! & 0x0f) | 0x50;
  digest[8] = (digest[8]! & 0x3f) | 0x80;
  const hex = digest.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

export function firstDefined(
  source: Record<string, unknown>,
  keys: readonly string[],
): unknown {
  for (const key of keys) {
    if (source[key] !== undefined) {
      return source[key];
    }
  }
  return undefined;
}

export function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    const single = asString(value);
    return single ? [single] : [];
  }
  return [
    ...new Set(
      value
        .map((item) =>
          typeof item === "string"
            ? item.trim()
            : asString(asRecord(item)?.id ?? asRecord(item)?._id),
        )
        .filter((item): item is string => Boolean(item)),
    ),
  ].sort();
}

export function sourceDate(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}
