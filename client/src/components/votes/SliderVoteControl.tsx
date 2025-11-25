import { Slider } from "@/components/ui/slider";
import { useMemo } from "react";

interface SliderVoteControlProps {
  value: number;
  onValueChange?: (value: number) => void;
  onValueCommit?: (value: number) => void;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
  leftLabel?: string;
  middleLabel?: string | null;
  rightLabel?: string;
  className?: string;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function SliderVoteControl({
  value,
  onValueChange,
  onValueCommit,
  disabled,
  min = 1,
  max = 5,
  step = 1,
  leftLabel = "Strongly Oppose",
  middleLabel = "Neutral",
  rightLabel = "Strongly Support",
  className = "",
}: SliderVoteControlProps) {
  const ticks = useMemo(() => {
    const tickValues: number[] = [];
    for (let current = min; current <= max; current += step) {
      tickValues.push(current);
    }
    if (tickValues[tickValues.length - 1] !== max) {
      tickValues.push(max);
    }
    return tickValues;
  }, [min, max, step]);

  const clampedValue = clamp(value, min, max);

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex justify-between text-xs font-medium px-1">
        <span className="text-red-400">{leftLabel}</span>
        {middleLabel ? <span className="text-gray-400">{middleLabel}</span> : <span />}
        <span className="text-green-400">{rightLabel}</span>
      </div>
      <div className="relative px-1">
        <Slider
          value={[clampedValue]}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onValueChange={(vals) => onValueChange?.(vals[0]!)}
          // Radix slider exposes onValueCommit
          onValueCommit={(vals) => onValueCommit?.(vals[0]!)}
          className="cursor-pointer"
        />
        <div className="flex justify-between mt-2 px-0.5">
          {ticks.map((tick) => {
            const isActive = Math.round(clampedValue) === tick;
            return (
              <div key={tick} className="flex flex-col items-center">
                <div
                  className={`w-0.5 h-2 rounded-full ${
                    isActive ? "bg-emerald-500" : "bg-gray-400"
                  }`}
                />
                <span
                  className={`text-xs mt-1 font-medium ${
                    isActive ? "text-emerald-400" : "text-gray-400"
                  }`}
                >
                  {tick}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}













