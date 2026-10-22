import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import type { AppSettings } from '@/types/db';

/**
 * Taxas da operação.
 *
 * Regra de ouro (ver supabase/migrations/*_0003_contabilidade_e_email.sql):
 * `payments.amount_brl` é sempre o BRUTO cobrado; a taxa é DERIVADA, mas fica
 * gravada em `payments.fee_brl` no momento da cobrança para que editar
 * `app_settings.mp_fee_percent` amanhã não reescreva o relatório de ontem.
 */

export const FALLBACK_SETTINGS: AppSettings = {
  id: true,
  store_name: 'Proex',
  mp_fee_percent: 4.99,
  mp_fee_fixed_brl: 0,
  tax_percent: 0,
  updated_at: new Date(0).toISOString(),
};

export type FeeSource = 'mercadopago' | 'estimada';

export interface ResolvedFee {
  feeBrl: number;
  source: FeeSource;
}

/** Subconjunto do pagamento do MP que interessa para descobrir a taxa. */
export interface FeeFacts {
  transaction_amount?: number;
  fee_details?: { type?: string; amount?: number; fee_payer?: string }[];
  transaction_details?: { net_received_amount?: number } | null;
}

const centavos = (n: number) => Math.round(n * 100) / 100;

export async function loadSettings(): Promise<AppSettings> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from('app_settings')
      .select('*')
      .eq('id', true)
      .maybeSingle();

    // A migration cria a linha; se por algum motivo não existir (banco antigo
    // ou RLS trocada), os defaults mantêm o cálculo de pé em vez de estourar.
    return (data as AppSettings | null) ?? FALLBACK_SETTINGS;
  } catch {
    return FALLBACK_SETTINGS;
  }
}

/** Taxa estimada pelas configurações: % sobre o bruto + fixo por transação. */
export function estimateFee(amountBrl: number, settings: AppSettings): number {
  if (!Number.isFinite(amountBrl) || amountBrl <= 0) return 0;
  const bruto = (amountBrl * Number(settings.mp_fee_percent)) / 100;
  const taxa = bruto + Number(settings.mp_fee_fixed_brl);
  // Taxa nunca pode passar do valor cobrado — arredonda para baixo nesse caso.
  return centavos(Math.min(taxa, amountBrl));
}

/** O pagamento já traz a taxa real? Evita ir ao banco buscar app_settings. */
export function hasRealFee(facts: FeeFacts): boolean {
  const detalhadas = (facts.fee_details ?? []).filter(
    (f) => (f.fee_payer ?? 'collector') !== 'payer' && Number(f.amount) > 0,
  );
  if (detalhadas.length > 0) return true;

  const liquido = facts.transaction_details?.net_received_amount;
  const bruto = Number(facts.transaction_amount ?? 0);
  return typeof liquido === 'number' && liquido >= 0 && liquido < bruto;
}

/**
 * Taxa real cobrada pelo Mercado Pago, com dois caminhos:
 *  1. `fee_details` — o detalhamento. Só contam as parcelas absorvidas pelo
 *     vendedor (`fee_payer = 'collector'`); tarifa paga pelo comprador (ex.:
 *     `coupon_fee`) não é custo nosso.
 *  2. `transaction_details.net_received_amount` — líquido creditado; a
 *     diferença para o bruto é a taxa, mas só serve quando for positiva.
 *
 * Sem nenhum dos dois (webhook antigo, reprocessamento manual, PIX sem
 * detalhamento), cai na estimativa por `app_settings`.
 */
export function resolveFee(
  facts: FeeFacts,
  amountBrl: number,
  settings: AppSettings,
): ResolvedFee {
  const bruto = Number.isFinite(amountBrl) ? amountBrl : Number(facts.transaction_amount ?? 0);

  const detalhadas = (facts.fee_details ?? []).filter(
    (f) => (f.fee_payer ?? 'collector') !== 'payer' && Number(f.amount) > 0,
  );
  if (detalhadas.length > 0) {
    const soma = detalhadas.reduce((acc, f) => acc + Number(f.amount), 0);
    return { feeBrl: centavos(Math.min(soma, bruto)), source: 'mercadopago' };
  }

  const liquido = facts.transaction_details?.net_received_amount;
  if (typeof liquido === 'number' && liquido >= 0 && liquido < bruto) {
    return { feeBrl: centavos(bruto - liquido), source: 'mercadopago' };
  }

  return { feeBrl: estimateFee(bruto, settings), source: 'estimada' };
}
