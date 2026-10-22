import { NextResponse, type NextRequest } from 'next/server';

import { getSessionUser } from '@/lib/supabase/server';
import { createCheckoutPreference, createOrder, getActivePlan, tooManyOpenOrders } from '@/lib/checkout';

export const dynamic = 'force-dynamic';

/**
 * POST /api/checkout/preference
 * Cria a preferência do Checkout Pro hospedado (caminho do cartão,
 * e também o "outros meios" do Mercado Pago).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body?.email ?? '')
      .trim()
      .toLowerCase();
    const planSlug = String(body?.planSlug ?? '');

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Informe um e-mail válido.' }, { status: 400 });
    }

    // Teto por e-mail: cada checkout cria um pagamento real no Mercado Pago.
    if (await tooManyOpenOrders(email)) {
      return NextResponse.json(
        { error: 'Muitos pedidos em aberto para este e-mail. Aguarde alguns minutos.' },
        { status: 429 },
      );
    }

    const user = await getSessionUser();
    const plan = await getActivePlan(planSlug);
    const order = await createOrder({
      email,
      plan,
      method: 'card',
      customerId: user?.id ?? null,
    });

    const pref = await createCheckoutPreference(order, plan);

    return NextResponse.json({
      orderId: order.id,
      amount: Number(order.amount_brl),
      planName: plan.name,
      initPoint: pref.initPoint,
      preferenceId: pref.preferenceId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Não foi possível iniciar o pagamento.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
