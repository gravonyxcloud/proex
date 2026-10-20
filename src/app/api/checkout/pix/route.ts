import { NextResponse, type NextRequest } from 'next/server';

import { createClient, getSessionUser } from '@/lib/supabase/server';
import { createPixPayment, createOrder, getActivePlan } from '@/lib/checkout';

export const dynamic = 'force-dynamic';

/**
 * POST /api/checkout/pix
 * Cria a ordem e gera o QR Code do PIX na hora.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body?.email ?? '')
      .trim()
      .toLowerCase();
    const planSlug = String(body?.planSlug ?? '');
    const fullName = typeof body?.fullName === 'string' ? body.fullName.trim() : null;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Informe um e-mail válido.' }, { status: 400 });
    }

    const user = await getSessionUser();
    const plan = await getActivePlan(planSlug);
    const order = await createOrder({
      email,
      plan,
      method: 'pix',
      customerId: user?.id ?? null,
      fullName,
    });

    const pix = await createPixPayment(order, plan);

    return NextResponse.json({
      orderId: order.id,
      amount: Number(order.amount_brl),
      planName: plan.name,
      ...pix,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Falha ao gerar o PIX.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
