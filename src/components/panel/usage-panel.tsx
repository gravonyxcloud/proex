import { plural, publicModelLabel } from '@/lib/model-labels';
import { compactNumber, formatBRL, formatPercent } from '@/lib/money';
import { formatDate } from '@/lib/date';
import { UsageMeter } from '@/components/panel/usage-meter';
import type { DailyUsage, LicenseUsageResponse, ModelUsage } from '@/types/db';

/**
 * Painel de consumo.
 *
 * Formas escolhidas pelo trabalho do dado (dataviz):
 *   - números de cabeça  -> KPI de stat tiles, não barra
 *   - razão contra limite -> medidor (componente UsageMeter)
 *   - magnitude por dia   -> colunas, UMA cor (série única, sem legenda)
 *   - magnitude por modelo-> barras horizontais (nomes longos)
 *
 * MODELOS INTERNOS NÃO APARECEM NO PAINEL DO CLIENTE: `showInternal=false`
 * censura qualquer linha do gateway cujo nome não tenha rótulo público
 * (ex.: `mimo-v2.6-flash-free`, `opencode`). O admin vê tudo.
 * Tudo em laranja validado `#d95926` sobre `#1e1b1a`; rótulos em token de texto,
 * nunca na cor da série.
 */
const SERIES = '#d95926';

interface Props {
  usage: LicenseUsageResponse;
  dias: number;
  /** Cliente vê só rótulos públicos (default). Admin vê os nomes do gateway. */
  showInternal?: boolean;
}

export function UsagePanel({ usage, dias, showInternal = false }: Props) {
  const { currentHour, totals, allTime, daily, byModel } = usage.usage;
  const janelaMin = usage.limits?.rollingWindowMinutes ?? 60;

  /** Somente modelos com rótulo público no modo cliente. */
  const modelosVisiveis = showInternal
    ? byModel
    : byModel.filter((m) => publicModelLabel(m.model, m.provider));

  return (
    <div className="space-y-6">
      <UsageMeter hour={currentHour} limits={usage.limits} overLimit={usage.overLimit} />

      {/* -------------------------------------------------------- KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label={`Tokens em ${dias} dias`} value={compactNumber(totals.tokens)} />
        <Tile label="Requisições no período" value={compactNumber(totals.requests)} />
        <Tile label="Custo no período" value={formatBRL(totals.cost)} />
        <Tile label="Primeiro pedido" value={formatDate(allTime.firstRequestAt ?? null)} />
      </div>

      {/* ------------------------------------------------- série diária */}
      <DailyColumns daily={daily} />

      {/* ---------------------------------------------- modelos mais usados */}
      {modelosVisiveis.length === 0 ? (
        <section className="surface p-6" aria-label="Modelos mais usados">
          <h2 className="text-sm font-semibold">Modelos mais usados</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            {showInternal
              ? 'Sem requisições na janela.'
              : 'Nenhum modelo público registrado na janela selecionada.'}
          </p>
        </section>
      ) : (
        <ModelBars
          models={modelosVisiveis.map((m) => ({
            ...m,
            // só rótulo público chega ao cliente; o nome interno nunca é impresso
            label: publicModelLabel(m.model, m.provider)!,
          }))}
        />
      )}

      {/* ------------------------------------------ tabela de detalhamento */}
      <details className="surface">
        <summary className="cursor-pointer px-6 py-4 text-sm font-semibold [&::-webkit-details-marker]:hidden">
          Ver como tabela
        </summary>
        <div className="overflow-x-auto border-t border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-6 py-3 font-medium">Dia</th>
                <th className="px-4 py-3 text-right font-medium">Requisições</th>
                <th className="px-4 py-3 text-right font-medium">Prompt</th>
                <th className="px-4 py-3 text-right font-medium">Conclusão</th>
                <th className="px-4 py-3 text-right font-medium">Tokens</th>
                <th className="px-6 py-3 text-right font-medium">Custo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[...daily].reverse().map((d) => (
                <tr key={d.date} className="hover:bg-white/[0.02]">
                  <td className="px-6 py-2.5 whitespace-nowrap">{d.date}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {d.requests.toLocaleString('pt-BR')}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {d.promptTokens.toLocaleString('pt-BR')}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {d.completionTokens.toLocaleString('pt-BR')}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                    {d.tokens.toLocaleString('pt-BR')}
                  </td>
                  <td className="px-6 py-2.5 text-right tabular-nums">{formatBRL(d.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Quando <code className="text-primary">exceeded</code> fica verdadeiro, as requisições
        recebem <strong className="text-foreground">HTTP 429</strong> até o consumo mais antigo
        sair da janela de {janelaMin} minutos. O limite é verificado antes
        do roteamento. Custo é estimativa do gateway no período.
      </p>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface p-5">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold leading-none">{value}</div>
    </div>
  );
}

/** Colunas por dia: magnitude comparável, série única, sem legenda. */
function DailyColumns({ daily }: { daily: DailyUsage[] }) {
  if (daily.length === 0) {
    return (
      <section className="surface p-6">
        <h2 className="text-sm font-semibold">Tokens por dia</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Nenhum dia com consumo na janela selecionada.
        </p>
      </section>
    );
  }

  const max = Math.max(...daily.map((d) => d.tokens), 1);
  const topIndex = daily.reduce((best, d, i) => (d.tokens > daily[best].tokens ? i : best), 0);
  const ticks = [max, max / 2, 0];

  return (
    <section className="surface p-6" aria-label="Tokens por dia">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">Tokens por dia</h2>
        <p className="text-xs text-muted-foreground">
          série única · maior dia {formatDate(daily[topIndex].date)}
        </p>
      </div>

      <div className="mt-6 flex gap-6">
        {/* eixo y: hairline sólida, recuada */}
        <div className="flex w-12 shrink-0 flex-col justify-between py-0 text-right text-[11px] text-muted-foreground tabular-nums">
          {ticks.map((t, i) => (
            <span key={i}>{t <= 0 ? '0' : compactNumber(t)}</span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              aria-hidden
              className="absolute inset-x-0 border-t border-[#383835]"
              style={{ top: `${(i / 2) * 100}%` }}
            />
          ))}

          <div className="relative flex h-40 items-end gap-[3px]">
            {daily.map((d, i) => {
              const h = d.tokens > 0 ? Math.max(2, (d.tokens / max) * 100) : 0;
              const isTop = i === topIndex;
              return (
                <div
                  key={d.date}
                  tabIndex={0}
                  className="group relative flex h-full flex-1 items-end justify-center outline-none"
                  aria-label={`${d.date}: ${d.tokens.toLocaleString('pt-BR')} tokens em ${d.requests} requisições`}
                >
                  <div
                    className="w-full max-w-[24px] rounded-t-[4px] transition-opacity group-hover:opacity-80 group-focus-visible:ring-2 group-focus-visible:ring-primary/60"
                    style={{
                      height: `${h}%`,
                      backgroundColor: SERIES,
                      // valor real zero: deixa a marca ir ao baseline sem fingir dado
                      opacity: d.tokens > 0 ? 1 : 0,
                      borderTopLeftRadius: h > 0 ? 4 : 0,
                    }}
                  />
                  {/* rótulo direto só no extremo — nunca um número em cada barra */}
                  {isTop && (
                    <span className="pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium text-muted-foreground">
                      {compactNumber(d.tokens)}
                    </span>
                  )}
                  {/* tooltip em hover E foco de teclado */}
                  <span className="pointer-events-none absolute -top-9 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-[#161413] px-2.5 py-1.5 text-[11px] shadow-lg group-hover:block group-focus-visible:block">
                    <span className="font-medium text-foreground">{d.date}</span>{' '}
                    <span className="tabular-nums text-muted-foreground">
                      · {d.tokens.toLocaleString('pt-BR')} tok · {d.requests} req
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-2 ml-[72px] flex justify-between text-[11px] text-muted-foreground">
        <span>{daily[0].date}</span>
        <span>{daily[daily.length - 1].date}</span>
      </div>
    </section>
  );
}

/** Modelos mais usados: nomes longos pedem barras horizontais. */
function ModelBars({
  models,
}: {
  models: Array<{ label: string } & ModelUsage>;
}) {
  if (models.length === 0) {
    return (
      <section className="surface p-6">
        <h2 className="text-sm font-semibold">Modelos mais usados</h2>
        <p className="mt-3 text-sm text-muted-foreground">Sem requisições na janela.</p>
      </section>
    );
  }

  // Ordena aqui mesmo: a legenda diz "mais usados", então a ordem do array
  // vindo do gateway não pode definir o ranking.
  const top = [...models].sort((a, b) => b.tokens - a.tokens).slice(0, 10);
  const max = Math.max(...top.map((m) => m.tokens), 1);

  return (
    <section className="surface p-6" aria-label="Modelos mais usados">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">Modelos mais usados</h2>
        <p className="text-xs text-muted-foreground">série única · {top.length} de 20</p>
      </div>

      <ul className="mt-5 space-y-3.5">
        {top.map((m, i) => (
          <li key={`${m.label}-${i}`} tabIndex={0} className="group outline-none">
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span className="min-w-0 truncate font-mono text-muted-foreground">
                {m.label}
              </span>
              {/* valor na ponta da barra: identidade vem do texto, cor só reforça magnitude */}
              <span className="shrink-0 font-medium tabular-nums text-foreground">
                {compactNumber(m.tokens)} tok
              </span>
            </div>
            <div className="mt-1.5 h-4 w-full overflow-hidden rounded-[4px]" style={{ backgroundColor: 'rgba(217,89,38,0.16)' }}>
              <div
                className="h-full rounded-r-[4px] transition-opacity group-hover:opacity-80 group-focus-visible:ring-2 group-focus-visible:ring-primary/60"
                style={{
                  width: `${Math.max(1, (m.tokens / max) * 100)}%`,
                  backgroundColor: SERIES,
                }}
              />
            </div>
            <span className="mt-1 block text-[11px] text-muted-foreground tabular-nums">
              {plural(m.requests, 'requisição', 'requisições')} · {formatBRL(m.cost)}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-5 text-[11px] text-muted-foreground">
        Escala relativa ao modelo mais usado ({formatPercent(100, 0)} do topo ={' '}
        {compactNumber(max)} tokens).
      </p>
    </section>
  );
}
