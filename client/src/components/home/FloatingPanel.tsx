import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * A small non-modal card floating above the page: above the bottom nav on phone,
 * bottom-right on tablet/desktop. It never covers the top of the page or blocks it.
 */
export function FloatingPanel({
  label,
  onClose,
  children,
}: {
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={label}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      className="fixed inset-x-3 z-40 max-h-[45vh] overflow-y-auto rounded-2xl border bg-card p-5 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200 bottom-[calc(92px+env(safe-area-inset-bottom,0px))] md:inset-x-auto md:bottom-6 md:right-6 md:w-[380px]"
    >
      <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close" className="absolute right-2 top-2">
        <X className="h-4 w-4" />
      </Button>
      {children}
    </div>
  );
}
