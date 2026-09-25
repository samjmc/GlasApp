import { GlasMark } from "@/components/pulse/GlasMark";

interface LoadingScreenProps {
  message?: string;
}

/** A small, calm loading state: the Glas mark pulsing above one line of text. */
const LoadingScreen = ({ message = "Loading…" }: LoadingScreenProps) => (
  <div role="status" aria-live="polite" className="flex min-h-[320px] flex-col items-center justify-center gap-4 py-10 text-center">
    <GlasMark className="h-12 w-12 animate-pulse" />
    <p className="font-display text-lg font-bold">{message}</p>
  </div>
);

export default LoadingScreen;
