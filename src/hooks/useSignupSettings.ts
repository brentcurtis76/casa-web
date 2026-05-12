import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ChurchSignupSettings, SignupFormType } from '@/types/signups';

export type ClosedReason = 'manual' | 'cutoff' | 'capacity';

interface UseSignupSettingsResult {
  settings: ChurchSignupSettings | null;
  isClosed: boolean;
  closedReason: ClosedReason | null;
  loading: boolean;
}

const REASON_LABELS: Record<ClosedReason, string> = {
  manual: 'Las inscripciones están cerradas por ahora.',
  cutoff: 'El plazo de inscripción ha terminado.',
  capacity: 'Hemos llegado al cupo máximo de inscripciones.',
};

export function getClosedReasonLabel(reason: ClosedReason): string {
  return REASON_LABELS[reason];
}

export function useSignupSettings(formType: SignupFormType): UseSignupSettingsResult {
  const [settings, setSettings] = useState<ChurchSignupSettings | null>(null);
  const [currentCount, setCurrentCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      // The generated Supabase types don't yet include church_signup_settings,
      // so go through an untyped client handle and cast the row.
      const settingsClient = supabase as unknown as {
        from: (table: string) => {
          select: (cols: string) => {
            eq: (col: string, val: string) => {
              maybeSingle: () => Promise<{ data: ChurchSignupSettings | null; error: unknown }>;
            };
          };
        };
      };

      const settingsRes = await settingsClient
        .from('church_signup_settings')
        .select('*')
        .eq('form_type', formType)
        .maybeSingle();

      // Count non-cancelled signups for capacity. RLS blocks anon SELECT on
      // church_signups, which means anon callers get count === 0 (the row
      // bodies stay hidden — no PII exposure). Authenticated admins see the
      // real count. Server-side enforcement lives in the public-signup edge
      // function.
      const countRes = await supabase
        .from('church_signups')
        .select('id', { head: true, count: 'exact' })
        .eq('form_type', formType)
        .neq('status', 'cancelled');

      if (cancelled) return;

      setSettings(settingsRes.data ?? null);
      setCurrentCount(typeof countRes.count === 'number' ? countRes.count : null);
      setLoading(false);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [formType]);

  let closedReason: ClosedReason | null = null;

  if (settings) {
    if (!settings.is_open) {
      closedReason = 'manual';
    } else if (settings.cutoff_at && new Date(settings.cutoff_at).getTime() <= Date.now()) {
      closedReason = 'cutoff';
    } else if (
      settings.max_capacity !== null &&
      currentCount !== null &&
      currentCount >= settings.max_capacity
    ) {
      closedReason = 'capacity';
    }
  }

  return {
    settings,
    isClosed: closedReason !== null,
    closedReason,
    loading,
  };
}
