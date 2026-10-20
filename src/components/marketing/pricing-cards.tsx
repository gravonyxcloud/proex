import Link from 'next/link';

import { formatBRL, pricePerDay } from '@/lib/money';
import type { Plan } from '@/types/db';

interface Props {
  plans: Plan[];
  /** Esconde os que não forem "compact" quando a tela for pequena. */
  compact?: boolean;
}

export function PricingCards({ plans, compact }: Props) {
  if (plans.length === 0) {
    return (
      <div className="surface p-10 text-center text-muted-foreground">
        Nenhum plano disponível no momento. Fale com o suporte.
      </div>
    );
  }

  return (
    <div className={`grid gap-5 sm:grid-cols-2 ${compact ? 'lg:grid-cols-4' : 'lg:grid-cols-4'}`}>
      {plans.map((plan, i) => {
        const perDay = pricePerDay(Number(plan.price_brl), plan.dias);

        return (
          <article
            key={plan.slug}
            className={[
              'surface surface-hover relative flex flex-col p-6',
              plan.highlight ? 'border-primary/50 bg-primary/[0.06]' : '',
            ].join(' ')}
            style={{ animationDelay: `${i * 70}ms` }}
          >
            {plan.highlight && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-primary-foreground shadow-glow">
                Melhor custo por dia
              </span>
            )}

            <div className="flex items-baseline justify-between">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {plan.dias} dias
              </span>
              <span className="badge !px-2 !py-0.5 !text-[10px]">Ilimitado</span>
            </div>

            <div className="mt-5 flex items-end gap-1.5">
              <span className="font-display text-4xl font-bold tracking-tight text-premium">
                {formatBRL(plan.price_brl)}
              </span>
            </div>

            <p className="mt-1.5 font-mono text-xs text-muted-foreground">
              {formatBRL(perDay)} por dia · uso ilimitado
            </p>

            <p className="mt-4 flex-1 text-sm leading-relaxed text-muted-foreground">
              {plan.description ?? 'Acesso por API ao Claude Code.'}
            </p>

            <ul className="mt-5 space-y-2 text-sm">
              {[
                '80M tokens por hora',
                '4 modelos inclusos',
                'Chave na aprovação do pagamento',
              ].map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-foreground/85">
                  <span className="mt-0.5 text-primary" aria-hidden>
                    ✓
                  </span>
                  {f}
                </li>
              ))}
            </ul>

            <Link
              href={`/checkout/${plan.slug}`}
              className={`mt-6 w-full ${plan.highlight ? 'btn-primary' : 'btn-outline'} btn`}
              aria-label={`Comprar ${plan.dias} dias de Claude Code ilimitado por ${formatBRL(plan.price_brl)}`}
            >
              Escolher {plan.dias} dias
            </Link>
          </article>
        );
      })}
    </div>
  );
}
