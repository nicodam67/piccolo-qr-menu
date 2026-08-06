import { buildManifest } from "./manifest";
import { normalizeSnapshot } from "./normalizers";
import { buildImportPlan } from "./planner";
import { buildValidationReport } from "./reports";
import type { ExistingMapping, ImportAnalysis } from "./types";
import { readConvexSnapshot } from "./zip-reader";

export async function analyzeHerculesSnapshot(
  inputPath: string,
  existingMappings: ExistingMapping[] = [],
): Promise<ImportAnalysis> {
  const snapshot = await readConvexSnapshot(inputPath);
  const normalized = normalizeSnapshot(snapshot.documentsByTable);
  const manifest = buildManifest(snapshot, normalized);
  const plan = buildImportPlan(manifest, normalized, existingMappings);
  const analysis: ImportAnalysis = {
    snapshot,
    manifest,
    normalized,
    plan,
    report: buildValidationReport(manifest, plan, { normalized }),
  };
  return analysis;
}
