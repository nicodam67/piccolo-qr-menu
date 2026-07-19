"use client";

export default function MenuError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f3eb] px-6 text-center">
      <div className="max-w-sm">
        <p className="font-serif text-5xl text-[#a8392f]">Oh!</p>
        <h1 className="mt-4 text-2xl font-semibold text-[#173f35]">
          No hemos podido mostrar la carta
        </h1>
        <p className="mt-3 text-sm leading-6 text-stone-600">
          Este prototipo ha encontrado un error inesperado. Puedes intentarlo de
          nuevo.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 min-h-12 rounded-full bg-[#173f35] px-6 font-semibold text-white"
        >
          Reintentar
        </button>
      </div>
    </main>
  );
}
