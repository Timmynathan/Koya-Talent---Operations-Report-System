import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { getLatestRun, getCustomRun, supabase } from './supabase';
import type { PeriodType } from './supabase';
import { useSession } from './useSession';
import SignIn from './SignIn';
import opsrLogo from './assets/opsr-logo.png';
import './App.css';

type Rate = { value: number | null; numerator: number; denominator: number;
              excluded: number; confidence: string; suppressed?: boolean };

const PERIODS: { key: PeriodType; label: string }[] = [
  { key: 'last_30', label: 'Last 30 days' },
  { key: 'last_90', label: 'Last 90 days' },
  { key: 'ytd',     label: 'Year to date' },
  { key: 'custom',  label: 'Custom range' },
];

const CUSTOM_MAX_SPAN_DAYS = 400;

function validateCustomRange(start: string, end: string): string | null {
  if (!start || !end) return 'Both dates are required.';
  if (start > end) return 'Start date must not be after end date.';
  const todayStr = new Date().toISOString().slice(0, 10);
  if (end > todayStr) return 'End date cannot be in the future.';
  const spanDays = Math.round(
    (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000
  ) + 1;
  if (spanDays > CUSTOM_MAX_SPAN_DAYS) return `Range cannot exceed ${CUSTOM_MAX_SPAN_DAYS} days.`;
  return null;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const isRate = (v: any): v is Rate =>
  v && typeof v === 'object' && 'denominator' in v;

const money = (n: number) =>
  'USD ' + n.toLocaleString('en-US', { maximumFractionDigits: 2 });

const IconDollar = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="12" y1="2" x2="12" y2="22" /><path d="M17 5.5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);
const IconUserPlus = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
    <line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" />
  </svg>
);
const IconUsers = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const IconCheck = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);
const IconCalendar = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="3" />
    <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);
const IconSparkle = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2l1.7 5.6L19 9l-5.3 1.4L12 16l-1.7-5.6L5 9l5.3-1.4L12 2z" />
  </svg>
);
const IconPin = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="5" />
    <line x1="12" y1="13" x2="12" y2="21" />
  </svg>
);

function Tile({ label, cur, prior, unit, variant = 'default', icon, caption }: {
  label: string; cur: any; prior: any; unit?: 'money' | 'pct' | 'days';
  variant?: 'default' | 'kpi' | 'row'; icon?: ReactNode; caption?: string;
}) {

  if (cur === null || cur === undefined) {
    if (variant === 'kpi') {
      return (
        <div className="kpi-card">
          {icon && <div className="icon">{icon}</div>}
          <div className="kpi-label">{label}</div>
          <div className="kpi-figure">
            <span className="kpi-value" style={{ color: 'var(--ink-3)', fontSize: '1.1rem' }}>
              Data unavailable
            </span>
          </div>
          {caption && <div className="kpi-caption">{caption}</div>}
        </div>
      );
    }
    if (variant === 'row') {
      return (
        <div className="stat-row">
          <span className="stat-row-label">{label}</span>
          <span className="stat-row-value" style={{ color: 'var(--ink-3)' }}>Data unavailable</span>
        </div>
      );
    }
    return (
      <div className="tile">
        <div className="label">{label}</div>
        <div className="value" style={{ color: 'var(--ink-3)', fontSize: '1rem' }}>
          Data unavailable
        </div>
      </div>
    );
  }

  let value: string, basis: string | null = null, curNum: number | null = null;

  if (isRate(cur)) {
    curNum = cur.value;
    value = cur.suppressed || cur.value === null
      ? `${cur.numerator} of ${cur.denominator}`
      : `${cur.value}%`;
    basis = cur.suppressed
      ? `Percentage withheld: ${cur.denominator} records is not sufficient to report a reliable percentage.`
      : `${cur.numerator} of ${cur.denominator}` +
        (cur.excluded ? ` · ${cur.excluded} excluded` : '');
  } else {
    curNum = typeof cur === 'number' ? cur : null;
    value = unit === 'money' ? money(cur)
          : unit === 'days'  ? `${cur} days`
          : String(cur);
  }

  const priorNum = isRate(prior) ? prior.value : (typeof prior === 'number' ? prior : null);
  const cls: 'up' | 'down' | 'flat' | null =
    curNum !== null && priorNum !== null
      ? (Math.abs(curNum - priorNum) < 0.05 ? 'flat' : curNum - priorNum > 0 ? 'up' : 'down')
      : null;
  const diff = curNum !== null && priorNum !== null ? curNum - priorNum : null;
  const shown = diff !== null
    ? (unit === 'money' ? money(Math.abs(diff)) : Math.abs(Math.round(diff * 10) / 10).toString())
    : null;

  if (variant === 'kpi') {
    return (
      <div className="kpi-card">
        {icon && <div className="icon">{icon}</div>}
        <div className="kpi-label">{label}</div>
        <div className="kpi-figure">
          <span className="kpi-value">{value}</span>
          {cls && (
            <span className={`pill ${cls === 'flat' ? 'flat' : cls === 'up' ? 'pos' : 'neg'}`}>
              {cls === 'flat' ? 'Unchanged' : `${cls === 'up' ? '▲' : '▼'} ${shown}`}
            </span>
          )}
        </div>
        {caption && <div className="kpi-caption">{caption}</div>}
        {basis && <div className="kpi-caption">{basis}</div>}
      </div>
    );
  }

  if (variant === 'row') {
    return (
      <div className="stat-row">
        <span className="stat-row-label">{label}</span>
        <span className="stat-row-figures">
          <span className="stat-row-value">{value}</span>
          {cls && (
            <span className={`stat-row-delta ${cls}`}>
              {cls === 'flat' ? 'Unchanged' : `${cls === 'up' ? '▲' : '▼'} ${shown}`}
            </span>
          )}
        </span>
      </div>
    );
  }

  let delta: ReactElement | null = null;
  if (cls) {
    delta = (
      <div className={`delta ${cls}`}>
        {cls === 'flat'
          ? 'Unchanged'
          : `${cls === 'up' ? '▲ Up' : '▼ Down'} ${shown} vs prior`}
      </div>
    );
  }

  return (
    <div className="tile">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {basis && <div className="basis">{basis}</div>}
      {delta}
    </div>
  );
}

function MetricRing({ label, cur, prior }: { label: string; cur: any; prior: any }) {
  if (cur === null || cur === undefined) {
    return (
      <div className="ring-wrap">
        <div className="ring-gauge dashed"><div className="hole"><span className="ring-na">N/A</span></div></div>
        <div className="ring-label">{label}</div>
      </div>
    );
  }

  if (!isRate(cur)) {
    return (
      <div className="ring-wrap">
        <div className="ring-gauge dashed"><div className="hole"><span className="ring-pct">{String(cur)}</span></div></div>
        <div className="ring-label">{label}</div>
      </div>
    );
  }

  const suppressed = !!cur.suppressed || cur.value === null;
  const pct = cur.value;
  const priorPct = isRate(prior) ? prior.value : null;
  const cls: 'up' | 'down' | 'flat' | null =
    pct !== null && priorPct !== null
      ? (Math.abs(pct - priorPct) < 0.05 ? 'flat' : pct - priorPct > 0 ? 'up' : 'down')
      : null;

  return (
    <div className="ring-wrap">
      <div className={`ring-gauge${suppressed ? ' dashed' : ''}`}>
        {!suppressed && (
          <div
            className="ring-fill"
            style={{ background: `conic-gradient(var(--ink) 0% ${pct}%, var(--surface-2) ${pct}% 100%)` }}
          />
        )}
        <div className="hole">
          {suppressed
            ? <span className="ring-count">{cur.numerator} of {cur.denominator}</span>
            : <span className="ring-pct">{pct}%</span>}
        </div>
      </div>
      <div className="ring-label">{label}</div>
      {cls && (
        <div className={`delta ${cls}`}>
          {cls === 'flat' ? 'Unchanged' : `${cls === 'up' ? '▲ Up' : '▼ Down'} vs prior`}
        </div>
      )}
    </div>
  );
}

function Section({ title, status, ring, children }:
  { title: string; status: string; ring: ReactNode; children: React.ReactNode }) {
  return (
    <div className="panel section-panel">
      <div className="panel-head"><h2>{title}</h2></div>
      {status !== 'ok'
        ? (
          <div className="banner">
            {title} data was unavailable for this run. These figures are not shown
            rather than shown as zero.
          </div>
        )
        : (
          <>
            {ring}
            <div className="stat-rows">{children}</div>
          </>
        )}
    </div>
  );
}

export default function App() {
  const session = useSession();
  const userId = session?.user?.id ?? null;

  const [period, setPeriod] = useState<PeriodType>('last_30');
  const [run, setRun] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [customPhase, setCustomPhase] =
    useState<'idle' | 'checking' | 'submitting' | 'polling' | 'timeout'>('idle');
  const [customError, setCustomError] = useState<string | null>(null);
  const pollAbortRef = useRef(false);
  const submittedAtRef = useRef<number | null>(null);

  useEffect(() => {
    // Switching periods (including into or out of "custom") invalidates
    // whatever poll loop might be in flight for the previous selection.
    // Also keyed on userId: signing out clears whatever is on screen, and
    // signing back in (without a full page reload) forces a fresh fetch
    // instead of leaving the previous user's stale snapshot state around.
    pollAbortRef.current = true;
    setCustomPhase('idle');
    setCustomError(null);
    setRun(null); setErr(null);

    if (!userId || period === 'custom') {
      // Not signed in, or custom range is driven by the date form rather
      // than fetched automatically — either way, nothing to fetch yet.
      setLoading(false);
      return;
    }

    setLoading(true);
    getLatestRun(period)
      .then(setRun)
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, [period, userId]);

  useEffect(() => {
    return () => { pollAbortRef.current = true; };
  }, []);

  async function handleCustomSubmit(forceRecompute: boolean) {
    const validationMessage = validateCustomRange(customStart, customEnd);
    if (validationMessage) { setCustomError(validationMessage); return; }
    setCustomError(null);

    if (!forceRecompute) {
      setCustomPhase('checking');
      try {
        const existing = await getCustomRun(customStart, customEnd);
        if (existing) {
          setRun(existing);
          setCustomPhase('idle');
          return;
        }
      } catch (e: any) {
        setCustomPhase('idle');
        setCustomError(e?.message ?? 'Could not check for an existing snapshot.');
        return;
      }
    }

    setCustomPhase('submitting');
    const submittedAt = Date.now();
    try {
      const res = await fetch('/api/run-report', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(session?.access_token ? { authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ period_start: customStart, period_end: customEnd }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}) as any);
        throw new Error(body.error ?? `Request failed (${res.status}).`);
      }
    } catch (e: any) {
      setCustomPhase('idle');
      setCustomError(e?.message ?? 'Could not start the report run.');
      return;
    }

    submittedAtRef.current = submittedAt;
    pollAbortRef.current = false;
    setCustomPhase('polling');

    const deadline = submittedAt + 120_000;
    while (Date.now() < deadline) {
      await sleep(2000);
      if (pollAbortRef.current) return;
      try {
        const found = await getCustomRun(customStart, customEnd);
        if (pollAbortRef.current) return;
        if (found && new Date(found.run_at).getTime() > submittedAt) {
          setRun(found);
          setCustomPhase('idle');
          return;
        }
      } catch {
        // Transient poll error — keep trying until the deadline.
      }
    }
    if (!pollAbortRef.current) setCustomPhase('timeout');
  }

  async function handleCheckAgain() {
    if (submittedAtRef.current == null) return;
    setCustomPhase('checking');
    try {
      const found = await getCustomRun(customStart, customEnd);
      if (found && new Date(found.run_at).getTime() > submittedAtRef.current) {
        setRun(found);
        setCustomPhase('idle');
      } else {
        setCustomPhase('timeout');
      }
    } catch (e: any) {
      setCustomPhase('timeout');
      setCustomError(e?.message ?? 'Could not check for the snapshot.');
    }
  }

  function handleCustomStartChange(value: string) {
    setCustomStart(value);
    setRun(null);
    setCustomPhase('idle');
    setCustomError(null);
  }

  function handleCustomEndChange(value: string) {
    setCustomEnd(value);
    setRun(null);
    setCustomPhase('idle');
    setCustomError(null);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    // useSession's onAuthStateChange fires with session = null, which
    // unmounts the dashboard in favor of <SignIn/> — but also clear the
    // snapshot explicitly so a sign-in-again-without-reload doesn't
    // briefly flash the previous session's figures before refetching.
    setRun(null);
    setErr(null);
  }

  if (session === undefined) {
    // Still checking for an existing session — a neutral placeholder,
    // never the login form, so an already-signed-in user never sees it flash.
    return <div className="auth-checking" role="status" aria-live="polite">
      <span className="sr-only">Loading…</span>
    </div>;
  }

  if (session === null) {
    return <SignIn />;
  }

  const cur = run?.metrics_current ?? {};
  const pri = run?.metrics_prior ?? {};
  const ins = run?.insights ?? {};
  const st  = run?.source_status ?? {};

  const isCustomBusy = customPhase === 'checking' || customPhase === 'submitting' || customPhase === 'polling';
  const customValidationMessage = validateCustomRange(customStart, customEnd);
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="wrap">
      <div className="topbar">
        <div className="brand">
          <img src={opsrLogo} alt="Opsr" className="brand-logo" />
          <h1>Koya Talent - Operations Report</h1>
          <p className="sub">
            {run
              ? `${run.period_start} to ${run.period_end} · last updated ${new Date(run.run_at).toLocaleString()}`
              : period === 'custom'
                ? (customPhase === 'checking' ? 'Checking for an existing snapshot…'
                  : customPhase === 'submitting' ? 'Starting the report run…'
                  : customPhase === 'polling' ? 'Computing… this pulls three sources and can take up to a minute.'
                  : customPhase === 'timeout' ? 'Still computing — this is taking longer than expected.'
                  : 'Choose a date range to run a custom report.')
                : loading ? 'Loading…' : 'No report yet for this period'}
          </p>
        </div>
        <div className="topbar-right">
          <div className="period-control">
            <span className="period-icon"><IconCalendar /></span>
            <div className="segmented">
              {PERIODS.map(p => (
                <button key={p.key} aria-pressed={period === p.key} onClick={() => setPeriod(p.key)}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <button className="signout-btn" onClick={handleSignOut}>Sign out</button>
        </div>
      </div>

      {period === 'custom' && (
        <div className="custom-range">
          <div className="custom-range-fields">
            <label className="custom-field">
              <span>Start date</span>
              <input
                type="date"
                value={customStart}
                max={todayStr}
                onChange={e => handleCustomStartChange(e.target.value)}
              />
            </label>
            <label className="custom-field">
              <span>End date</span>
              <input
                type="date"
                value={customEnd}
                max={todayStr}
                onChange={e => handleCustomEndChange(e.target.value)}
              />
            </label>
            <button
              className="custom-run-btn"
              disabled={isCustomBusy || !!customValidationMessage}
              onClick={() => handleCustomSubmit(!!run)}
            >
              {isCustomBusy ? 'Working…' : run ? 'Recompute' : 'Run report'}
            </button>
            {customPhase === 'timeout' && (
              <button className="custom-check-btn" onClick={handleCheckAgain}>Check again</button>
            )}
          </div>

          {customValidationMessage && (customStart || customEnd) && !isCustomBusy && (
            <p className="custom-hint">{customValidationMessage}</p>
          )}
          {customError && <div className="banner">{customError}</div>}
          {customPhase === 'timeout' && !customError && (
            <div className="banner">
              This is taking longer than expected. The snapshot may still appear shortly — feel free to check again.
            </div>
          )}
        </div>
      )}

      {err && <div className="banner">Could not load the report: {err}</div>}
      {loading && !err && <p className="state-msg">Loading…</p>}
      {!loading && !run && !err && period !== 'custom' && (
        <p className="state-msg">No report has been generated for this period yet.</p>
      )}

      {run && (
        <div className="report" key={period + run.run_at}>
          <div className="kpi-row">
            <Tile variant="kpi" icon={<IconDollar />} label="Revenue won"
              cur={st.sales === 'ok' ? cur.sales?.revenue_won : undefined}
              prior={st.sales === 'ok' ? pri.sales?.revenue_won : undefined}
              unit="money" caption="Closed-won revenue this period" />
            <Tile variant="kpi" icon={<IconUserPlus />} label="Total leads"
              cur={st.sales === 'ok' ? cur.sales?.total_leads : undefined}
              prior={st.sales === 'ok' ? pri.sales?.total_leads : undefined}
              caption="New pipeline entries this period" />
            <Tile variant="kpi" icon={<IconCheck />} label="On-time rate"
              cur={st.delivery === 'ok' ? cur.delivery?.on_time_rate : undefined}
              prior={st.delivery === 'ok' ? pri.delivery?.on_time_rate : undefined}
              caption="Projects completed on schedule" />
            <Tile variant="kpi" icon={<IconUsers />} label="Headcount"
              cur={st.people === 'ok' ? cur.people?.active_headcount : undefined}
              prior={st.people === 'ok' ? pri.people?.active_headcount : undefined}
              caption="Active headcount at period end" />
          </div>

          {ins.executive_summary && (
            <div className="ai-glow-ring">
              <div className="panel summary">
                <div className="panel-head">
                  <h2>Executive summary</h2>
                  <span className="ai-badge"><IconSparkle /> AI generated</span>
                </div>
                <p>{ins.executive_summary}</p>
              </div>
            </div>
          )}

          <div className="sections-grid">
            <Section title="Sales" status={st.sales}
              ring={<MetricRing label="Win rate" cur={cur.sales?.win_rate} prior={pri.sales?.win_rate} />}>
              <Tile variant="row" label="Total leads"     cur={cur.sales?.total_leads}     prior={pri.sales?.total_leads} />
              <Tile variant="row" label="Closed won"      cur={cur.sales?.closed_won}      prior={pri.sales?.closed_won} />
              <Tile variant="row" label="Closed lost"     cur={cur.sales?.closed_lost}     prior={pri.sales?.closed_lost} />
              <Tile variant="row" label="Revenue won"     cur={cur.sales?.revenue_won}     prior={pri.sales?.revenue_won} unit="money" />
              <Tile variant="row" label="Pipeline value"  cur={cur.sales?.pipeline_value}  prior={pri.sales?.pipeline_value} unit="money" />
              <Tile variant="row" label="Marketing spend" cur={cur.sales?.marketing_spend} prior={pri.sales?.marketing_spend} unit="money" />
              <Tile variant="row" label="Cost per lead"   cur={cur.sales?.cost_per_lead}   prior={pri.sales?.cost_per_lead} unit="money" />
            </Section>

            <Section title="Project delivery" status={st.delivery}
              ring={<MetricRing label="On-time rate" cur={cur.delivery?.on_time_rate} prior={pri.delivery?.on_time_rate} />}>
              <Tile variant="row" label="Open at period end" cur={cur.delivery?.open_projects}      prior={pri.delivery?.open_projects} />
              <Tile variant="row" label="Completed"          cur={cur.delivery?.completed_projects} prior={pri.delivery?.completed_projects} />
              <Tile variant="row" label="Blocked"            cur={cur.delivery?.blocked_projects}   prior={pri.delivery?.blocked_projects} />
              <Tile variant="row" label="Overdue and open"   cur={cur.delivery?.overdue_open}       prior={pri.delivery?.overdue_open} />
              <Tile variant="row" label="Average delay"      cur={cur.delivery?.average_delay_days} prior={pri.delivery?.average_delay_days} unit="days" />
              <Tile variant="row" label="Budget variance"    cur={cur.delivery?.budget_variance}    prior={pri.delivery?.budget_variance} unit="money" />
              <Tile variant="row" label="Over budget"        cur={cur.delivery?.over_budget}        prior={pri.delivery?.over_budget} />
            </Section>

            <Section title="People ops" status={st.people}
              ring={<MetricRing label="Attrition rate" cur={cur.people?.attrition_rate} prior={pri.people?.attrition_rate} />}>
              <Tile variant="row" label="Applications"    cur={cur.people?.applications}       prior={pri.people?.applications} />
              <Tile variant="row" label="Offers accepted" cur={cur.people?.offers_accepted}    prior={pri.people?.offers_accepted} />
              <Tile variant="row" label="New hires"       cur={cur.people?.new_hires}          prior={pri.people?.new_hires} />
              <Tile variant="row" label="Exits"           cur={cur.people?.exits}              prior={pri.people?.exits} />
              <Tile variant="row" label="Headcount at period end" cur={cur.people?.active_headcount} prior={pri.people?.active_headcount} />
              <Tile variant="row" label="Time to hire"    cur={cur.people?.time_to_hire_days}  prior={pri.people?.time_to_hire_days} unit="days" />
              <Tile variant="row" label="Offer acceptance" cur={cur.people?.offer_accept_days} prior={pri.people?.offer_accept_days} unit="days" />
            </Section>
          </div>

          {ins.risks?.length > 0 && (
            <div className="panel risk-panel">
              <div className="panel-head"><h2>Risks and anomalies</h2></div>
              <div className="card-grid">
                {ins.risks.map((r: any, i: number) => (
                  <div className="risk-card" data-severity={r.severity} key={i}>
                    <span className={`chip ${r.severity}`}>{r.severity}</span>
                    <strong>{r.title}</strong>
                    <p>{r.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {ins.recommended_actions?.length > 0 && (
            <div className="panel action-panel">
              <div className="panel-head"><h2>Recommended actions</h2></div>
              <div className="card-grid">
                {ins.recommended_actions.map((a: any, i: number) => (
                  <div className="action-card" key={i}>
                    <span className="action-index">{i + 1}</span>
                    <div className="action-body">
                      <strong>{a.action}</strong>
                      <p>{a.why}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="paper-wrap">
            <div className="paper-sheet">
              <span className="paper-pin"><IconPin /></span>
              <div className="panel-head"><h2>Data quality</h2></div>
              <div className="dq-list">
                {(ins.data_quality_notes ?? []).map((n: string, i: number) => (
                  <div className="dq-row" key={`n${i}`}>
                    <span className="dq-dot" />
                    <span>{n}</span>
                  </div>
                ))}
                {(run.data_quality ?? []).map((d: any, i: number) => (
                  <div className="dq-row" key={`d${i}`}>
                    <span className="dq-source">{d.source}</span>
                    <span>{d.issue}{d.count !== null ? ` (${d.count})` : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
