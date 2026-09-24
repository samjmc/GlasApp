import { cn } from "@/lib/utils";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

/**
 * A pill-shaped choice between a few options (sort order, view, time range).
 * For switching whole panels of content, use ui/tabs, which has the same look.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  size = "md",
  className,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name for the group. */
  label: string;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("no-scrollbar inline-flex max-w-full gap-1 overflow-x-auto rounded-xl bg-elevated p-1", className)}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "shrink-0 rounded-lg px-4 font-semibold transition-colors",
              size === "sm" ? "h-8 text-[13px]" : "h-10 text-sm",
              selected ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
