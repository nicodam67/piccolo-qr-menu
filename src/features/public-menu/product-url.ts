const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function slugifyProductName(name: string) {
  return (
    name
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLocaleLowerCase("es")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "producto"
  );
}

export function getPublicProductPath(
  locale: string,
  productId: string,
  productName: string,
) {
  return `/${encodeURIComponent(locale)}/producto/${productId}-${slugifyProductName(
    productName,
  )}`;
}

export function parseProductIdFromSegment(segment: string) {
  const productId = segment.slice(0, 36);
  const suffix = segment.slice(36);

  if (
    !uuidPattern.test(productId) ||
    (suffix.length > 0 && !suffix.startsWith("-"))
  ) {
    return null;
  }

  return productId.toLowerCase();
}
