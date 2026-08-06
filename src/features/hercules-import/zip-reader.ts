import { createHash } from "node:crypto";
import { stat } from "node:fs/promises";
import { basename } from "node:path";

import yauzl, { type Entry, type ZipFile } from "yauzl";

import { parseJsonLines } from "./jsonl";
import { inspectBinary } from "./mime";
import type { SnapshotData, StorageDocument, ValidationIssue } from "./types";
import { sha256File } from "./utils";

const MAX_DOCUMENT_FILE_BYTES = 64 * 1024 * 1024;
const MAX_ENTRY_BYTES = 2 * 1024 * 1024 * 1024;
const MAX_TOTAL_BYTES = 20 * 1024 * 1024 * 1024;
const MAX_COMPRESSION_RATIO = 1_000;
const MIME_SAMPLE_BYTES = 1024 * 1024;

export class UnsafeSnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeSnapshotError";
  }
}

function openZip(path: string): Promise<ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.open(
      path,
      { lazyEntries: true, autoClose: false, validateEntrySizes: true },
      (error, zipfile) => {
        if (error || !zipfile) {
          reject(error ?? new Error("No se pudo abrir el ZIP."));
          return;
        }
        resolve(zipfile);
      },
    );
  });
}

function openEntryStream(zipfile: ZipFile, entry: Entry): Promise<NodeJS.ReadableStream> {
  return new Promise((resolve, reject) => {
    zipfile.openReadStream(entry, (error, stream) => {
      if (error || !stream) {
        reject(error ?? new Error(`No se pudo leer ${entry.fileName}.`));
        return;
      }
      resolve(stream);
    });
  });
}

async function readEntryBuffer(
  zipfile: ZipFile,
  entry: Entry,
  limit: number,
): Promise<Buffer> {
  if (entry.uncompressedSize > limit) {
    throw new UnsafeSnapshotError(
      `${entry.fileName} supera el límite de ${limit} bytes.`,
    );
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const rawChunk of await openEntryStream(zipfile, entry)) {
    const chunk = Buffer.from(rawChunk as Uint8Array);
    size += chunk.length;
    if (size > limit) {
      throw new UnsafeSnapshotError(`${entry.fileName} excede su tamaño declarado.`);
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function inspectStorageEntry(zipfile: ZipFile, entry: Entry) {
  const hash = createHash("sha256");
  const samples: Buffer[] = [];
  let sampleSize = 0;
  let byteSize = 0;
  for await (const rawChunk of await openEntryStream(zipfile, entry)) {
    const chunk = Buffer.from(rawChunk as Uint8Array);
    hash.update(chunk);
    byteSize += chunk.length;
    if (sampleSize < MIME_SAMPLE_BYTES) {
      const remaining = MIME_SAMPLE_BYTES - sampleSize;
      const sample = chunk.subarray(0, remaining);
      samples.push(sample);
      sampleSize += sample.length;
    }
  }
  if (byteSize !== entry.uncompressedSize) {
    throw new UnsafeSnapshotError(
      `${entry.fileName} no coincide con el tamaño declarado en el ZIP.`,
    );
  }
  return {
    byteSize,
    sha256: hash.digest("hex"),
    ...inspectBinary(Buffer.concat(samples)),
  };
}

function assertSafeEntry(entry: Entry, totalBytes: number): void {
  const name = entry.fileName;
  if (
    name.includes("\\") ||
    name.includes("\0") ||
    name.startsWith("/") ||
    name.split("/").some((segment) => segment === "..")
  ) {
    throw new UnsafeSnapshotError(`Ruta ZIP no segura: ${name}`);
  }
  const unixMode = entry.externalFileAttributes >>> 16;
  if ((unixMode & 0o170000) === 0o120000) {
    throw new UnsafeSnapshotError(`El ZIP contiene un enlace simbólico: ${name}`);
  }
  if (entry.uncompressedSize > MAX_ENTRY_BYTES) {
    throw new UnsafeSnapshotError(`Entrada ZIP demasiado grande: ${name}`);
  }
  if (totalBytes + entry.uncompressedSize > MAX_TOTAL_BYTES) {
    throw new UnsafeSnapshotError("El ZIP supera el límite total descomprimido.");
  }
  if (
    entry.compressedSize > 0 &&
    entry.uncompressedSize / entry.compressedSize > MAX_COMPRESSION_RATIO
  ) {
    throw new UnsafeSnapshotError(`Ratio de compresión inseguro: ${name}`);
  }
}

function safeDecodeStorageId(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export async function readConvexSnapshot(inputPath: string): Promise<SnapshotData> {
  const sourceStats = await stat(inputPath);
  if (!sourceStats.isFile()) {
    throw new UnsafeSnapshotError("La entrada debe ser un archivo ZIP regular.");
  }

  const checksum = await sha256File(inputPath);
  const zipfile = await openZip(inputPath);
  const documentsByTable = new Map<string, Record<string, unknown>[]>();
  const tableFields = new Map<string, Set<string>>();
  const tableInvalidLines = new Map<string, number>();
  const storageFiles: SnapshotData["storageFiles"] = new Map();
  const issues: ValidationIssue[] = [];
  const seenEntries = new Set<string>();
  let totalBytes = 0;

  try {
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const fail = (error: unknown) => {
        if (settled) return;
        settled = true;
        reject(error);
      };
      zipfile.once("error", fail);
      zipfile.once("end", () => {
        if (!settled) {
          settled = true;
          resolve();
        }
      });
      zipfile.on("entry", (entry: Entry) => {
        void (async () => {
          assertSafeEntry(entry, totalBytes);
          totalBytes += entry.uncompressedSize;
          if (seenEntries.has(entry.fileName)) {
            throw new UnsafeSnapshotError(
              `El ZIP contiene la entrada duplicada ${entry.fileName}.`,
            );
          }
          seenEntries.add(entry.fileName);

          if (entry.fileName.endsWith("/")) {
            zipfile.readEntry();
            return;
          }
          const tableMatch = /^([^/]+)\/documents\.jsonl$/u.exec(entry.fileName);
          if (tableMatch) {
            const table = tableMatch[1]!;
            const parsed = parseJsonLines(
              await readEntryBuffer(zipfile, entry, MAX_DOCUMENT_FILE_BYTES),
              table,
            );
            documentsByTable.set(table, parsed.documents);
            tableFields.set(table, parsed.fields);
            tableInvalidLines.set(table, parsed.invalidLineCount);
            issues.push(...parsed.issues);
            zipfile.readEntry();
            return;
          }
          if (
            entry.fileName === "generated_schema.jsonl" ||
            entry.fileName.endsWith("/generated_schema.jsonl")
          ) {
            await readEntryBuffer(zipfile, entry, MAX_DOCUMENT_FILE_BYTES);
            zipfile.readEntry();
            return;
          }
          if (entry.fileName.startsWith("_storage/")) {
            const storageId = safeDecodeStorageId(
              entry.fileName.slice("_storage/".length),
            );
            if (!storageId) {
              throw new UnsafeSnapshotError("Binario de storage sin identificador.");
            }
            storageFiles.set(storageId, {
              entryName: entry.fileName,
              ...(await inspectStorageEntry(zipfile, entry)),
            });
            zipfile.readEntry();
            return;
          }
          issues.push({
            code: "ZIP_UNRECOGNIZED_ENTRY",
            severity: "warning",
            path: entry.fileName,
            message: `Entrada no reconocida inventariada: ${entry.fileName}.`,
          });
          await readEntryBuffer(zipfile, entry, MAX_DOCUMENT_FILE_BYTES);
          zipfile.readEntry();
        })().catch(fail);
      });
      zipfile.readEntry();
    });
  } finally {
    zipfile.close();
  }

  const storageMetadata = (documentsByTable.get("_storage") ?? []).filter(
    (document): document is StorageDocument => typeof document._id === "string",
  );
  return {
    sourcePath: inputPath,
    checksum,
    byteSize: sourceStats.size,
    documentsByTable,
    tableFields,
    tableInvalidLines,
    storageMetadata,
    storageFiles,
    issues,
  };
}

export function snapshotDisplayName(snapshot: SnapshotData): string {
  return basename(snapshot.sourcePath);
}
