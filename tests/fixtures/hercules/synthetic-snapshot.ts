import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

import yazl from "yazl";

export const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

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
