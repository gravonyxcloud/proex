import Link from 'next/link';

import { usageFailureText, type UsageFailure } from '@/lib/usage';

/**
 * Estado sem consumo — honesto: diz o motivo real (segredo ausente, chave
 * inexistente, gateway fora) em vez de fingir que o cliente não usou nada.
 */
export function UsageUnavailable({ failure }: { failure: UsageFailure }) {
  const { titulo, corpo } = usageFailureText(failure);

  return (
    <div className="surface grid place-items-center gap-4 px-6 py-14 text-center">
      <div
        className="grid h-12 w-12 place-items-center rounded-full border border-border bg-muted text-xl text-muted-foreground"
        aria-hidden
      >
        ◔
      </div>
      <div className="max-w-lg">
        <h2 className="text-lg font-semibold">{titulo}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{corpo}</p>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/#uso-justo" className="btn-outline btn-sm">
          Como funciona a janela de 60 min
        </Link>
        <Link href="/painel/suporte" className="btn-ghost btn-sm">
          Falar com o suporte
        </Link>
      </div>
    </div>
  );
}
