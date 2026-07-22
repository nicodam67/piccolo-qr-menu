import { Search, X } from "lucide-react";

type MenuSearchProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  clearLabel: string;
};

export function MenuSearch({
  value,
  onChange,
  placeholder,
  label,
  clearLabel,
}: MenuSearchProps) {
  return (
    <div className="relative">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-stone-400"
      />
      <label htmlFor="menu-search" className="sr-only">
        {label}
      </label>
      <input
        id="menu-search"
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        aria-controls="menu-product-sections"
        className="min-h-11 w-full rounded-xl border border-stone-200 bg-white pr-11 pl-10 text-sm text-stone-800 outline-none placeholder:text-stone-400 focus:border-[#245849] focus:ring-3 focus:ring-[#245849]/10"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={clearLabel}
          className="absolute top-1/2 right-1.5 grid size-9 -translate-y-1/2 place-items-center rounded-full text-stone-500 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-[#173f35]"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      ) : null}
    </div>
  );
}
