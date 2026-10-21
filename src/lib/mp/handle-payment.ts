import 'server-only';

import { activateLicense, LicenseApiError, renewLicense } from '@/lib/license-api';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Order, OrderStatus } from '@/types/db';

/** `sk-px-...abcd` — só para listas. A chave completa fica só na linha da licença. */
export function keyHint(key: string): string {
  if (key.length <= 12) return key;
  return `${key.slice(0, 7)}…${key.slice(-4)}`;
}

/**
 * Vencimento devolvido pelo gateway, com fallback pelo plano.
 * A resposta vem envolvida: `{ license: { expiresAt } }`, e `expiresAt` e
 * `null` quando a chave nao expira.
 */
export function expiresFrom(
  expiresAt: string | null | undefined,
  fallbackDays: number,
): string {
  if (expiresAt) {
    const d = new Date(expiresAt);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date(Date.now() + Math.max(1, fallbackDays) * 86_400_000).toISOString();
}

// pending, in_process e rejected podem avancar para approved (um PIX pago
// depois do vencimento do QR, ou um cartao recusado que depois passa).
const APPROVABLE: OrderStatus[] = ['pending', 'in_process', 'rejected'];

export interface PaymentFacts {
  id: string;
  status?: string;
  status_detail?: string;
  external_reference?: string;
  payment_method_id?: string;
  transaction_amount?: number;
  installments?: number;
  date_approved?: string | null;
}

export interface ProcessResult {
  orderId: string | null;
  action: 'no_order' | 'ignored' | 'advanced' | 'already' | 'issued' | 'license_error';
  detail: string;
}

/**
 * Ponto único de verdade do pagamento: chamado pelo webhook, pelo polling
 * do retorno e pela sincronização manual do admin.
 *
 * Idempotente por construção:
 *  - a transição de status usa `where status in ('pending','in_process')`;
 *  - a emissão da chave é protegida pelo índice único em licenses.order_id.
 */
export async function processPayment(facts: PaymentFacts, actor = 'system'): Promise<ProcessResult> {
  const supabase = createAdminClient();

  // 1. localiza a ordem pelo external_reference (preferido) ou pelo id do MP
  let order: Order | null = null;

  if (facts.external_reference) {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('external_reference', facts.external_reference)
      .maybeSingle();
    order = (data as Order) ?? null;
  }

  if (!order && facts.id) {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('mp_payment_id', String(facts.id))
      .maybeSingle();
    order = (data as Order) ?? null;
  }

  if (!order) {
    return { orderId: null, action: 'no_order', detail: 'Nenhuma ordem corresponde a este pagamento.' };
  }

  const mpStatus = facts.status ?? 'pending';

  // 2. registra o pagamento (one-shot por mp_payment_id)
  if (facts.id) {
    await supabase.from('payments').upsert(
      {
        order_id: order.id,
        customer_id: order.customer_id,
        mp_payment_id: String(facts.id),
        method: facts.payment_method_id === 'pix' ? 'pix' : (order.method ?? 'card'),
        amount_brl: order.amount_brl,
        installments: facts.installments ?? 1,
        status: mpStatus,
        status_detail: facts.status_detail ?? null,
        paid_at: facts.date_approved ?? null,
      },
      { onConflict: 'mp_payment_id', ignoreDuplicates: true },
    );
  }

  // 3. espelha o status do MP na ordem
  await supabase
    .from('orders')
    .update({ mp_payment_id: String(facts.id), mp_payment_status: mpStatus })
    .eq('id', order.id);

  // 4. aprovação — apenas na primeira vez
  if (mpStatus === 'approved') {
    const { data: advanced } = await supabase
      .from('orders')
      .update({ status: 'approved', paid_at: facts.date_approved ?? new Date().toISOString(), license_error: null })
      .eq('id', order.id)
      .in('status', APPROVABLE)
      .select('id');

    order.status = 'approved';
    if (advanced && advanced.length > 0) {
      // transição nova
    }
  } else if (mpStatus === 'rejected' || mpStatus === 'cancelled') {
    await supabase
      .from('orders')
      .update({ status: mpStatus as OrderStatus })
      .eq('id', order.id)
      .in('status', APPROVABLE);
    return { orderId: order.id, action: 'ignored', detail: `Pagamento ${mpStatus}; nenhuma chave emitida.` };
  } else if (mpStatus === 'refunded' || mpStatus === 'charged_back') {
    await supabase.from('orders').update({ status: 'refunded' }).eq('id', order.id);
    return { orderId: order.id, action: 'ignored', detail: 'Estorno registrado.' };
  } else {
    // pending / in_process / authorized — nunca emite chave
    await supabase
      .from('orders')
      .update({ status: 'in_process' })
      .eq('id', order.id)
      .in('status', APPROVABLE);
    return { orderId: order.id, action: 'ignored', detail: `Aguardando confirmação (${mpStatus}).` };
  }

  // 5. já existe chave para este pedido?
  const { data: existingLicense } = await supabase
    .from('licenses')
    .select('id, expires_at')
    .eq('order_id', order.id)
    .maybeSingle();

  if (existingLicense) {
    await supabase.from('orders').update({ license_issued: true, license_error: null }).eq('id', order.id);
    return { orderId: order.id, action: 'already', detail: 'Chave já emitida para este pedido.' };
  }

  // 6. cliente já tem chave ativa? renova mantendo a MESMA chave e somando o prazo
  //    ao vencimento atual (política do gateway). Nenhuma chave nova é criada.
  const { data: priorLicense } = await supabase
    .from('licenses')
    .select('id, key, expires_at')
    .eq('customer_email', order.customer_email)
    .neq('status', 'revoked')
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (priorLicense) {
    // Idempotência: o Mercado Pago reenvia o webhook. Se este pedido já
    // emitiu, não soma o prazo duas vezes.
    if (order.license_issued) {
      return { orderId: order.id, action: 'already', detail: 'Renovação já processada.' };
    }

    try {
      const renewal = await renewLicense({
        email: order.customer_email,
        key: priorLicense.key,
        planSlug: order.plan_slug,
        orderId: order.external_reference,
      });

      const key = renewal.license?.key ?? priorLicense.key;

      // O gateway soma o prazo ao vencimento atual. Nunca aceitamos um
      // retorno menor que o vencimento que já existia — se a chave nunca
      // vencia, continua não vencendo.
      const upstreamExpires = renewal.license?.expiresAt ?? null;
      let expiresAt = priorLicense.expires_at;
      if (priorLicense.expires_at && upstreamExpires) {
        const next = new Date(upstreamExpires);
        const prev = new Date(priorLicense.expires_at);
        if (!Number.isNaN(next.getTime()) && next.getTime() > prev.getTime()) {
          expiresAt = next.toISOString();
        }
      }

      await supabase
        .from('licenses')
        .update({
          key,
          key_hint: keyHint(key),
          plan_slug: order.plan_slug,
          status: 'active',
          expires_at: expiresAt,
          customer_id: order.customer_id,
        })
        .eq('id', priorLicense.id);

      await supabase.from('orders').update({ license_issued: true, license_error: null }).eq('id', order.id);

      await logLicenseEvent({
        licenseId: priorLicense.id,
        orderId: order.id,
        action: 'renew',
        detail:
          `Renovação do plano ${order.plan_slug} sobre a chave ${keyHint(key)}. ` +
          `Vencimento ${
            expiresAt ? new Date(expiresAt).toLocaleDateString('pt-BR') : 'sem vencimento'
          } (soma ao vencimento anterior).`,
        actor,
      });

      return { orderId: order.id, action: 'issued', detail: `Chave renovada: ${keyHint(key)}.` };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao renovar a licença.';

      // O pagamento CONTINUA aprovado: o dinheiro entrou. A falha vira
      // erro recuperável com botão de reprocessar no admin.
      await supabase.from('orders').update({ license_error: message }).eq('id', order.id);
      await logLicenseEvent({
        licenseId: priorLicense.id,
        orderId: order.id,
        action: 'failed',
        detail: message,
        actor,
      });

      return { orderId: order.id, action: 'license_error', detail: message };
    }
  }

  // 7. emite a chave na API upstream
  try {
    const activation = await activateLicense({
      email: order.customer_email,
      planSlug: order.plan_slug,
      orderId: order.external_reference, // dedupe no lado da API
    });

    // A API envolve a resposta: nao existe `key` no topo do payload.
    const payload = activation.license;
    const key = payload?.key;
    if (!key) throw new LicenseApiError('A API não devolveu a chave.', 502);

    const planDays = Number(order.plan_slug.replace(/^cc_(\d+)d$/, '$1')) || 30;
    // Em /activate o limite vem dentro de `license`, nao em `limits`.
    const hourlyTokenLimit = payload.hourlyTokenLimit ?? activation.limits?.hourlyTokenLimit;

    const insert = await supabase.from('licenses').insert({
      customer_id: order.customer_id,
      customer_email: order.customer_email,
      plan_slug: order.plan_slug,
      key,
      key_hint: keyHint(key),
      status: 'active',
      order_id: order.id,
      expires_at: expiresFrom(payload?.expiresAt, planDays),
    });

    if (insert.error) {
      // corrida com um webhook simultaneo: o indice unico venceu, e a chave
      // que existe e a legitima.
      if (insert.error.code === '23505') {
        await supabase.from('orders').update({ license_issued: true, license_error: null }).eq('id', order.id);
        await logLicenseEvent({ orderId: order.id, action: 'activate', detail: 'Chave já havia sido emitida.', actor });
        return { orderId: order.id, action: 'already', detail: 'Chave já emitida.' };
      }
      throw new Error(insert.error.message);
    }

    await supabase.from('orders').update({ license_issued: true, license_error: null }).eq('id', order.id);
    await logLicenseEvent({
      orderId: order.id,
      action: 'activate',
      detail:
        `Plano ${order.plan_slug} ativado a partir do pagamento ${mpStatus}.` +
        (hourlyTokenLimit
          ? ` Limite do gateway: ${hourlyTokenLimit.toLocaleString('pt-BR')} tokens/h (janela móvel).`
          : ''),
      actor,
    });

    return { orderId: order.id, action: 'issued', detail: 'Chave emitida.' };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Falha ao ativar a licença.';

    // O pagamento CONTINUA aprovado: o dinheiro entrou. A falha vira
    // erro recuperável com botão de reprocessar no admin.
    await supabase.from('orders').update({ license_error: message }).eq('id', order.id);
    await logLicenseEvent({ orderId: order.id, action: 'failed', detail: message, actor });

    return { orderId: order.id, action: 'license_error', detail: message };
  }
}

export async function logLicenseEvent(input: {
  licenseId?: string | null;
  orderId?: string | null;
  action: 'activate' | 'renew' | 'revoke' | 'reprocess' | 'failed';
  detail?: string | null;
  actor?: string;
}) {
  const supabase = createAdminClient();
  await supabase.from('license_events').insert({
    license_id: input.licenseId ?? null,
    order_id: input.orderId ?? null,
    action: input.action,
    detail: input.detail ?? null,
    actor: input.actor ?? 'system',
  });
}
