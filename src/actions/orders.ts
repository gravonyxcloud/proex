'use server';

import { revalidatePath } from 'next/cache';

import { paymentClient, mpConfig } from '@/lib/mp/client';
import { processPayment, logLicenseEvent } from '@/lib/mp/handle-payment';
import { PaymentRefund } from 'mercadopago';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getOrderState } from '@/lib/checkout';
import { getPlan } from '@/lib/plans';
import { licenseActionSchema } from '@/lib/schemas';
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
        fee_details: payment.fee_details,
        transaction_details: payment.transaction_details,
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

/**
 * Solicita reembolso automático se o pedido foi aprovado há ≤ 7 dias.
 * Chama o Mercado Pago para estornar e marca o pedido como refunded.
 */
export async function requestRefund(orderId: string): Promise<ActionState> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new Error('Sessão expirada. Entre novamente.');

    const admin = createAdminClient();

    // Busca o pedido do cliente
    const { data: order } = await admin
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .eq('customer_id', user.id)
      .single();

    if (!order) return { ok: false, message: 'Pedido não encontrado.' };

    if (order.status !== 'approved') {
      return { ok: false, message: 'Só pedidos aprovados podem ser reembolsados.' };
    }

    // Verifica se está dentro dos 7 dias corridos
    const paidAt = order.paid_at ? new Date(order.paid_at) : new Date(order.created_at);
    const now = new Date();
    const diffDays = (now.getTime() - paidAt.getTime()) / (1000 * 60 * 60 * 24);

    if (diffDays > 7) {
      return {
        ok: false,
        message: `O prazo de 7 dias para reembolso expirou (foram ${Math.floor(diffDays)} dias).`,
      };
    }

    // Se já tem chave emitida, revoga a licença localmente
    if (order.license_issued) {
      const { data: license } = await admin
        .from('licenses')
        .select('id')
        .eq('order_id', orderId)
        .maybeSingle();

      if (license) {
        await admin
          .from('licenses')
          .update({
            status: 'revoked',
            revoked_at: now.toISOString(),
            revoked_reason: 'Reembolso solicitado pelo cliente (≤ 7 dias)',
          })
          .eq('id', license.id);

        await logLicenseEvent({
          licenseId: license.id,
          orderId: order.id,
          action: 'revoke',
          detail: 'Revogada por reembolso automático (≤ 7 dias)',
          actor: user.email ?? 'customer',
        });
      }
    }

    // Chama o Mercado Pago para fazer o estorno
    if (!process.env.MP_ACCESS_TOKEN) {
      return { ok: false, message: 'MP_ACCESS_TOKEN não configurado.' };
    }

    const mp = paymentClient();
    const refundClient = new PaymentRefund(mpConfig());

    if (order.mp_payment_id) {
      const refundResult = await refundClient.total({ payment_id: order.mp_payment_id });
      if (refundResult.status !== 'approved') {
        return { ok: false, message: `Falha no estorno MP: ${refundResult.status}` };
      }
    } else {
      // Fallback: busca pelo external_reference
      const search = await mp.search({
        options: { external_reference: order.external_reference, limit: 1 },
      });
      const found = search.results?.[0];
      if (found?.id) {
        const refundResult = await refundClient.total({ payment_id: String(found.id) });
        if (refundResult.status !== 'approved') {
          return { ok: false, message: `Falha no estorno MP: ${refundResult.status}` };
        }
      } else {
        return { ok: false, message: 'Pagamento não encontrado no Mercado Pago para estorno.' };
      }
    }

    // Atualiza o pedido
    await admin
      .from('orders')
      .update({
        status: 'refunded',
        refunded_at: now.toISOString(),
        license_issued: false,
      })
      .eq('id', orderId);

    revalidatePath('/painel/pagamentos');
    revalidatePath('/painel/suporte');

    return { ok: true, message: 'Reembolso processado. O valor volta em até 5 dias úteis.' };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Falha ao solicitar reembolso.' };
  }
}

/**
 * Renova a chave do usuário logado (painel do cliente).
 * Cria um novo pedido, paga via Mercado Pago e estende a mesma chave.
 * O plano escolhido define quantos dias serão somados ao vencimento atual (ou a partir de agora, se já venceu).
 */
export async function userRenew(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('Sessão expirada. Entre novamente.');

  const planSlug = String(formData.get('planSlug') ?? '').trim();

  if (!planSlug) return { ok: false, message: 'Plano não informado.' };

  try {
    const admin = createAdminClient();

    // Busca a chave ativa do usuário (não revogada)
    const { data: license } = await admin
      .from('licenses')
      .select('id, key, plan_slug, expires_at, status')
      .eq('customer_id', user.id)
      .neq('status', 'revoked')
      .order('expires_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!license) {
      return { ok: false, message: 'Você não tem uma chave ativa para renovar. Compre um novo plano.' };
    }

    const plano = await getPlan(planSlug);
    if (!plano) return { ok: false, message: 'Plano inexistente ou inativo.' };

    // Verifica se já tem pedido pendente
    const { data: pendingOrder } = await admin
      .from('orders')
      .select('id')
      .eq('customer_id', user.id)
      .in('status', ['pending', 'in_process'])
      .limit(1)
      .maybeSingle();

    if (pendingOrder) {
      return { ok: false, message: 'Você já tem um pagamento em andamento. Aguarde ou cancele o anterior.' };
    }

    // Cria novo pedido de renovação
    const orderId = `renew_${Date.now()}`;
    const { data: order, error: orderError } = await admin
      .from('orders')
      .insert({
        external_reference: `renew_${orderId}`,
        customer_id: user.id,
        customer_email: user.email?.toLowerCase(),
        plan_slug: plano.slug,
        amount_brl: plano.price_brl,
        method: 'pix',
        status: 'pending',
      })
      .select('id, external_reference')
      .single();

    if (orderError || !order) {
      return { ok: false, message: 'Falha ao criar pedido de renovação.' };
    }

    // Cria pagamento PIX
    if (!process.env.MP_ACCESS_TOKEN) {
      return { ok: false, message: 'MP_ACCESS_TOKEN não configurado.' };
    }

    const mp = paymentClient();
    const expires = new Date(Date.now() + 30 * 60_000).toISOString();

    const payment = await mp.create({
      body: {
        transaction_amount: plano.price_brl,
        description: `Renovação ${plano.name} — Proex`,
        external_reference: order.external_reference,
        payment_method_id: 'pix',
        notification_url: `${process.env.SITE_URL ?? 'https://proex.dev'}/api/webhooks/mercadopago`,
        date_of_expiration: expires,
        statement_descriptor: 'PROEX',
        payer: { email: user.email?.toLowerCase() },
      },
      requestOptions: { idempotencyKey: `renew-${order.external_reference}` },
    });

    const paymentId = String(payment.id ?? '');
    const qrCode = payment.point_of_interaction?.transaction_data?.qr_code ?? '';
    const qrBase64 = payment.point_of_interaction?.transaction_data?.qr_code_base64 ?? '';

    if (!qrCode && payment.status !== 'approved') {
      await admin.from('orders').delete().eq('id', order.id);
      return { ok: false, message: 'Não foi possível gerar o código PIX agora.' };
    }

    await admin
      .from('orders')
      .update({ mp_payment_id: paymentId, mp_payment_status: payment.status ?? 'pending' })
      .eq('id', order.id);

    // Salva a chave original no order para o webhook saber que é renovação
    await admin
      .from('orders')
      .update({ license_key_renew: license.key })
      .eq('id', order.id);

    return {
      ok: true,
      message: 'PIX gerado. Pague para renovar sua chave.',
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Falha ao criar renovação.' };
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