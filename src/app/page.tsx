import { redirect } from "next/navigation";

import { getPublishedLocales } from "@/features/locales/repository";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const locales = await getPublishedLocales();
  const primary = locales.find((locale) => locale.isPrimary) ?? locales[0];
  redirect(`/${primary?.code ?? "es"}`);
}
