# Party quiz: the CLI and its gates

Each party with TDs "takes" the quiz from its GE2024 manifesto. A model picks one answer per
question, backed by a verbatim quote and page, or abstains. Every quote is checked against the
stored text. A person reviews every answer in a git PR before anything is served.
Plan: `docs/plans/quiz-improvements/02-party-manifesto-quiz.md` on the `plan/quiz-improvements` branch.

This file covers the ingest and answer CLI (`server/jobs/party-quiz.ts`, PR 02b). Serving the
answers (the API and the party page) is a later PR; until then sheets change nothing on the site.

## Where things live

| What | Where | Committed? |
|---|---|---|
| Document list, sha256, word count, licence check | `server/partyQuiz/registry.ts` | yes |
| Downloaded file + extracted pages | local text store, default `~/.glas/party-quiz/` (`--store <dir>`) | **never**: the store refuses any folder inside the repo |
| Answer sheets | `server/partyQuiz/sheets/ge2024/<party>.ts` + generated `sheets/index.ts` | yes, one sheet PR per party |

The repo is public. A manifesto is someone else's text, so only short capped quotes are
committed (at most 2 quotes of at most 50 words per item, and per document at most
min(3,000 words, 5% of its word count); `validateSheet` enforces this).

## Commands

```
npm run party-quiz -- ingest  --doc <slug> --file <path> [--retrieved YYYY-MM-DD] [--replace]
npm run party-quiz -- answer  --party <label> [--questions 1,5] [--missing] [--force]
                              [--dry-run] [--yes] [--shuffle-check] [--control]
npm run party-quiz -- review  --party <label>
npm run party-quiz -- approve --party <label> (--questions 1,5 | --all-pending)
npm run party-quiz -- edit    --party <label> --question N --answer K --quote-page P --quote "..." --note "..."
npm run party-quiz -- check   [--mark-stale] [--quotes]
npm run party-quiz -- report  [--compare ches.csv]
```

- **ingest** extracts the pages (PDF: one per page with its printed label; HTML: one per h1–h3
  section), drops running headers and footers, stores the file and its pages under the file's
  sha256, and prints the sha256, word count and likely image pages (under 50 characters; no OCR).
  The same file again is a no-op. A different file for a stored slug needs `--replace`.
- **answer** always prints a token and cost estimate first (characters ÷ 3, no cache). It calls
  the model only with `--yes`. A party that already has a sheet needs `--missing` (only questions
  with no current item) or `--force` (ask again). A re-run keeps an approval only when the status,
  answer and set of quote shas are unchanged. Questions that fail twice are listed and not written.
  - `--control` answers from `server/partyQuiz/fixtures/control.txt` (invented text with no
    position) instead of the manifesto. Every question must abstain. Writes no sheet.
  - `--shuffle-check` shows the answers in a fixed shuffled order and compares with the sheet.
    At least 90% must be identical. Writes no sheet.
- **review** prints the Markdown table for the sheet PR body.
- **approve** approves items; abstentions are approved too. Only approved, answered, current
  items are ever scored.
- **edit** replaces an answer with the reviewer's own, backed by one quote that is verified
  against the store. It sets `reviewerEdited` and the note, and approves the item.
- **check** runs the sheet caps and the stale check on every sheet (exit 1 on a problem).
  `--mark-stale` marks items whose question was edited or deleted; `--quotes` re-verifies every
  quote against the store and re-stamps its `quoteSha`.
- **report** reads the stored party rows **read-only** (needs `DATABASE_URL`) and prints, per
  party, the manifesto vector, coverage, baseline, stored row and blend; it flags
  |m − baseline| ≥ 6 at coverage ≥ 0.5, and prints the party order for users at all −10, all +10
  and all 0, before and after the blend. `--compare` takes a CSV `party,<dimension>,...` on the
  −10..+10 scale.

## Gates (in this order)

1. **Download (Sam).** Download each manifesto in a browser. No code downloads anything.
2. **Ingest.** `ingest --doc <slug> --file <path>`, then put the printed `sha256`, `wordCount`
   and `retrieved` into `registry.ts`.
3. **Licence (Sam).** Check the party's site for a text-and-data-mining opt-out (EU DSM Art. 4)
   and accept the quote caps (CRRA 2000 s.51), then set `licenceChecked: true`. This is not legal
   advice. `answer` refuses any document without `sha256`, `wordCount` and `licenceChecked: true`.
4. **Estimate.** `answer --party <label> --dry-run`. Check the DeepSeek prices first
   (`PRICE_PER_MILLION` in `server/partyQuiz/answer.ts` holds the assumed ones).
5. **Spend (Sam approves).** `answer --party <label> --yes`. Only a DeepSeek provider is accepted
   (`LLM_API_KEY`, `LLM_BASE_URL` unset or a DeepSeek URL). The run logs call 1's real
   `prompt_tokens` (to calibrate the estimate), warns if call 2 had no cache hits, and prints the
   actual cost. The sheet records the model that actually answered and `PROMPT_VERSION`.
6. **Probes.** `answer --control --yes` must give 100% abstentions; `answer --shuffle-check --yes`
   must be at least 90% identical.
7. **Review (Sam).** `review` into the PR body, spot-check the citation links, `approve` / `edit`,
   `check --quotes` before pushing, and `report` for the PR body. Sam merges sheet PRs himself.

A question edited or deleted in `shared/quiz.ts` makes its items stale: `sheets.test.ts` fails
until `check --mark-stale` is run, and `answer --missing` asks it again.
