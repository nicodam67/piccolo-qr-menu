"use client";

import { useEffect, useMemo, useState } from "react";

import { CategoryNavigation } from "@/components/category-navigation";
import { FloatingCallButton } from "@/components/floating-call-button";
import { MenuHeader } from "@/components/menu-header";
import { MenuSearch } from "@/components/menu-search";
import { ProductCard } from "@/components/product-card";

import type { DemoMenu, OpeningStatus } from "./types";
import { filterProducts, getOpeningStatus } from "./utils";

type PublicMenuPageProps = {
  menu: DemoMenu;
  initialOpeningStatus: OpeningStatus;
};

export function PublicMenuPage({
  menu,
  initialOpeningStatus,
}: PublicMenuPageProps) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState(
    menu.categories[0]?.id ?? "",
  );
  const [openingStatus, setOpeningStatus] = useState(initialOpeningStatus);

  const filteredProducts = useMemo(
    () => filterProducts(menu.products, query),
    [menu.products, query],
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

  const visibleActiveCategory = visibleCategories.some(
    (category) => category.id === activeCategory,
  )
    ? activeCategory
    : (visibleCategories[0]?.id ?? "");

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
    if (visibleCategories.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries.find((entry) => entry.isIntersecting);
        const categoryId = visibleEntry?.target.getAttribute("data-category");

        if (categoryId) {
          setActiveCategory(categoryId);
        }
      },
      { rootMargin: "-25% 0px -65% 0px", threshold: 0 },
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
    setActiveCategory(categoryId);
    document
      .getElementById(`category-${categoryId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <a
        href="#menu-content"
        className="fixed top-2 left-2 z-[60] -translate-y-20 rounded-full bg-white px-4 py-3 font-bold text-[#173f35] shadow-lg transition-transform focus:translate-y-0"
      >
        Saltar a la carta
      </a>

      <main className="min-h-screen pb-28">
        <MenuHeader menu={menu} openingStatus={openingStatus} />

        <section
          id="menu-content"
          aria-labelledby="menu-title"
          className="mx-auto max-w-5xl pt-10"
        >
          <div className="px-4 sm:px-6">
            <p className="text-xs font-extrabold tracking-[0.18em] text-[#a8392f] uppercase">
              Prototipo visual
            </p>
            <div className="mt-2 flex items-end justify-between gap-5">
              <div>
                <h2
                  id="menu-title"
                  className="font-display text-4xl text-[#173f35] sm:text-5xl"
                >
                  Carta de demostración
                </h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-stone-600">
                  Todos los platos, precios, alérgenos e imágenes de esta vista
                  son datos provisionales y no representan la carta oficial.
                </p>
              </div>
              <span className="hidden text-sm font-semibold text-stone-400 sm:block">
                {filteredProducts.length} resultados
              </span>
            </div>

            <div className="mt-6">
              <MenuSearch value={query} onChange={setQuery} />
            </div>
          </div>

          {visibleCategories.length > 0 ? (
            <div className="sticky top-0 z-40 mt-5 border-y border-stone-200/80 bg-[#f7f3eb]/95 shadow-[0_8px_24px_-24px_rgba(23,63,53,0.7)] backdrop-blur-lg">
              <CategoryNavigation
                categories={visibleCategories}
                activeCategory={visibleActiveCategory}
                onSelect={handleCategorySelect}
              />
            </div>
          ) : null}

          <div
            className="px-4 pt-4 sm:px-6"
            aria-live="polite"
            aria-atomic="true"
          >
            {query ? (
              <p className="text-sm text-stone-500">
                {filteredProducts.length === 1
                  ? "1 resultado de demostración"
                  : `${filteredProducts.length} resultados de demostración`}
              </p>
            ) : null}
          </div>

          {visibleCategories.length > 0 ? (
            <div className="space-y-14 px-4 pt-8 sm:px-6">
              {visibleCategories.map((category) => {
                const categoryProducts = filteredProducts.filter(
                  (product) => product.categoryId === category.id,
                );

                return (
                  <section
                    id={`category-${category.id}`}
                    key={category.id}
                    data-category={category.id}
                    className="scroll-mt-28"
                    aria-labelledby={`category-title-${category.id}`}
                  >
                    <div className="mb-5">
                      <p className="text-[11px] font-bold tracking-[0.16em] text-[#a8392f] uppercase">
                        {category.eyebrow}
                      </p>
                      <h2
                        id={`category-title-${category.id}`}
                        className="font-display mt-1 text-3xl text-[#173f35]"
                      >
                        {category.name}
                      </h2>
                    </div>

                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                      {categoryProducts.map((product) => (
                        <ProductCard key={product.id} product={product} />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          ) : (
            <div className="mx-4 mt-8 rounded-[1.75rem] border border-dashed border-stone-300 bg-white px-6 py-12 text-center sm:mx-6">
              <p className="font-display text-2xl text-[#173f35]">
                No encontramos ese plato
              </p>
              <p className="mt-2 text-sm text-stone-500">
                Prueba con otro nombre, etiqueta o alérgeno.
              </p>
              <button
                type="button"
                onClick={() => setQuery("")}
                className="mt-5 min-h-11 rounded-full bg-[#173f35] px-5 text-sm font-bold text-white"
              >
                Limpiar búsqueda
              </button>
            </div>
          )}
        </section>

        <footer className="mx-auto mt-16 max-w-5xl border-t border-stone-200 px-4 pt-8 text-center text-xs leading-5 text-stone-500 sm:px-6">
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
