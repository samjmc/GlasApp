import type { ReactNode } from "react";
import { CheckCircle2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  /** The page's name, shown as the main heading. */
  title: string;
  /** One line under the title. */
  description?: ReactNode;
  /** A small label above the title, e.g. "Dáil Éireann". */
  eyebrow?: ReactNode;
  /** When set, an info button opens a "How it works" dialog with these bullets. */
  tooltipTitle?: string;
  bullets?: string[];
  right?: ReactNode;
  className?: string;
};

/** The top of a page: heading, one-line description, optional "how it works" and actions. */
export function PageHeader({ title, description, eyebrow, tooltipTitle, bullets = [], right, className }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="flex min-w-0 flex-col gap-2">
        {eyebrow && <div className="text-[13px] font-semibold text-muted-foreground">{eyebrow}</div>}
        <div className="flex items-center gap-2">
          <h1 className="font-display text-3xl font-bold leading-none tracking-tight sm:text-5xl">{title}</h1>
          {tooltipTitle && (
            <Dialog>
              <DialogTrigger asChild>
                <Button type="button" variant="ghost" size="icon-sm" aria-label={`How ${title} works`}>
                  <Info />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>{tooltipTitle}</DialogTitle>
                </DialogHeader>
                <ul className="flex flex-col gap-3 text-sm text-muted-foreground">
                  {bullets.map((text) => (
                    <li key={text} className="flex items-start gap-2.5">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                      <span className="leading-snug">{text}</span>
                    </li>
                  ))}
                </ul>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button className="w-full sm:w-auto">Got it</Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
        {description && <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">{description}</p>}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </header>
  );
}
