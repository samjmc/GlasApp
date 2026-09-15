### Task 18
**Owned files (4, 138 baseline errors):**
- client/src/components/EnhancedPoliticalProfileExplanation.tsx
- client/src/components/GlobalSearch.tsx
- client/src/components/LeafletIrelandMap.tsx
- client/src/components/OfficialElectoralMap.tsx

**Goal:** 0 errors in your owned files after `npx tsc --noEmit --incremental false`; total project
error count strictly decreases from the baseline recorded in the ledger; all 103 tests pass.

**Steps:**
1. Read the Global Constraints section of the plan file (this brief includes it) and the Fix
   strategy per error code.
2. For each of your owned files, fix every TypeScript error using the strategies above. Keep
   runtime behavior identical.
3. Run the verification gates (Verification section). Iterate until your owned files show 0
   errors and `npm run test` passes.

**Boundaries — do NOT touch:** any file not in your Owned Files list, `tsconfig.json`,
`shared/**` (Task 1 owns it), and package.json.

**Verification gates:**
- `npx tsc --noEmit --incremental false 2>&1 > /tmp/tsc-T18.txt; grep -cE "error TS" /tmp/tsc-T18.txt` then `grep -E "^(OWNED_FILE1|OWNED_FILE2|...)" /tmp/tsc-T18.txt | wc -l` must be 0.
- `npm run test` — must pass.
- Confirm `tsconfig.json` still has `"strict": true`.

**Baseline errors in owned files (fix all of these):**
client/src/components/EnhancedPoliticalProfileExplanation.tsx(63,85): error TS18046: 'event' is of type 'unknown'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(66,28): error TS18046: 'event' is of type 'unknown'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(79,9): error TS2304: Cannot find name 'setData'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(80,9): error TS2304: Cannot find name 'setIsLoading'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(84,9): error TS2304: Cannot find name 'setIsError'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(85,9): error TS2304: Cannot find name 'setError'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(86,9): error TS2304: Cannot find name 'setIsLoading'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(90,7): error TS2304: Cannot find name 'setIsLoading'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(161,7): error TS2304: Cannot find name 'isLoading'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(181,7): error TS2552: Cannot find name 'isError'. Did you mean 'Error'?
client/src/components/EnhancedPoliticalProfileExplanation.tsx(192,14): error TS2304: Cannot find name 'error'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(192,39): error TS2304: Cannot find name 'error'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(203,7): error TS2304: Cannot find name 'data'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(205,44): error TS2304: Cannot find name 'data'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(208,22): error TS2304: Cannot find name 'data'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(208,47): error TS2304: Cannot find name 'data'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(208,79): error TS2304: Cannot find name 'data'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(209,29): error TS2304: Cannot find name 'data'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(209,62): error TS2304: Cannot find name 'data'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(209,94): error TS2304: Cannot find name 'data'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(213,23): error TS2304: Cannot find name 'data'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(214,17): error TS2304: Cannot find name 'data'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(215,16): error TS2304: Cannot find name 'data'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(215,39): error TS2304: Cannot find name 'data'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(216,31): error TS2304: Cannot find name 'data'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(217,23): error TS2304: Cannot find name 'data'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(219,25): error TS2304: Cannot find name 'data'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(220,43): error TS7006: Parameter 's' implicitly has an 'any' type.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(220,65): error TS7006: Parameter 's' implicitly has an 'any' type.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(223,36): error TS2304: Cannot find name 'data'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(223,53): error TS2304: Cannot find name 'data'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(224,28): error TS2304: Cannot find name 'data'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(225,40): error TS2304: Cannot find name 'data'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(225,62): error TS2304: Cannot find name 'data'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(226,48): error TS2304: Cannot find name 'data'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(226,78): error TS2304: Cannot find name 'data'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(256,70): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'string'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(256,147): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'string'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(259,58): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'string'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(259,145): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'string'.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(592,36): error TS7006: Parameter 'tension' implicitly has an 'any' type.
client/src/components/EnhancedPoliticalProfileExplanation.tsx(592,45): error TS7006: Parameter 'index' implicitly has an 'any' type.
client/src/components/GlobalSearch.tsx(115,19): error TS18046: 'td' is of type 'unknown'.
client/src/components/GlobalSearch.tsx(116,19): error TS18046: 'td' is of type 'unknown'.
client/src/components/GlobalSearch.tsx(117,19): error TS18046: 'td' is of type 'unknown'.
client/src/components/GlobalSearch.tsx(123,37): error TS18046: 'party' is of type 'unknown'.
client/src/components/GlobalSearch.tsx(129,19): error TS18046: 'constituency' is of type 'unknown'.
client/src/components/GlobalSearch.tsx(129,54): error TS18046: 'constituency' is of type 'unknown'.
client/src/components/GlobalSearch.tsx(213,54): error TS18046: 'result.entity' is of type 'unknown'.
client/src/components/GlobalSearch.tsx(216,57): error TS18046: 'result.entity' is of type 'unknown'.
client/src/components/GlobalSearch.tsx(220,47): error TS18046: 'result.entity' is of type 'unknown'.
client/src/components/GlobalSearch.tsx(362,28): error TS18046: 'td' is of type 'unknown'.
client/src/components/GlobalSearch.tsx(362,40): error TS18046: 'td' is of type 'unknown'.
client/src/components/GlobalSearch.tsx(364,70): error TS18046: 'td' is of type 'unknown'.
client/src/components/GlobalSearch.tsx(376,44): error TS18046: 'td' is of type 'unknown'.
client/src/components/GlobalSearch.tsx(379,44): error TS18046: 'td' is of type 'unknown'.
client/src/components/GlobalSearch.tsx(379,72): error TS18046: 'td' is of type 'unknown'.
client/src/components/GlobalSearch.tsx(384,26): error TS18046: 'td' is of type 'unknown'.
client/src/components/GlobalSearch.tsx(384,44): error TS18046: 'td' is of type 'unknown'.
client/src/components/GlobalSearch.tsx(398,28): error TS18046: 'party' is of type 'unknown'.
client/src/components/GlobalSearch.tsx(401,56): error TS18046: 'party' is of type 'unknown'.
client/src/components/GlobalSearch.tsx(414,44): error TS18046: 'party' is of type 'unknown'.
client/src/components/GlobalSearch.tsx(417,30): error TS18046: 'party' is of type 'unknown'.
client/src/components/GlobalSearch.tsx(434,30): error TS18046: 'constituency' is of type 'unknown'.
client/src/components/GlobalSearch.tsx(438,31): error TS18046: 'constituency' is of type 'unknown'.
client/src/components/GlobalSearch.tsx(452,46): error TS18046: 'constituency' is of type 'unknown'.
client/src/components/GlobalSearch.tsx(455,33): error TS18046: 'constituency' is of type 'unknown'.
client/src/components/GlobalSearch.tsx(455,57): error TS18046: 'constituency' is of type 'unknown'.
client/src/components/LeafletIrelandMap.tsx(36,111): error TS2345: Argument of type '{}' is not assignable to parameter of type '"all" | "constituencies" | "provinces" | "electoral" | "cities" | (() => "all" | "constituencies" | "provinces" | "electoral" | "cities")'.
client/src/components/LeafletIrelandMap.tsx(272,16): error TS2571: Object is of type 'unknown'.
client/src/components/LeafletIrelandMap.tsx(280,27): error TS2345: Argument of type 'HTMLDivElement | null' is not assignable to parameter of type 'string | HTMLElement'.
client/src/components/LeafletIrelandMap.tsx(363,23): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'GeoJsonObject | GeoJsonObject[] | null | undefined'.
client/src/components/LeafletIrelandMap.tsx(407,23): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'GeoJsonObject | GeoJsonObject[] | null | undefined'.
client/src/components/LeafletIrelandMap.tsx(495,9): error TS2571: Object is of type 'unknown'.
client/src/components/LeafletIrelandMap.tsx(496,9): error TS2571: Object is of type 'unknown'.
client/src/components/LeafletIrelandMap.tsx(497,9): error TS2571: Object is of type 'unknown'.
client/src/components/LeafletIrelandMap.tsx(498,9): error TS2571: Object is of type 'unknown'.
client/src/components/LeafletIrelandMap.tsx(499,9): error TS2571: Object is of type 'unknown'.
client/src/components/LeafletIrelandMap.tsx(511,26): error TS2571: Object is of type 'unknown'.
client/src/components/LeafletIrelandMap.tsx(514,9): error TS2571: Object is of type 'unknown'.
client/src/components/LeafletIrelandMap.tsx(515,9): error TS2571: Object is of type 'unknown'.
client/src/components/LeafletIrelandMap.tsx(516,9): error TS2571: Object is of type 'unknown'.
client/src/components/LeafletIrelandMap.tsx(517,9): error TS2571: Object is of type 'unknown'.
client/src/components/LeafletIrelandMap.tsx(526,17): error TS2571: Object is of type 'unknown'.
client/src/components/LeafletIrelandMap.tsx(527,27): error TS2571: Object is of type 'unknown'.
client/src/components/LeafletIrelandMap.tsx(528,28): error TS2571: Object is of type 'unknown'.
client/src/components/LeafletIrelandMap.tsx(529,30): error TS2571: Object is of type 'unknown'.
client/src/components/LeafletIrelandMap.tsx(574,26): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'SetStateAction<"all" | "constituencies" | "provinces" | "electoral" | "cities">'.
client/src/components/OfficialElectoralMap.tsx(62,7): error TS18046: 'c' is of type 'unknown'.
client/src/components/OfficialElectoralMap.tsx(63,7): error TS18046: 'c' is of type 'unknown'.
client/src/components/OfficialElectoralMap.tsx(64,7): error TS18046: 'c' is of type 'unknown'.
client/src/components/OfficialElectoralMap.tsx(73,24): error TS2339: Property 'tds' does not exist on type '{}'.
client/src/components/OfficialElectoralMap.tsx(73,44): error TS2339: Property 'tds' does not exist on type '{}'.
client/src/components/OfficialElectoralMap.tsx(75,22): error TS2339: Property 'tds' does not exist on type '{}'.
client/src/components/OfficialElectoralMap.tsx(76,25): error TS18046: 'td' is of type 'unknown'.
client/src/components/OfficialElectoralMap.tsx(79,31): error TS2339: Property 'parties' does not exist on type '{}'.
client/src/components/OfficialElectoralMap.tsx(79,55): error TS2339: Property 'parties' does not exist on type '{}'.
client/src/components/OfficialElectoralMap.tsx(81,22): error TS2339: Property 'parties' does not exist on type '{}'.
client/src/components/OfficialElectoralMap.tsx(82,27): error TS18046: 'p' is of type 'unknown'.
client/src/components/OfficialElectoralMap.tsx(82,36): error TS18046: 'p' is of type 'unknown'.
client/src/components/OfficialElectoralMap.tsx(93,51): error TS2339: Property 'tdCount' does not exist on type '{}'.
client/src/components/OfficialElectoralMap.tsx(164,7): error TS18046: 'c' is of type 'unknown'.
client/src/components/OfficialElectoralMap.tsx(165,21): error TS18046: 'c' is of type 'unknown'.
client/src/components/OfficialElectoralMap.tsx(231,26): error TS2339: Property 'tds' does not exist on type '{}'.
client/src/components/OfficialElectoralMap.tsx(231,46): error TS2339: Property 'tds' does not exist on type '{}'.
client/src/components/OfficialElectoralMap.tsx(232,24): error TS2339: Property 'tds' does not exist on type '{}'.
client/src/components/OfficialElectoralMap.tsx(233,27): error TS18046: 'td' is of type 'unknown'.
client/src/components/OfficialElectoralMap.tsx(236,33): error TS2339: Property 'parties' does not exist on type '{}'.
client/src/components/OfficialElectoralMap.tsx(236,57): error TS2339: Property 'parties' does not exist on type '{}'.
client/src/components/OfficialElectoralMap.tsx(237,24): error TS2339: Property 'parties' does not exist on type '{}'.
client/src/components/OfficialElectoralMap.tsx(238,29): error TS18046: 'p' is of type 'unknown'.
client/src/components/OfficialElectoralMap.tsx(238,38): error TS18046: 'p' is of type 'unknown'.
client/src/components/OfficialElectoralMap.tsx(270,52): error TS18046: 'c' is of type 'unknown'.
client/src/components/OfficialElectoralMap.tsx(273,36): error TS2339: Property 'averageScore' does not exist on type '{}'.
client/src/components/OfficialElectoralMap.tsx(279,42): error TS2339: Property 'genderBreakdown' does not exist on type '{}'.
client/src/components/OfficialElectoralMap.tsx(316,26): error TS2339: Property 'tds' does not exist on type '{}'.
client/src/components/OfficialElectoralMap.tsx(316,46): error TS2339: Property 'tds' does not exist on type '{}'.
client/src/components/OfficialElectoralMap.tsx(317,24): error TS2339: Property 'tds' does not exist on type '{}'.
client/src/components/OfficialElectoralMap.tsx(318,27): error TS18046: 'td' is of type 'unknown'.
client/src/components/OfficialElectoralMap.tsx(319,26): error TS18046: 'td' is of type 'unknown'.
client/src/components/OfficialElectoralMap.tsx(329,33): error TS2339: Property 'parties' does not exist on type '{}'.
client/src/components/OfficialElectoralMap.tsx(329,57): error TS2339: Property 'parties' does not exist on type '{}'.
client/src/components/OfficialElectoralMap.tsx(330,24): error TS2339: Property 'parties' does not exist on type '{}'.
client/src/components/OfficialElectoralMap.tsx(331,44): error TS18046: 'p' is of type 'unknown'.
client/src/components/OfficialElectoralMap.tsx(332,32): error TS18046: 'p' is of type 'unknown'.
client/src/components/OfficialElectoralMap.tsx(336,32): error TS18046: 'p' is of type 'unknown'.
client/src/components/OfficialElectoralMap.tsx(578,13): error TS18046: 'layer' is of type 'unknown'.
client/src/components/OfficialElectoralMap.tsx(578,30): error TS18046: 'layer' is of type 'unknown'.
client/src/components/OfficialElectoralMap.tsx(579,36): error TS18046: 'layer' is of type 'unknown'.
client/src/components/OfficialElectoralMap.tsx(580,35): error TS18046: 'layer' is of type 'unknown'.
client/src/components/OfficialElectoralMap.tsx(581,35): error TS18046: 'layer' is of type 'unknown'.
client/src/components/OfficialElectoralMap.tsx(582,35): error TS18046: 'layer' is of type 'unknown'.
client/src/components/OfficialElectoralMap.tsx(587,15): error TS18046: 'layer' is of type 'unknown'.
client/src/components/OfficialElectoralMap.tsx(588,13): error TS18046: 'layer' is of type 'unknown'.
client/src/components/OfficialElectoralMap.tsx(594,25): error TS18046: 'layer' is of type 'unknown'.
client/src/components/OfficialElectoralMap.tsx(595,29): error TS18046: 'layer' is of type 'unknown'.
client/src/components/OfficialElectoralMap.tsx(596,15): error TS18046: 'layer' is of type 'unknown'.
client/src/components/OfficialElectoralMap.tsx(597,13): error TS18046: 'layer' is of type 'unknown'.

## Task 19

