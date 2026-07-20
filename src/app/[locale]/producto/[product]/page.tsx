import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import { ChevronRight, MapPin, Phone } from "lucide-react";
import { notFound } from "next/navigation";

import { getLocaleConfig, isSupportedLocale } from "@/config/locales";
import { ProductCard } from "@/components/product-card";
import { TaxonomyIcon } from "@/components/taxonomy-icon";
import { LanguageSelector } from "@/components/language-selector";
import {
  getPublishedLocales,
  getPublishedProductLocales,
  isLocalePublished,
} from "@/features/locales/repository";
import { ProductImageLightbox } from "@/features/public-menu/components/product-image-lightbox";
import { ShareProductButton } from "@/features/public-menu/components/share-product-button";
import { getPublicMenuCopy } from "@/features/public-menu/copy";
import { getPublicProductDetail } from "@/features/public-menu/repository";
import {
  getPublicProductPath,
  parseProductIdFromSegment,
} from "@/features/public-menu/product-url";
import {
  getPublicSiteUrl,
  makeAbsolutePublicUrl,
} from "@/features/public-menu/site-url";

type ProductPageProps = {
  params: Promise<{ locale: string; product: string }>;
};

const getCachedProduct = cache(getPublicProductDetail);

function getSeoDescription(
  productName: string,
  productDescription: string,
  categoryName: string,
  restaurantName: string,
) {
  return (
    productDescription.trim() ||
    `${productName} · ${categoryName} · ${restaurantName}`
  ).slice(0, 200);
}

function safeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { locale, product: segment } = await params;
  const productId = parseProductIdFromSegment(segment);

  if (
    !productId ||
    !isSupportedLocale(locale) ||
    !(await isLocalePublished(locale))
  ) {
    notFound();
  }

  const detail = await getCachedProduct(productId, locale);

  if (!detail) {
    notFound();
  }

  const [siteUrl, productLocales] = await Promise.all([
    getPublicSiteUrl(),
    getPublishedProductLocales(productId),
  ]);
  const canonicalPath = getPublicProductPath(
    locale,
    detail.product.id,
    detail.product.name,
  );
  const canonicalUrl = makeAbsolutePublicUrl(canonicalPath, siteUrl);
  const description = getSeoDescription(
    detail.product.name,
    detail.product.description,
    detail.category.name,
    detail.restaurant.name,
  );
  const imageUrl =
    detail.displaySettings.showImages && detail.product.imageUrl
      ? makeAbsolutePublicUrl(detail.product.imageUrl, siteUrl)
      : null;
  const title = `${detail.product.name} | ${detail.restaurant.name}`;
  const languageAlternates = Object.fromEntries(
    productLocales.map((alternate) => [
      alternate.code,
      makeAbsolutePublicUrl(
        getPublicProductPath(
          alternate.code,
          detail.product.id,
          alternate.name,
        ),
        siteUrl,
      ),
    ]),
  );
  const primaryAlternate = productLocales.find(
    (alternate) => alternate.isPrimary,
  );
  const localeConfig = getLocaleConfig(locale);

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
      languages: {
        ...languageAlternates,
        "x-default":
          languageAlternates[primaryAlternate?.code ?? locale] ?? canonicalUrl,
      },
    },
    openGraph: {
      type: "website",
      url: canonicalUrl,
      title,
      description,
      siteName: detail.restaurant.name,
      locale: localeConfig?.openGraphLocale,
      alternateLocale: productLocales
        .filter((alternate) => alternate.code !== locale)
        .map((alternate) => alternate.openGraphLocale),
      images: imageUrl
        ? [{ url: imageUrl, alt: detail.product.imageAlt }]
        : undefined,
    },
    twitter: {
      card: imageUrl ? "summary_large_image" : "summary",
      title,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
  };
}

export default async function PublicProductPage({
  params,
}: ProductPageProps) {
  const { locale, product: segment } = await params;
  const productId = parseProductIdFromSegment(segment);

  if (
    !productId ||
    !isSupportedLocale(locale) ||
    !(await isLocalePublished(locale))
  ) {
    notFound();
  }

  const detail = await getCachedProduct(productId, locale);

  if (!detail) {
    notFound();
  }

  const copy = getPublicMenuCopy(locale);
  const [siteUrl, publishedLocales, productLocales] = await Promise.all([
    getPublicSiteUrl(),
    getPublishedLocales(),
    getPublishedProductLocales(productId),
  ]);
  const canonicalPath = getPublicProductPath(
    locale,
    detail.product.id,
    detail.product.name,
  );
  const canonicalUrl = makeAbsolutePublicUrl(canonicalPath, siteUrl);
  const absoluteImageUrl =
    detail.displaySettings.showImages && detail.product.imageUrl
      ? makeAbsolutePublicUrl(detail.product.imageUrl, siteUrl)
      : null;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "MenuItem",
    name: detail.product.name,
    ...(detail.product.description
      ? { description: detail.product.description }
      : {}),
    ...(absoluteImageUrl ? { image: absoluteImageUrl } : {}),
    ...(detail.displaySettings.showPrices
      ? {
          offers: {
            "@type": "Offer",
            price: detail.product.fullPrice.toFixed(2),
            priceCurrency: detail.currencyCode,
            availability: detail.product.isSoldOut
              ? "https://schema.org/OutOfStock"
              : "https://schema.org/InStock",
            url: canonicalUrl,
          },
        }
      : {}),
    provider: {
      "@type": "Restaurant",
      name: detail.restaurant.name,
    },
  };
  const formatPrice = (price: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: detail.currencyCode,
    }).format(price);

  return (
    <div className="min-h-screen bg-[#f7f3eb] pb-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />

      <header className="border-b border-white/10 bg-[#173f35] text-white">
        <div className="mx-auto flex min-h-20 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            href={`/${locale}`}
            className="rounded-lg text-sm font-bold text-white/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            ← {copy.backToMenu}
          </Link>
          <div className="flex items-center gap-3">
            <LanguageSelector
              locales={publishedLocales}
              currentLocale={locale}
              productId={detail.product.id}
              productLocales={productLocales}
              unavailableMessage={copy.productUnavailableInLanguage}
            />
            <div className="hidden text-right sm:block">
              <p className="font-display text-xl">{detail.restaurant.name}</p>
              <p className="mt-0.5 text-[10px] text-[#d7ae6a]">
                {detail.restaurant.slogan}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        <nav
          aria-label="Breadcrumb"
          className="mb-6 flex flex-wrap items-center gap-2 text-xs text-stone-500"
        >
          <Link
            href={`/${locale}`}
            className="rounded-sm hover:text-[#173f35] focus-visible:outline-2 focus-visible:outline-[#173f35]"
          >
            Carta
          </Link>
          <ChevronRight aria-hidden="true" className="size-3.5" />
          <Link
            href={`/${locale}#category-${detail.category.id}`}
            className="rounded-sm hover:text-[#173f35] focus-visible:outline-2 focus-visible:outline-[#173f35]"
          >
            {detail.category.name}
          </Link>
          <ChevronRight aria-hidden="true" className="size-3.5" />
          <span aria-current="page" className="font-semibold text-stone-700">
            {detail.product.name}
          </span>
        </nav>

        <article
          data-testid="product-detail"
          className="grid gap-7 lg:grid-cols-[minmax(0,1.05fr)_minmax(22rem,0.95fr)] lg:items-start"
        >
          {detail.displaySettings.showImages && detail.product.imageUrl ? (
            <ProductImageLightbox
              src={detail.product.imageUrl}
              alt={detail.product.imageAlt}
              enlargeLabel={copy.enlargeImage}
              closeLabel={copy.closeImage}
              isSoldOut={detail.product.isSoldOut}
            />
          ) : null}

          <div
            className={
              detail.displaySettings.showImages && detail.product.imageUrl
                ? ""
                : "lg:col-span-2 lg:max-w-3xl"
            }
          >
            <p className="text-[10px] font-extrabold tracking-[0.16em] text-[#a8392f] uppercase">
              {copy.category}: {detail.category.name}
            </p>
            <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
              <h1 className="font-display max-w-2xl text-4xl leading-none text-[#173f35] sm:text-5xl">
                {detail.product.name}
              </h1>
              {detail.product.isSoldOut ? (
                <span className="rounded-full bg-[#a8392f] px-4 py-2 text-xs font-extrabold text-white uppercase">
                  {copy.soldOut}
                </span>
              ) : null}
            </div>

            {detail.displaySettings.showDescriptions &&
            detail.product.description ? (
              <p className="mt-5 text-base leading-7 text-stone-600">
                {detail.product.description}
              </p>
            ) : null}

            {detail.displaySettings.showPrices ? (
              <div className="mt-6 flex flex-wrap gap-3">
                <div className="rounded-2xl bg-white px-5 py-4 ring-1 ring-stone-200">
                  <p className="text-[10px] font-bold text-stone-400 uppercase">
                    {copy.price}
                  </p>
                  <p className="mt-1 text-2xl font-extrabold text-[#173f35]">
                    {formatPrice(detail.product.fullPrice)}
                  </p>
                </div>
                {detail.displaySettings.showHalfPortions &&
                detail.product.halfPrice ? (
                  <div className="rounded-2xl bg-white px-5 py-4 ring-1 ring-stone-200">
                    <p className="text-[10px] font-bold text-stone-400 uppercase">
                      {copy.halfPortion}
                    </p>
                    <p className="mt-1 text-2xl font-extrabold text-[#a8392f]">
                      {formatPrice(detail.product.halfPrice)}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}

            {detail.displaySettings.showTags &&
            detail.product.tags.length > 0 ? (
              <section className="mt-6" aria-labelledby="product-tags-title">
                <h2
                  id="product-tags-title"
                  className="text-xs font-bold text-stone-500"
                >
                  {copy.tags}
                </h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  {detail.product.tags.map((tag) => (
                    <span
                      key={tag.label}
                      className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[#173f35] ring-1 ring-stone-200"
                    >
                      {tag.label}
                    </span>
                  ))}
                </div>
              </section>
            ) : null}

            {detail.displaySettings.showAllergens &&
            detail.product.allergens.length > 0 ? (
              <section
                className="mt-6"
                aria-labelledby="product-allergens-title"
              >
                <h2
                  id="product-allergens-title"
                  className="text-xs font-bold text-stone-500"
                >
                  {copy.allergens}
                </h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  {detail.product.allergens.map((allergen) => (
                    <span
                      key={allergen.label}
                      className="inline-flex min-h-9 items-center gap-2 rounded-full bg-white px-3 text-xs text-stone-600 ring-1 ring-stone-200"
                    >
                      <TaxonomyIcon
                        icon={allergen.icon}
                        label={allergen.label}
                      />
                      {allergen.label}
                    </span>
                  ))}
                </div>
              </section>
            ) : null}

            <div className="mt-7">
              <ShareProductButton
                title={detail.product.name}
                description={detail.product.description}
                shareLabel={copy.share}
                copiedLabel={copy.linkCopied}
                errorLabel={copy.copyError}
              />
            </div>

            <aside className="mt-7 rounded-2xl border border-stone-200 bg-white p-4">
              <p className="font-display text-xl text-[#173f35]">
                {detail.restaurant.name}
              </p>
              <div className="mt-3 space-y-2 text-xs text-stone-500">
                <p className="flex items-start gap-2">
                  <MapPin
                    aria-hidden="true"
                    className="mt-0.5 size-3.5 shrink-0 text-[#a8392f]"
                  />
                  {detail.restaurant.address}
                </p>
                <a
                  href={detail.restaurant.phoneHref}
                  className="inline-flex items-center gap-2 font-semibold text-[#173f35] focus-visible:outline-2 focus-visible:outline-[#173f35]"
                >
                  <Phone aria-hidden="true" className="size-3.5" />
                  {detail.restaurant.phoneDisplay}
                </a>
              </div>
            </aside>
          </div>
        </article>

        {detail.relatedProducts.length > 0 ? (
          <section
            data-testid="related-products"
            aria-labelledby="related-products-title"
            className="mt-12 border-t border-stone-200 pt-8"
          >
            <h2
              id="related-products-title"
              className="font-display text-3xl text-[#173f35]"
            >
              {copy.relatedProducts}
            </h2>
            <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {detail.relatedProducts.map((relatedProduct) => (
                <ProductCard
                  key={relatedProduct.id}
                  product={relatedProduct}
                  settings={detail.displaySettings}
                  href={getPublicProductPath(
                    locale,
                    relatedProduct.id,
                    relatedProduct.name,
                  )}
                  viewProductLabel={copy.viewProduct}
                />
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
