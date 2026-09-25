import { Loader2, RotateCw } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";

/**
 * "Try again" for a failed query. Pass the query's `isFetching` as `pending`, so a click
 * shows a spinner and cannot fire twice while the retry is in flight.
 */
export function RetryButton({
  onRetry,
  pending = false,
  label = "Try again",
  ...props
}: Omit<ButtonProps, "onClick" | "children"> & { onRetry: () => void; pending?: boolean; label?: string }) {
  return (
    <Button type="button" {...props} onClick={onRetry} disabled={pending || props.disabled} aria-busy={pending}>
      {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RotateCw aria-hidden="true" />}
      {pending ? "Trying again…" : label}
    </Button>
  );
}
