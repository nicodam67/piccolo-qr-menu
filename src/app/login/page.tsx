import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getAdminDashboardSummary } from "@/features/admin/repository";
import { LoginForm } from "@/features/auth/components/login-form";
import { getAdminSession } from "@/features/auth/server-session";

export const metadata: Metadata = {
  title: "Iniciar sesión · Piccolo QR Menu",
  description: "Acceso al panel de administración de Piccolo QR Menu.",
};

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams: Promise<{ next?: string | string[] }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await getAdminSession();

  if (session) {
    redirect("/admin");
  }

  const [{ next }, restaurant] = await Promise.all([
    searchParams,
    getAdminDashboardSummary(),
  ]);
  const nextPath = typeof next === "string" ? next : "/admin";

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#f6f1e8] px-4 py-10">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-64 bg-[#173f35]"
      />
      <div
        aria-hidden="true"
        className="absolute top-16 left-1/2 size-72 -translate-x-1/2 rounded-full bg-[#d7ae6a]/10 blur-3xl"
      />

      <section className="relative w-full max-w-md overflow-hidden rounded-[1.75rem] border border-white/80 bg-[#fffdfa] shadow-[0_28px_80px_-35px_rgba(23,63,53,0.55)]">
        <div className="bg-[#173f35] px-6 pt-8 pb-7 text-center text-white">
          <span className="font-display mx-auto grid size-14 place-items-center rounded-full border border-white/25 bg-[#7d2f27] text-2xl shadow-lg">
            P
          </span>
          <p className="font-display mt-4 text-2xl">Piccolo</p>
          <p className="mt-1 text-[10px] font-bold tracking-[0.16em] text-[#d7ae6a] uppercase">
            {restaurant.restaurantName}
          </p>
        </div>

        <div className="px-6 py-7 sm:px-8">
          <p className="text-[10px] font-extrabold tracking-[0.18em] text-[#a8392f] uppercase">
            Administración
          </p>
          <h1 className="font-display mt-1 text-3xl text-[#173f35]">
            Bienvenido de nuevo
          </h1>
          <p className="mt-2 text-sm leading-6 text-stone-500">
            Inicia sesión para acceder al panel del restaurante.
          </p>

          <LoginForm nextPath={nextPath} />
        </div>
      </section>
    </main>
  );
}
