import { AdminShell } from '@/components/admin/admin-shell';
import { SaquesManager } from '@/components/admin/saques-manager';
import { TaxasForm } from '@/components/admin/taxas-form';
import { loadSettings } from '@/lib/mp/fees';
import { formatBRL, formatPercent } from '@/lib/money';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Payment, Withdrawal } from '@/types/db';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Contabilidade', robots: { index: false, follow: false } };

type PagamentoFechado = Pick<
  Payment,
  'amount_brl' | 'fee_brl' | 'net_brl' | 'fee_source' | 'method' | 'paid_at'
>;

export default async function ContabilidadeAdmin() {
  const supabase = createAdminClient();

  const [settings, pagamentosRes, saquesRes] = await Promise.all([
    loadSettings(),
    // Só o que efetivamente entrou em caixa. pending/rejected/refunded ficam
    // de fora: estorno é dinheiro que voltou, não receita.
    supabase
      .from('payments')
      .select('amount_brl, fee_brl, net_brl, fee_source, method, paid_at')
      .eq('status', 'approved')
      .order('paid_at', { ascending: false }),
    supabase.from('withdrawals').select('*').order('withdrawn_at', { ascending: false }).limit(40),
  ]);

  const pagamentos = (pagamentosRes.data ?? []) as PagamentoFechado[];
  const saques = (saquesRes.data ?? []) as Withdrawal[];

  const bruto = somar(pagamentos.map((p) => Number(p.amount_brl)));
  const taxas = somar(pagamentos.map((p) => Number(p.fee_brl)));
  // net_brl é coluna gerada (amount_brl - fee_brl). Quando ela não veio (linha
  // antiga), o cálculo local dá o mesmo resultado.
  const liquido = somar(pagamentos.map((p) => Number(p.net_brl ?? Number(p.amount_brl) - Number(p.fee_brl))));
  const reserva = Math.round(((liquido * Number(settings.tax_percent)) / 100) * 100) / 100;
  const disponivel = Math.round((liquido - reserva) * 100) / 100;

  const retirado = somar(saques.map((s) => Number(s.amount_brl)));
  const saldo = Math.round((disponivel - retirado) * 100) / 100;

  const reais = pagamentos.filter((p) => p.fee_source === 'mercadopago').length;
  const estimadas = pagamentos.filter((p) => p.fee_source === 'estimada').length;

  const kpis = [
    { k: 'Bruto cobrado', v: formatBRL(bruto), sub: `${pagamentos.length} pagamentos aprovados` },
    {
      k: 'Taxas do gateway',
      v: formatBRL(taxas),
      sub: bruto > 0 ? `${formatPercent((taxas / bruto) * 100)} do bruto` : '—',
    },
    {
      k: 'Reserva de imposto',
      v: formatBRL(reserva),
      sub: `${formatPercent(Number(settings.tax_percent))} do líquido`,
    },
    {
      k: 'Disponível para saque',
      v: formatBRL(disponivel),
      sub: `líquido ${formatBRL(liquido)}`,
    },
    { k: 'Já retirado', v: formatBRL(retirado), sub: `${saques.length} lançamentos` },
    {
      k: 'Saldo em caixa',
      v: formatBRL(saldo),
      sub: saldo < 0 ? 'negativo: saques acima do líquido' : 'disponível − retirado',
    },
  ];

  return (
    <AdminShell
      titulo="Contabilidade"
      descricao="Bruto, taxa, líquido e o que já saiu do caixa. As taxas de cada pagamento são congeladas no momento da cobrança — mudar os valores aqui não reescreve o passado."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kpis.map((k) => (
          <div key={k.k} className="surface p-5">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{k.k}</div>
            <div
              className={`mt-2 font-display text-3xl font-bold ${
                k.k === 'Saldo em caixa' && saldo < 0 ? 'text-danger' : 'text-premium'
              }`}
            >
              {k.v}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="surface flex flex-wrap items-center justify-between gap-4 p-5 text-sm">
        <div>
          <strong className="text-foreground">Precisão das taxas.</strong>{' '}
          <span className="text-muted-foreground">
            {reais} pagamentos com taxa real do Mercado Pago, {estimadas} por estimativa
            {settings.updated_at && settings.updated_at !== new Date(0).toISOString()
              ? ` (configuração atualizada em ${new Date(settings.updated_at).toLocaleDateString('pt-BR')})`
              : ''}
            .
          </span>
        </div>
        {estimadas > 0 && (
          <span className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
            {estimadas} estimada{estimadas > 1 ? 's' : ''}
          </span>
        )}
      </div>

      <TaxasForm settings={settings} />

      <SaquesManager saques={saques} />
    </AdminShell>
  );
}

function somar(valores: number[]): number {
  return Math.round(valores.reduce((acc, v) => acc + (Number.isFinite(v) ? v : 0), 0) * 100) / 100;
}
