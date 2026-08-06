export const SUPPORTED_LOCALES = [
  "es",
  "ca",
  "en",
  "ro",
  "fr",
  "de",
  "nl",
  "it",
] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export type SourceDocument = Record<string, unknown>;
export type Severity = "warning" | "error";

export type ValidationIssue = {
  code: string;
  severity: Severity;
  message: string;
  table?: string;
  externalId?: string;
  path?: string;
};

export type TableClassification = "supported" | "auxiliary" | "unknown";

export type TableInventory = {
  name: string;
  classification: TableClassification;
  documentCount: number;
  fields: string[];
  invalidLineCount: number;
  duplicateIds: string[];
};

export type StorageDocument = SourceDocument & {
  _id: string;
  _creationTime?: number;
};

export type AssetReference = {
  entityType: "product" | "branding";
  externalId: string;
  role: "primary" | "gallery" | "video" | "logo" | "hero" | "icon";
  sortOrder: number;
};

export type AssetManifestEntry = {
  storageId: string;
  sourceInternalId: string | null;
  physicalFilename: string | null;
  originalFilename: string | null;
  mimeType: string;
  byteSize: number;
  sha256: string;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  references: AssetReference[];
  referencedBy: string[];
  orphan: boolean;
  duplicateOf: string | null;
  proposedStorageKey: string;
  proposedAssetId: string;
  status: "ready" | "missing_binary" | "metadata_missing" | "unsupported";
};

export type SnapshotManifest = {
  schemaVersion: 1;
  source: {
    filename: string;
    checksum: string;
    byteSize: number;
  };
  tables: TableInventory[];
  assets: AssetManifestEntry[];
  totals: {
    tables: number;
    documents: number;
    storageFiles: number;
    storageBytes: number;
  };
  issues: ValidationIssue[];
};

export type Translation = {
  locale: SupportedLocale;
  name: string;
  description: string;
  slogan?: string;
  source: "localized" | "base_field";
};

export type NormalizedEntityStates = {
  active: boolean | null;
  visible: boolean | null;
  available: boolean | null;
  soldOut: boolean | null;
  hidden: boolean | null;
  archived: boolean | null;
  effectiveActive: boolean;
};

export type NormalizedOpeningHour = {
  dayOfWeek: number;
  isClosed: boolean;
  firstOpensAt: string | null;
  firstClosesAt: string | null;
  secondOpensAt: string | null;
  secondClosesAt: string | null;
  crossesMidnight: boolean;
};

export type NormalizedCategory = {
  entityType: "category";
  externalId: string;
  sourceCreatedAt: string | null;
  sortOrder: number;
  isActive: boolean;
  status: string | null;
  states: NormalizedEntityStates;
  translations: Translation[];
  externalReferences: Record<string, string>;
  sourceMetadata: Record<string, unknown>;
  payloadHash: string;
};

export type NormalizedProduct = {
  entityType: "product";
  externalId: string;
  sourceCreatedAt: string | null;
  categoryExternalId: string;
  translations: Translation[];
  fullPriceCents: number;
  halfPriceCents: number | null;
  halfPortionAvailable: boolean | null;
  quantity: string | null;
  isActive: boolean;
  isSoldOut: boolean;
  states: NormalizedEntityStates;
  sortOrder: number;
  tags: string[];
  allergens: string[];
  primaryAssetExternalId: string | null;
  galleryAssetExternalIds: string[];
  videoAssetExternalIds: string[];
  flags: Record<string, boolean | string | number | null>;
  sourceMetadata: Record<string, unknown>;
  payloadHash: string;
};

export type NormalizedBranding = {
  entityType: "restaurant";
  externalId: string;
  sourceCreatedAt: string | null;
  phone: string;
  address: string;
  timezone: string;
  currencyCode: string;
  defaultLocale: SupportedLocale;
  heroImageUrl: string;
  translations: Translation[];
  colors: {
    primaryColor: string | null;
    secondaryColor: string | null;
    backgroundColor: string | null;
    textColor: string | null;
  };
  fonts: {
    primaryFont: string | null;
    secondaryFont: string | null;
  };
  assetExternalIds: {
    logo: string | null;
    hero: string | null;
    icon: string | null;
  };
  links: Array<{ kind: string; label: string | null; url: string; sortOrder: number }>;
  openingHours: NormalizedOpeningHour[];
  sourceMetadata: Record<string, unknown>;
  payloadHash: string;
};

export type UserInventory = {
  externalId: string;
  sourceCreatedAt: string | null;
  email: string | null;
  metadata: Record<string, unknown>;
  requiresHumanReview: true;
};

export type NormalizedSnapshot = {
  categories: NormalizedCategory[];
  products: NormalizedProduct[];
  branding: NormalizedBranding[];
  users: UserInventory[];
  issues: ValidationIssue[];
};

export type ImportAction = "create" | "update" | "skip" | "reject";

export type ImportPlanItem = {
  entityType:
    | "locale"
    | "restaurant"
    | "branding"
    | "category"
    | "tag"
    | "allergen"
    | "product"
    | "asset"
    | "user"
    | "unknown_table";
  sourceExternalId: string;
  proposedInternalId: string | null;
  action: ImportAction;
  reason: string;
  warnings: string[];
  dependencies: string[];
  importOrder: number;
  payloadHash: string | null;
};

export type ImportPlan = {
  schemaVersion: 1;
  sourceChecksum: string;
  dryRun: boolean;
  items: ImportPlanItem[];
  counters: Record<ImportAction, number>;
  issues: ValidationIssue[];
};

export type ValidationReport = {
  schemaVersion: 1;
  valid: boolean;
  sourceChecksum: string;
  counters: ImportPlan["counters"];
  warnings: ValidationIssue[];
  errors: ValidationIssue[];
  userInventory: UserInventory[];
  translationSummary: Array<{
    table: "branding" | "categories" | "menuItems";
    locale: SupportedLocale;
    present: number;
    baseFallback: number;
    absent: number;
    empty: number;
    sameAsBase: number;
  }>;
};

export type SnapshotData = {
  sourcePath: string;
  checksum: string;
  byteSize: number;
  documentsByTable: Map<string, SourceDocument[]>;
  tableFields: Map<string, Set<string>>;
  tableInvalidLines: Map<string, number>;
  storageMetadata: StorageDocument[];
  storageFiles: Map<
    string,
    {
      entryName: string;
      physicalFilename: string;
      byteSize: number;
      sha256: string;
      mimeType: string;
      width: number | null;
      height: number | null;
      durationMs: number | null;
    }
  >;
  issues: ValidationIssue[];
};

export type ExistingMapping = {
  entityType: string;
  externalId: string;
  internalId: string;
  payloadHash: string | null;
};

export type ImportAnalysis = {
  snapshot: SnapshotData;
  manifest: SnapshotManifest;
  normalized: NormalizedSnapshot;
  plan: ImportPlan;
  report: ValidationReport;
};
