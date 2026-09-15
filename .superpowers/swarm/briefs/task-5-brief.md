### Task 5
**Owned files (6, 104 baseline errors):**
- server/routes/botRoutes.ts
- server/routes/chatRoutes.ts
- server/routes/debateMonitoringRoutes.ts
- server/routes/debateWorkspaceRoutes.ts
- server/routes/politicianChatRoutes.ts
- server/routes/shadowRoutes.ts

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
- `npx tsc --noEmit --incremental false 2>&1 > /tmp/tsc-T5.txt; grep -cE "error TS" /tmp/tsc-T5.txt` then `grep -E "^(OWNED_FILE1|OWNED_FILE2|...)" /tmp/tsc-T5.txt | wc -l` must be 0.
- `npm run test` — must pass.
- Confirm `tsconfig.json` still has `"strict": true`.

**Baseline errors in owned files (fix all of these):**
server/routes/botRoutes.ts(14,3): error TS18046: 'next' is of type 'unknown'.
server/routes/botRoutes.ts(53,16): error TS18046: 'error' is of type 'unknown'.
server/routes/botRoutes.ts(89,16): error TS18046: 'error' is of type 'unknown'.
server/routes/chatRoutes.ts(89,13): error TS18046: 'msg' is of type 'unknown'.
server/routes/chatRoutes.ts(89,36): error TS18046: 'msg' is of type 'unknown'.
server/routes/chatRoutes.ts(90,28): error TS18046: 'msg' is of type 'unknown'.
server/routes/chatRoutes.ts(90,47): error TS18046: 'msg' is of type 'unknown'.
server/routes/chatRoutes.ts(93,13): error TS18046: 'msg' is of type 'unknown'.
server/routes/chatRoutes.ts(95,28): error TS18046: 'msg' is of type 'unknown'.
server/routes/chatRoutes.ts(95,47): error TS18046: 'msg' is of type 'unknown'.
server/routes/chatRoutes.ts(98,13): error TS18046: 'msg' is of type 'unknown'.
server/routes/chatRoutes.ts(100,24): error TS18046: 'msg' is of type 'unknown'.
server/routes/chatRoutes.ts(101,27): error TS18046: 'msg' is of type 'unknown'.
server/routes/chatRoutes.ts(102,32): error TS18046: 'msg' is of type 'unknown'.
server/routes/debateMonitoringRoutes.ts(115,60): error TS2339: Property 'message' does not exist on type '{}'.
server/routes/debateWorkspaceRoutes.ts(18,13): error TS2339: Property 'period' does not exist on type 'object'.
server/routes/debateWorkspaceRoutes.ts(20,20): error TS2339: Property 'period' does not exist on type 'object'.
server/routes/debateWorkspaceRoutes.ts(20,41): error TS2339: Property 'period' does not exist on type 'object'.
server/routes/debateWorkspaceRoutes.ts(20,68): error TS2339: Property 'period' does not exist on type 'object'.
server/routes/debateWorkspaceRoutes.ts(20,88): error TS2339: Property 'period' does not exist on type 'object'.
server/routes/debateWorkspaceRoutes.ts(22,27): error TS2339: Property 'period' does not exist on type 'object'.
server/routes/debateWorkspaceRoutes.ts(23,25): error TS2339: Property 'period' does not exist on type 'object'.
server/routes/debateWorkspaceRoutes.ts(27,13): error TS2339: Property 'party' does not exist on type 'object'.
server/routes/debateWorkspaceRoutes.ts(27,47): error TS2339: Property 'party' does not exist on type 'object'.
server/routes/debateWorkspaceRoutes.ts(28,13): error TS2339: Property 'topic' does not exist on type 'object'.
server/routes/debateWorkspaceRoutes.ts(28,47): error TS2339: Property 'topic' does not exist on type 'object'.
server/routes/debateWorkspaceRoutes.ts(29,13): error TS2339: Property 'chamber' does not exist on type 'object'.
server/routes/debateWorkspaceRoutes.ts(29,51): error TS2339: Property 'chamber' does not exist on type 'object'.
server/routes/debateWorkspaceRoutes.ts(62,16): error TS18046: 'row' is of type 'unknown'.
server/routes/debateWorkspaceRoutes.ts(63,33): error TS18046: 'row' is of type 'unknown'.
server/routes/debateWorkspaceRoutes.ts(63,55): error TS18046: 'row' is of type 'unknown'.
server/routes/debateWorkspaceRoutes.ts(66,14): error TS7006: Parameter 'a' implicitly has an 'any' type.
server/routes/debateWorkspaceRoutes.ts(66,17): error TS7006: Parameter 'b' implicitly has an 'any' type.
server/routes/debateWorkspaceRoutes.ts(68,13): error TS7006: Parameter 'entry' implicitly has an 'any' type.
server/routes/debateWorkspaceRoutes.ts(76,19): error TS18046: 'row' is of type 'unknown'.
server/routes/debateWorkspaceRoutes.ts(77,19): error TS18046: 'row' is of type 'unknown'.
server/routes/debateWorkspaceRoutes.ts(78,19): error TS18046: 'row' is of type 'unknown'.
server/routes/debateWorkspaceRoutes.ts(80,19): error TS18046: 'row' is of type 'unknown'.
server/routes/debateWorkspaceRoutes.ts(81,19): error TS18046: 'row' is of type 'unknown'.
server/routes/debateWorkspaceRoutes.ts(156,44): error TS18046: 'row' is of type 'unknown'.
server/routes/debateWorkspaceRoutes.ts(179,5): error TS2698: Spread types may only be created from object types.
server/routes/debateWorkspaceRoutes.ts(180,34): error TS18046: 'row' is of type 'unknown'.
server/routes/debateWorkspaceRoutes.ts(185,21): error TS18046: 'row' is of type 'unknown'.
server/routes/debateWorkspaceRoutes.ts(186,7): error TS18046: 'row' is of type 'unknown'.
server/routes/debateWorkspaceRoutes.ts(186,52): error TS18046: 'entry' is of type 'unknown'.
server/routes/debateWorkspaceRoutes.ts(192,40): error TS18046: 'row' is of type 'unknown'.
server/routes/debateWorkspaceRoutes.ts(192,73): error TS18046: 'row' is of type 'unknown'.
server/routes/debateWorkspaceRoutes.ts(194,26): error TS18046: 'activity' is of type 'unknown'.
server/routes/debateWorkspaceRoutes.ts(195,63): error TS18046: 'activity' is of type 'unknown'.
server/routes/debateWorkspaceRoutes.ts(219,60): error TS2339: Property 'message' does not exist on type '{}'.
server/routes/debateWorkspaceRoutes.ts(253,60): error TS2339: Property 'message' does not exist on type '{}'.
server/routes/debateWorkspaceRoutes.ts(287,60): error TS2339: Property 'message' does not exist on type '{}'.
server/routes/debateWorkspaceRoutes.ts(309,60): error TS2339: Property 'message' does not exist on type '{}'.
server/routes/debateWorkspaceRoutes.ts(332,60): error TS2339: Property 'message' does not exist on type '{}'.
server/routes/debateWorkspaceRoutes.ts(422,60): error TS2339: Property 'message' does not exist on type '{}'.
server/routes/politicianChatRoutes.ts(69,121): error TS18046: 'c' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(109,13): error TS2698: Spread types may only be created from object types.
server/routes/politicianChatRoutes.ts(137,79): error TS18046: 'b' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(137,94): error TS18046: 'a' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(140,33): error TS18046: 'c' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(147,62): error TS18046: 'c' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(170,30): error TS18046: 'm' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(171,38): error TS18046: 'm' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(172,36): error TS18046: 'm' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(177,30): error TS18046: 'm' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(189,25): error TS18046: 'a' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(189,43): error TS18046: 'a' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(190,25): error TS18046: 'b' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(190,43): error TS18046: 'b' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(196,35): error TS18046: 'c' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(197,41): error TS18046: 'c' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(207,27): error TS18046: 'chunk' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(207,49): error TS18046: 'chunk' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(208,40): error TS18046: 'chunk' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(211,22): error TS18046: 'chunk' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(212,29): error TS18046: 'chunk' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(222,116): error TS18046: 'c' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(239,22): error TS18046: 'p' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(239,40): error TS18046: 'p' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(240,17): error TS18046: 'p' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(246,43): error TS18046: 'p' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(246,76): error TS18046: 'p' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(246,98): error TS18046: 'p' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(525,11): error TS18046: 'pos' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(527,18): error TS18046: 'pos' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(527,47): error TS18046: 'pos' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(530,18): error TS18046: 'pos' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(533,18): error TS18046: 'pos' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(539,21): error TS18046: 'pos' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(539,52): error TS18046: 'pos' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(540,19): error TS18046: 'pos' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(540,48): error TS18046: 'pos' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(556,16): error TS18046: 'pos' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(558,28): error TS18046: 'pos' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(572,79): error TS18046: 'p' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(575,16): error TS18046: 'p' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(576,17): error TS18046: 'p' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(577,26): error TS18046: 'p' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(577,79): error TS18046: 'p' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(578,25): error TS18046: 'p' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(578,113): error TS18046: 'p' is of type 'unknown'.
server/routes/politicianChatRoutes.ts(579,25): error TS18046: 'p' is of type 'unknown'.
server/routes/shadowRoutes.ts(32,31): error TS18047: 'db' is possibly 'null'.
server/routes/shadowRoutes.ts(42,31): error TS18047: 'db' is possibly 'null'.

## Task 6

