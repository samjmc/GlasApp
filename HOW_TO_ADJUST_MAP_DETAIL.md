# How to Adjust Constituency Map Detail

## Current Status ✅
- **Map is working** with all 43 constituencies displayed
- **Using:** Simplified boundaries (tolerance 5.0, 26 MB)
- **Shapes:** Recognizable county/constituency outlines

## How to Change Detail Level

### Step 1: Generate Boundaries

Run the simplification script with your desired tolerance:

```bash
# More detailed (larger file)
node scripts/simplify-constituencies.js 2.0     # 47 MB - good detail
node scripts/simplify-constituencies.js 1.0     # ~80 MB - better detail
node scripts/simplify-constituencies.js 0.5     # ~95 MB - high detail

# Less detailed (smaller file)  
node scripts/simplify-constituencies.js 5.0     # 26 MB - current (recommended)
node scripts/simplify-constituencies.js 10.0    # ~15 MB - simpler shapes
```

### Step 2: Update the App

Edit `client/src/helpers/fetchConstituencyGeoJSON.ts` line 9:

```typescript
const IRELAND_CONSTITUENCIES = '/assets/ireland-constituencies-simplified-2.geojson';
//                                                                          ↑
//                                                          Change this number
```

### Step 3: Refresh Browser

The map will automatically load the new boundaries.

## Available Files

All generated files are in `public/assets/`:
- `ireland-constituencies-simplified-5.geojson` (26 MB) ← Currently in use
- `ireland-constituencies-simplified-2.geojson` (47 MB)
- `ireland-constituencies-simplified-0.5.geojson` (95 MB)
- `ireland-constituencies-simplified-0.1.geojson` (140 MB)
- etc.

## Recommendation

**Tolerance 2.0 - 5.0** provides the best balance:
- File sizes are reasonable for web (26-47 MB)
- Shapes are recognizable as actual constituencies
- Fast enough loading on decent connections
- 70-85% reduction in data points while keeping shape fidelity

## Note on SVG

SVG won't help reduce file size. The problem isn't the format, it's the number of coordinate points. GeoJSON and SVG will have similar sizes for the same level of detail.

