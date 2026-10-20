import 'server-only';

import type { LicenseEnvelope, LicenseUsageResponse } from '@/types/db';

/**
 * Cliente da API privada de licencas do gateway (https://api.gravonyx.com).
 *
 * SOMENTE backend. O segredo privado nunca pode ir para o navegador —
 * este modulo e protegido pelo pacote `server-only`.
 *
 * Endpoints:
 *   POST /api/license/activate  -> cria chave
 *   POST /api/license/renew     -> estende a mesma chave
 *   GET  /api/license/usage     -> consumo de tokens (painel)
 *   GET  /v1/models             -> sonda de saude
 */

export class LicenseApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'LicenseApiError';
  }
}

const BASE = () => (process.env.LICENSE_API_BASE ?? 'https://api.gravonyx.com').replace(/\/+$/, '');

function secret(): string {
  const s = process.env.LICENSE_API_SECRET;
  if (!s) throw new Error('LICENSE_API_SECRET não configurada.');
  return s;
}

type Plan = '3d' | '7d' | '15d' | '30d';

/** "cc_15d" -> "15d" */
export function planSlugToApi(slug: string): Plan {
  const m = /^cc_(\d+)d$/.exec(slug);
  if (!m) throw new Error(`Plano inválido: ${slug}`);
  const days = Number(m[1]);
  const allowed = [3, 7, 15, 30] as const;
  if (!(allowed as readonly number[]).includes(days)) {
    throw new Error(`Plano não suportado pela API de licenças: ${slug}`);
  }
  return `${days}d` as Plan;
}

function errorMessage(parsed: unknown, status: number): string {
  if (typeof parsed === 'object' && parsed !== null) {
    const o = parsed as Record<string, unknown>;
    for (const k of ['error', 'message']) {
      if (typeof o[k] === 'string' && o[k]) return o[k] as string;
    }
  }
  const map: Record<number, string> = {
    400: 'A API exigiu email ou key e não recebeu.',
    401: 'Segredo de licença inválido no servidor.',
    404: 'Licença não encontrada no gateway.',
    503: 'API de licenças não configurada.',
  };
  return map[status] ?? `A API de licenças respondeu ${status}.`;
}

async function request<T>(opts: {
  method: 'GET' | 'POST';
  path: string;
  query?: Record<string, string | number | undefined>;
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
}): Promise<T> {
  const url = new URL(`${BASE()}${opts.path}`);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    }
  }

  const res = await fetch(url, {
    method: opts.method,
    headers: {
      'x-license-secret': secret(),
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      ...opts.headers,
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    cache: 'no-store',
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

  if (!res.ok) throw new LicenseApiError(errorMessage(parsed, res.status), res.status, parsed);

  return parsed as T;
}

/**
 * Cria uma chave nova.
 * `orderId` SEMPRE e enviado: e o dedupe que impede duas ativacoes para o
 * mesmo pagamento quando o Mercado Pago reenvia o webhook.
 *
 * A resposta envolve tudo em `license` — nao existe `key` no topo.
 */
export async function activateLicense(input: {
  email: string;
  planSlug: string;
  orderId: string;
}): Promise<LicenseEnvelope> {
  return request<LicenseEnvelope>({
    method: 'POST',
    path: '/api/license/activate',
    body: {
      email: input.email,
      plan: planSlugToApi(input.planSlug),
      orderId: input.orderId,
    },
    headers: { 'x-customer-email': input.email },
  });
}

/** Estende a MESMA chave a partir do vencimento atual (ou de agora, se ja venceu). */
export async function renewLicense(input: {
  email: string;
  key: string;
  planSlug: string;
  orderId: string;
}): Promise<LicenseEnvelope> {
  return request<LicenseEnvelope>({
    method: 'POST',
    path: '/api/license/renew',
    body: {
      email: input.email,
      key: input.key,
      plan: planSlugToApi(input.planSlug),
      orderId: input.orderId,
    },
    headers: {
      'x-customer-email': input.email,
      'x-api-key': input.key,
    },
  });
}

/**
 * Consumo de tokens do gateway — leitura, nao escrita: nao ha ingest, o
 * proprio gateway guarda o historico.
 *
 * `key` e o identificador mais preciso; sem ele o gateway usa a chave mais
 * recente do `email`. `days` corta a janela (1 a 365, padrao 30).
 */
export async function getLicenseUsage(input: {
  email?: string;
  key?: string;
  days?: number;
}): Promise<LicenseUsageResponse> {
  const headers: Record<string, string> = {};
  if (input.email) headers['x-customer-email'] = input.email;
  if (input.key) headers['x-api-key'] = input.key;

  const days = Math.min(365, Math.max(1, Math.round(input.days ?? 30)));

  return request<LicenseUsageResponse>({
    method: 'GET',
    path: '/api/license/usage',
    query: { email: input.email, key: input.key, days },
    headers,
  });
}

/**
 * Revogacao LOCAL: a API do gateway nao expoe um endpoint de revogacao,
 * entao aqui marcamos `licenses.status = 'revoked'` e escondemos a chave
 * no painel. O pedido de um endpoint upstream segue pendente.
 */
export const UPSTREAM_REVOKE_PENDING = true;

/** Sonda minima de saude — usada no admin e no /api/health. */
export async function pingLicenseApi(): Promise<{ ok: boolean; detail: string }> {
  try {
    const res = await fetch(`${BASE()}/v1/models`, {
      method: 'GET',
      headers: { Authorization: 'Bearer sk-probe' },
      cache: 'no-store',
    });
    // 401/403 significa que a ponte esta de pe e pedindo credencial valida.
    const up = res.status > 0 && res.status < 500;
    return { ok: up, detail: `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : 'falha de rede' };
  }
}
