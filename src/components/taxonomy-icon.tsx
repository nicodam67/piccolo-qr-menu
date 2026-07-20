import { ShieldAlert } from "lucide-react";

const iconCharacters: Record<string, string> = {
  wheat: "🌾",
  gluten: "🌾",
  egg: "🥚",
  milk: "🥛",
  fish: "🐟",
  crustaceans: "🦞",
  molluscs: "🦑",
  peanut: "🥜",
  nuts: "🌰",
  soy: "🫘",
  celery: "🥬",
  mustard: "🌿",
  sesame: "🌱",
  sulfites: "🍷",
  lupin: "🌻",
};

type TaxonomyIconProps = {
  icon: string;
  label: string;
  className?: string;
};

export function TaxonomyIcon({
  icon,
  label,
  className = "",
}: TaxonomyIconProps) {
  const character = iconCharacters[icon.toLowerCase()];

  if (character) {
    return (
      <span
        role="img"
        aria-label={label}
        className={`inline-grid place-items-center ${className}`}
      >
        {character}
      </span>
    );
  }

  return (
    <ShieldAlert
      role="img"
      aria-label={label}
      className={className}
    />
  );
}
