import { useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { getLatestRun } from './supabase';
import type { PeriodType } from './supabase';
import opsrLogo from './assets/opsr-logo.png';
import './App.css';

type Rate = { value: number | null; numerator: number; denominator: number;
              excluded: number; confidence: string; suppressed?: boolean };

const PERIODS: { key: PeriodType; label: string }[] = [
  { key: 'last_30', label: 'Last 30 days' },
  { key: 'last_90', label: 'Last 90 days' },
  { key: 'ytd',     label: 'Year to date' },
];

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
  const [period, setPeriod] = useState<PeriodType>('last_30');
  const [run, setRun] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setRun(null); setErr(null); setLoading(true);
    getLatestRun(period)
      .then(setRun)
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, [period]);

  const cur = run?.metrics_current ?? {};
  const pri = run?.metrics_prior ?? {};
  const ins = run?.insights ?? {};
  const st  = run?.source_status ?? {};

  return (
    <div className="wrap">
      <div className="topbar">
        <div className="brand">
          <img src={opsrLogo} alt="Opsr" className="brand-logo" />
          <h1>Koya Talent - Operations Report</h1>
          <p className="sub">
            {run
              ? `${run.period_start} to ${run.period_end} · last updated ${new Date(run.run_at).toLocaleString()}`
              : loading ? 'Loading…' : 'No report yet for this period'}
          </p>
        </div>
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
      </div>

      {err && <div className="banner">Could not load the report: {err}</div>}
      {loading && !err && <p className="state-msg">Loading…</p>}
      {!loading && !run && !err && (
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
