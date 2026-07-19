import { Languages } from "lucide-react";

export function LanguageSelector() {
  return (
    <label className="flex min-h-10 items-center gap-1.5 rounded-full border border-white/20 bg-black/25 px-3 text-xs font-bold text-white backdrop-blur-md">
      <Languages aria-hidden="true" className="size-3.5" />
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
