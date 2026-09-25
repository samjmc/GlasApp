import { Link } from "wouter";
import { Compass, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] w-full flex-col items-center justify-center gap-6 px-4 text-center">
      <span className="font-display text-7xl font-extrabold tracking-tight text-primary sm:text-8xl">404</span>
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-bold tracking-tight">Page not found</h1>
        <p className="max-w-sm text-muted-foreground">
          That page doesn't exist, or it moved. Head back home or check out the rankings.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild size="lg" className="gap-2">
          <Link href="/">
            <Home className="h-4 w-4" aria-hidden="true" />
            Back to home
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="gap-2">
          <Link href="/rankings">
            <Compass className="h-4 w-4" aria-hidden="true" />
            Go to rankings
          </Link>
        </Button>
      </div>
    </div>
  );
}
