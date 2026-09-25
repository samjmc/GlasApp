import type { ReactNode } from "react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

/** A bento tile on the home page. */
export function HomeCard({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("flex min-w-0 flex-col gap-4 rounded-2xl border bg-card p-5 md:p-6", className)}>{children}</section>;
}

/** Card title with an optional "see all" link on the right. */
export function HomeCardHeader({ title, href, linkLabel, note }: { title: string; href?: string; linkLabel?: string; note?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="font-display text-xl font-bold tracking-tight md:text-[22px]">{title}</h2>
      {href && linkLabel ? (
        <Link href={href} className="shrink-0 text-sm font-bold text-primary hover:underline">
          {linkLabel}
        </Link>
      ) : (
        note && <span className="shrink-0 text-[13px] text-muted-foreground">{note}</span>
      )}
    </div>
  );
}
