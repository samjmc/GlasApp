# Axis Labels Fix - November 21, 2025

## Issue
The dimension shift scales were showing generic "LEFT" and "RIGHT" labels for all dimensions, even when the actual spectrum endpoints should be different (e.g., "Libertarian - Authoritarian" for Authority, "Expert-Led - Populist" for Technocratic).

## Root Cause
The backend function `mapIdeologyDimensionToAxisLabel()` was returning simple labels like "Authority" and "Technocratic" without the spectrum endpoints. The frontend parsing logic expected labels in the format "Dimension Left - Right" and would fall back to generic "Left/Right" when this format wasn't found.

## Fix Applied

Updated `server/services/dailySessionService.ts` to return full axis labels with proper spectrum endpoints:

```typescript
function mapIdeologyDimensionToAxisLabel(dimension: IdeologyDimension): string {
  const labels: Record<IdeologyDimension, string> = {
    economic: "Economic Left - Right",
    social: "Social Progressive - Conservative",
    cultural: "Cultural Liberal - Traditional",
    authority: "Authority Libertarian - Authoritarian",
    environmental: "Climate Aggressive - Moderate",
    welfare: "Welfare Expansive - Limited",
    globalism: "Globalism International - National",
    technocratic: "Technocratic Expert-Led - Populist",
  };
  return labels[dimension] ?? dimension;
}
```

## Result

Now each dimension shows meaningful spectrum labels:

- **Economic**: Left ↔ Right
- **Social**: Progressive ↔ Conservative
- **Cultural**: Liberal ↔ Traditional
- **Authority**: Libertarian ↔ Authoritarian
- **Climate**: Aggressive ↔ Moderate
- **Welfare**: Expansive ↔ Limited
- **Globalism**: International ↔ National
- **Technocratic**: Expert-Led ↔ Populist

## Testing

1. Delete your current session for today
2. Create and complete a new daily session
3. Check the summary page - each dimension should now show its proper spectrum labels
4. The labels should accurately reflect the political/ideological spectrum for that dimension

## Files Modified

- `server/services/dailySessionService.ts` - Updated `mapIdeologyDimensionToAxisLabel()` function

## Notes

The frontend parsing logic already supported this format (splitting on " - "), so no frontend changes were needed. The fix ensures consistency across all dimensions and provides users with clear, meaningful labels that accurately describe what each end of the spectrum represents.


