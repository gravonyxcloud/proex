import { NextResponse, type NextRequest } from 'next/server';
import { InvalidWebhookSignatureError, WebhookSignatureValidator } from 'mercadopago';

import { paymentClient } from '@/lib/mp/client';
import { processPayment } from '@/lib/mp/handle-payment';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const first = (v: string | string[] | null | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : (v ?? undefined);

/** Payload gravado SEM PII de cartão: só o que interessa para depurar. */
function sanitize(input: Record<string, unknown>) {
  const allow = [
    'id',
    'status',
    'status_detail',
    'external_reference',
    'payment_method_id',
    'payment_type_id',
    'transaction_amount',
    'installments',
    'date_created',
    'date_approved',
    'date_last_updated',
    'collector_id',
    'operation_type',
  ];
  const out: Record<string, unknown> = {};
  for (const k of allow) if (k in input) out[k] = input[k];
  return out;
}

/**
 * POST /api/webhooks/mercadopago
 *
 * Duas defesas obrigatórias:
 *  1. assinatura HMAC (x-signature) — recusa forjado;
 *  2. event_id único por transição real do pagamento — recusa o retry agressivo
 *     do Mercado Pago, que entrega fora de ordem.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'MP_WEBHOOK_SECRET não configurado. Configure a assinatura em Tus Integraciones.' },
      { status: 503 },
    );
  }

  const url = new URL(req.url);
  const xSignature = first(req.headers.get('x-signature'));
  const xRequestId = first(req.headers.get('x-request-id'));

  if (!xSignature) {
    return NextResponse.json({ error: 'Assinatura ausente.' }, { status: 401 });
  }

  // O corpo é lido uma única vez e guardado: precisamos dele no validador
  // (data.id pode vir só no payload) e depois no processamento.
  let body: Record<string, any> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const dataId =
    first(url.searchParams.get('data.id')) ??
    (body?.data?.id !== undefined && body?.data?.id !== null ? String(body.data.id) : undefined);

  try {
    WebhookSignatureValidator.validate({
      xSignature,
      xRequestId,
      dataId: dataId ?? null,
      secret,
      toleranceSeconds: 600,
    });
  } catch (err) {
    const reason =
      err instanceof InvalidWebhookSignatureError ? err.reason : 'desconhecida';
    return NextResponse.json({ error: 'Assinatura inválida.', reason }, { status: 401 });
  }

  const topic =
    first(url.searchParams.get('topic')) ??
    first(url.searchParams.get('type')) ??
    (typeof body?.action === 'string' && body.action.includes('payment') ? 'payment' : undefined);

  const idStr = dataId ?? '';

  // Só nos importa pagamento. merchant_order, qr_code etc. saem como 200
  // (senão o Mercado Pago fica reenviando para sempre).
  if (topic && !topic.includes('payment') && !idStr) {
    return NextResponse.json({ received: true, ignored: true });
  }

  if (!idStr) {
    return NextResponse.json({ received: true, ignored: true, reason: 'sem data.id' });
  }

  const supabase = createAdminClient();

  let eventId: string | null = null;

  try {
    // Fonte de verdade: busca o pagamento no Mercado Pago em vez de confiar
    // no corpo da notificação (que pode estar atrasado ou incompleto).
    const payment = await paymentClient().get({ id: idStr });

    const facts = {
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
    };

    // event_id identifica uma TRANSIÇÃO do pagamento. A linha é gravada só
    // DEPOIS do processamento: antes já nascia como 'processed' e um reenvio
    // caía no 23505 — se o processamento tivesse falhado, nunca mais seria
    // reprocessado (o 200 de resposta já faz o MP parar de reentregar).
    eventId = `pay:${facts.id}:${payment.status ?? 'unknown'}:${payment.date_last_updated ?? 'na'}`;

    const result = await processPayment(facts, 'webhook');

    const { error: insertErr } = await supabase.from('webhook_events').upsert(
      {
        event_id: eventId,
        topic: topic ?? 'payment',
        mp_payment_id: facts.id,
        status_raw: payment.status ?? null,
        payload: sanitize(payment as unknown as Record<string, unknown>),
        // license_error vira 'error' para aparecer na fila de erros do admin;
        // após um reprocessamento bem-sucedido o upsert volta para 'processed'.
        result:
          result.action === 'license_error'
            ? 'error'
            : result.action === 'issued' || result.action === 'already'
              ? 'processed'
              : 'ignored',
        error: result.action === 'license_error' ? result.detail : null,
      },
      { onConflict: 'event_id' },
    );
    if (insertErr) throw new Error(insertErr.message);

    return NextResponse.json({ received: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao processar notificação.';

    // insert (não upsert): não sobrescreve um registro 'processed' válido.
    // O 'error' fica visível no admin; o próximo reenvio reprocessa e o
    // upsert de sucesso sobrescreve a linha.
    await supabase.from('webhook_events').insert({
      event_id: eventId ?? `err:${idStr}:${Date.now()}`,
      topic: topic ?? 'payment',
      mp_payment_id: idStr,
      payload: null,
      result: 'error',
      error: message,
    });

    // 200 de propósito: 5xx faria o Mercado Pago reenviar em loop e mascarar
    // o erro real. O registro `result='error'` fica no painel admin.
    return NextResponse.json({ received: true, error: message }, { status: 200 });
  }
}
