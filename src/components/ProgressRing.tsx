/**
 * A ring that fills as a share of something is done. Honest progress: it
 * is drawn from the checks and the parts that exist, never from a score
 * anybody could game, and it carries no number of its own beside it
 * (research/WIZARD_UX.md).
 */
export function ProgressRing({
  value,
  size = 20,
  label,
  className = "",
}: {
  /** 0 to 1. */
  value: number;
  size?: number;
  label?: string;
  className?: string;
}) {
  const stroke = 2.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={`shrink-0 -rotate-90 ${className}`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {/* Drawn in the colour of whatever it sits in, so it reads on a dark
          badge and a light one alike. */}
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-current opacity-25" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - v)}
        className="stroke-current transition-[stroke-dashoffset] duration-500 ease-out motion-reduce:transition-none"
      />
    </svg>
  );
}
