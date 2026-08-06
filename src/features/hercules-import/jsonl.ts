import { TextDecoder } from "node:util";

import type { SourceDocument, ValidationIssue } from "./types";
import { asRecord } from "./utils";

export function parseJsonLines(
  buffer: Buffer,
  table: string,
): {
  documents: SourceDocument[];
  fields: Set<string>;
  invalidLineCount: number;
  issues: ValidationIssue[];
} {
  const issues: ValidationIssue[] = [];
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return {
      documents: [],
      fields: new Set(),
      invalidLineCount: 1,
      issues: [
        {
          code: "JSONL_INVALID_UTF8",
          severity: "error",
          table,
          message: `${table}/documents.jsonl no es UTF-8 válido.`,
        },
      ],
    };
  }

  const documents: SourceDocument[] = [];
  const fields = new Set<string>();
  let invalidLineCount = 0;
  text.split(/\r?\n/u).forEach((line, index) => {
    if (!line.trim()) {
      return;
    }
    try {
      const value = JSON.parse(line) as unknown;
      const record = asRecord(value);
      if (!record) {
        throw new Error("not-object");
      }
      Object.keys(record).forEach((field) => fields.add(field));
      documents.push(record);
    } catch {
      invalidLineCount += 1;
      issues.push({
        code: "JSONL_INVALID_DOCUMENT",
        severity: "error",
        table,
        path: `${table}/documents.jsonl:${index + 1}`,
        message: `La línea ${index + 1} no contiene un objeto JSON válido.`,
      });
    }
  });

  return { documents, fields, invalidLineCount, issues };
}
