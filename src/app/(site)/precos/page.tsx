import type { Metadata } from 'next';

import { PricingCards } from '@/components/marketing/pricing-cards';
import { FAIR_USE } from '@/lib/constants';
import { getActivePlans } from '@/lib/plans';

export const metadata: Metadata = {
  title: 'Planos',
  description:
    'Planos Proex de acesso por API ao Claude Code: 3, 7, 15 e 30 dias com uso ilimitado e 80 milhões de tokens por hora.',
  alternates: { canonical: '/precos' },
};

export default async function PrecosPage() {
  const plans = await getActivePlans();

  return (
    <div className="section py-20">
      <div className="mx-auto max-w-3xl text-center">
        <span className="badge">Planos por período</span>
        <h1 className="mt-6 text-4xl font-bold sm:text-5xl">Pague pelo tempo, não por token.</h1>
        <p className="mt-5 leading-relaxed text-muted-foreground">
          Todos os planos vêm com uso ilimitado dentro do período e o mesmo limite de uso justo de{' '}
          {FAIR_USE.unlimitedLabel}. Quanto maior o prazo, menor o custo por dia.
        </p>
      </div>

      <div className="mt-14">
        <PricingCards plans={plans} />
      </div>

      <div className="mx-auto mt-16 grid max-w-4xl gap-5 md:grid-cols-3">
        {[
          {
            t: 'O relógio começa na emissão',
            d: 'O prazo conta a partir da emissão da chave, não da compra, e não pausa.',
          },
          {
            t: 'Sem cota total',
            d: `Só existe o teto de ritmo de ${FAIR_USE.unlimitedLabel} numa janela deslizante de 60 minutos.`,
          },
          {
            t: 'Acabou, renovou',
            d: 'Quando o prazo termina a chave para de autenticar. Você renova pelo painel mantendo a mesma chave.',
          },
        ].map((x) => (
          <div key={x.t} className="surface p-6">
            <h2 className="text-base font-semibold">{x.t}</h2>
            <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{x.d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
