# Constituency Boundary Detail Guide

This guide shows how to generate constituency boundary files with different levels of detail.

## Quick Reference

| Tolerance | Detail Level | File Size | Points | Best For |
|-----------|--------------|-----------|--------|----------|
| 0.0001 | Maximum | ~200 MB | ~1.9M | Extremely detailed analysis |
| 0.001 | Very High | ~160 MB | ~1.8M | High-quality maps |
| 0.005 | High | ~40 MB | ~400K | Good detail, reasonable size |
| 0.01 | Medium | ~20 MB | ~200K | Balanced (recommended) |
| 0.05 | Low | ~5 MB | ~40K | Fast loading |
| 0.1 | Basic | ~2 MB | ~20K | Very fast, basic shapes |

## How to Generate

Run the simplification script with your desired tolerance:

```bash
node scripts/simplify-constituencies.js 0.005
```

## Updating the App

After generating a simplified file, update `client/src/helpers/fetchConstituencyGeoJSON.ts`:

```typescript
const IRELAND_CONSTITUENCIES = '/assets/ireland-constituencies-simplified-0.005.geojson';
```

## Recommendations

- **For production**: Use 0.005 or 0.01 tolerance (good detail, manageable file size)
- **For development**: Use 0.05 or 0.1 tolerance (fast loading, testing)
- **For high-quality maps**: Use 0.001 tolerance (very detailed, large file)

## Current Setup

The app currently uses simplified boundaries at `/assets/ireland-constituencies-simple.geojson` 
(basic rectangular approximations for testing).

Replace with generated simplified boundaries for accurate county shapes.

