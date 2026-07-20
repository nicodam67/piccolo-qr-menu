import "server-only";

import { headers } from "next/headers";

function parseConfiguredUrl(value: string | undefined) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);

    if (url.protocol === "https:" || url.protocol === "http:") {
      return url;
    }
  } catch {
    return null;
  }

  return null;
}

export function getConfiguredPublicSiteUrl() {
  return parseConfiguredUrl(process.env.NEXT_PUBLIC_SITE_URL);
}

export async function getPublicSiteUrl() {
  const configuredUrl = getConfiguredPublicSiteUrl();

  if (configuredUrl) {
    return configuredUrl;
  }

  const vercelHost =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;

  if (vercelHost) {
    return new URL(`https://${vercelHost}`);
  }

  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol =
    requestHeaders.get("x-forwarded-proto")?.split(",")[0] ?? "https";

  if (!host || (protocol !== "http" && protocol !== "https")) {
    throw new Error(
      "Configura NEXT_PUBLIC_SITE_URL para generar URLs públicas absolutas.",
    );
  }

  return new URL(`${protocol}://${host}`);
}

export function makeAbsolutePublicUrl(value: string, siteUrl: URL) {
  return new URL(value, siteUrl).toString();
}
