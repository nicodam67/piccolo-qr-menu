import { Phone } from "lucide-react";

type FloatingCallButtonProps = {
  phoneDisplay: string;
  phoneHref: string;
};

export function FloatingCallButton({
  phoneDisplay,
  phoneHref,
}: FloatingCallButtonProps) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-5xl justify-end px-3 pb-[max(0.65rem,env(safe-area-inset-bottom))] sm:px-6">
      <a
        href={phoneHref}
        className="pointer-events-auto flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/20 bg-[#7d2f27] px-5 text-sm font-bold text-white shadow-[0_10px_28px_-10px_rgba(71,22,18,0.65)] transition-transform hover:bg-[#922f27] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a8392f] active:scale-[0.98]"
        aria-label={`Llamar al teléfono de demostración ${phoneDisplay}`}
      >
        <Phone aria-hidden="true" className="size-4" />
        <span>Llamar · demo</span>
      </a>
    </div>
  );
}
