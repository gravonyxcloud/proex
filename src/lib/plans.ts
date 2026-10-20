import 'server-only';

import { cache } from 'react';

import { createAdminClient } from '@/lib/supabase/admin';
import type { Plan } from '@/types/db';

/**
 * Planos ativos em ordem de exibição.
 * `cache()` do React deduplica dentro de um mesmo request — landing e /precos
 * compartilham a consulta sem bater duas vezes no banco.
 */
export const getActivePlans = cache(async (): Promise<Plan[]> => {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('plans')
      .select('*')
      .eq('active', true)
      .order('sort', { ascending: true });

    if (error) throw error;
    return (data ?? []) as Plan[];
  } catch {
    // Sem service role configurada (build/preview), cai nos defaults do seed.
    return FALLBACK_PLANS;
  }
});

export const getPlan = cache(async (slug: string): Promise<Plan | null> => {
  const plans = await getActivePlans();
  return plans.find((p) => p.slug === slug) ?? null;
});

/** Espelha o seed do 0001_init.sql — mantido para a landing não quebrar
 *  em ambiente sem Supabase. O checkout SEMPRE lê o banco. */
export const FALLBACK_PLANS: Plan[] = [
  {
    slug: 'cc_3d', name: 'Claude Code · 3 dias', dias: 3, price_brl: 49,
    description: 'Para uma rodada de ajustes.', highlight: false, active: true, sort: 1,
    created_at: '', updated_at: '',
  },
  {
    slug: 'cc_7d', name: 'Claude Code · 7 dias', dias: 7, price_brl: 89,
    description: 'A semana inteira de trabalho.', highlight: false, active: true, sort: 2,
    created_at: '', updated_at: '',
  },
  {
    slug: 'cc_15d', name: 'Claude Code · 15 dias', dias: 15, price_brl: 159,
    description: 'Projeto longo, sem contar token.', highlight: false, active: true, sort: 3,
    created_at: '', updated_at: '',
  },
  {
    slug: 'cc_30d', name: 'Claude Code · 30 dias', dias: 30, price_brl: 279,
    description: 'Mês inteiro. Melhor custo por dia.', highlight: true, active: true, sort: 4,
    created_at: '', updated_at: '',
  },
];
