import type { VercelRequest, VercelResponse } from '@vercel/node';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_SPAN_DAYS = 400;
const MS_PER_DAY = 86_400_000;

function isValidCalendarDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const ms = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(ms)) return false;
  // Date.parse normalizes out-of-range days/months (e.g. 2026-02-30 becomes
  // 2026-03-02) instead of rejecting them — round-tripping back to the same
  // string is what actually catches that.
  return new Date(ms).toISOString().slice(0, 10) === value;
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

type ValidatedRange = { period_start: string; period_end: string };

// Returns an error message string on failure, or the validated range on
// success. Deliberately not a { ok: boolean } discriminated union — Vercel's
// isolated type-check of /api files (separate from our own tsc -b, which
// passes clean) has failed to narrow that pattern in practice. A plain
// typeof check is about as basic as narrowing gets, so it's used here
// defensively rather than to satisfy any particular checker's quirks.
function validateBody(body: unknown): string | ValidatedRange {
  if (typeof body !== 'object' || body === null) {
    return 'Request body must be a JSON object.';
  }
  const { period_start, period_end } = body as Record<string, unknown>;

  if (typeof period_start !== 'string' || typeof period_end !== 'string' || !period_start || !period_end) {
    return 'period_start and period_end are required strings.';
  }
  if (!DATE_RE.test(period_start) || !DATE_RE.test(period_end)) {
    return 'Dates must be in YYYY-MM-DD format.';
  }
  if (!isValidCalendarDate(period_start)) {
    return `period_start (${period_start}) is not a valid calendar date.`;
  }
  if (!isValidCalendarDate(period_end)) {
    return `period_end (${period_end}) is not a valid calendar date.`;
  }
  if (period_start > period_end) {
    return 'period_start must not be after period_end.';
  }

  const spanDays = Math.round(
    (Date.parse(`${period_end}T00:00:00Z`) - Date.parse(`${period_start}T00:00:00Z`)) / MS_PER_DAY
  ) + 1;
  if (spanDays > MAX_SPAN_DAYS) {
    return `Range cannot exceed ${MAX_SPAN_DAYS} days (requested ${spanDays}).`;
  }

  if (period_end > todayUTC()) {
    return 'period_end cannot be in the future.';
  }

  return { period_start, period_end };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed. Use POST.' });
    return;
  }

  const result = validateBody(req.body);
  if (typeof result === 'string') {
    res.status(400).json({ error: result });
    return;
  }
  const { period_start, period_end } = result;

  const webhookUrl = process.env.N8N_CUSTOM_WEBHOOK_URL;
  const webhookSecret = process.env.N8N_WEBHOOK_SECRET;

  if (!webhookUrl || !webhookSecret) {
    // Deliberately generic — never state which var is missing or echo either value.
    console.error('run-report: server is missing required webhook configuration');
    res.status(500).json({ error: 'Server is not configured to run reports.' });
    return;
  }

  try {
    const n8nRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-report-secret': webhookSecret,
      },
      body: JSON.stringify({ period_start, period_end }),
    });

    if (!n8nRes.ok) {
      console.error('run-report: webhook responded with a non-2xx status', n8nRes.status);
      res.status(502).json({ error: 'The report worker could not accept this request. Please try again.' });
      return;
    }
  } catch {
    // Deliberately not logging the caught error's message: a fetch failure
    // to an unreachable host can embed the target URL in its message.
    console.error('run-report: webhook request failed');
    res.status(502).json({ error: 'Could not reach the report worker. Please try again.' });
    return;
  }

  res.status(202).json({ accepted: true });
}
