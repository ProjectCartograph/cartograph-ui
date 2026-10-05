import type { LucideIcon } from "lucide-react";

/** One answer to a question asked by picking: an icon, a title and a line
 * saying what it means, picked by a click, as a radio. */
export function ChoiceCard({
  icon: Icon,
  title,
  detail,
  picked,
  disabled,
  onPick,
}: {
  icon: LucideIcon;
  title: string;
  detail: string;
  picked: boolean;
  disabled?: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={picked}
      disabled={disabled}
      onClick={onPick}
      className={`cartograph-pick flex items-start gap-3 rounded-xl p-4 text-left ring-1 transition-[transform,background-color,box-shadow] duration-100 ease-standard hover:ring-primary/50 active:bg-muted/60 motion-safe:active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none disabled:pointer-events-none motion-reduce:transition-none ${
        picked ? "bg-primary/5 ring-2 ring-primary" : "ring-foreground/10"
      }`}
    >
      <Icon className={`mt-0.5 size-5 shrink-0 ${picked ? "text-primary" : "text-muted-foreground"}`} aria-hidden="true" />
      <span className="flex flex-col gap-1">
        <span className="font-medium">{title}</span>
        <span className="text-sm text-muted-foreground">{detail}</span>
      </span>
    </button>
  );
}
