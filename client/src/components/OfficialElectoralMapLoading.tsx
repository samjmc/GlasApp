import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

/** What the constituency map shows while its boundaries load. */
const OfficialElectoralMapLoading: React.FC = () => {
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center gap-4 bg-elevated p-6" aria-busy="true">
      <Skeleton className="absolute inset-4 rounded-xl opacity-60" />
      <div className="relative flex flex-col items-center gap-2 rounded-xl bg-card px-5 py-4 text-center">
        <span className="font-display text-lg font-bold tracking-tight">Loading the map</span>
        <span className="text-sm text-muted-foreground">Drawing the constituency boundaries.</span>
      </div>
    </div>
  );
};

export default OfficialElectoralMapLoading;
