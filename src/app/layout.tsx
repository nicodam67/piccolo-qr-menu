import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";

import { getLocaleConfig } from "@/config/locales";
import "./globals.css";

export const metadata: Metadata = {
  title: "Piccolo La Ràpita · Carta",
  description:
    "Prototipo visual de la carta pública de Piccolo La Ràpita.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#173f35",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const requestHeaders = await headers();
  const locale = requestHeaders.get("x-piccolo-locale") ?? "es";
  const localeConfig = getLocaleConfig(locale) ?? getLocaleConfig("es");

  return (
    <html
      lang={localeConfig?.htmlLang ?? "es"}
      dir={localeConfig?.direction ?? "ltr"}
    >
      <body>{children}</body>
    </html>
  );
}
