"use client";

import { useActionState } from "react";
import { LoaderCircle, LockKeyhole, Mail } from "lucide-react";

import {
  initialLoginState,
  loginAction,
} from "@/features/auth/actions";

type LoginFormProps = {
  nextPath: string;
};

export function LoginForm({ nextPath }: LoginFormProps) {
  const [state, formAction, isPending] = useActionState(
    loginAction,
    initialLoginState,
  );

  return (
    <form action={formAction} className="mt-8 space-y-5">
      <input type="hidden" name="next" value={nextPath} />

      <div>
        <label
          htmlFor="email"
          className="text-xs font-bold tracking-wide text-stone-700"
        >
          Email
        </label>
        <div className="relative mt-2">
          <Mail
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-stone-400"
          />
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            maxLength={320}
            disabled={isPending}
            className="min-h-12 w-full rounded-xl border border-stone-200 bg-white pr-4 pl-11 text-sm text-stone-900 outline-none transition focus:border-[#245849] focus:ring-3 focus:ring-[#245849]/10 disabled:opacity-60"
            placeholder="admin@piccolo.es"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="password"
          className="text-xs font-bold tracking-wide text-stone-700"
        >
          Contraseña
        </label>
        <div className="relative mt-2">
          <LockKeyhole
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-stone-400"
          />
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            maxLength={1_024}
            disabled={isPending}
            className="min-h-12 w-full rounded-xl border border-stone-200 bg-white pr-4 pl-11 text-sm text-stone-900 outline-none transition focus:border-[#245849] focus:ring-3 focus:ring-[#245849]/10 disabled:opacity-60"
            placeholder="Tu contraseña"
          />
        </div>
      </div>

      <div aria-live="polite" className="min-h-5">
        {state.error ? (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700"
          >
            {state.error}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#173f35] px-5 text-sm font-extrabold text-white transition hover:bg-[#245849] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173f35] disabled:cursor-wait disabled:opacity-70"
      >
        {isPending ? (
          <LoaderCircle
            aria-hidden="true"
            className="size-4 animate-spin"
          />
        ) : null}
        {isPending ? "Comprobando…" : "Iniciar sesión"}
      </button>
    </form>
  );
}
