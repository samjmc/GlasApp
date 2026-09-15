### Task 15
**Owned files (2, 133 baseline errors):**
- client/src/pages/EducationPage.tsx
- client/src/pages/PollingSystemInfo.tsx

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
- `npx tsc --noEmit --incremental false 2>&1 > /tmp/tsc-T15.txt; grep -cE "error TS" /tmp/tsc-T15.txt` then `grep -E "^(OWNED_FILE1|OWNED_FILE2|...)" /tmp/tsc-T15.txt | wc -l` must be 0.
- `npm run test` — must pass.
- Confirm `tsconfig.json` still has `"strict": true`.

**Baseline errors in owned files (fix all of these):**
client/src/pages/EducationPage.tsx(1088,80): error TS18046: 'item' is of type 'unknown'.
client/src/pages/EducationPage.tsx(1330,13): error TS2322: Type '{ pledgesData: any; pledgesLoading: boolean; getScoreColor: (score: number) => "text-red-600" | "text-green-600" | "text-yellow-600"; getScoreBadge: (score: number) => "bg-red-100 text-red-800" | "bg-green-100 text-green-800" | "bg-yellow-100 text-yellow-800"; formatDate: (dateString: string) => string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/EducationPage.tsx(1587,33): error TS2339: Property 'pledgesData' does not exist on type 'unknown'.
client/src/pages/EducationPage.tsx(1587,46): error TS2339: Property 'pledgesLoading' does not exist on type 'unknown'.
client/src/pages/EducationPage.tsx(1587,62): error TS2339: Property 'getScoreColor' does not exist on type 'unknown'.
client/src/pages/EducationPage.tsx(1587,77): error TS2339: Property 'getScoreBadge' does not exist on type 'unknown'.
client/src/pages/EducationPage.tsx(1587,92): error TS2339: Property 'formatDate' does not exist on type 'unknown'.
client/src/pages/EducationPage.tsx(1611,92): error TS18046: 'item' is of type 'unknown'.
client/src/pages/EducationPage.tsx(1639,65): error TS18046: 'item' is of type 'unknown'.
client/src/pages/EducationPage.tsx(1648,28): error TS18046: 'item' is of type 'unknown'.
client/src/pages/EducationPage.tsx(1649,29): error TS18046: 'item' is of type 'unknown'.
client/src/pages/EducationPage.tsx(1788,92): error TS18046: 'item' is of type 'unknown'.
client/src/pages/EducationPage.tsx(1807,65): error TS18046: 'item' is of type 'unknown'.
client/src/pages/EducationPage.tsx(1817,26): error TS18046: 'item' is of type 'unknown'.
client/src/pages/EducationPage.tsx(1818,27): error TS18046: 'item' is of type 'unknown'.
client/src/pages/EducationPage.tsx(1879,35): error TS18046: 'action' is of type 'unknown'.
client/src/pages/EducationPage.tsx(1880,68): error TS18046: 'action' is of type 'unknown'.
client/src/pages/EducationPage.tsx(1882,41): error TS18046: 'action' is of type 'unknown'.
client/src/pages/EducationPage.tsx(1884,28): error TS18046: 'action' is of type 'unknown'.
client/src/pages/EducationPage.tsx(1886,32): error TS18046: 'action' is of type 'unknown'.
client/src/pages/EducationPage.tsx(2134,59): error TS18046: 'pledge' is of type 'unknown'.
client/src/pages/EducationPage.tsx(2136,76): error TS18046: 'pledge' is of type 'unknown'.
client/src/pages/EducationPage.tsx(2137,81): error TS18046: 'pledge' is of type 'unknown'.
client/src/pages/EducationPage.tsx(2138,38): error TS18046: 'pledge' is of type 'unknown'.
client/src/pages/EducationPage.tsx(2307,106): error TS2571: Object is of type 'unknown'.
client/src/pages/EducationPage.tsx(2307,167): error TS2571: Object is of type 'unknown'.
client/src/pages/EducationPage.tsx(2315,17): error TS2571: Object is of type 'unknown'.
client/src/pages/EducationPage.tsx(2430,61): error TS18046: 'politician' is of type 'unknown'.
client/src/pages/EducationPage.tsx(2433,20): error TS18046: 'politician' is of type 'unknown'.
client/src/pages/EducationPage.tsx(2437,37): error TS18046: 'politician' is of type 'unknown'.
client/src/pages/EducationPage.tsx(2446,125): error TS18046: 'politician' is of type 'unknown'.
client/src/pages/EducationPage.tsx(2448,57): error TS18046: 'politician' is of type 'unknown'.
client/src/pages/EducationPage.tsx(2454,69): error TS18046: 'politician' is of type 'unknown'.
client/src/pages/EducationPage.tsx(2522,61): error TS18046: 'politician' is of type 'unknown'.
client/src/pages/EducationPage.tsx(2525,20): error TS18046: 'politician' is of type 'unknown'.
client/src/pages/EducationPage.tsx(2529,37): error TS18046: 'politician' is of type 'unknown'.
client/src/pages/EducationPage.tsx(2538,123): error TS18046: 'politician' is of type 'unknown'.
client/src/pages/EducationPage.tsx(2540,57): error TS18046: 'politician' is of type 'unknown'.
client/src/pages/EducationPage.tsx(2546,67): error TS18046: 'politician' is of type 'unknown'.
client/src/pages/EducationPage.tsx(2616,67): error TS18046: 'politician' is of type 'unknown'.
client/src/pages/EducationPage.tsx(2620,20): error TS18046: 'politician' is of type 'unknown'.
client/src/pages/EducationPage.tsx(2624,37): error TS18046: 'politician' is of type 'unknown'.
client/src/pages/EducationPage.tsx(2633,124): error TS18046: 'politician' is of type 'unknown'.
client/src/pages/EducationPage.tsx(2641,68): error TS18046: 'politician' is of type 'unknown'.
client/src/pages/EducationPage.tsx(2711,67): error TS18046: 'politician' is of type 'unknown'.
client/src/pages/EducationPage.tsx(2715,20): error TS18046: 'politician' is of type 'unknown'.
client/src/pages/EducationPage.tsx(2719,37): error TS18046: 'politician' is of type 'unknown'.
client/src/pages/EducationPage.tsx(2728,126): error TS18046: 'politician' is of type 'unknown'.
client/src/pages/EducationPage.tsx(2736,70): error TS18046: 'politician' is of type 'unknown'.
client/src/pages/EducationPage.tsx(3233,35): error TS2339: Property 'success' does not exist on type '{}'.
client/src/pages/EducationPage.tsx(3233,63): error TS2339: Property 'data' does not exist on type '{}'.
client/src/pages/EducationPage.tsx(3241,25): error TS2339: Property 'data' does not exist on type '{}'.
client/src/pages/EducationPage.tsx(3246,20): error TS18046: 'td' is of type 'unknown'.
client/src/pages/EducationPage.tsx(3250,56): error TS18046: 'td' is of type 'unknown'.
client/src/pages/EducationPage.tsx(3251,58): error TS18046: 'td' is of type 'unknown'.
client/src/pages/EducationPage.tsx(3251,71): error TS18046: 'td' is of type 'unknown'.
client/src/pages/EducationPage.tsx(3256,18): error TS18046: 'td' is of type 'unknown'.
client/src/pages/EducationPage.tsx(3259,18): error TS18046: 'td' is of type 'unknown'.
client/src/pages/EducationPage.tsx(3334,63): error TS18046: 'b' is of type 'unknown'.
client/src/pages/EducationPage.tsx(3334,80): error TS18046: 'a' is of type 'unknown'.
client/src/pages/EducationPage.tsx(3338,38): error TS18046: 'party' is of type 'unknown'.
client/src/pages/EducationPage.tsx(3340,65): error TS18046: 'party' is of type 'unknown'.
client/src/pages/EducationPage.tsx(3344,99): error TS18046: 'party' is of type 'unknown'.
client/src/pages/EducationPage.tsx(3345,74): error TS18046: 'party' is of type 'unknown'.
client/src/pages/EducationPage.tsx(3347,84): error TS18046: 'party' is of type 'unknown'.
client/src/pages/EducationPage.tsx(3383,72): error TS2339: Property 'data' does not exist on type '{}'.
client/src/pages/EducationPage.tsx(3383,97): error TS2571: Object is of type 'unknown'.
client/src/pages/EducationPage.tsx(3384,25): error TS2571: Object is of type 'unknown'.
client/src/pages/EducationPage.tsx(3385,62): error TS18046: 'b' is of type 'unknown'.
client/src/pages/EducationPage.tsx(3385,96): error TS18046: 'a' is of type 'unknown'.
client/src/pages/EducationPage.tsx(3389,36): error TS18046: 'party' is of type 'unknown'.
client/src/pages/EducationPage.tsx(3391,63): error TS18046: 'party' is of type 'unknown'.
client/src/pages/EducationPage.tsx(3395,97): error TS18046: 'party' is of type 'unknown'.
client/src/pages/EducationPage.tsx(3396,72): error TS18046: 'party' is of type 'unknown'.
client/src/pages/EducationPage.tsx(3398,83): error TS18046: 'party' is of type 'unknown'.
client/src/pages/PollingSystemInfo.tsx(199,13): error TS2322: Type '{ name: string; description: string; columns: string[]; status: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/PollingSystemInfo.tsx(205,13): error TS2322: Type '{ name: string; description: string; columns: string[]; status: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/PollingSystemInfo.tsx(211,13): error TS2322: Type '{ name: string; description: string; columns: string[]; status: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/PollingSystemInfo.tsx(217,13): error TS2322: Type '{ name: string; description: string; columns: string[]; status: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/PollingSystemInfo.tsx(229,13): error TS2322: Type '{ name: string; description: string; columns: string[]; status: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/PollingSystemInfo.tsx(235,13): error TS2322: Type '{ name: string; description: string; columns: string[]; status: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/PollingSystemInfo.tsx(241,13): error TS2322: Type '{ name: string; description: string; columns: string[]; status: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/PollingSystemInfo.tsx(399,13): error TS2322: Type '{ title: string; recommended: boolean; description: string; pros: string[]; cons: string[]; example: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/PollingSystemInfo.tsx(412,13): error TS2322: Type '{ title: string; recommended: boolean; description: string; pros: string[]; cons: string[]; example: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/PollingSystemInfo.tsx(427,13): error TS2322: Type '{ title: string; recommended: boolean; description: string; pros: string[]; cons: string[]; example: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/PollingSystemInfo.tsx(468,13): error TS2322: Type '{ page: string; component: string; priority: string; description: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/PollingSystemInfo.tsx(474,13): error TS2322: Type '{ page: string; component: string; priority: string; description: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/PollingSystemInfo.tsx(480,13): error TS2322: Type '{ page: string; component: string; priority: string; description: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/PollingSystemInfo.tsx(486,13): error TS2322: Type '{ page: string; component: string; priority: string; description: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/PollingSystemInfo.tsx(506,11): error TS2322: Type '{ phase: number; title: string; status: string; items: { task: string; done: boolean; }[]; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/PollingSystemInfo.tsx(518,11): error TS2322: Type '{ phase: number; title: string; status: string; items: { task: string; done: boolean; }[]; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/PollingSystemInfo.tsx(530,11): error TS2322: Type '{ phase: number; title: string; status: string; items: { task: string; done: boolean; }[]; estimatedTime: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/PollingSystemInfo.tsx(549,13): error TS2322: Type '{ number: number; title: string; description: string; command: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/PollingSystemInfo.tsx(555,13): error TS2322: Type '{ number: number; title: string; description: string; command: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/PollingSystemInfo.tsx(561,13): error TS2322: Type '{ number: number; title: string; description: string; command: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/PollingSystemInfo.tsx(567,13): error TS2322: Type '{ number: number; title: string; description: string; command: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/PollingSystemInfo.tsx(579,13): error TS2322: Type '{ icon: string; title: string; description: string; priority: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/PollingSystemInfo.tsx(585,13): error TS2322: Type '{ icon: string; title: string; description: string; priority: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/PollingSystemInfo.tsx(591,13): error TS2322: Type '{ icon: string; title: string; description: string; priority: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/PollingSystemInfo.tsx(597,13): error TS2322: Type '{ icon: string; title: string; description: string; priority: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/PollingSystemInfo.tsx(603,13): error TS2322: Type '{ icon: string; title: string; description: string; priority: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/PollingSystemInfo.tsx(609,13): error TS2322: Type '{ icon: string; title: string; description: string; priority: string; }' is not assignable to type 'IntrinsicAttributes'.
client/src/pages/PollingSystemInfo.tsx(655,22): error TS2339: Property 'name' does not exist on type 'unknown'.
client/src/pages/PollingSystemInfo.tsx(655,28): error TS2339: Property 'description' does not exist on type 'unknown'.
client/src/pages/PollingSystemInfo.tsx(655,41): error TS2339: Property 'columns' does not exist on type 'unknown'.
client/src/pages/PollingSystemInfo.tsx(655,50): error TS2339: Property 'status' does not exist on type 'unknown'.
client/src/pages/PollingSystemInfo.tsx(681,30): error TS2339: Property 'title' does not exist on type 'unknown'.
client/src/pages/PollingSystemInfo.tsx(681,37): error TS2339: Property 'recommended' does not exist on type 'unknown'.
client/src/pages/PollingSystemInfo.tsx(681,50): error TS2339: Property 'description' does not exist on type 'unknown'.
client/src/pages/PollingSystemInfo.tsx(681,63): error TS2339: Property 'pros' does not exist on type 'unknown'.
client/src/pages/PollingSystemInfo.tsx(681,69): error TS2339: Property 'cons' does not exist on type 'unknown'.
client/src/pages/PollingSystemInfo.tsx(681,75): error TS2339: Property 'example' does not exist on type 'unknown'.
client/src/pages/PollingSystemInfo.tsx(720,25): error TS2339: Property 'page' does not exist on type 'unknown'.
client/src/pages/PollingSystemInfo.tsx(720,31): error TS2339: Property 'component' does not exist on type 'unknown'.
client/src/pages/PollingSystemInfo.tsx(720,42): error TS2339: Property 'priority' does not exist on type 'unknown'.
client/src/pages/PollingSystemInfo.tsx(720,52): error TS2339: Property 'description' does not exist on type 'unknown'.
client/src/pages/PollingSystemInfo.tsx(741,22): error TS2339: Property 'phase' does not exist on type 'unknown'.
client/src/pages/PollingSystemInfo.tsx(741,29): error TS2339: Property 'title' does not exist on type 'unknown'.
client/src/pages/PollingSystemInfo.tsx(741,36): error TS2339: Property 'status' does not exist on type 'unknown'.
client/src/pages/PollingSystemInfo.tsx(741,44): error TS2339: Property 'items' does not exist on type 'unknown'.
client/src/pages/PollingSystemInfo.tsx(741,51): error TS2339: Property 'estimatedTime' does not exist on type 'unknown'.
client/src/pages/PollingSystemInfo.tsx(758,30): error TS18046: 'item' is of type 'unknown'.
client/src/pages/PollingSystemInfo.tsx(759,16): error TS18046: 'item' is of type 'unknown'.
client/src/pages/PollingSystemInfo.tsx(761,30): error TS18046: 'item' is of type 'unknown'.
client/src/pages/PollingSystemInfo.tsx(761,78): error TS18046: 'item' is of type 'unknown'.
client/src/pages/PollingSystemInfo.tsx(774,25): error TS2339: Property 'number' does not exist on type 'unknown'.
client/src/pages/PollingSystemInfo.tsx(774,33): error TS2339: Property 'title' does not exist on type 'unknown'.
client/src/pages/PollingSystemInfo.tsx(774,40): error TS2339: Property 'description' does not exist on type 'unknown'.
client/src/pages/PollingSystemInfo.tsx(774,53): error TS2339: Property 'command' does not exist on type 'unknown'.
client/src/pages/PollingSystemInfo.tsx(789,28): error TS2339: Property 'icon' does not exist on type 'unknown'.
client/src/pages/PollingSystemInfo.tsx(789,34): error TS2339: Property 'title' does not exist on type 'unknown'.
client/src/pages/PollingSystemInfo.tsx(789,41): error TS2339: Property 'description' does not exist on type 'unknown'.
client/src/pages/PollingSystemInfo.tsx(789,54): error TS2339: Property 'priority' does not exist on type 'unknown'.

## Task 16

