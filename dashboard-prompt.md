# Dashboard build prompt — for Claude Code

Paste the block below into Claude Code, with `week2-handoff.md` in the same project
folder so it can read the full context.

---

```
I'm building the dashboard for a reporting system. Read week2-handoff.md in this
folder first — it has the full project context, the Supabase schema, and the
design decisions already made.

WHAT EXISTS
- An n8n workflow writes one row per report run to a Supabase table `report_runs`.
- That row has: period_type ('last_30' | 'last_90' | 'ytd' | 'custom'), period_start,
  period_end, prior_start, prior_end, run_at, triggered_by, and five JSONB columns:
  source_status, metrics_current, metrics_prior, insights, data_quality.
- A Vite + React + TypeScript app is scaffolded with @supabase/supabase-js installed,
  a .env holding VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, and src/supabase.ts
  exporting getLatestRun(periodType).

WHAT I NEED
Finish the dashboard. It reads from Supabase and renders; it must never calculate
anything itself — every number is computed in the workflow, and two places doing the
same arithmetic will eventually disagree.

Required on the page:
- A period selector (Last 30 days / Last 90 days / Year to date). Changing it refetches.
- The reporting period dates and a "last updated" timestamp from run_at.
- Three metric sections: Sales, Project Delivery, People Ops, each a grid of stat tiles.
- Each tile shows the current value and its change against metrics_prior.
- The AI executive summary, risks (with severity), recommended actions, and data quality
  notes, all from the insights column.

FOUR RENDERING RULES THAT MATTER MORE THAN THE STYLING
1. Rate metrics arrive as objects: { value, numerator, denominator, excluded,
   confidence, suppressed }. When suppressed is true, value is null — render the
   counts ("0 of 2") and never a percentage. When it's not suppressed, show the
   percentage AND the denominator underneath, e.g. "60% — 3 of 5".
2. A null metric means the source was unavailable. Render "Data unavailable", never
   zero, never a dash that could read as nil.
3. source_status is { sales, delivery, people }. If any is not "ok", that section
   shows a prominent banner saying that data was unavailable for this run, and its
   tiles are not rendered.
4. Distinguish "loading" from "no data". A period with no snapshot yet should say so,
   not hang on a spinner.

DESIGN
Clean and readable, not flashy — this is an internal ops report for a manager with
thirty seconds. Light and dark mode via prefers-color-scheme, tokens for colour, no
CSS framework needed. Severity chips should use status colours (high/medium/low) with
the word visible, never colour alone. Tabular numerals on figures.

Then deploy it to Vercel and give me the URL. Before deploying, confirm that querying
the `source_records` table with the anon key returns nothing — RLS should block it,
and I need to verify that rather than assume it.
```

---

## Two things to check when it's finished

These are the ones an assistant is most likely to get subtly wrong.

**Check it isn't computing percentages.** Given `numerator` and `denominator` it may
helpfully calculate a rate for the suppressed ones — which is exactly what four rounds
of prompt engineering on the workflow side were spent preventing. A suppressed rate must
render as counts only.

**Check nulls.** `0` and `null` are both falsy in careless JSX, and a delivery section
showing zeros when Airtable was down is precisely the failure mode this project is
built against. Null means "we don't know"; zero means "we know, and it's none."

## Expected behaviour once it runs

Clicking through the three periods:

- **Sales and People figures change** — total leads roughly 9 → 24 → 48 as the window widens
- **Open projects (12) and headcount (81) stay identical** across all three, because every
  period ends on 30 June and those are measured at period end

The second pattern looks like a bug and isn't. Being able to explain why is worth
saying out loud in the demo video.
