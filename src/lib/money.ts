const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export function formatBRL(value: number | string): string {
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return 'R$ —';
  return brl.format(n);
}

/** 89.90 -> "89.90" (formato aceito pelo Mercado Pago) */
export function toMPAmount(value: number | string): number {
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n) || n <= 0) throw new Error('Valor de pagamento inválido.');
  return Math.round(n * 100) / 100;
}

export function pricePerDay(price: number, dias: number): number {
  if (dias <= 0) return 0;
  return Math.round((price / dias) * 100) / 100;
}

/**
 * Compactação automática de números de contagem — 1.284 / 12,9 mil / 4,2 mi.
 * Separador brasileiro; o valor cheio fica no tooltip/tabela.
 */
export function compactNumber(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const n = Math.abs(value);
  if (n < 1_000) return Math.round(value).toLocaleString('pt-BR');
  if (n < 1_000_000) return `${(value / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  if (n < 1_000_000_000)
    return `${(value / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  return `${(value / 1_000_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} bi`;
}

/** Percentual na escala 0–100 que vem do gateway (0.15625 = 0,16%). */
export function formatPercent(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '—';
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: digits })}%`;
}
