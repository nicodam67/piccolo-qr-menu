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
      className="hide-scrollbar flex gap-2 overflow-x-auto px-4 py-3 sm:px-6"
    >
      {categories.map((category) => {
        const isActive = activeCategory === category.id;

        return (
          <button
            type="button"
            key={category.id}
            onClick={() => onSelect(category.id)}
            aria-current={isActive ? "true" : undefined}
            className={`min-h-11 shrink-0 rounded-full px-5 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173f35] ${
              isActive
                ? "bg-[#173f35] text-white shadow-md"
                : "border border-stone-200 bg-white text-stone-600 hover:border-[#173f35]/30"
            }`}
          >
            {category.name}
          </button>
        );
      })}
    </nav>
  );
}
