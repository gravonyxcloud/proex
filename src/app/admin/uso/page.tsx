import Link from 'next/link';

import { AdminShell } from '@/components/admin/admin-shell';
import { UsagePanel } from '@/components/panel/usage-panel';
import { UsageUnavailable } from '@/components/panel/usage-unavailable';
import { fetchUsage } from '@/lib/usage';
import { formatBRL } from '@/lib/money';
import { formatDate, relativeTime } from '@/lib/date';
import { createAdminClient } from '@/lib/supabase/admin';
import type { License } from '@/types/db';

export const dynamic = 'force-dynamic';

const PRESETS = [7, 14, 30, 90] as const;

export default async function UsoAdmin({
  searchParams,
}: {
  searchParams: { email?: string; dias?: string };
}) {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from('licenses')
    .select('id, key, key_hint, customer_email, plan_slug, status, expires_at, issued_at')
    .order('issued_at', { ascending: false })
    .limit(200);

  const licencas = (data ?? []) as License[];

  const requested = Number(searchParams.dias);
  const dias = PRESETS.includes(requested as (typeof PRESETS)[number]) ? requested : 30;
  const email = (searchParams.email ?? '').trim().toLowerCase();

  const alvo = email
    ? licencas.find((l) => l.customer_email.toLowerCase() === email && l.status === 'active') ??
      licencas.find((l) => l.customer_email.toLowerCase() === email)
    : undefined;

  const consumo = email
    ? await fetchUsage({ email, key: alvo?.key, days: dias })
    : null;

  return (
    <AdminShell
      titulo="Consumo"
      descricao="Leitura direta no gateway via GET /api/license/usage — o próprio gateway guarda o histórico, não há ingest. Janela, custo, série diária e modelos."
      acao={
        email ? (
          <Link href="/admin/uso" className="btn-ghost btn-sm">
            ← Todos os clientes
          </Link>
        ) : (
          <div className="rounded-lg border border-border bg-card px-4 py-2 font-mono text-xs text-muted-foreground">
            GET /api/license/usage?email=…&days={dias}
          </div>
        )
      }
    >
      {/* ----------------------------------------------------- filtro */}
      {!email && (
        <p className="text-sm text-muted-foreground">
          Escolha um cliente para ver o consumo dele. A busca usa o e-mail; a chave vai junto quando
          existe, que é o critério mais preciso do gateway.
        </p>
      )}

      {email && (
        <nav className="flex flex-wrap gap-2" aria-label="Janela do histórico">
          {PRESETS.map((d) => (
            <Link
              key={d}
              href={`/admin/uso?email=${encodeURIComponent(email)}&dias=${d}`}
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
      )}

      {/* ------------------------------------------------- consumo */}
      {email &&
        (consumo?.ok ? (
          <div className="space-y-4">
            <div className="surface flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm">
              <div>
                <span className="text-muted-foreground">Cliente</span>{' '}
                <span className="font-medium">{email}</span>
                <span className="ml-3 text-muted-foreground">plano</span>{' '}
                <span className="font-medium">{alvo?.plan_slug ?? '—'}</span>
              </div>
              <div className="text-muted-foreground">
                {consumo.data.license.expired ? (
                  <span className="text-danger">expirada</span>
                ) : consumo.data.license.active ? (
                  <span className="text-success">ativa</span>
                ) : (
                  <span>inativa</span>
                )}
                {consumo.data.license.restricted && (
                  <span className="ml-3 text-[#fab219]">
                    restrita a {consumo.data.license.allow?.length ?? 0} combo(s)
                  </span>
                )}
                <span className="ml-3 tabular-nums">
                  {formatBRL(consumo.data.usage.totals.cost)} no período
                </span>
              </div>
            </div>

            <UsagePanel usage={consumo.data} dias={dias} showInternal />
          </div>
        ) : (
          <UsageUnavailable failure={consumo!.failure} />
        ))}

      {/* ------------------------------------------------ lista de chaves */}
      <div className="surface overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold">
            Chaves{email ? '' : ' — escolha um cliente'}
          </h2>
        </div>

        {licencas.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">Nenhuma chave emitida ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Chave</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Plano</th>
                  <th className="px-4 py-3 font-medium">Emitida</th>
                  <th className="px-4 py-3 font-medium">Vencimento</th>
                  <th className="px-5 py-3 text-right font-medium">Consumo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {licencas.map((l) => {
                  const ativo = email === l.customer_email.toLowerCase();
                  return (
                    <tr
                      key={l.id}
                      className={`transition ${ativo ? 'bg-primary/[0.07]' : 'hover:bg-white/[0.02]'}`}
                    >
                      <td className="px-5 py-3.5 font-mono text-xs">{l.key_hint}</td>
                      <td className="px-4 py-3.5">
                        <div className="max-w-[240px] truncate">{l.customer_email}</div>
                      </td>
                      <td className="px-4 py-3.5">{l.plan_slug.replace('cc_', '').replace('d', ' dias')}</td>
                      <td className="px-4 py-3.5 text-xs text-muted-foreground" title={formatDate(l.issued_at)}>
                        {relativeTime(l.issued_at)}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">{formatDate(l.expires_at)}</td>
                      <td className="px-5 py-3.5 text-right">
                        <Link
                          href={`/admin/uso?email=${encodeURIComponent(l.customer_email)}&dias=${dias}`}
                          className="btn-outline btn-sm"
                        >
                          {ativo ? 'aberto' : 'ver'}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
