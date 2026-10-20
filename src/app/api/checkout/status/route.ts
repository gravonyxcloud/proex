import { NextResponse, type NextRequest } from 'next/server';

import { getOrderState } from '@/lib/checkout';
import { paymentClient } from '@/lib/mp/client';
import { processPayment } from '@/lib/mp/handle-payment';

export const dynamic = 'force-dynamic';

/**
 * GET /api/checkout/status?orderId=<uuid>&email=<email>
 *
 * É o polling do /checkout/retorno. O PIX nunca dispara auto_return, então o
 * redirect sozinho não prova nada: aqui consultamos o Mercado Pago quando o
 * webhook ainda não chegou, e devolvemos a chave se o pagamento estiver
 * aprovado. Exige orderId + e-mail para não entregar a chave a quem adivinha.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get('orderId') ?? '';
  const email = (searchParams.get('email') ?? '').trim().toLowerCase();

  if (!/^[0-9a-f-]{36}$/i.test(orderId) || !email) {
    return NextResponse.json({ error: 'Parâmetros inválidos.' }, { status: 400 });
  }

  const state = await getOrderState(orderId);
  if (!state || state.order.customer_email.toLowerCase() !== email) {
    return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 });
  }

  let order = state.order;

  // Ainda pendente? Consulta o Mercado Pago direto — o webhook pode estar atrasado.
  if (order.status === 'pending' || order.status === 'in_process') {
    const mpId = order.mp_payment_id;
    if (mpId && process.env.MP_ACCESS_TOKEN) {
      try {
        const payment = await paymentClient().get({ id: mpId });
        await processPayment(
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
          'poll',
        );
      } catch {
        // webhook ainda vai resolver; seguimos com o estado atual
      }
    }

    const refreshed = await getOrderState(orderId);
    if (refreshed) {
      order = refreshed.order as typeof order;
      state.license = refreshed.license;
    }
  }

  // (deliberadamente não gravamos cada polling: o retorno dispara a cada 2s
  // e encheria webhook_events. O log de verdade é o do webhook.)
  return NextResponse.json({
    status: order.status,
    licenseIssued: order.license_issued,
    licenseError: order.license_error,
    amount: Number(order.amount_brl),
    planSlug: order.plan_slug,
    paidAt: order.paid_at,
    license: state.license
      ? {
          key: state.license.key,
          keyHint: state.license.key_hint,
          status: state.license.status,
          expiresAt: state.license.expires_at,
        }
      : null,
  });
}
