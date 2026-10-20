import 'server-only';

import { randomUUID } from 'node:crypto';

import { createAdminClient } from '@/lib/supabase/admin';
import { paymentClient, preferenceClient } from '@/lib/mp/client';
import { SITE } from '@/lib/constants';
import { toMPAmount } from '@/lib/money';
import type { Order, Plan } from '@/types/db';

export function webhookUrl(): string {
  return `${SITE.url.replace(/\/+$/, '')}/api/webhooks/mercadopago`;
}

export function backUrl(order: Order): string {
  return `${SITE.url.replace(/\/+$/, '')}/checkout/retorno?orderId=${order.id}`;
}

/** Plano ativo ou lança — o preço vem do BANCO, nunca do cliente. */
export async function getActivePlan(slug: string): Promise<Plan> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('slug', slug)
    .eq('active', true)
    .single();

  if (error || !data) throw new Error('Plano indisponível no momento.');
  return data as Plan;
}

/**
 * Cria a ordem congelando `amount_brl` no valor vigente.
 * Se um admin editar o plano depois, o webhook continua honrando ESTE valor.
 */
export async function createOrder(input: {
  email: string;
  plan: Plan;
  method: 'pix' | 'card';
  customerId?: string | null;
  fullName?: string | null;
}): Promise<Order> {
  const supabase = createAdminClient();

  const order = {
    external_reference: `px_${randomUUID().replace(/-/g, '').slice(0, 24)}`,
    customer_id: input.customerId ?? null,
    customer_email: input.email.toLowerCase(),
    plan_slug: input.plan.slug,
    amount_brl: toMPAmount(input.plan.price_brl),
    method: input.method,
    status: 'pending',
  };

  const { data, error } = await supabase
    .from('orders')
    .insert(order)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error('Não foi possível registrar o pedido. Tente novamente.');
  }
  return data as Order;
}

/** PIX gerado na hora: QR em base64 + código copia-e-cola. */
export async function createPixPayment(order: Order, plan: Plan) {
  const mp = paymentClient();

  const expires = new Date(Date.now() + 30 * 60_000).toISOString();

  const payment = await mp.create({
    body: {
      transaction_amount: order.amount_brl,
      description: `${plan.name} — Proex`,
      external_reference: order.external_reference,
      payment_method_id: 'pix',
      notification_url: webhookUrl(),
      date_of_expiration: expires,
      statement_descriptor: 'PROEX',
      payer: { email: order.customer_email },
    },
    requestOptions: { idempotencyKey: `pix-${order.external_reference}` },
  });

  const poi = payment.point_of_interaction?.transaction_data;
  const qrBase64 = poi?.qr_code_base64 ?? '';
  const qrCode = poi?.qr_code ?? '';

  if (!qrCode && payment.status !== 'approved') {
    throw new Error('Não foi possível gerar o código PIX agora.');
  }

  const supabase = createAdminClient();
  await supabase
    .from('orders')
    .update({ mp_payment_id: String(payment.id ?? ''), mp_payment_status: payment.status ?? 'pending' })
    .eq('id', order.id);

  return {
    paymentId: String(payment.id ?? ''),
    status: payment.status ?? 'pending',
    qrCode,
    qrBase64,
    expiresAt: expires,
  };
}

/**
 * Checkout Pro hospedado — usado no caminho do cartão.
 * O usuário sai do site, paga no Mercado Pago e volta para /checkout/retorno.
 */
export async function createCheckoutPreference(order: Order, plan: Plan) {
  const pref = preferenceClient();
  const site = SITE.url.replace(/\/+$/, '');

  const response = await pref.create({
    body: {
      items: [
        {
          id: plan.slug,
          title: plan.name,
          quantity: 1,
          unit_price: order.amount_brl,
          currency_id: 'BRL',
          description: plan.description ?? 'Acesso por API ao Claude Code (Proex)',
        },
      ],
      payer: { email: order.customer_email },
      external_reference: order.external_reference,
      notification_url: webhookUrl(),
      back_urls: {
        success: backUrl(order),
        pending: backUrl(order),
        failure: backUrl(order),
      },
      auto_return: 'approved',
      statement_descriptor: 'PROEX',
      metadata: { order_id: order.id, plan_slug: plan.slug },
    },
    requestOptions: { idempotencyKey: `pref-${order.external_reference}` },
  });

  const supabase = createAdminClient();
  await supabase
    .from('orders')
    .update({ mp_preference_id: response.id ?? null })
    .eq('id', order.id);

  if (!response.init_point) throw new Error('Não foi possível abrir o checkout.');

  return { initPoint: response.init_point, preferenceId: response.id ?? '', site };
}

/** Estado atual da ordem + chave emitida, para o polling do /checkout/retorno. */
export async function getOrderState(orderId: string) {
  const supabase = createAdminClient();

  const { data: order } = await supabase
    .from('orders')
    .select('id, status, method, amount_brl, plan_slug, customer_email, license_issued, license_error, paid_at, created_at, external_reference')
    .eq('id', orderId)
    .single();

  if (!order) return null;

  const { data: license } = await supabase
    .from('licenses')
    .select('id, key, key_hint, status, expires_at, plan_slug')
    .eq('order_id', orderId)
    .maybeSingle();

  return { order: order as Order, license };
}
