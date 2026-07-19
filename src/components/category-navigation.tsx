import type { DemoCategory } from "@/features/public-menu/types";

type CategoryNavigationProps = {
  categories: DemoCategory[];
  activeCategory: string;
  onSelect: (categoryId: string) => void;
};

export function CategoryNavigation({
  categories,
  activeCategory,
  onSelect,
}: CategoryNavigationProps) {
  return (
    <nav
      aria-label="Categorías de la carta"
      className="hide-scrollbar flex gap-6 overflow-x-auto px-4 sm:px-6"
    >
      {categories.map((category) => {
        const isActive = activeCategory === category.id;

        return (
          <button
            type="button"
            key={category.id}
            onClick={() => onSelect(category.id)}
            aria-current={isActive ? "true" : undefined}
            className={`relative min-h-11 shrink-0 border-b-2 px-0.5 pt-0.5 text-xs font-extrabold tracking-[0.08em] uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173f35] ${
              isActive
                ? "border-[#a8392f] text-[#173f35]"
                : "border-transparent text-stone-500 hover:text-[#173f35]"
            }`}
          >
            {category.name}
          </button>
        );
      })}
    </nav>
  );
}
