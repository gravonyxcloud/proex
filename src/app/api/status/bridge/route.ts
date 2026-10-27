import { NextResponse } from 'next/server';
import { pingLicenseApi } from '@/lib/license-api';

export const dynamic = 'force-dynamic';

export async function GET() {
  const [licenses, anthropic] = await Promise.all([
    pingLicenseApi(),
    (async () => {
      try {
        const aiBase = (process.env.AI_SUPPORT_BASE_URL?.trim() || 'https://api.anthropic.com').replace(/\/+$/, '');
        const aiKey = process.env.AI_SUPPORT_API_KEY?.trim();
        if (!aiKey) return { ok: false, status: 0, ms: 0, detail: 'IA não configurada.' };
        const started = Date.now();
        const res = await fetch(`${aiBase}/v1/models`, {
          headers: { 'x-api-key': aiKey, 'anthropic-version': '2023-06-01' },
          cache: 'no-store',
        });
        const ms = Date.now() - started;
        const text = await res.text();
        return {
          ok: res.ok,
          status: res.status,
          ms,
          detail: text.slice(0, 200).replace(/\s+/g, ' '),
        };
      } catch (e: any) {
        return { ok: false, status: 0, ms: Date.now() - (Date.now()), detail: e?.message ?? 'Falha de rede.' };
      }
    })(),
  ]);

  const gatewayUp = (r: { ok: boolean; status?: number; detail?: string }) => r.ok || (r.status && r.status > 0 && r.status < 500);

  const checks = [
    {
      ok: gatewayUp(licenses),
      label: 'Ponte de licenças',
      detail: gatewayUp(licenses)
        ? 'No ar — responde pedindo credencial, como deve.'
        : `Indisponível (HTTP ${licenses.detail || 'sem resposta'}).`,
      latencyMs: 0,
    },
    {
      ok: gatewayUp(anthropic),
      label: 'API de chaves',
      detail: gatewayUp(anthropic)
        ? 'No ar — emissão de chaves operacional.'
        : `Indisponível (HTTP ${anthropic.status || 'sem resposta'}).`,
      latencyMs: 0,
    },
  ];

  const modelChecks = [
    { id: 'claude-opus-5-5', label: 'Opus 5.5' },
    { id: 'claude-fable-5-1', label: 'Fable 5.1' },
    { id: 'claude-sonnet-5-5', label: 'Sonnet 5.5' },
    { id: 'claude-haiku-5-5', label: 'Haiku 5.5' },
  ].map((m) => ({
    model: m.id,
    label: m.label,
    ok: gatewayUp(anthropic),
    detail: gatewayUp(anthropic) ? 'Disponível agora.' : `Indisponível (HTTP ${anthropic.status || 'sem resposta'}).`,
  }));

  const allOk = checks.every((c) => c.ok) && modelChecks.every((m) => m.ok);

  return NextResponse.json({ checks, modelChecks, allOk });
}