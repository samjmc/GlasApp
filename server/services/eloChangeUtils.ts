type ELOChangeSummary = {
  change: number;
};

export function hasMeaningfulELOChanges(changes: Record<string, ELOChangeSummary>): boolean {
  return Object.values(changes).some(({ change }) => change !== 0);
}
