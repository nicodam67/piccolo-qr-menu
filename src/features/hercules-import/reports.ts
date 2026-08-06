import { mkdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { assertSafeForReport } from "./security";
import type {
  ImportAnalysis,
  ImportPlan,
  SnapshotManifest,
  ValidationReport,
} from "./types";
import { canonicalJson } from "./utils";

export function buildValidationReport(
  manifest: SnapshotManifest,
  plan: ImportPlan,
  analysis: Pick<ImportAnalysis, "normalized">,
): ValidationReport {
  const warnings = manifest.issues.filter(
    ({ severity }) => severity === "warning",
  );
  const errors = manifest.issues.filter(({ severity }) => severity === "error");
  return {
    schemaVersion: 1,
    valid: errors.length === 0,
    sourceChecksum: manifest.source.checksum,
    counters: plan.counters,
    warnings,
    errors,
    userInventory: analysis.normalized.users,
  };
}

function markdownReport(analysis: ImportAnalysis): string {
  const { manifest, plan, report } = analysis;
  const lines = [
    "# Informe de validación Hercules",
    "",
    `- Snapshot: \`${manifest.source.filename}\``,
    `- SHA-256: \`${manifest.source.checksum}\``,
    `- Resultado: **${report.valid ? "válido" : "inválido"}**`,
    `- Documentos: ${manifest.totals.documents}`,
    `- Binarios: ${manifest.totals.storageFiles} (${manifest.totals.storageBytes} bytes)`,
    "",
    "## Tablas",
    "",
    "| Tabla | Clasificación | Documentos | JSONL inválido |",
    "| --- | --- | ---: | ---: |",
    ...manifest.tables.map(
      (table) =>
        `| ${table.name} | ${table.classification} | ${table.documentCount} | ${table.invalidLineCount} |`,
    ),
    "",
    "## Plan",
    "",
    "| Acción | Conteo |",
    "| --- | ---: |",
    ...(["create", "update", "skip", "reject"] as const).map(
      (action) => `| ${action} | ${plan.counters[action]} |`,
    ),
    "",
    "## Assets",
    "",
    `- Referenciados: ${manifest.assets.filter((asset) => !asset.orphan).length}`,
    `- Huérfanos: ${manifest.assets.filter((asset) => asset.orphan).length}`,
    `- Duplicados por SHA-256: ${manifest.assets.filter((asset) => asset.duplicateOf).length}`,
    `- Binario ausente: ${manifest.assets.filter((asset) => asset.status === "missing_binary").length}`,
    "",
    "## Usuarios",
    "",
    `Se inventariaron ${report.userInventory.length} usuarios. No se importan credenciales, sesiones, tokens ni administradores. Todos requieren intervención humana.`,
    "",
    "## Errores",
    "",
    ...(report.errors.length
      ? report.errors.map(
          (error) =>
            `- \`${error.code}\`${error.table ? ` (${error.table})` : ""}: ${error.message}`,
        )
      : ["- Ninguno."]),
    "",
    "## Advertencias",
    "",
    ...(report.warnings.length
      ? report.warnings.map(
          (warning) =>
            `- \`${warning.code}\`${warning.table ? ` (${warning.table})` : ""}: ${warning.message}`,
        )
      : ["- Ninguna."]),
    "",
    "## Garantías de este informe",
    "",
    "- El ZIP se abrió en modo de solo lectura y no se extrajo.",
    "- No se escribió en PostgreSQL ni se copiaron binarios.",
    "- Los IDs propuestos son deterministas a partir del tipo y `_id` Convex.",
    "- Las discrepancias permanecen explícitas; no se inventan traducciones.",
    "",
  ];
  return lines.join("\n");
}

async function atomicWrite(path: string, contents: string) {
  const temporary = `${path}.tmp-${process.pid}`;
  await writeFile(temporary, contents, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, path);
}

export async function writeReports(
  analysis: ImportAnalysis,
  outputDirectory: string,
): Promise<string[]> {
  assertSafeForReport(analysis.manifest, "manifest");
  assertSafeForReport(analysis.plan, "plan");
  assertSafeForReport(analysis.report, "report");
  await mkdir(outputDirectory, { recursive: true, mode: 0o700 });
  const outputs = [
    ["manifest.json", `${canonicalJson(analysis.manifest)}\n`],
    ["import-plan.json", `${canonicalJson(analysis.plan)}\n`],
    ["validation-report.json", `${canonicalJson(analysis.report)}\n`],
    ["REPORT.md", markdownReport(analysis)],
  ] as const;
  await Promise.all(
    outputs.map(([filename, contents]) =>
      atomicWrite(join(outputDirectory, filename), contents),
    ),
  );
  return outputs.map(([filename]) => join(outputDirectory, filename));
}
