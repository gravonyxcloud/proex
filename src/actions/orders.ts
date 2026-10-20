'use server';

import { revalidatePath } from 'next/cache';

import { paymentClient } from '@/lib/mp/client';
import { processPayment } from '@/lib/mp/handle-payment';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getOrderState } from '@/lib/checkout';
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
 * Sincroniza uma ordem com o Mercado Pago.
 *
 * Cobre o caso em que o webhook não chegou (domínio não autorizado, PIX pago
 * após o QR expirar, queda do Mercado Pago). Busca o pagamento real pela
 * referência do pedido e rota pelo mesmo processamento idempotente.
 */
export async function syncOrder(orderId: string): Promise<ActionState> {
  const actor = await requireAdmin().catch((e: Error) => {
    throw e;
  });

  try {
    const admin = createAdminClient();
    const { data: order } = await admin
      .from('orders')
      .select('id, external_reference, mp_payment_id')
      .eq('id', orderId)
      .single();

    if (!order) return { ok: false, message: 'Pedido não encontrado.' };

    if (!process.env.MP_ACCESS_TOKEN) {
      return { ok: false, message: 'MP_ACCESS_TOKEN não configurado.' };
    }

    const mp = paymentClient();

    let payment: Awaited<ReturnType<typeof mp.get>> | null = null;

    // Prefere buscar pelo external_reference: o mp_payment_id só existe se o
    // PIX foi criado por aqui; no Checkout Pro ele nem sempre veio salvo.
    const search = await mp.search({
      options: { external_reference: order.external_reference, limit: 1 },
    });

    const found = search.results?.[0];
    if (found?.id) {
      payment = await mp.get({ id: String(found.id) });
    } else if (order.mp_payment_id) {
      payment = await mp.get({ id: order.mp_payment_id });
    }

    if (!payment) {
      return {
        ok: false,
        message: 'Nenhum pagamento encontrado no Mercado Pago para este pedido.',
      };
    }

    const result = await processPayment(
      {
        id: String(payment.id),
        status: payment.status,
        status_detail: payment.status_detail,
        external_reference: payment.external_reference,
        payment_method_id: payment.payment_method_id,
        transaction_amount: payment.transaction_amount,
        installments: payment.installments,
        date_approved: payment.date_approved,
      },
      actor,
    );

    revalidatePath('/admin');
    revalidatePath('/admin/pagamentos');
    revalidatePath('/admin/clientes');

    return {
      ok: result.action !== 'license_error',
      message:
        result.action === 'issued'
          ? 'Sincronizado. Chave emitida.'
          : result.action === 'already'
            ? 'Sincronizado. A chave já existia.'
            : result.action === 'license_error'
              ? `Pagamento aprovado, mas a ativação falhou: ${result.detail}`
              : result.detail,
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Falha na sincronização.' };
  }
}

/** Reprocessa só a emissão da chave de um pedido já aprovado. */
export async function reprocessLicense(orderId: string): Promise<ActionState> {
  const actor = await requireAdmin();

  try {
    const state = await getOrderState(orderId);
    if (!state) return { ok: false, message: 'Pedido não encontrado.' };

    if (state.license) {
      return { ok: false, message: 'Este pedido já tem chave emitida.' };
    }

    if (state.order.status !== 'approved') {
      return { ok: false, message: 'O pedido não está aprovado, nada a emitir.' };
    }

    const admin = createAdminClient();
    await admin.from('orders').update({ license_issued: false, license_error: null }).eq('id', orderId);

    // processPayment reentra na etapa de emissão (guardada pelo índice único).
    const result = await processPayment(
      {
        id: state.order.mp_payment_id ?? `local_${orderId}`,
        status: 'approved',
        external_reference: state.order.external_reference,
        date_approved: state.order.paid_at,
      },
      actor,
    );

    revalidatePath('/admin');
    revalidatePath('/admin/chaves');
    revalidatePath('/admin/clientes');

    return { ok: result.action === 'issued' || result.action === 'already', message: result.detail };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Falha ao reprocessar.' };
  }
}