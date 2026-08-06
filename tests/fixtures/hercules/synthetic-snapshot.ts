import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

import yazl from "yazl";

export const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);
export const tinyMp4 = Buffer.from([
  0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
  0x00, 0x00, 0x00, 0x00, 0x69, 0x73, 0x6f, 0x6d, 0x6d, 0x70, 0x34, 0x32,
]);

export type SyntheticSnapshotOptions = {
  tables?: Record<string, Array<Record<string, unknown> | string>>;
  storageFiles?: Record<string, Buffer>;
};

export function baseTables(): Record<string, Array<Record<string, unknown>>> {
  const sha256 = createHash("sha256").update(tinyPng).digest("hex");
  return {
    categories: [
      {
        _id: "category-1",
        _creationTime: 1_700_000_000_000,
        translations: {
          es: { name: "Categoría sintética", description: "Solo prueba" },
        },
        sortOrder: 1,
        isActive: true,
      },
    ],
    menuItems: [
      {
        _id: "product-1",
        _creationTime: 1_700_000_000_100,
        categoryId: "category-1",
        translations: {
          es: { name: "Producto sintético", description: "Solo prueba" },
        },
        price: "12.50",
        halfPrice: "7.25",
        hasHalfPortion: true,
        imageStorageId: "storage-image-1",
        tags: ["vegetariano"],
        allergens: ["gluten"],
        sortOrder: 1,
        available: true,
        soldOut: false,
      },
    ],
    branding: [
      {
        _id: "branding-1",
        _creationTime: 1_700_000_000_200,
        phone: "+34 900 000 001",
        address: "Dirección sintética",
        timezone: "Europe/Madrid",
        currencyCode: "EUR",
        defaultLocale: "es",
        translations: {
          es: { name: "Restaurante sintético", description: "Solo prueba" },
        },
        heroId: "storage-image-1",
        primaryColor: "#112233",
        links: [
          {
            kind: "website",
            label: "Web sintética",
            url: "https://example.test",
            sortOrder: 0,
          },
        ],
      },
    ],
    users: [
      {
        _id: "user-1",
        _creationTime: 1_700_000_000_300,
        email: "synthetic@example.test",
        metadata: { roleHint: "review-only" },
      },
    ],
    _storage: [
      {
        _id: "storage-image-1",
        _creationTime: 1_700_000_000_400,
        contentType: "image/png",
        size: tinyPng.length,
        sha256,
        originalFilename: "synthetic.png",
      },
    ],
  };
}

export function realShapeFixture(): {
  tables: Record<string, Array<Record<string, unknown>>>;
  storageFiles: Record<string, Buffer>;
} {
  const binaryById = {
    "real-product-image": Buffer.concat([tinyPng, Buffer.from("product")]),
    "real-product-video": tinyMp4,
    "real-brand-hero": Buffer.concat([tinyPng, Buffer.from("hero")]),
    "real-brand-logo": Buffer.concat([tinyPng, Buffer.from("logo")]),
    "real-brand-icon": Buffer.concat([tinyPng, Buffer.from("icon")]),
  };
  const storageFiles = {
    "real-product-image.png": binaryById["real-product-image"],
    "real-product-video.mp4": binaryById["real-product-video"],
    "real-brand-hero.png": binaryById["real-brand-hero"],
    "real-brand-logo.png": binaryById["real-brand-logo"],
    "real-brand-icon.png": binaryById["real-brand-icon"],
  };
  const storageMetadata = Object.entries(binaryById).map(
    ([storageId, contents], index) => ({
      _id: storageId,
      _creationTime: 1_700_000_001_000 + index,
      internalId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      contentType: storageId.endsWith("video") ? "video/mp4" : "image/png",
      size: contents.length,
      sha256: createHash("sha256").update(contents).digest("base64"),
    }),
  );
  return {
    tables: {
      categories: [
        {
          _id: "real-category",
          _creationTime: 1_700_000_000_000,
          name: "Categoría sanitizada",
          order: 1,
          available: true,
          translations: {
            en: { name: "Sanitized category", description: "" },
            es: { name: "Categoría sanitizada", description: "" },
          },
        },
      ],
      menuItems: [
        {
          _id: "real-product",
          _creationTime: 1_700_000_000_100,
          categoryId: "real-category",
          name: "Producto sanitizado",
          description: "Descripción sintética",
          order: 1,
          available: false,
          price: 12.5,
          halfPortionPrice: 7.25,
          quantity: "250 g",
          imageStorageId: "real-product-image",
          videoStorageId: "real-product-video",
          tags: ["sintético"],
          allergens: ["gluten"],
          translations: {
            es: {
              name: "Producto sanitizado",
              description: "Descripción sintética",
            },
            en: { name: "", description: "" },
          },
        },
      ],
      branding: [
        {
          _id: "real-branding",
          _creationTime: 1_700_000_000_200,
          restaurantName: "Restaurante sanitizado",
          tagline: "Eslogan sintético",
          description: "Descripción sintética",
          phone: "+34 900 000 001",
          address: "Dirección sintética",
          city: "Ciudad sintética",
          postalCode: "00000",
          province: "Provincia sintética",
          establishedYear: "2000",
          heroImageUrl: "https://example.test/hero",
          heroImageStorageId: "real-brand-hero",
          logoId: "real-brand-logo",
          icon: "real-brand-icon",
          hours: "Horario sintético",
          cardSettings: {
            layout: "grid",
            showAllergens: true,
            showDescription: true,
            showHalfPortion: true,
            showImage: true,
            showPrice: true,
            showQuantity: true,
            showTags: true,
          },
          themeColors: {
            primary: "#112233",
            accent: "#445566",
            background: "#ffffff",
            infoTextColor: "#111111",
            callButtonBg: "#112233",
            callButtonText: "#ffffff",
          },
          themeFonts: {
            heading: "Synthetic Sans",
            body: "Synthetic Serif",
            headingColor: "#111111",
            bodyColor: "#222222",
          },
          schedule: [
            {
              day: "monday",
              shift1: { open: true, openTime: "12:00", closeTime: "16:00" },
              shift2: { open: true, openTime: "20:00", closeTime: "00:30" },
            },
            ...["tuesday", "wednesday", "thursday", "friday"].map((day) => ({
              day,
              shift1: { open: true, openTime: "12:00", closeTime: "16:00" },
              shift2: { open: false, openTime: "", closeTime: "" },
            })),
            ...["saturday", "sunday"].map((day) => ({
              day,
              shift1: { open: false, openTime: "", closeTime: "" },
              shift2: { open: false, openTime: "", closeTime: "" },
            })),
          ],
          links: [
            {
              kind: "website",
              label: "Web sintética",
              url: "https://example.test",
            },
          ],
        },
      ],
      users: [],
      _storage: storageMetadata,
    },
    storageFiles,
  };
}

export async function writeSyntheticSnapshot(
  path: string,
  options: SyntheticSnapshotOptions = {},
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const zip = new yazl.ZipFile();
  const tables = options.tables ?? baseTables();
  Object.entries(tables).forEach(([table, documents]) => {
    const contents = documents
      .map((document) =>
        typeof document === "string" ? document : JSON.stringify(document),
      )
      .join("\n");
    zip.addBuffer(
      Buffer.from(`${contents}${contents ? "\n" : ""}`),
      `${table}/documents.jsonl`,
    );
  });
  Object.entries(
    options.storageFiles ?? { "storage-image-1": tinyPng },
  ).forEach(([storageId, contents]) => {
    zip.addBuffer(contents, `_storage/${encodeURIComponent(storageId)}`);
  });
  zip.end();
  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(path, { mode: 0o600 });
    zip.outputStream.pipe(output);
    output.on("close", resolve);
    output.on("error", reject);
    zip.outputStream.on("error", reject);
  });
}
