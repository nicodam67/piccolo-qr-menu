import { redirect } from "next/navigation";

import { isSupportedLocale } from "@/config/locales";

type LegacyQrPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const allowedParameters = [
  "size",
  "margin",
  "correction",
  "dark",
  "light",
  "background",
  "layout",
  "showName",
  "showSlogan",
  "showCta",
] as const;

export default async function AdminQrPage({
  searchParams,
}: LegacyQrPageProps) {
  const source = await searchParams;
  const target = new URLSearchParams();
  const locale = source.locale;

  if (typeof locale === "string" && isSupportedLocale(locale)) {
    target.set("locale", locale);
  }

  for (const key of allowedParameters) {
    const value = source[key];
    if (typeof value === "string" && value.length <= 20) {
      target.set(key, value);
    }
  }

  redirect(
    target.size > 0
      ? `/admin/qr-code?${target.toString()}`
      : "/admin/qr-code",
  );
}
