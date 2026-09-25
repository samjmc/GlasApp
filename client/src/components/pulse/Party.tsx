import { useState } from "react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { initials, partyStyle } from "@/lib/parties";

/** A small coloured dot for a party. */
export function PartyDot({ party, className }: { party: string | null | undefined; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block h-2 w-2 shrink-0 rounded-full", className)}
      style={{ backgroundColor: partyStyle(party).dot }}
    />
  );
}

/** Dot + party name, optionally linking to the party page. */
export function PartyLabel({
  party,
  link = false,
  short = false,
  className,
}: {
  party: string | null | undefined;
  link?: boolean;
  short?: boolean;
  className?: string;
}) {
  const style = partyStyle(party);
  const body = (
    <>
      <PartyDot party={party} />
      <span className="truncate">{short ? style.short : style.name}</span>
    </>
  );
  const classes = cn("inline-flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground", className);
  if (link && party) {
    return (
      <Link href={`/party/${encodeURIComponent(party)}`} className={cn(classes, "hover:text-foreground")}>
        {body}
      </Link>
    );
  }
  return <span className={classes}>{body}</span>;
}

const AVATAR_SIZES = {
  sm: "h-8 w-8 text-xs",
  md: "h-11 w-11 text-sm",
  lg: "h-16 w-16 text-lg",
  xl: "h-24 w-24 text-2xl",
} as const;

/**
 * A TD's photo, falling back to initials on the party colour when there is no photo
 * or it fails to load.
 */
export function TDAvatar({
  name,
  party,
  imageUrl,
  size = "md",
  className,
}: {
  name: string;
  party?: string | null;
  imageUrl?: string | null;
  size?: keyof typeof AVATAR_SIZES;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const classes = cn(
    "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-white",
    AVATAR_SIZES[size],
    className
  );

  if (imageUrl && !failed) {
    return (
      <span className={classes} style={{ backgroundColor: partyStyle(party).fill }}>
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      </span>
    );
  }
  return (
    <span className={classes} style={{ backgroundColor: partyStyle(party).fill }} aria-hidden="true">
      {initials(name)}
    </span>
  );
}
