import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";

import { isSupportedLocale } from "@/config/locales";
import { isLocalePublished } from "@/features/locales/repository";
import { getReservationCopy } from "@/features/reservations/copy";
import { ReservationForm } from "@/features/reservations/components/reservation-form";
import { getReservationPublicData } from "@/features/reservations/repository";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const copy = getReservationCopy(locale);
  return {
    title: `${copy.title} · Piccolo`,
    description: copy.intro,
    robots: { index: false, follow: false },
  };
}

export default async function PublicReservationsPage({ params }: Props) {
  const { locale } = await params;
  if (!isSupportedLocale(locale) || !(await isLocalePublished(locale))) {
    notFound();
  }
  const data = await getReservationPublicData(locale);
  if (!data) notFound();
  const copy = getReservationCopy(locale);

  return (
    <main className="min-h-screen bg-[#f7f3eb] px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-2xl">
        <Link
          href={`/${locale}`}
          className="mb-5 inline-flex min-h-11 items-center rounded-full border border-stone-300 bg-white px-4 text-sm font-bold text-[#173f35]"
        >
          ← {copy.backToMenu}
        </Link>
        <ReservationForm
          locale={locale}
          restaurantName={data.restaurantName}
          restaurantPhone={data.restaurantPhone}
          settings={data.settings}
          isReady={data.isReady}
          onlinePaymentsEnabled={data.onlinePaymentsEnabled}
          minDate={data.range.minDate}
          maxDate={data.range.maxDate}
        />
      </div>
    </main>
  );
}
