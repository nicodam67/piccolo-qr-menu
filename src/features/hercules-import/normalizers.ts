import { findSensitivePaths, omitSensitiveValues } from "./security";
import type {
  NormalizedBranding,
  NormalizedCategory,
  NormalizedProduct,
  NormalizedSnapshot,
  SourceDocument,
  SupportedLocale,
  Translation,
  ValidationIssue,
} from "./types";
import { SUPPORTED_LOCALES } from "./types";
import {
  asRecord,
  asString,
  asStringArray,
  canonicalJson,
  firstDefined,
  sha256,
  sourceDate,
} from "./utils";

const baseFields = ["_id", "_creationTime"];
const categoryFields = new Set([
  ...baseFields,
  "name",
  "nombre",
  "names",
  "nombres",
  "description",
  "descripcion",
  "descriptions",
  "descripciones",
  "translations",
  "traducciones",
  "order",
  "orden",
  "sortOrder",
  "visible",
  "isVisible",
  "isActive",
  "active",
  "status",
  "estado",
  "parentId",
  "parentCategoryId",
  "externalReferences",
  "externalIds",
  "createdAt",
  "updatedAt",
]);
const productFields = new Set([
  ...baseFields,
  "category",
  "categoryId",
  "categoria",
  "categoriaId",
  "name",
  "nombre",
  "names",
  "nombres",
  "description",
  "descripcion",
  "descriptions",
  "descripciones",
  "translations",
  "traducciones",
  "price",
  "precio",
  "fullPrice",
  "precioCompleto",
  "fullPriceCents",
  "halfPrice",
  "precioMediaRacion",
  "halfPriceCents",
  "hasHalfPortion",
  "mediaRacion",
  "available",
  "isAvailable",
  "disponible",
  "visible",
  "isVisible",
  "isActive",
  "soldOut",
  "isSoldOut",
  "agotado",
  "tags",
  "labels",
  "etiquetas",
  "allergens",
  "alergenos",
  "image",
  "imageId",
  "imageStorageId",
  "primaryImage",
  "imagen",
  "gallery",
  "galeria",
  "videos",
  "video",
  "order",
  "orden",
  "sortOrder",
  "flags",
  "featured",
  "isFeatured",
  "createdAt",
  "updatedAt",
]);
const brandingFields = new Set([
  ...baseFields,
  "name",
  "nombre",
  "description",
  "descripcion",
  "slogan",
  "translations",
  "traducciones",
  "phone",
  "telefono",
  "address",
  "direccion",
  "timezone",
  "currency",
  "currencyCode",
  "defaultLocale",
  "heroImageUrl",
  "logo",
  "logoId",
  "hero",
  "heroId",
  "icon",
  "favicon",
  "primaryColor",
  "secondaryColor",
  "backgroundColor",
  "surfaceColor",
  "textColor",
  "primaryFont",
  "secondaryFont",
  "fontHeading",
  "fontBody",
  "links",
  "socialLinks",
  "createdAt",
  "updatedAt",
]);
const userFields = new Set([
  ...baseFields,
  "email",
  "name",
  "fullName",
  "metadata",
  "profile",
  "role",
  "createdAt",
  "updatedAt",
  "password",
  "passwordHash",
  "token",
  "refreshToken",
  "accessToken",
  "session",
]);
const supportedLinkKinds = new Set([
  "website",
  "instagram",
  "facebook",
  "tiktok",
  "youtube",
  "map",
  "booking",
  "other",
]);

function issue(
  issues: ValidationIssue[],
  code: string,
  severity: "warning" | "error",
  message: string,
  table: string,
  externalId?: string,
  path?: string,
) {
  issues.push({ code, severity, message, table, externalId, path });
}

function validateFields(
  document: SourceDocument,
  allowed: Set<string>,
  table: string,
  externalId: string | undefined,
  issues: ValidationIssue[],
) {
  Object.keys(document)
    .filter((key) => !allowed.has(key))
    .sort()
    .forEach((key) =>
      issue(
        issues,
        "UNKNOWN_DOCUMENT_FIELD",
        "warning",
        `Campo desconocido "${key}" en ${table}; no se transformará.`,
        table,
        externalId,
        key,
      ),
    );
}

function localeRecord(value: unknown): Record<string, unknown> {
  return asRecord(value) ?? {};
}

function extractTranslations(
  document: SourceDocument,
  table: string,
  externalId: string,
  issues: ValidationIssue[],
): Translation[] {
  const byLocale = new Map<
    SupportedLocale,
    { name: string | null; description: string | null; slogan: string | null }
  >();
  const translationRoot = localeRecord(
    firstDefined(document, ["translations", "traducciones"]),
  );
  const names = localeRecord(
    firstDefined(document, ["names", "nombres", "name", "nombre"]),
  );
  const descriptions = localeRecord(
    firstDefined(document, [
      "descriptions",
      "descripciones",
      "description",
      "descripcion",
    ]),
  );
  const observedLocales = new Set([
    ...Object.keys(translationRoot),
    ...Object.keys(names),
    ...Object.keys(descriptions),
  ]);
  observedLocales.forEach((locale) => {
    if (!SUPPORTED_LOCALES.includes(locale as SupportedLocale)) {
      issue(
        issues,
        "UNKNOWN_LOCALE",
        "error",
        `Locale no reconocido "${locale}".`,
        table,
        externalId,
        `translations.${locale}`,
      );
      return;
    }
    const translated = translationRoot[locale];
    const translatedRecord = asRecord(translated);
    const name =
      asString(translatedRecord?.name ?? translatedRecord?.nombre) ??
      asString(translated) ??
      asString(names[locale]);
    const description =
      asString(
        translatedRecord?.description ?? translatedRecord?.descripcion,
      ) ??
      asString(descriptions[locale]) ??
      "";
    const slogan = asString(
      translatedRecord?.slogan ?? translatedRecord?.eslogan,
    );
    byLocale.set(locale as SupportedLocale, { name, description, slogan });
  });

  const directName = asString(firstDefined(document, ["name", "nombre"]));
  const directDescription =
    asString(firstDefined(document, ["description", "descripcion"])) ?? "";
  if (directName && !byLocale.has("es")) {
    byLocale.set("es", {
      name: directName,
      description: directDescription,
      slogan: asString(firstDefined(document, ["slogan", "eslogan"])),
    });
  }

  for (const locale of SUPPORTED_LOCALES) {
    if (!byLocale.get(locale)?.name) {
      issue(
        issues,
        "MISSING_TRANSLATION",
        "warning",
        `Falta traducción con nombre para locale "${locale}".`,
        table,
        externalId,
        `translations.${locale}`,
      );
    }
  }
  const translations = [...byLocale.entries()]
    .filter((entry): entry is [SupportedLocale, { name: string; description: string | null; slogan: string | null }] =>
      Boolean(entry[1].name),
    )
    .map(([locale, translation]) => ({
      locale,
      name: translation.name,
      description: translation.description ?? "",
      ...(translation.slogan ? { slogan: translation.slogan } : {}),
    }))
    .sort((left, right) => left.locale.localeCompare(right.locale));
  if (translations.length === 0) {
    issue(
      issues,
      "REQUIRED_TRANSLATION_MISSING",
      "error",
      "El documento no contiene ninguna traducción con nombre.",
      table,
      externalId,
    );
  }
  return translations;
}

function integerField(
  value: unknown,
  fallback: number,
  issues: ValidationIssue[],
  table: string,
  externalId: string,
  field: string,
): number {
  if (value === undefined) return fallback;
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
    return value;
  }
  issue(
    issues,
    "INVALID_NON_NEGATIVE_INTEGER",
    "error",
    `${field} debe ser un entero no negativo.`,
    table,
    externalId,
    field,
  );
  return fallback;
}

function booleanField(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function parsePrice(
  document: SourceDocument,
  centsKeys: string[],
  decimalKeys: string[],
  required: boolean,
  table: string,
  externalId: string,
  issues: ValidationIssue[],
): number | null {
  const centsValue = firstDefined(document, centsKeys);
  if (centsValue !== undefined) {
    if (
      typeof centsValue === "number" &&
      Number.isSafeInteger(centsValue) &&
      centsValue >= 0
    ) {
      return centsValue;
    }
    issue(
      issues,
      "INVALID_PRICE",
      "error",
      "El precio en céntimos debe ser un entero no negativo.",
      table,
      externalId,
    );
    return null;
  }
  const value = firstDefined(document, decimalKeys);
  if (value === undefined || value === null || value === "") {
    if (required) {
      issue(
        issues,
        "INVALID_PRICE",
        "error",
        "Falta el precio completo.",
        table,
        externalId,
      );
    }
    return null;
  }
  const raw = typeof value === "number" ? value.toString() : asString(value);
  if (!raw || !/^\d+(?:\.\d{1,2})?$/u.test(raw)) {
    issue(
      issues,
      "INVALID_PRICE",
      "error",
      `Precio ambiguo o con más de dos decimales: "${String(value)}".`,
      table,
      externalId,
    );
    return null;
  }
  const [whole, fraction = ""] = raw.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) {
    issue(
      issues,
      "INVALID_PRICE",
      "error",
      "El precio está fuera de rango.",
      table,
      externalId,
    );
    return null;
  }
  return cents;
}

function storageId(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  const record = asRecord(value);
  return asString(
    record?._id ?? record?.storageId ?? record?.id ?? record?.storage_id,
  );
}

function storageIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    const single = storageId(value);
    return single ? [single] : [];
  }
  return [
    ...new Set(value.map(storageId).filter((id): id is string => Boolean(id))),
  ].sort();
}

function normalizeCategories(
  documents: SourceDocument[],
  issues: ValidationIssue[],
): NormalizedCategory[] {
  return documents.flatMap((document) => {
    const externalId = asString(document._id);
    if (!externalId) {
      issue(
        issues,
        "MISSING_EXTERNAL_ID",
        "error",
        "Categoría sin _id.",
        "categories",
      );
      return [];
    }
    validateFields(document, categoryFields, "categories", externalId, issues);
    findSensitivePaths(document).forEach((path) =>
      issue(
        issues,
        "SENSITIVE_FIELD",
        "error",
        `Campo sensible rechazado: ${path}.`,
        "categories",
        externalId,
        path,
      ),
    );
    const parentId = asString(
      firstDefined(document, ["parentId", "parentCategoryId"]),
    );
    const externalReferences = Object.fromEntries(
      Object.entries(
        asRecord(
          firstDefined(document, ["externalReferences", "externalIds"]),
        ) ?? {},
      )
        .filter((entry): entry is [string, string] => typeof entry[1] === "string")
        .sort(([left], [right]) => left.localeCompare(right)),
    );
    if (parentId) externalReferences.parentCategoryId = parentId;
    const normalized = {
      entityType: "category" as const,
      externalId,
      sourceCreatedAt: sourceDate(document._creationTime),
      sortOrder: integerField(
        firstDefined(document, ["sortOrder", "order", "orden"]),
        0,
        issues,
        "categories",
        externalId,
        "sortOrder",
      ),
      isActive: booleanField(
        firstDefined(document, ["isActive", "visible", "isVisible", "active"]),
        true,
      ),
      status: asString(firstDefined(document, ["status", "estado"])),
      translations: extractTranslations(
        document,
        "categories",
        externalId,
        issues,
      ),
      externalReferences,
    };
    return [{ ...normalized, payloadHash: sha256(canonicalJson(normalized)) }];
  });
}

function normalizeProducts(
  documents: SourceDocument[],
  issues: ValidationIssue[],
): NormalizedProduct[] {
  return documents.flatMap((document) => {
    const externalId = asString(document._id);
    if (!externalId) {
      issue(
        issues,
        "MISSING_EXTERNAL_ID",
        "error",
        "Producto sin _id.",
        "menuItems",
      );
      return [];
    }
    validateFields(document, productFields, "menuItems", externalId, issues);
    findSensitivePaths(document).forEach((path) =>
      issue(
        issues,
        "SENSITIVE_FIELD",
        "error",
        `Campo sensible rechazado: ${path}.`,
        "menuItems",
        externalId,
        path,
      ),
    );
    const categoryExternalId = storageId(
      firstDefined(document, [
        "categoryId",
        "categoriaId",
        "category",
        "categoria",
      ]),
    );
    if (!categoryExternalId) {
      issue(
        issues,
        "PRODUCT_CATEGORY_REQUIRED",
        "error",
        "El producto no referencia una categoría.",
        "menuItems",
        externalId,
        "categoryId",
      );
    }
    const fullPriceCents = parsePrice(
      document,
      ["fullPriceCents"],
      ["fullPrice", "precioCompleto", "price", "precio"],
      true,
      "menuItems",
      externalId,
      issues,
    );
    const halfPriceCents = parsePrice(
      document,
      ["halfPriceCents"],
      ["halfPrice", "precioMediaRacion"],
      false,
      "menuItems",
      externalId,
      issues,
    );
    const halfFlag = firstDefined(document, ["hasHalfPortion", "mediaRacion"]);
    if (halfFlag === true && halfPriceCents === null) {
      issue(
        issues,
        "INVALID_HALF_PORTION",
        "error",
        "Media ración habilitada sin precio.",
        "menuItems",
        externalId,
      );
    } else if (halfFlag === false && halfPriceCents !== null) {
      issue(
        issues,
        "INVALID_HALF_PORTION",
        "error",
        "Media ración deshabilitada con precio.",
        "menuItems",
        externalId,
      );
    } else if (halfFlag === undefined && halfPriceCents !== null) {
      issue(
        issues,
        "HALF_PORTION_FLAG_MISSING",
        "warning",
        "Existe precio de media ración sin flag explícito.",
        "menuItems",
        externalId,
      );
    }
    const available = booleanField(
      firstDefined(document, ["available", "isAvailable", "disponible"]),
      true,
    );
    const normalized = {
      entityType: "product" as const,
      externalId,
      sourceCreatedAt: sourceDate(document._creationTime),
      categoryExternalId: categoryExternalId ?? "",
      translations: extractTranslations(
        document,
        "menuItems",
        externalId,
        issues,
      ),
      fullPriceCents: fullPriceCents ?? 0,
      halfPriceCents,
      isActive:
        available &&
        booleanField(
          firstDefined(document, ["isActive", "visible", "isVisible"]),
          true,
        ),
      isSoldOut: booleanField(
        firstDefined(document, ["soldOut", "isSoldOut", "agotado"]),
        false,
      ),
      sortOrder: integerField(
        firstDefined(document, ["sortOrder", "order", "orden"]),
        0,
        issues,
        "menuItems",
        externalId,
        "sortOrder",
      ),
      tags: asStringArray(
        firstDefined(document, ["tags", "labels", "etiquetas"]),
      ),
      allergens: asStringArray(
        firstDefined(document, ["allergens", "alergenos"]),
      ),
      primaryAssetExternalId: storageId(
        firstDefined(document, [
          "imageStorageId",
          "imageId",
          "primaryImage",
          "image",
          "imagen",
        ]),
      ),
      galleryAssetExternalIds: storageIds(
        firstDefined(document, ["gallery", "galeria"]),
      ),
      videoAssetExternalIds: storageIds(
        firstDefined(document, ["videos", "video"]),
      ),
      flags: {
        featured:
          typeof firstDefined(document, ["featured", "isFeatured"]) === "boolean"
            ? (firstDefined(document, ["featured", "isFeatured"]) as boolean)
            : null,
        ...(asRecord(document.flags) ?? {}),
      },
    };
    return [{ ...normalized, payloadHash: sha256(canonicalJson(normalized)) }];
  });
}

function normalizeBranding(
  documents: SourceDocument[],
  issues: ValidationIssue[],
): NormalizedBranding[] {
  return documents.flatMap((document) => {
    const externalId = asString(document._id);
    if (!externalId) {
      issue(
        issues,
        "MISSING_EXTERNAL_ID",
        "error",
        "Branding sin _id.",
        "branding",
      );
      return [];
    }
    validateFields(document, brandingFields, "branding", externalId, issues);
    findSensitivePaths(document).forEach((path) =>
      issue(
        issues,
        "SENSITIVE_FIELD",
        "error",
        `Campo sensible rechazado: ${path}.`,
        "branding",
        externalId,
        path,
      ),
    );
    const defaultLocale =
      asString(document.defaultLocale) ?? ("es" satisfies SupportedLocale);
    if (!SUPPORTED_LOCALES.includes(defaultLocale as SupportedLocale)) {
      issue(
        issues,
        "UNKNOWN_LOCALE",
        "error",
        `Locale predeterminado no reconocido "${defaultLocale}".`,
        "branding",
        externalId,
      );
    }
    const required = {
      phone: asString(firstDefined(document, ["phone", "telefono"])),
      address: asString(firstDefined(document, ["address", "direccion"])),
    };
    Object.entries(required).forEach(([field, value]) => {
      if (!value) {
        issue(
          issues,
          "BRANDING_REQUIRED_FIELD",
          "error",
          `Branding requiere ${field}.`,
          "branding",
          externalId,
          field,
        );
      }
    });
    const rawLinks =
      firstDefined(document, ["links", "socialLinks"]) ?? ([] as unknown[]);
    const links = (Array.isArray(rawLinks) ? rawLinks : [])
      .map((value, index) => {
        const record = asRecord(value);
        const url = asString(record?.url);
        if (!record || !url) return null;
        const kind = asString(record.kind ?? record.type) ?? "other";
        if (!supportedLinkKinds.has(kind)) {
          issue(
            issues,
            "UNSUPPORTED_LINK_KIND",
            "error",
            `Tipo de enlace no soportado "${kind}".`,
            "branding",
            externalId,
            `links.${index}.kind`,
          );
        }
        return {
          kind,
          label: asString(record.label),
          url,
          sortOrder:
            typeof record.sortOrder === "number" &&
            Number.isSafeInteger(record.sortOrder) &&
            record.sortOrder >= 0
              ? record.sortOrder
              : index,
        };
      })
      .filter((value): value is NonNullable<typeof value> => Boolean(value))
      .sort((left, right) => left.sortOrder - right.sortOrder);
    const heroAsset = storageId(firstDefined(document, ["heroId", "hero"]));
    if (!asString(document.heroImageUrl) && !heroAsset) {
      issue(
        issues,
        "BRANDING_REQUIRED_FIELD",
        "error",
        "Branding requiere heroImageUrl o un asset hero.",
        "branding",
        externalId,
        "hero",
      );
    }
    const normalized = {
      entityType: "restaurant" as const,
      externalId,
      sourceCreatedAt: sourceDate(document._creationTime),
      phone: required.phone ?? "",
      address: required.address ?? "",
      timezone: asString(document.timezone) ?? "Europe/Madrid",
      currencyCode: (
        asString(firstDefined(document, ["currencyCode", "currency"])) ?? "EUR"
      ).toUpperCase(),
      defaultLocale: SUPPORTED_LOCALES.includes(defaultLocale as SupportedLocale)
        ? (defaultLocale as SupportedLocale)
        : "es",
      heroImageUrl:
        asString(document.heroImageUrl) ??
        (heroAsset ? `hercules-pending://storage/${heroAsset}` : ""),
      translations: extractTranslations(
        document,
        "branding",
        externalId,
        issues,
      ),
      colors: {
        primaryColor: asString(document.primaryColor),
        secondaryColor: asString(document.secondaryColor),
        backgroundColor: asString(
          firstDefined(document, ["backgroundColor", "surfaceColor"]),
        ),
        textColor: asString(document.textColor),
      },
      fonts: {
        primaryFont: asString(
          firstDefined(document, ["primaryFont", "fontHeading"]),
        ),
        secondaryFont: asString(
          firstDefined(document, ["secondaryFont", "fontBody"]),
        ),
      },
      assetExternalIds: {
        logo: storageId(firstDefined(document, ["logoId", "logo"])),
        hero: heroAsset,
        icon: storageId(firstDefined(document, ["icon", "favicon"])),
      },
      links,
    };
    return [{ ...normalized, payloadHash: sha256(canonicalJson(normalized)) }];
  });
}

export function normalizeSnapshot(
  documentsByTable: Map<string, SourceDocument[]>,
): NormalizedSnapshot {
  const issues: ValidationIssue[] = [];
  const categories = normalizeCategories(
    documentsByTable.get("categories") ?? [],
    issues,
  );
  const products = normalizeProducts(
    documentsByTable.get("menuItems") ?? [],
    issues,
  );
  const branding = normalizeBranding(
    documentsByTable.get("branding") ?? [],
    issues,
  );
  const users = (documentsByTable.get("users") ?? []).flatMap((document) => {
    const externalId = asString(document._id);
    if (!externalId) {
      issue(
        issues,
        "MISSING_EXTERNAL_ID",
        "error",
        "Usuario sin _id.",
        "users",
      );
      return [];
    }
    validateFields(document, userFields, "users", externalId, issues);
    const sensitive = findSensitivePaths(document);
    sensitive.forEach((path) =>
      issue(
        issues,
        "SENSITIVE_USER_FIELD_REDACTED",
        "warning",
        `Campo sensible de usuario omitido: ${path}.`,
        "users",
        externalId,
        path,
      ),
    );
    const safe = omitSensitiveValues(document) as SourceDocument;
    const metadata = {
      ...(asRecord(safe.metadata) ?? {}),
      ...(asString(safe.name) ? { name: asString(safe.name)! } : {}),
      ...(asString(safe.fullName)
        ? { fullName: asString(safe.fullName)! }
        : {}),
      ...(asString(safe.role) ? { role: asString(safe.role)! } : {}),
    };
    issue(
      issues,
      "USER_REQUIRES_HUMAN_REVIEW",
      "warning",
      "El usuario se inventaría únicamente; no se importará.",
      "users",
      externalId,
    );
    return [
      {
        externalId,
        sourceCreatedAt: sourceDate(document._creationTime),
        email: asString(document.email)?.toLowerCase() ?? null,
        metadata,
        requiresHumanReview: true as const,
      },
    ];
  });

  const categoryIds = new Set(categories.map(({ externalId }) => externalId));
  categories.forEach((category) => {
    const parent = category.externalReferences.parentCategoryId;
    if (parent && !categoryIds.has(parent)) {
      issue(
        issues,
        "ORPHAN_CATEGORY",
        "error",
        `La categoría referencia padre inexistente "${parent}".`,
        "categories",
        category.externalId,
      );
    }
  });
  products.forEach((product) => {
    if (!categoryIds.has(product.categoryExternalId)) {
      issue(
        issues,
        "PRODUCT_CATEGORY_NOT_FOUND",
        "error",
        `Categoría inexistente "${product.categoryExternalId}".`,
        "menuItems",
        product.externalId,
        "categoryId",
      );
    }
  });
  const categoryNames = new Map<string, string>();
  categories.forEach((category) => {
    category.translations.forEach((translation) => {
      const key = `${translation.locale}:${translation.name.toLocaleLowerCase()}`;
      const previous = categoryNames.get(key);
      if (previous && previous !== category.externalId) {
        issue(
          issues,
          "DUPLICATE_CATEGORY_NAME",
          "warning",
          `Nombre de categoría duplicado con "${previous}" en ${translation.locale}.`,
          "categories",
          category.externalId,
        );
      } else {
        categoryNames.set(key, category.externalId);
      }
    });
  });
  return { categories, products, branding, users, issues };
}
