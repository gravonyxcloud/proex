/**
 * Nomes PÚBLICOS de combo — o que o cliente pode ver.
 *
 * O gateway devolve em `byModel` o modelo interno que a rota escolheu
 * (ex.: `mimo-v2.6-flash-free`, provider `opencode`). Isso é detalhe de
 * implementação da ponte e NUNCA pode chegar ao cliente: ele comprou um
 * COMBO, e o combo é que tem nome público.
 *
 * REGRA PADRÃO: o que não estiver mapeado aqui é CENSURADO no modo cliente.
 * Encher o mapa é seguro; errar para o lado de não mapear também é seguro.
 * Errar para o lado de mapear demais é o que vaza informação interna.
 */
export const PUBLIC_MODEL_LABELS: Readonly<Record<string, string>> = {
  // combos públicos -> como o gateway pode se referir a eles.
  // Ajuste/complete conforme a sua tabela de combos do 9Router.
  'claude-opus-5-5': 'Claude Opus 5.5',
  'claude-sonnet-5-5': 'Claude Sonnet 5.5',
  'claude-haiku-5-5': 'Claude Haiku 5.5',
  'claude-fable-5-1': 'Claude Fable 5.1',
};

/**
 * Rotulo publico para uma linha de consumo.
 * `null` = interno, nao pode ser exibido ao cliente.
 */
export function publicModelLabel(
  model: string | null | undefined,
  provider?: string | null,
): string | null {
  if (model) {
    const direto = PUBLIC_MODEL_LABELS[model];
    if (direto) return direto;
  }
  // um id interno que CONTÉM o nome de um combo publico ainda e interno:
  // so aceita match exato, nunca por substring, senao `...opus...` vaza.
  if (provider) {
    const porProvider = PUBLIC_MODEL_LABELS[provider];
    if (porProvider) return porProvider;
  }
  return null;
}

/** Agrupa linhas internas por rótulo público, somando tudo que virou mesmo combo. */
export function groupByPublicLabel<
  T extends { model?: string | null; provider?: string | null; requests: number; tokens: number; cost: number },
>(rows: T[]): { label: string; requests: number; tokens: number; cost: number; internals: number }[] {
  const mapa = new Map<string, { label: string; requests: number; tokens: number; cost: number; internals: number }>();

  for (const r of rows) {
    const label = publicModelLabel(r.model, r.provider);
    if (!label) continue;
    const atual = mapa.get(label) ?? { label, requests: 0, tokens: 0, cost: 0, internals: 0 };
    atual.requests += r.requests;
    atual.tokens += r.tokens;
    atual.cost += r.cost;
    atual.internals += 1;
    mapa.set(label, atual);
  }

  return [...mapa.values()].sort((a, b) => b.tokens - a.tokens);
}

/** "1 requisição" / "12 requisições" — sem plural torto. */
export function plural(n: number, singular: string, pluralizado: string): string {
  return `${n.toLocaleString('pt-BR')} ${n === 1 ? singular : pluralizado}`;
}
