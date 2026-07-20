"use client";

import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { CategoryNavigation } from "@/components/category-navigation";
import { FloatingCallButton } from "@/components/floating-call-button";
import { MenuHeader } from "@/components/menu-header";
import { MenuSearch } from "@/components/menu-search";
import { ProductCard } from "@/components/product-card";

import type { DemoMenu, OpeningStatus } from "./types";
import type { PublishedLocale } from "@/features/locales/repository";
import { getPublicMenuCopy } from "./copy";
import { getPublicProductPath } from "./product-url";
import { filterProducts, getOpeningStatus } from "./utils";

const POSITION_MAX_AGE_MS = 30 * 60 * 1_000;

type StoredMenuPosition = {
  scrollY: number;
  categoryId: string;
  savedAt: number;
};

type PublicMenuPageProps = {
  menu: DemoMenu;
  initialOpeningStatus: OpeningStatus;
  publishedLocales: PublishedLocale[];
};

export function PublicMenuPage({
  menu,
  initialOpeningStatus,
  publishedLocales,
}: PublicMenuPageProps) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [activeCategory, setActiveCategory] = useState(
    menu.categories[0]?.id ?? "",
  );
  const [openingStatus, setOpeningStatus] = useState(initialOpeningStatus);
  const activeCategoryRef = useRef(activeCategory);
  const queryRef = useRef(query);
  const visibleCategoriesRef = useRef(menu.categories);
  const positionStorageKey = `piccolo-menu-position:${menu.locale}`;
  const copy = getPublicMenuCopy(menu.locale);

  const filteredProducts = useMemo(
    () => filterProducts(menu.products, deferredQuery),
    [menu.products, deferredQuery],
  );

  const visibleCategories = useMemo(
    () =>
      menu.categories.filter((category) =>
        filteredProducts.some(
          (product) => product.categoryId === category.id,
        ),
      ),
    [filteredProducts, menu.categories],
  );
  const productCounts = useMemo(
    () => {
      const counts: Record<string, number> = Object.fromEntries(
        visibleCategories.map((category) => [category.id, 0]),
      );

      for (const product of filteredProducts) {
        if (product.categoryId in counts) {
          counts[product.categoryId] += 1;
        }
      }

      return counts;
    },
    [filteredProducts, visibleCategories],
  );

  const visibleActiveCategory = visibleCategories.some(
    (category) => category.id === activeCategory,
  )
    ? activeCategory
    : (visibleCategories[0]?.id ?? "");

  useEffect(() => {
    activeCategoryRef.current = visibleActiveCategory;
    queryRef.current = query;
    visibleCategoriesRef.current = visibleCategories;
  }, [query, visibleActiveCategory, visibleCategories]);

  useEffect(() => {
    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";

    return () => {
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, []);

  useEffect(() => {
    const refreshStatus = () => {
      setOpeningStatus(
        getOpeningStatus(new Date(), menu.openingHours, menu.timeZone),
      );
    };

    const intervalId = window.setInterval(refreshStatus, 60_000);
    return () => window.clearInterval(intervalId);
  }, [menu.openingHours, menu.timeZone]);

  useEffect(() => {
    const navigationEntry = performance.getEntriesByType(
      "navigation",
    )[0] as PerformanceNavigationTiming | undefined;

    if (navigationEntry?.type === "reload") {
      sessionStorage.removeItem(positionStorageKey);
      return;
    }

    if (window.location.hash.startsWith("#category-")) {
      const categoryId = decodeURIComponent(
        window.location.hash.replace("#category-", ""),
      );

      if (menu.categories.some((category) => category.id === categoryId)) {
        const hashFrame = window.requestAnimationFrame(() => {
          activeCategoryRef.current = categoryId;
          setActiveCategory(categoryId);
        });
        return () => window.cancelAnimationFrame(hashFrame);
      }

      return;
    }

    const storedValue = sessionStorage.getItem(positionStorageKey);

    if (!storedValue) {
      return;
    }

    let storedPosition: StoredMenuPosition;

    try {
      storedPosition = JSON.parse(storedValue) as StoredMenuPosition;
    } catch {
      sessionStorage.removeItem(positionStorageKey);
      return;
    }

    if (
      !Number.isFinite(storedPosition.scrollY) ||
      Date.now() - storedPosition.savedAt > POSITION_MAX_AGE_MS ||
      !menu.categories.some(
        (category) => category.id === storedPosition.categoryId,
      )
    ) {
      sessionStorage.removeItem(positionStorageKey);
      return;
    }

    let scrollFrame = 0;
    const stateFrame = window.requestAnimationFrame(() => {
      setActiveCategory(storedPosition.categoryId);
      scrollFrame = window.requestAnimationFrame(() => {
        window.scrollTo({ top: storedPosition.scrollY, behavior: "auto" });
      });
    });

    return () => {
      window.cancelAnimationFrame(stateFrame);
      window.cancelAnimationFrame(scrollFrame);
    };
  }, [menu.categories, positionStorageKey]);

  useEffect(() => {
    let animationFrame = 0;

    const savePosition = () => {
      animationFrame = 0;

      if (queryRef.current.trim()) {
        return;
      }

      if (
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 2
      ) {
        const lastCategory = visibleCategoriesRef.current.at(-1);

        if (
          lastCategory &&
          activeCategoryRef.current !== lastCategory.id
        ) {
          activeCategoryRef.current = lastCategory.id;
          setActiveCategory(lastCategory.id);
        }
      }

      const position: StoredMenuPosition = {
        scrollY: window.scrollY,
        categoryId: activeCategoryRef.current,
        savedAt: Date.now(),
      };
      sessionStorage.setItem(positionStorageKey, JSON.stringify(position));
    };

    const scheduleSave = () => {
      if (!animationFrame) {
        animationFrame = window.requestAnimationFrame(savePosition);
      }
    };

    window.addEventListener("scroll", scheduleSave, { passive: true });
    window.addEventListener("pagehide", savePosition);

    return () => {
      window.removeEventListener("scroll", scheduleSave);
      window.removeEventListener("pagehide", savePosition);
      window.cancelAnimationFrame(animationFrame);
    };
  }, [positionStorageKey]);

  useEffect(() => {
    if (visibleCategories.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const isAtDocumentEnd =
          window.innerHeight + window.scrollY >=
          document.documentElement.scrollHeight - 2;
        const visibleEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (left, right) =>
              Math.abs(left.boundingClientRect.top - 88) -
              Math.abs(right.boundingClientRect.top - 88),
          )[0];
        const categoryId = isAtDocumentEnd
          ? visibleCategories.at(-1)?.id
          : visibleEntry?.target.getAttribute("data-category");

        if (categoryId && categoryId !== activeCategoryRef.current) {
          activeCategoryRef.current = categoryId;
          setActiveCategory(categoryId);
        }
      },
      {
        rootMargin: "-80px 0px -60% 0px",
        threshold: [0, 0.1, 0.25, 0.5],
      },
    );

    visibleCategories.forEach((category) => {
      const section = document.getElementById(`category-${category.id}`);
      if (section) {
        observer.observe(section);
      }
    });

    return () => observer.disconnect();
  }, [visibleCategories]);

  const handleCategorySelect = (categoryId: string) => {
    activeCategoryRef.current = categoryId;
    setActiveCategory(categoryId);
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}#category-${categoryId}`,
    );
    document
      .getElementById(`category-${categoryId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleSearchChange = (value: string) => {
    setQuery(value);

    if (value && window.location.hash) {
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}`,
      );
    }
  };

  return (
    <>
      <a
        href="#menu-content"
        className="fixed top-2 left-2 z-[60] -translate-y-20 rounded-full bg-white px-4 py-3 font-bold text-[#173f35] shadow-lg transition-transform focus:translate-y-0"
      >
        Saltar a la carta
      </a>

      <main className="min-h-screen pb-20">
        <MenuHeader
          menu={menu}
          openingStatus={openingStatus}
          publishedLocales={publishedLocales}
        />

        <section
          id="menu-content"
          aria-labelledby="menu-title"
          className="mx-auto max-w-5xl"
        >
          <div className="px-4 py-4 sm:px-6">
            <div className="flex items-end justify-between gap-5">
              <div>
                <h2
                  id="menu-title"
                  className="font-display text-2xl text-[#173f35]"
                >
                  Carta de demostración
                </h2>
                <p className="mt-0.5 max-w-xl text-[10px] leading-4 text-stone-500">
                  Contenido provisional, no oficial
                </p>
              </div>
              <span className="text-[10px] font-semibold text-stone-400">
                {filteredProducts.length} platos demo
              </span>
            </div>

            <div className="mt-3">
              <MenuSearch
                value={query}
                onChange={handleSearchChange}
                placeholder={copy.searchPlaceholder}
                label={copy.searchLabel}
                clearLabel={copy.clearSearch}
              />
            </div>
          </div>

          {visibleCategories.length > 0 ? (
            <div className="sticky top-0 z-40 border-y border-stone-200 bg-[#fffdfa]/95 backdrop-blur-lg">
              <CategoryNavigation
                categories={visibleCategories}
                productCounts={productCounts}
                activeCategory={visibleActiveCategory}
                onSelect={handleCategorySelect}
                ariaLabel={copy.categoriesLabel}
              />
            </div>
          ) : null}

          <div
            className="px-4 pt-3 sm:px-6"
            aria-live="polite"
            aria-atomic="true"
          >
            {query ? (
              <p className="text-xs text-stone-500">
                {filteredProducts.length === 1
                  ? `1 ${copy.result}`
                  : `${filteredProducts.length} ${copy.results}`}
              </p>
            ) : null}
          </div>

          {visibleCategories.length > 0 ? (
            <div
              id="menu-product-sections"
              className="space-y-10 px-4 pt-6 sm:px-6"
            >
              {visibleCategories.map((category) => {
                const categoryProducts = filteredProducts.filter(
                  (product) => product.categoryId === category.id,
                );

                return (
                  <section
                    id={`category-${category.id}`}
                    key={category.id}
                    data-category={category.id}
                    className="scroll-mt-16"
                    aria-labelledby={`category-title-${category.id}`}
                  >
                    <div className="mb-4 flex items-end gap-3 border-b border-stone-200 pb-2.5">
                      <h2
                        id={`category-title-${category.id}`}
                        className="font-display text-2xl text-[#a8392f]"
                      >
                        {category.name}
                        <span className="ml-2 align-middle text-sm text-stone-400">
                          · {productCounts[category.id] ?? 0}
                        </span>
                      </h2>
                      <p className="pb-0.5 text-[9px] font-bold tracking-[0.1em] text-stone-400 uppercase">
                        {category.eyebrow}
                      </p>
                    </div>

                    <div
                      className={
                        menu.displaySettings.layout === "cards"
                          ? "grid gap-7 sm:grid-cols-2 lg:grid-cols-3"
                          : "space-y-5"
                      }
                    >
                      {categoryProducts.map((product) => (
                        <ProductCard
                          key={product.id}
                          product={product}
                          settings={menu.displaySettings}
                          href={getPublicProductPath(
                            menu.locale,
                            product.id,
                            product.name,
                          )}
                          viewProductLabel={copy.viewProduct}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          ) : (
            <div
              id="menu-product-sections"
              className="mx-4 mt-6 border-y border-stone-200 px-6 py-10 text-center sm:mx-6"
            >
              <p className="font-display text-2xl text-[#173f35]">
                {copy.noResultsTitle}
              </p>
              <p className="mt-2 text-sm text-stone-500">
                {copy.noResultsHint}
              </p>
              <button
                type="button"
                onClick={() => handleSearchChange("")}
                aria-label={copy.clearSearch}
                className="mt-5 min-h-11 rounded-full bg-[#173f35] px-5 text-sm font-bold text-white"
              >
                {copy.clearSearch}
              </button>
            </div>
          )}
        </section>

        <footer className="mx-auto mt-10 max-w-5xl border-t border-stone-200 px-4 pt-6 text-center text-[10px] leading-4 text-stone-500 sm:px-6">
          <p className="font-bold text-stone-700">Entrega 1 · Prototipo visual</p>
          <p className="mt-1">
            Ningún dato de esta carta, salvo el nombre y el eslogan indicados,
            está confirmado como oficial.
          </p>
        </footer>
      </main>

      <FloatingCallButton
        phoneDisplay={menu.restaurant.phoneDisplay}
        phoneHref={menu.restaurant.phoneHref}
      />
    </>
  );
}
