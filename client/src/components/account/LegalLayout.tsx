import type { ReactNode } from "react";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

export type LegalTocEntry = { id: string; label: string };

/**
 * Comfortable long-form reading layout for legal pages (Privacy Policy, Terms of Service):
 * narrow measure, a sticky table of contents on lg+, a last-updated line, and a way back home.
 */
export function LegalLayout({
  title,
  lastUpdated,
  toc,
  children,
}: {
  title: string;
  lastUpdated: string;
  toc: LegalTocEntry[];
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 py-8 lg:flex-row lg:items-start lg:gap-12">
      <div className="min-w-0 flex-1">
        <div className="mb-8 max-w-[70ch]">
          <h1 className="font-display text-4xl font-bold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">Last updated: {lastUpdated}</p>
        </div>

        <div className="flex max-w-[70ch] flex-col gap-8 text-[15px] leading-relaxed text-foreground [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:tracking-tight [&_h3]:font-display [&_h3]:text-lg [&_h3]:font-bold [&_h3]:tracking-tight [&_a]:font-semibold [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_p]:text-muted-foreground [&_li]:text-muted-foreground [&_ul]:list-disc [&_ul]:pl-6 [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-border [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2">
          {children}
        </div>

        <div className="mt-12 max-w-[70ch] text-center">
          <Link
            href="/"
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-6 font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to home
          </Link>
        </div>
      </div>

      <nav
        aria-label="Table of contents"
        className="hidden shrink-0 lg:sticky lg:top-24 lg:block lg:w-56 lg:self-start"
      >
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">On this page</p>
        <ul className="flex flex-col gap-1 border-l border-border pl-3 text-sm">
          {toc.map((entry) => (
            <li key={entry.id}>
              <a
                href={`#${entry.id}`}
                className="block py-1 text-muted-foreground transition-colors hover:text-foreground"
              >
                {entry.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
