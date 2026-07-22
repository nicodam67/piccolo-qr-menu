export type QrDownloadSize = 512 | 1024 | 2048;
export type QrDownloadFormat = "png" | "svg";

export function buildPublicMenuUrl(
  baseUrl: string,
  locale: string,
  supportedLocales: string[],
) {
  if (!supportedLocales.includes(locale)) {
    throw new Error("El locale seleccionado no está disponible.");
  }

  let url: URL;

  try {
    url = new URL(baseUrl);
  } catch {
    throw new Error("La URL pública configurada no es válida.");
  }

  if (
    (url.protocol !== "https:" && url.protocol !== "http:") ||
    url.username ||
    url.password
  ) {
    throw new Error("La URL pública debe utilizar HTTP o HTTPS.");
  }

  const pathSegments = url.pathname
    .split("/")
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment));
  const lastSegment = pathSegments.at(-1);

  if (lastSegment && supportedLocales.includes(lastSegment)) {
    pathSegments.pop();
  }

  pathSegments.push(locale);
  url.pathname = `/${pathSegments.map(encodeURIComponent).join("/")}`;
  url.search = "";
  url.hash = "";

  return url.toString().replace(/\/$/, "");
}

export function getQrDownloadFilename(
  locale: string,
  format: QrDownloadFormat,
) {
  return `piccolo-carta-qr-${locale}.${format}`;
}
