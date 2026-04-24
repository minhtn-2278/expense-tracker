import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { formatLocalDate, type Period } from '@/lib/time/period';

export interface CategoryTotal {
  categoryId: string;
  name: string;
  total: number;
}

export interface PeriodTotals {
  from: string;
  to: string;
  totalIncome: number;
  totalExpense: number;
  net: number;
  byCategory: {
    income: CategoryTotal[];
    expense: CategoryTotal[];
  };
}

/**
 * Aggregate the caller's transactions for the period containing `anchor`.
 * Delegates all bucketing to the Postgres `dashboard_totals` RPC so that
 * RLS applies naturally — the function is `security invoker` server-side.
 */
export async function aggregateForPeriod({
  period,
  anchor,
}: {
  period: Period;
  anchor: Date;
}): Promise<PeriodTotals> {
  const supabase = await createClient();

  const { data: user } = await supabase.auth.getUser();
  const userId = user.user?.id;

  // Resolve caller's timezone. Missing profile row (edge case) → VN default.
  let tz = 'Asia/Ho_Chi_Minh';
  if (userId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('timezone')
      .eq('id', userId)
      .maybeSingle();
    if (profile?.timezone) tz = profile.timezone;
  }

  const { data, error } = await supabase.rpc('dashboard_totals', {
    p_period: period,
    p_anchor: formatLocalDate(anchor, tz),
    p_tz: tz,
  });
  if (error) throw error;

  // RPC is typed as returning `Json` by the Supabase type generator; at
  // runtime it always returns the PeriodTotals shape declared in
  // 0005_dashboard_rpc.sql, so a bounce through `unknown` is the honest cast.
  return data as unknown as PeriodTotals;
}
