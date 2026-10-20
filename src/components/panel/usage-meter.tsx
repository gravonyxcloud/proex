import { formatPercent, compactNumber } from '@/lib/money';
import { formatDateTime } from '@/lib/date';
import type { CurrentHourUsage, UsageLimits } from '@/types/db';

/**
 * Medidor da janela móvel de 60 min — "uma razão contra um limite" é meter,
 * não gráfico de pizza.
 *
 * Cor do preenchimento carrega severidade (accent → warning → danger), sempre
 * acompanhada de ÍCONE + RÓTULO: status nunca se comunica só por cor.
 * A trilha é um degrau mais fraco do MESMO tom, então o estado se lê no bar inteiro.
 *
 * Cores validadas pelo dataviz (`validate_palette.js --mode dark --surface #1e1b1a`)
 * para o par de séries; severidade vem da status palette fixa.
 */
const SERIES = '#d95926'; // acima do limite de severidade — normal
const WARNING = '#fab219';
const CRITICAL = '#d03b3b';

type Severity = 'ok' | 'warning' | 'critical';

function severityOf(hour: CurrentHourUsage): Severity {
  if (hour.exceeded || hour.percentUsed >= 100) return 'critical';
  if (hour.percentUsed >= 80) return 'warning';
  return 'ok';
}

const SEVERITY: Record<
  Severity,
  { fill: string; label: string; icon: string; text: string }
> = {
  ok: { fill: SERIES, label: 'Dentro do limite', icon: '✓', text: 'text-success' },
  warning: { fill: WARNING, label: 'Aproximando do limite', icon: '!', text: 'text-[#fab219]' },
  critical: { fill: CRITICAL, label: 'Limite atingido', icon: '×', text: 'text-danger' },
};

interface Props {
  hour: CurrentHourUsage;
  /** nem todo endpoint devolve `limits`; cai no `hour.limit` */
  limits?: UsageLimits;
  overLimit?: boolean;
  /** 'lg' = figura única da página de uso; 'sm' = bloco compacto do painel */
  size?: 'lg' | 'sm';
}

export function UsageMeter({ hour, limits, overLimit = false, size = 'lg' }: Props) {
  const severity = severityOf(hour);
  const s = SEVERITY[severity];
  const pct = Math.max(0, Math.min(100, Number.isFinite(hour.percentUsed) ? hour.percentUsed : 0));
  // Valor real típico é ~0,1%: sem largura mínima o preenchimento some.
  const width = hour.used > 0 ? `max(2px, ${pct}%)` : '0%';
  const hit = overLimit || severity === 'critical';
  const teto = hour.limit || limits?.hourlyTokenLimit || 80_000_000;
  const janela = limits?.rollingWindowMinutes ?? 60;

  return (
    <section className="surface p-6" aria-label="Janela móvel de 60 minutos">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">
            {size === 'lg' ? 'Última hora' : 'Janela móvel de 60 min'}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {janela} min · teto de {compactNumber(teto)} tokens
          </p>
        </div>

        {/* ícone + rótulo: o estado nunca depende só da cor */}
        <span
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
            severity === 'critical'
              ? 'border-danger/50 bg-danger/10 text-danger'
              : severity === 'warning'
                ? 'border-[#fab219]/50 bg-[#fab219]/10 text-[#fab219]'
                : 'border-success/40 bg-success/10 text-success'
          }`}
        >
          <span aria-hidden className="grid h-4 w-4 place-items-center rounded-full border border-current text-[10px] leading-none">
            {s.icon}
          </span>
          {hit ? 'HTTP 429 ativo' : s.label}
        </span>
      </div>

      <div className="mt-5 flex items-end gap-4">
        <span
          className={`font-display font-bold leading-none tracking-tight ${
            size === 'lg' ? 'text-5xl' : 'text-3xl'
          }`}
          style={{ color: 'hsl(var(--foreground))' }}
        >
          {formatPercent(hour.percentUsed)}
        </span>
        <span className="pb-1 text-sm text-muted-foreground">do teto da hora</span>
      </div>

      {/* trilha = mesmo tom, opaco baixo; preenchimento = cor de severidade */}
      <div
        className="mt-4 h-3 w-full overflow-hidden rounded-full"
        style={{ backgroundColor: 'rgba(217,89,38,0.16)' }}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={hour.limit}
        aria-valuenow={hour.used}
        aria-valuetext={`${formatPercent(hour.percentUsed)} do limite de ${hour.limit.toLocaleString('pt-BR')} tokens por hora`}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width, backgroundColor: s.fill }}
        />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
        <Stat label="Usado" value={compactNumber(hour.used)} />
        <Stat label="Restante" value={compactNumber(hour.remaining)} />
        <Stat label="Teto" value={compactNumber(hour.limit)} />
        <Stat label="Zera em" value={hour.resetAt ? formatDateTime(hour.resetAt) : '—'} />
      </dl>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium tabular-nums">{value}</dd>
    </div>
  );
}
