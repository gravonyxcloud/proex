import Link from 'next/link';

import { UsagePanel } from '@/components/panel/usage-panel';
import { UsageUnavailable } from '@/components/panel/usage-unavailable';
import { fetchUsage } from '@/lib/usage';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Uso' };

const PRESETS = [7, 14, 30, 90] as const;

export default async function UsoPage({ searchParams }: { searchParams: { dias?: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const requested = Number(searchParams.dias);
  const dias = PRESETS.includes(requested as (typeof PRESETS)[number])
    ? requested
    : 14;

  const { data: licencas } = await supabase
    .from('licenses')
    .select('id, key, key_hint, status, expires_at, plan_slug, customer_email')
    .eq('customer_id', user.id)
    .order('issued_at', { ascending: false })
    .limit(5);

  const lista = licencas ?? [];
  const licenca = lista.find((l) => l.status === 'active') ?? lista[0];

  if (!licenca) {
    return (
      <div className="space-y-6">
        <Header dias={dias} />
        <div className="surface grid place-items-center gap-4 px-6 py-14 text-center">
          <h2 className="text-lg font-semibold">Você ainda não tem uma chave</h2>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            O consumo aparece por aqui assim que uma licença for emitida no seu e-mail.
          </p>
          <Link href="/precos" className="btn-primary">
            Ver planos
          </Link>
        </div>
      </div>
    );
  }

  const resultado = await fetchUsage({
    email: user.email ?? licenca.customer_email,
    key: licenca.key,
    days: dias,
  });

  return (
    <div className="space-y-6">
      <Header dias={dias} />

      <p className="text-sm text-muted-foreground">
        Chave <span className="font-mono text-foreground">{licenca.key_hint}</span>
        {resultado.ok ? (
          <>
            {' '}
            · janela de {resultado.data.usage.window.days} dias ·{' '}
            {resultado.data.license.expired
              ? 'licença expirada'
              : resultado.data.license.active
                ? 'licença ativa'
                : 'licença inativa'}
            {resultado.data.overLimit && (
              <span className="ml-2 text-danger">· limite atingido</span>
            )}
          </>
        ) : (
          <> · {resultado.failure.message}</>
        )}
      </p>

      {resultado.ok ? (
        <UsagePanel usage={resultado.data} dias={dias} />
      ) : (
        <UsageUnavailable failure={resultado.failure} />
      )}
    </div>
  );
}

function Header({ dias }: { dias: number }) {
  return (
    <header className="space-y-4">
      <div>
        <p className="text-sm text-muted-foreground">Consumo da sua chave</p>
        <h1 className="mt-1 text-3xl font-bold">Uso</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Você paga pelo período, não por token. Os números existem para você enxergar o ritmo e o
          pico de cada janela de 60 minutos — a política de uso justo de{' '}
          <span className="text-primary">80 milhões de tokens por hora</span> é o único teto.
        </p>
      </div>

      {/* filtros numa linha acima do gráfico, como manda a spec de interação */}
      <nav className="flex flex-wrap gap-2" aria-label="Janela do histórico">
        {PRESETS.map((d) => (
          <Link
            key={d}
            href={`/painel/uso?dias=${d}`}
            aria-current={d === dias ? 'page' : undefined}
            className={`rounded-lg border px-3.5 py-1.5 text-xs font-medium transition ${
              d === dias
                ? 'border-primary/50 bg-primary/10 text-primary'
                : 'border-border bg-card text-muted-foreground hover:text-foreground'
            }`}
          >
            {d} dias
          </Link>
        ))}
      </nav>
    </header>
  );
}
