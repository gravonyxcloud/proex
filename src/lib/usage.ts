import 'server-only';

import { getLicenseUsage, LicenseApiError } from '@/lib/license-api';
import type { LicenseUsageResponse } from '@/types/db';

/**
 * Consulta de consumo no gateway, com degradacao controlada.
 *
 * Nao ha ingest: o gateway guarda o historico e devolve serie pronta.
 * Qualquer falha vira `ok:false` com um motivo legivel, para o painel
 * mostrar um estado vazio honesto em vez de derrubar a pagina.
 */

export type UsageFailure = {
  reason: 'sem_segredo' | 'nao_encontrada' | 'credencial_invalida' | 'erro';
  message: string;
};

export type UsageResult =
  | { ok: true; data: LicenseUsageResponse }
  | { ok: false; failure: UsageFailure };

const BY_STATUS: Record<number, UsageFailure> = {
  400: { reason: 'credencial_invalida', message: 'A API exigiu e-mail ou chave e não recebeu.' },
  401: { reason: 'sem_segredo', message: 'LICENSE_API_SECRET ausente ou inválida no servidor.' },
  404: { reason: 'nao_encontrada', message: 'Nenhuma licença encontrada no gateway para este cliente.' },
  503: { reason: 'sem_segredo', message: 'API de uso não configurada no gateway.' },
};

export async function fetchUsage(input: {
  email: string;
  key?: string | null;
  days?: number;
}): Promise<UsageResult> {
  try {
    const data = await getLicenseUsage({
      email: input.email,
      key: input.key ?? undefined,
      days: input.days,
    });
    return { ok: true, data };
  } catch (err) {
    if (err instanceof LicenseApiError) {
      return { ok: false, failure: BY_STATUS[err.status] ?? { reason: 'erro', message: err.message } };
    }
    if (err instanceof Error && err.message.includes('LICENSE_API_SECRET')) {
      return {
        ok: false,
        failure: {
          reason: 'sem_segredo',
          message: 'LICENSE_API_SECRET não configurada no .env.local.',
        },
      };
    }
    return {
      ok: false,
      failure: {
        reason: 'erro',
        message: err instanceof Error ? err.message : 'Falha ao consultar o gateway.',
      },
    };
  }
}

/** Bloco de estado vazio/falha, compartilhado pelo painel e pelo admin. */
export function usageFailureText(failure: UsageFailure): { titulo: string; corpo: string } {
  switch (failure.reason) {
    case 'sem_segredo':
      return {
        titulo: 'Consumo indisponível',
        corpo: `${failure.message} Enquanto isso, a política de uso justo vale: 80 milhões de tokens por hora.`,
      };
    case 'nao_encontrada':
      return {
        titulo: 'Ainda sem consumo registrado',
        corpo: `${failure.message} Assim que a chave processar o primeiro comando, os números aparecem aqui.`,
      };
    case 'credencial_invalida':
      return {
        titulo: 'Chave não reconhecida',
        corpo: `${failure.message} Confirme a chave com o suporte.`,
      };
    default:
      return {
        titulo: 'Não foi possível ler o consumo',
        corpo: `${failure.message} Tente recarregar em instantes.`,
      };
  }
}
