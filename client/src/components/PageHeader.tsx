import type { ReactNode } from "react";
import { Info, Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogClose,
  DialogFooter
} from "@/components/ui/dialog";

type PageHeaderProps = {
  title: string;
  tooltipTitle?: string;
  bullets?: string[];
  description?: string;
  right?: ReactNode;
  className?: string;
};

export function PageHeader({ title, tooltipTitle, bullets = [], description, right, className }: PageHeaderProps) {
  return (
    <div className={className ?? ""}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-500 dark:text-gray-400 truncate">
              {title}
            </div>
            {tooltipTitle && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto w-auto p-1 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-transparent"
                    aria-label={`About ${title}`}
                  >
                    <Info className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[90%] max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 text-white shadow-2xl z-[1050]">
                  <DialogHeader className="mb-2 flex flex-row items-center justify-between space-y-0 text-left">
                    <DialogTitle className="flex items-center gap-2 text-xl font-bold text-white">
                      <Sparkles className="h-5 w-5 text-emerald-400" />
                      {tooltipTitle}
                    </DialogTitle>
                  </DialogHeader>
                  
                  <div className="space-y-4">
                    <div className="rounded-xl bg-white/5 p-4">
                      <h4 className="mb-3 font-medium text-white flex items-center gap-2 text-sm">
                        <Info className="h-4 w-4 text-emerald-400" />
                        How it works
                      </h4>
                      <ul className="space-y-3 text-sm text-gray-300">
                        {bullets.map((text) => (
                          <li key={text} className="flex items-start gap-2.5">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500/70" />
                            <span className="leading-snug">{text}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <DialogFooter className="mt-2 sm:justify-end">
                    <DialogClose asChild>
                      <Button 
                        className="w-full rounded-xl bg-white text-slate-900 font-semibold hover:bg-gray-200 sm:w-auto"
                      >
                        Got it
                      </Button>
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
          {description && (
            <p className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
              {description}
            </p>
          )}
        </div>

        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
    </div>
  );
}
