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
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-5xl justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:justify-end sm:px-6">
      <a
        href={phoneHref}
        className="pointer-events-auto flex min-h-14 w-full items-center justify-center gap-3 rounded-full border border-white/15 bg-[#a8392f] px-6 font-extrabold text-white shadow-[0_14px_35px_-10px_rgba(71,22,18,0.65)] transition-transform hover:bg-[#922f27] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a8392f] active:scale-[0.98] sm:w-auto"
        aria-label={`Llamar al teléfono de demostración ${phoneDisplay}`}
      >
        <Phone aria-hidden="true" className="size-5" />
        <span>Llamar · teléfono demo</span>
      </a>
    </div>
  );
}
