import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { CheckoutForm } from '@/components/checkout/checkout-form';
import { SITE } from '@/lib/constants';
import { getActivePlans } from '@/lib/plans';
import { getSessionUser } from '@/lib/supabase/server';
import type { Plan } from '@/types/db';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: { planId: string };
}): Promise<Metadata> {
  const plans = await getActivePlans();
  const plan = plans.find((p) => p.slug === params.planId);
  return {
    title: plan ? `Comprar ${plan.dias} dias` : 'Checkout',
    robots: { index: false, follow: false },
  };
}

export default async function CheckoutPage({ params }: { params: { planId: string } }) {
  const plans = await getActivePlans();
  const plan: Plan | undefined = plans.find((p) => p.slug === params.planId);
  if (!plan) notFound();

  const user = await getSessionUser();
  const email = user?.email ?? undefined;

  return (
    <div className="section py-16">
      <div className="mx-auto max-w-lg">
        <Link href="/precos" className="text-sm text-muted-foreground transition hover:text-primary">
          ← Voltar aos planos
        </Link>

        <h1 className="mt-5 text-3xl font-bold">Finalizar compra</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          O período começa na emissão da chave, quando o pagamento aprovar.
        </p>

        <div className="mt-8">
          <CheckoutForm plan={plan} prefilledEmail={email} />
        </div>

        <div className="mt-6 rounded-xl border border-border bg-card/60 p-5 text-xs leading-relaxed text-muted-foreground">
          <strong className="text-foreground">Antes de pagar:</strong> a chave autentica chamadas de
          API pela ponte ({SITE.apiBase.replace(/^https?:\/\//, '')}) e não loga no claude.ai, no
          app nem no Claude Desktop. Você não está comprando um plano da Anthropic. Uso justo de{' '}
          <span className="text-primary">80 milhões de tokens por hora</span>, uma chave por pessoa.
        </div>
      </div>
    </div>
  );
}
