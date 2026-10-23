import 'server-only';

/**
 * Cliente mínimo da Messages API da Anthropic.
 *
 * SOMENTE backend: a chave nunca pode ir para o navegador.
 * Este módulo é a única porta de saída para a IA do suporte — o resto do
 * código nunca chama `fetch` direto para o provedor.
 *
 * Variáveis (todas server-side, sem NEXT_PUBLIC_):
 *   AI_SUPPORT_BASE_URL     padrão https://api.anthropic.com
 *   AI_SUPPORT_API_KEY      chave do provedor
 *   AI_SUPPORT_MODEL        padrão claude-opus-5-5
 *   AI_SUPPORT_TIMEOUT_MS   padrão 45000
 */

export interface AiMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiReply {
  text: string;
  model: string;
  /** motivo do provedor quando a resposta não foi entregue */
  stopReason: string | null;
}

export class AiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'AiError';
  }
}

function baseUrl(): string {
  return (process.env.AI_SUPPORT_BASE_URL?.trim() || 'https://api.anthropic.com').replace(/\/+$/, '');
}

function apiKey(): string {
  const key = process.env.AI_SUPPORT_API_KEY?.trim();
  if (!key) throw new AiError('AI_SUPPORT_API_KEY não configurada.', 503);
  return key;
}

export function aiModel(): string {
  return process.env.AI_SUPPORT_MODEL?.trim() || 'claude-opus-5-5';
}

function timeoutMs(): number {
  const n = Number(process.env.AI_SUPPORT_TIMEOUT_MS ?? 45000);
  return Number.isFinite(n) && n > 0 ? n : 45000;
}

/** true quando há chave configurada — o suporte funciona sem IA. */
export function aiConfigured(): boolean {
  return Boolean(process.env.AI_SUPPORT_API_KEY?.trim());
}

function errorMessage(parsed: unknown, status: number): string {
  if (typeof parsed === 'object' && parsed !== null) {
    const o = parsed as Record<string, unknown>;
    const err = o.error;
    if (typeof err === 'object' && err !== null) {
      const m = (err as Record<string, unknown>).message;
      if (typeof m === 'string' && m) return m;
    }
    if (typeof err === 'string' && err) return err;
    if (typeof o.message === 'string' && o.message) return o.message;
  }
  const map: Record<number, string> = {
    400: 'O provedor recusou a requisição da IA.',
    401: 'Chave da IA inválida no servidor.',
    403: 'Chave da IA sem permissão para este modelo.',
    404: 'Modelo da IA não encontrado no provedor.',
    429: 'O provedor limitou a taxa da IA.',
    529: 'O provedor da IA está sobrecarregado.',
  };
  return map[status] ?? `O provedor da IA respondeu ${status}.`;
}

/**
 * POST /v1/messages no formato Anthropic.
 * `system` vai separado (é onde entram as regras do suporte), `messages`
 * carrega só a conversa.
 */
export async function createMessage(input: {
  system: string;
  messages: AiMessage[];
  maxTokens?: number;
  temperature?: number;
}): Promise<AiReply> {
  const model = aiModel();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs());

  try {
    const res = await fetch(`${baseUrl()}/v1/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey(),
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: input.maxTokens ?? 1200,
        temperature: input.temperature ?? 0.3,
        system: input.system,
        messages: input.messages,
      }),
      cache: 'no-store',
      signal: controller.signal,
    });

    const text = await res.text();
    let parsed: unknown;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }

    if (!res.ok) throw new AiError(errorMessage(parsed, res.status), res.status, parsed);

    const body = parsed as {
      model?: string;
      stop_reason?: string | null;
      content?: Array<{ type: string; text?: string }>;
    };

    // Só blocos de texto interessam: thinking/tool_use não viram mensagem.
    const out = (body.content ?? [])
      .filter((b) => b.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text as string)
      .join('\n')
      .trim();

    if (!out) throw new AiError('A IA não retornou texto.', 502, parsed);

    return { text: out, model: body.model ?? model, stopReason: body.stop_reason ?? null };
  } catch (e: unknown) {
    if (e instanceof AiError) throw e;
    if (e instanceof Error && e.name === 'AbortError') {
      throw new AiError('A IA demorou demais para responder.', 504);
    }
    throw new AiError(e instanceof Error ? e.message : 'Falha ao chamar a IA.', 502);
  } finally {
    clearTimeout(timer);
  }
}
