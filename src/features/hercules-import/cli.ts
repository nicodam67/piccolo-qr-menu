import { basename, dirname, join } from "node:path";

import {
  applySnapshotToTestDatabase,
  recordDryRun,
  validateSnapshotAgainstDatabase,
} from "./database";
import { writeReports } from "./reports";
import { analyzeHerculesSnapshot } from "./service";

type Arguments = Record<string, string | boolean>;

function parseArguments(values: string[]): Arguments {
  const parsed: Arguments = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]!;
    if (!value.startsWith("--")) {
      throw new Error(`Argumento inesperado: ${value}`);
    }
    const key = value.slice(2);
    const next = values[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

function requiredString(args: Arguments, key: string): string {
  const value = args[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Falta --${key}.`);
  }
  return value;
}

function optionalString(args: Arguments, key: string): string | undefined {
  const value = args[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function defaultOutputDirectory(input: string): string {
  const filename = basename(input).replace(/\.zip$/iu, "");
  return join(dirname(input), `${filename}.hercules-report`);
}

function databaseUrl(args: Arguments): string {
  return (
    optionalString(args, "database-url") ??
    process.env.DATABASE_URL ??
    requiredString(args, "database-url")
  );
}

async function inspect(args: Arguments) {
  const input = requiredString(args, "input");
  const output = optionalString(args, "output-dir") ?? defaultOutputDirectory(input);
  const analysis = await analyzeHerculesSnapshot(input);
  await writeReports(analysis, output);
  console.log(
    `Inspección completada: ${analysis.manifest.totals.documents} documentos, ${analysis.manifest.totals.storageFiles} binarios.`,
  );
  console.log(`Informes: ${output}`);
  if (!analysis.report.valid) process.exitCode = 2;
}

async function dryRun(args: Arguments) {
  const input = requiredString(args, "input");
  const output = optionalString(args, "output-dir") ?? defaultOutputDirectory(input);
  const configuredDatabase = optionalString(args, "database-url");
  const analysis = configuredDatabase
    ? await validateSnapshotAgainstDatabase(input, configuredDatabase)
    : await analyzeHerculesSnapshot(input);
  if (args["record-run"]) {
    if (!configuredDatabase) {
      throw new Error("--record-run requiere --database-url.");
    }
    await recordDryRun(analysis, configuredDatabase);
  }
  await writeReports(analysis, output);
  console.log(
    `Dry-run: create=${analysis.plan.counters.create}, update=${analysis.plan.counters.update}, skip=${analysis.plan.counters.skip}, reject=${analysis.plan.counters.reject}.`,
  );
  console.log(`Informes: ${output}`);
  if (!analysis.report.valid) process.exitCode = 2;
}

async function validateDatabase(args: Arguments) {
  const input = requiredString(args, "input");
  const output = optionalString(args, "output-dir") ?? defaultOutputDirectory(input);
  const analysis = await validateSnapshotAgainstDatabase(input, databaseUrl(args));
  await writeReports(analysis, output);
  console.log(
    `Validación DB: create=${analysis.plan.counters.create}, update=${analysis.plan.counters.update}, skip=${analysis.plan.counters.skip}, reject=${analysis.plan.counters.reject}.`,
  );
  console.log(`Informes: ${output}`);
  if (!analysis.report.valid) process.exitCode = 2;
}

async function apply(args: Arguments) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Apply está prohibido con NODE_ENV=production.");
  }
  if (args["dry-run"]) {
    throw new Error("--apply y --dry-run son incompatibles.");
  }
  const input = requiredString(args, "input");
  const output = optionalString(args, "output-dir") ?? defaultOutputDirectory(input);
  const result = await applySnapshotToTestDatabase({
    inputPath: input,
    databaseUrl: databaseUrl(args),
    confirmDatabaseName: requiredString(args, "confirm-database-name"),
    confirmSourceChecksum: requiredString(args, "confirm-source-checksum"),
    confirmBackupId: requiredString(args, "confirm-backup-id"),
  });
  await writeReports(result.analysis, output);
  console.log(
    `Apply sintético completado en ${result.databaseName}; run ${result.runId}.`,
  );
  console.log("No se copiaron binarios a storage.");
  console.log(`Informes: ${output}`);
}

async function main() {
  const [command, ...rawArguments] = process.argv.slice(2);
  const args = parseArguments(rawArguments);
  if (command === "inspect") {
    await inspect(args);
    return;
  }
  if (command === "validate-db") {
    await validateDatabase(args);
    return;
  }
  if (command === "import") {
    if (args["apply"]) {
      await apply(args);
    } else {
      await dryRun(args);
    }
    return;
  }
  throw new Error("Comando esperado: inspect, import o validate-db.");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Error desconocido.";
  console.error(`Hercules importer: ${message}`);
  process.exitCode = 1;
});
