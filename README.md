# Koya Ops Reporting

A dashboard that pulls sales, project & hiring data from three separate systems daily and
uses AI to explain what changed, replacing manual report creation.

**[Live dashboard →](https://koya-talent-operations-report-syste.vercel.app/
<img width="1710" height="985" alt="Screenshot 2026-09-14 at 13 05 34" src="https://github.com/user-attachments/assets/d5848bbf-0bcc-484d-8e56-3f934f37bedd" />
)**



---

## The problem

Koya Talent's leadership ran on three disconnected systems: sales in a Google Sheet, project
delivery in Airtable, and hiring behind an internal API. Answering "how are we doing?" meant
a person opening three tabs and copying figures into a fourth document — slow, and
calculated slightly differently each time depending on who did it.

## What it does

A scheduled workflow runs each morning. It pulls all three sources, computes a fixed set of
KPIs across three reporting periods — last 30 days, last 90 days, year to date — plus the
equal-length period immediately before each, so every figure has something to be compared
against. Claude writes an executive summary, names the risks with severity, and suggests
actions. The whole run is stored as a snapshot, and the dashboard renders the latest one per
period. Users can also request an arbitrary date range on demand.

## Three rules that shaped the build

**Claude never touches arithmetic.** Every number is computed deterministically in code. The
model receives only finished figures and writes prose from them. This is what makes the
output trustworthy — the AI cannot get a number wrong because it never calculates one.

**The dashboard never calculates either.** It reads snapshots and renders them. Two places
doing the same sum eventually disagree, and then nobody trusts either.

**Missing data is never rendered as zero.** Null means "we don't know", zero means "we know,
and it's none". When a source is unavailable, that section shows a banner rather than a grid
of zeros — because a report claiming "zero overdue projects" when it means "couldn't reach
Airtable" reads as good news.

## Architecture

```
Schedule (daily)
   │
   ▼
Workflow A — builds three period windows, each with its prior period
   │
   ├──► Workflow B ──┐
   ├──► Workflow B   ├── fetch 3 sources → normalise → compute metrics
   └──► Workflow B ──┘   → Claude writes insights → write snapshot
                                                          │
Dashboard ◄── Supabase (RLS) ◄────────────────────────────┘
   │
   └──► Custom range → Vercel function (holds secret, verifies session)
                          └──► Workflow C ──► Workflow B
```

Three n8n workflows: a **scheduler**, a reusable **reporting engine** invoked as a
sub-workflow, and a **webhook** for custom date ranges. Only the engine computes anything, so
there is one definition of every metric regardless of what triggered the run.

## Tech stack

| Layer | Technology |
|---|---|
| Automation | n8n |
| AI | Claude API (Anthropic) |
| Database | Supabase (PostgreSQL, JSONB, Row Level Security) |
| Frontend | React · TypeScript · Vite |
| Backend | Vercel serverless functions |
| Auth | Supabase Auth |
| Sources | Google Sheets API · Airtable API · REST API |
| Hosting | Vercel |

## Data model

**`report_runs`** — one row per report: period dates, source statuses, all metrics for the
current and prior period, Claude's insights, data-quality notes. This is what the dashboard
reads.

**`source_records`** — the raw data each report was built from, three rows per run. Kept so
any figure remains auditable after the source spreadsheet has moved on.

The report is the receipt; the source records are the shopping.

## Security

The Supabase anon key ships in the JavaScript bundle by design — it has to, the browser
needs it. Row Level Security is the actual gate:

- `report_runs` — readable by authenticated sessions only
- `source_records` — RLS enabled, **no policy at all**, so the individual People Ops records
  are unreachable through the API by any key a browser could hold
- Public sign-ups disabled; users provisioned by hand
- The custom-range trigger secret lives in a Vercel serverless function, never the client
  bundle, and the function verifies the caller's session before spending any API calls

A client-side login would have been worthless here — it would hide the interface while
leaving the API open.

## Notable engineering

**A concurrency bug that reported success.** Three period runs writing hundreds of rows each
were silently truncating one another — 148, 222 and 314 rows where all three should have
matched — while n8n reported a clean run every time. Found by counting rows against a
hand-worked expectation, not by any error. Fixed by restructuring to three rows per run with
records held as JSON arrays: 3 writes instead of 314, and the row count is verifiable at a
glance.

**Statistical confidence on every rate.** Each percentage carries its numerator, denominator
and a confidence band. Below five records the percentage is withheld entirely and the counts
are shown instead — "0 of 2", not "0%", because a ratio off two records is noise that looks
authoritative.

**Grounding the AI took four iterations.** Early versions dramatised: two overdue projects
became a "collapse", then a "crisis", and one run invented a prior-period comparison that was
demonstrably false. Three rounds of stricter prompt instructions didn't hold. What worked was
changing the input rather than the behaviour — suppressing the misleading percentage in code
so the model never saw it. Constraining what a model can see proved far more reliable than
instructing it how to behave.

## Known limitations

- **Schema drift is undetected.** A renamed source column means the fetch succeeds, the field
  maps to undefined, and the figure quietly becomes zero while the status still reads `ok`.
  First thing I would add.
- **No pagination.** Airtable returns 100 records per page; delivery currently has 74.
- **An empty response reads as a genuine zero.** A `200` with no rows is indistinguishable
  from a period that truly had none.
- **Year-to-date's comparison window is the weakest** — the preceding equal-length window, so
  seasonality isn't controlled for.
- **The engine is invoked three times per scheduled period** where once would do. Output is
  correct; the work is wasted.

## Running it locally

```bash
npm install
cp .env.example .env      # add your Supabase URL and anon key
vercel dev                # not `npm run dev` — the api/ routes need Vercel's runtime
```

| Variable | Where | Public? |
|---|---|---|
| `VITE_SUPABASE_URL` | browser + functions | yes, by design |
| `VITE_SUPABASE_ANON_KEY` | browser + functions | yes, by design — RLS is the gate |
| `N8N_CUSTOM_WEBHOOK_URL` | functions only | no |
| `N8N_WEBHOOK_SECRET` | functions only | no |

The n8n workflow exports are in [`workflows/`](workflows/). Import them into an n8n instance
and set the credentials for Google Sheets, Airtable, Supabase and Anthropic.

---

Built as part of StackShift's *Building Production-Ready Systems* programme.
