import { brandColors } from "@/lib/design-tokens";

type SymbolMarkProps = {
  size?: number;
  className?: string;
  /** "brand" = purple badge (default), "mono" = single ink color, "white" = for dark backgrounds */
  variant?: "brand" | "mono" | "white";
};

/**
 * Servino symbol: a geometric "S" connecting two nodes inside a rounded
 * home-shaped container — the S represents Servino, the two dots represent
 * the homeowner and the professional it connects.
 */
export function SymbolMark({ size = 40, className, variant = "brand" }: SymbolMarkProps) {
  const badgeFill = variant === "brand" ? brandColors.purple : variant === "white" ? "transparent" : "transparent";
  const strokeColor = variant === "white" ? "#FFFFFF" : variant === "mono" ? brandColors.ink : "#FFFFFF";
  const nodeStart = variant === "brand" ? brandColors.coral : strokeColor;
  const nodeEnd = variant === "brand" ? brandColors.teal : strokeColor;
  const badgeStroke = variant === "brand" ? "none" : strokeColor;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      className={className}
      role="img"
      aria-label="Servino"
    >
      <rect
        x="4"
        y="4"
        width="92"
        height="92"
        rx="24"
        fill={badgeFill}
        stroke={badgeStroke}
        strokeWidth={variant === "brand" ? 0 : 3}
      />
      <path
        d="M69 28 A16 16 0 1 0 40 41 A16 16 0 1 1 60 59 A16 16 0 1 0 31 72"
        stroke={strokeColor}
        strokeWidth="10"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="69" cy="28" r="7" fill={nodeStart} />
      <circle cx="31" cy="72" r="7" fill={nodeEnd} />
    </svg>
  );
}

type WordmarkProps = {
  className?: string;
  variant?: "ink" | "white";
};

export function Wordmark({ className, variant = "ink" }: WordmarkProps) {
  return (
    <span
      className={`font-semibold tracking-tight ${variant === "white" ? "text-white" : "text-ink"} ${className ?? ""}`}
    >
      Servino
    </span>
  );
}

type LogoProps = {
  className?: string;
  symbolSize?: number;
  variant?: "brand" | "mono" | "white";
  wordmarkTextClassName?: string;
};

export function Logo({ className, symbolSize = 32, variant = "brand", wordmarkTextClassName = "text-xl" }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <SymbolMark size={symbolSize} variant={variant} />
      <Wordmark variant={variant === "white" ? "white" : "ink"} className={wordmarkTextClassName} />
    </span>
  );
}
