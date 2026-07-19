import { Languages } from "lucide-react";

export function LanguageSelector() {
  return (
    <label className="flex min-h-11 items-center gap-2 rounded-full border border-white/25 bg-black/20 px-3 text-sm font-bold text-white shadow-sm backdrop-blur-md">
      <Languages aria-hidden="true" className="size-4" />
      <span className="sr-only">Seleccionar idioma</span>
      <select
        aria-label="Idioma"
        defaultValue="es"
        className="cursor-pointer appearance-none bg-transparent pr-1 outline-none"
      >
        <option value="es" className="text-stone-900">
          ES
        </option>
      </select>
    </label>
  );
}
