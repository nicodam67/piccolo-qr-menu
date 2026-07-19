import { Search, X } from "lucide-react";

type MenuSearchProps = {
  value: string;
  onChange: (value: string) => void;
};

export function MenuSearch({ value, onChange }: MenuSearchProps) {
  return (
    <div className="relative">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-stone-400"
      />
      <label htmlFor="menu-search" className="sr-only">
        Buscar en la carta de demostración
      </label>
      <input
        id="menu-search"
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Buscar un plato…"
        autoComplete="off"
        className="min-h-14 w-full rounded-2xl border border-stone-200 bg-white pr-12 pl-12 text-base text-stone-800 shadow-sm outline-none placeholder:text-stone-400 focus:border-[#245849] focus:ring-4 focus:ring-[#245849]/10"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Limpiar búsqueda"
          className="absolute top-1/2 right-2 grid size-10 -translate-y-1/2 place-items-center rounded-full text-stone-500 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-[#173f35]"
        >
          <X aria-hidden="true" className="size-5" />
        </button>
      ) : null}
    </div>
  );
}
