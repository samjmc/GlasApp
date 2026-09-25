import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface MultipleChoiceVoteControlProps {
  options: Record<string, string>; // { option_a: "Text", option_b: "Text", ... }
  selectedOption: string | null;
  onSelect: (optionKey: string) => void;
  disabled?: boolean;
  /** "lg" for the full-screen daily vote, "sm" for compact rows inside cards. */
  size?: "lg" | "sm";
  label?: string;
}

const LETTERS = "ABCDEFGH";

/** A radio group of lettered answer options. */
export function MultipleChoiceVoteControl({
  options,
  selectedOption,
  onSelect,
  disabled = false,
  size = "lg",
  label = "Your answer",
}: MultipleChoiceVoteControlProps) {
  const optionEntries = Object.entries(options).sort(([a], [b]) => a.localeCompare(b));
  const lg = size === "lg";

  return (
    <div role="radiogroup" aria-label={label} className={cn("flex w-full flex-col", lg ? "gap-2.5" : "gap-2")}>
      {optionEntries.map(([optionKey, optionText], index) => {
        const isSelected = selectedOption === optionKey;
        return (
          <button
            key={optionKey}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={disabled}
            onClick={() => {
              navigator.vibrate?.(30);
              onSelect(optionKey);
            }}
            className={cn(
              "flex w-full items-center border-2 text-left transition-colors duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
              lg ? "min-h-[72px] gap-3.5 rounded-xl px-4 py-3.5" : "min-h-[48px] gap-3 rounded-lg px-3 py-2",
              isSelected ? "border-primary bg-primary/15" : "border-border bg-card hover:bg-accent"
            )}
          >
            <span
              className={cn(
                "flex shrink-0 items-center justify-center rounded-full font-extrabold",
                lg ? "h-9 w-9 text-sm" : "h-7 w-7 text-xs",
                isSelected ? "bg-primary text-primary-foreground" : "bg-elevated text-foreground"
              )}
            >
              {isSelected ? <Check className={lg ? "h-[18px] w-[18px]" : "h-4 w-4"} strokeWidth={3} aria-hidden="true" /> : LETTERS[index] ?? index + 1}
            </span>
            <span className={cn("min-w-0 flex-1 break-words font-semibold leading-snug", lg ? "text-base" : "text-sm")}>
              {optionText}
            </span>
          </button>
        );
      })}
    </div>
  );
}
