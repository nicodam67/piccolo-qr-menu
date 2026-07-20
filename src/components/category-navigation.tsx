"use client";

import { useEffect, useRef } from "react";

import type { DemoCategory } from "@/features/public-menu/types";

type CategoryNavigationProps = {
  categories: DemoCategory[];
  productCounts: Record<string, number>;
  activeCategory: string;
  onSelect: (categoryId: string) => void;
  ariaLabel: string;
};

export function CategoryNavigation({
  categories,
  productCounts,
  activeCategory,
  onSelect,
  ariaLabel,
}: CategoryNavigationProps) {
  const buttonRefs = useRef(new Map<string, HTMLButtonElement>());

  useEffect(() => {
    buttonRefs.current.get(activeCategory)?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [activeCategory]);

  return (
    <nav
      aria-label={ariaLabel}
      className="hide-scrollbar flex gap-6 overflow-x-auto px-4 sm:px-6"
    >
      {categories.map((category) => {
        const isActive = activeCategory === category.id;

        return (
          <button
            type="button"
            key={category.id}
            ref={(element) => {
              if (element) {
                buttonRefs.current.set(category.id, element);
              } else {
                buttonRefs.current.delete(category.id);
              }
            }}
            onClick={() => onSelect(category.id)}
            aria-current={isActive ? "page" : undefined}
            className={`relative min-h-11 shrink-0 border-b-2 px-0.5 pt-0.5 text-xs font-extrabold tracking-[0.08em] uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173f35] ${
              isActive
                ? "border-[#a8392f] text-[#173f35]"
                : "border-transparent text-stone-500 hover:text-[#173f35]"
            }`}
          >
            {category.name} · {productCounts[category.id] ?? 0}
          </button>
        );
      })}
    </nav>
  );
}
