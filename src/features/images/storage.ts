import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import type { OptimizedProductImage } from "./image-processing";

type ImageStorageDriver = "local" | "s3";

type ImageStorageConfig =
  | {
      driver: "local";
      directory: string;
    }
  | {
      driver: "s3";
      bucket: string;
      publicBaseUrl: string;
      client: S3Client;
    };

export type StoredProductImage = {
  desktopUrl: string;
  mobileUrl: string;
};

const globalForStorage = globalThis as typeof globalThis & {
  piccoloS3Client?: S3Client;
};

function getDriver(): ImageStorageDriver {
  const configuredDriver = process.env.IMAGE_STORAGE_DRIVER;

  if (configuredDriver === "local" || configuredDriver === "s3") {
    return configuredDriver;
  }

  if (process.env.NODE_ENV !== "production") {
    return "local";
  }

  throw new Error(
    "IMAGE_STORAGE_DRIVER debe configurarse como local o s3.",
  );
}

function getStorageConfig(): ImageStorageConfig {
  const driver = getDriver();

  if (driver === "local") {
    return {
      driver,
      directory: path.join(
        /* turbopackIgnore: true */ process.cwd(),
        ".data",
        "uploads",
      ),
    };
  }

  const bucket = process.env.IMAGE_S3_BUCKET;
  const region = process.env.IMAGE_S3_REGION;
  const publicBaseUrl = process.env.IMAGE_PUBLIC_BASE_URL;

  if (!bucket || !region || !publicBaseUrl) {
    throw new Error(
      "IMAGE_S3_BUCKET, IMAGE_S3_REGION e IMAGE_PUBLIC_BASE_URL son obligatorias para S3.",
    );
  }

  if (!globalForStorage.piccoloS3Client) {
    const accessKeyId = process.env.IMAGE_S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.IMAGE_S3_SECRET_ACCESS_KEY;

    globalForStorage.piccoloS3Client = new S3Client({
      region,
      endpoint: process.env.IMAGE_S3_ENDPOINT || undefined,
      forcePathStyle: process.env.IMAGE_S3_FORCE_PATH_STYLE === "true",
      credentials:
        accessKeyId && secretAccessKey
          ? { accessKeyId, secretAccessKey }
          : undefined,
    });
  }

  return {
    driver,
    bucket,
    publicBaseUrl: publicBaseUrl.replace(/\/$/, ""),
    client: globalForStorage.piccoloS3Client,
  };
}

function getVariantKeys() {
  const imageId = randomUUID();

  return {
    desktop: `products/${imageId}.desktop.webp`,
    mobile: `products/${imageId}.mobile.webp`,
  };
}

export async function storeProductImage(
  image: OptimizedProductImage,
): Promise<StoredProductImage> {
  const config = getStorageConfig();
  const keys = getVariantKeys();

  if (config.driver === "local") {
    await mkdir(
      path.join(
        /* turbopackIgnore: true */ config.directory,
        "products",
      ),
      { recursive: true },
    );
    await Promise.all([
      writeFile(
        path.join(
          /* turbopackIgnore: true */ config.directory,
          keys.desktop,
        ),
        image.desktop,
      ),
      writeFile(
        path.join(
          /* turbopackIgnore: true */ config.directory,
          keys.mobile,
        ),
        image.mobile,
      ),
    ]);

    return {
      desktopUrl: `/uploads/${keys.desktop}`,
      mobileUrl: `/uploads/${keys.mobile}`,
    };
  }

  const upload = (key: string, body: Buffer) =>
    config.client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: body,
        ContentType: "image/webp",
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );

  await Promise.all([
    upload(keys.desktop, image.desktop),
    upload(keys.mobile, image.mobile),
  ]);

  return {
    desktopUrl: `${config.publicBaseUrl}/${keys.desktop}`,
    mobileUrl: `${config.publicBaseUrl}/${keys.mobile}`,
  };
}

function getManagedKeys(url: string, config: ImageStorageConfig) {
  let desktopKey: string | null = null;

  if (config.driver === "local") {
    const pathname = new URL(url, "http://local").pathname;

    if (pathname.startsWith("/uploads/products/")) {
      desktopKey = pathname.replace(/^\/uploads\//, "");
    }
  } else if (url.startsWith(`${config.publicBaseUrl}/products/`)) {
    desktopKey = url.slice(config.publicBaseUrl.length + 1);
  }

  if (!desktopKey || !desktopKey.endsWith(".desktop.webp")) {
    return [];
  }

  return [
    desktopKey,
    desktopKey.replace(/\.desktop\.webp$/, ".mobile.webp"),
  ];
}

export async function deleteManagedProductImage(url: string) {
  if (!url) {
    return;
  }

  const config = getStorageConfig();
  const keys = getManagedKeys(url, config);

  if (keys.length === 0) {
    return;
  }

  if (config.driver === "local") {
    await Promise.all(
      keys.map((key) =>
        rm(
          path.join(/* turbopackIgnore: true */ config.directory, key),
          { force: true },
        ),
      ),
    );
    return;
  }

  await Promise.all(
    keys.map((key) =>
      config.client.send(
        new DeleteObjectCommand({
          Bucket: config.bucket,
          Key: key,
        }),
      ),
    ),
  );
}

export function getLocalImagePath(pathSegments: string[]) {
  const config = getStorageConfig();

  if (config.driver !== "local") {
    return null;
  }

  if (
    pathSegments.length !== 2 ||
    pathSegments[0] !== "products" ||
    !/^[a-f0-9-]+\.(?:desktop|mobile)\.webp$/i.test(pathSegments[1])
  ) {
    return null;
  }

  return path.join(
    /* turbopackIgnore: true */ config.directory,
    ...pathSegments,
  );
}
