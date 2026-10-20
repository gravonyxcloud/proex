'use client';

import Link from 'next/link';
import { useState } from 'react';

import { useToast } from '@/components/ui/toaster';
import { formatDaysLeft, formatDate } from '@/lib/date';
import type { LicenseStatus } from '@/types/db';

const STATUS_LABEL: Record<LicenseStatus, string> = {
  active: 'Ativa',
  expired: 'Expirada',
  revoked: 'Revogada',
};

const STATUS_STYLE: Record<LicenseStatus, string> = {
  active: 'border-success/40 bg-success/15 text-success',
  expired: 'border-danger/40 bg-danger/15 text-danger',
  revoked: 'border-border bg-muted text-muted-foreground',
};

interface Props {
  licenseKey: string;
  keyHint: string;
  status: LicenseStatus;
  expiresAt: string;
  issuedAt: string;
  planSlug: string;
}

export function KeyCard({ licenseKey, keyHint, status, expiresAt, issuedAt, planSlug }: Props) {
  const toast = useToast();
  const [revelada, setRevelada] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const bloqueada = status !== 'active';
  const dias = planSlug.replace('cc_', '').replace('d', ' dias');

  async function copiar() {
    try {
      await navigator.clipboard.writeText(licenseKey);
      setCopiado(true);
      toast.success('Chave copiada.');
      setTimeout(() => setCopiado(false), 2200);
    } catch {
      toast.error('Não foi possível copiar. Selecione o texto à mão.');
    }
  }

  return (
    <div className="surface overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-white/[0.02] px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold">Chave da API</span>
          <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[status]}`}>
            {STATUS_LABEL[status]}
          </span>
        </div>
        <span className="font-mono text-xs text-muted-foreground">{dias}</span>
      </div>

      <div className="p-6">
        <div className="rounded-xl border border-border bg-[#0d0c0b] p-4">
          <code className="block break-all font-mono text-sm text-primary">
            {bloqueada ? keyHint : revelada ? licenseKey : keyHint}
          </code>

          <div className="mt-4 flex flex-wrap gap-2">
            {!bloqueada && (
              <button onClick={() => setRevelada((v) => !v)} className="btn-outline btn-sm">
                {revelada ? 'ocultar' : 'revelar'}
              </button>
            )}
            <button onClick={copiar} className="btn-primary btn-sm" disabled={bloqueada}>
              {copiado ? 'copiado ✓' : 'copiar chave'}
            </button>
            <Link href="/#como-funciona" className="btn-ghost btn-sm">
              como usar
            </Link>
            <Link href="/precos" className="btn-ghost btn-sm">
              renovar
            </Link>
          </div>
        </div>

        <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-muted/40 p-3.5">
            <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Vencimento</dt>
            <dd className="mt-1 font-medium">{formatDate(expiresAt)}</dd>
          </div>
          <div className="rounded-xl border border-border bg-muted/40 p-3.5">
            <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Restante</dt>
            <dd className="mt-1 font-medium">{formatDaysLeft(expiresAt)}</dd>
          </div>
          <div className="rounded-xl border border-border bg-muted/40 p-3.5">
            <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Emitida em</dt>
            <dd className="mt-1 font-medium">{formatDate(issuedAt)}</dd>
          </div>
        </dl>

        <div className="mt-5 rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold">Configurar no terminal</h3>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-[#0d0c0b] p-4 font-mono text-xs leading-relaxed text-foreground/85">{`setx ANTHROPIC_BASE_URL "https://api.gravonyx.com"
setx ANTHROPIC_API_KEY "${revelada && !bloqueada ? licenseKey : 'sk-px-...'}"`}</pre>
          <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
            Windows: abra um terminal novo depois do <code className="text-primary">setx</code>.
            macOS/Linux: use <code className="text-primary">export</code> no mesmo terminal.
          </p>
        </div>

        {bloqueada && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3.5 text-sm">
            <span>
              {status === 'revoked'
                ? 'Esta chave foi revogada e não autentica mais chamadas.'
                : 'O período terminou. Renove para voltar a usar a mesma chave.'}
            </span>
            <Link href="/precos" className="btn-primary btn-sm">
              {status === 'revoked' ? 'Falar com o suporte' : 'Renovar agora'}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
