'use server';

import { revalidatePath } from 'next/cache';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { appSettingsSchema, withdrawalSchema } from '@/lib/schemas';
import type { ActionState } from '@/actions/plans';

async function requireAdmin(): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('Sessão expirada. Entre novamente.');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.role !== 'admin') throw new Error('Acesso restrito a administradores.');

  return user.email ?? 'admin';
}

/**
 * Grava as taxas da operação.
 *
 * Isso NÃO reescreve pagamentos antigos: `payments.fee_brl` é congelado no
 * momento em que a cobrança entra (ver handle-payment.ts). Mudar a taxa aqui
 * só afeta as estimativas daqui pra frente — é o que mantém o relatório de um
 * mês fechado igual para sempre.
 */
export async function saveSettings(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireAdmin();

    const parsed = appSettingsSchema.safeParse({
      store_name: formData.get('store_name'),
      mp_fee_percent: formData.get('mp_fee_percent'),
      mp_fee_fixed_brl: formData.get('mp_fee_fixed_brl'),
      tax_percent: formData.get('tax_percent'),
    });

    if (!parsed.success) return { ok: false, message: parsed.error.errors[0].message };

    const admin = createAdminClient();
    const { error } = await admin
      .from('app_settings')
      .update({
        store_name: parsed.data.store_name,
        mp_fee_percent: parsed.data.mp_fee_percent,
        mp_fee_fixed_brl: parsed.data.mp_fee_fixed_brl,
        tax_percent: parsed.data.tax_percent,
      })
      .eq('id', true);

    if (error) return { ok: false, message: error.message };

    revalidatePath('/admin/contabilidade');
    return { ok: true, message: 'Taxas salvas. Pagamentos já registrados não mudam.' };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Falha ao salvar.' };
  }
}

export async function addWithdrawal(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  try {
    const actor = await requireAdmin();

    const parsed = withdrawalSchema.safeParse({
      amount_brl: formData.get('amount_brl'),
      withdrawn_at: formData.get('withdrawn_at') || undefined,
      method: formData.get('method'),
      destination: formData.get('destination') || null,
      note: formData.get('note') || null,
    });

    if (!parsed.success) return { ok: false, message: parsed.error.errors[0].message };

    // Data pura -> meio-dia UTC: fica no dia certo exibido em qualquer fuso
    // de UTC-11 a UTC+11, sem o clássico "lançou dia 4, apareceu dia 3".
    const withdrawnAt = parsed.data.withdrawn_at
      ? new Date(`${parsed.data.withdrawn_at}T12:00:00.000Z`).toISOString()
      : new Date().toISOString();

    const admin = createAdminClient();
    const { error } = await admin.from('withdrawals').insert({
      amount_brl: parsed.data.amount_brl,
      withdrawn_at: withdrawnAt,
      method: parsed.data.method,
      destination: parsed.data.destination ?? null,
      note: parsed.data.note ?? null,
      actor,
    });

    if (error) return { ok: false, message: error.message };

    revalidatePath('/admin/contabilidade');
    return { ok: true, message: 'Saque lançado.' };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Falha ao lançar saque.' };
  }
}

export async function removeWithdrawal(id: string): Promise<ActionState> {
  try {
    await requireAdmin();

    if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, message: 'Saque inválido.' };

    const admin = createAdminClient();
    const { error } = await admin.from('withdrawals').delete().eq('id', id);

    if (error) return { ok: false, message: error.message };

    revalidatePath('/admin/contabilidade');
    return { ok: true, message: 'Saque removido do caixa.' };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Falha ao remover.' };
  }
}
