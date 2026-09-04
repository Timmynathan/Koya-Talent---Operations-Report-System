import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export type PeriodType = 'last_30' | 'last_90' | 'ytd' | 'custom';

export async function getLatestRun(periodType: PeriodType) {
  const { data, error } = await supabase
    .from('report_runs')
    .select('*')
    .eq('period_type', periodType)
    .order('run_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getCustomRun(periodStart: string, periodEnd: string) {
  const { data, error } = await supabase
    .from('report_runs')
    .select('*')
    .eq('period_type', 'custom')
    .eq('period_start', periodStart)
    .eq('period_end', periodEnd)
    .order('run_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}