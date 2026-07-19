export default function MenuLoading() {
  return (
    <main className="min-h-screen bg-stone-50" aria-busy="true">
      <div className="h-[26rem] animate-pulse bg-stone-300" />
      <div className="relative mx-auto -mt-20 max-w-5xl px-4">
        <div className="h-64 animate-pulse rounded-[2rem] bg-white shadow-sm" />
        <div className="mt-8 h-14 animate-pulse rounded-full bg-stone-200" />
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <div className="h-[30rem] animate-pulse rounded-[1.75rem] bg-white" />
          <div className="h-[30rem] animate-pulse rounded-[1.75rem] bg-white" />
        </div>
      </div>
      <span className="sr-only">Cargando carta de demostración…</span>
    </main>
  );
}
