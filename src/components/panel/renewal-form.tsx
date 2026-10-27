'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';

import { useToast } from '@/components/ui/toaster';
import { formatBRL } from '@/lib/money';
import type { Plan } from '@/types/db';

type Etapa = 'plano' | 'pix' | 'sucesso';

interface PixResponse {
  orderId: string;
  amount: number;
  planName: string;
  paymentId: string;
  status: string;
  qrCode: string;
  qrBase64: string;
  expiresAt: string;
}

const PIX_POLL_MS = 3000;
const PIX_TIMEOUT_MS = 32 * 60_000;

export function RenewalForm({
  planos,
  licenseKey,
  licenseHint,
  currentPlanSlug
}: {
  planos: Plan[];
  licenseKey: string;
  licenseHint: string;
  currentPlanSlug: string;
}) {
  const toast = useToast();
  const [etapa, setEtapa] = useState<Etapa>('plano');
  const [planSelecionado, setPlanSelecionado] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pix, setPix] = useState<PixResponse | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [aguardando, setAguardando] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopPoll() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  async function startPolling(orderId: string, email: string) {
    const started = Date.now();
    setAguardando(true);

    stopPoll();
    pollRef.current = setInterval(async () => {
      if (Date.now() - started > PIX_TIMEOUT_MS) {
        stopPoll();
        setAguardando(false);
        setErro('O código PIX expirou. Gere um novo.');
        return;
      }

      try {
        const res = await fetch(
          `/api/checkout/status?orderId=${orderId}&email=${encodeURIComponent(email)}`,
        );
        if (!res.ok) return;
        const data = await res.json();

        if (data.status === 'approved' && data.license) {
          stopPoll();
          setAguardando(false);
          setEtapa('sucesso');
          toast.success('Renovação aprovada! Sua chave foi estendida.');
        } else if (data.status === 'rejected' || data.status === 'cancelled') {
          stopPoll();
          setAguardando(false);
          setErro('O pagamento não foi aprovado. Tente novamente.');
        }
      } catch {
        /* rede oscilou: tenta de novo no próximo tick */
      }
    }, PIX_POLL_MS);
  }

  async function gerarPix(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!planSelecionado) return;

    setErro(null);
    setBusy(true);

    try {
      const res = await fetch('/api/checkout/pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planSlug: planSelecionado.slug }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? 'Não foi possível gerar o PIX.');

      setPix(data as PixResponse);
      setEtapa('pix');
      // Obtém email do usuário logado via supabase - vamos pegar do session
      const sessionRes = await fetch('/api/auth/session');
      const sessionData = await sessionRes.json();
      const email = sessionData?.user?.email;

      if (email) {
        await startPolling(data.orderId, email);
      }
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao iniciar o pagamento.');
    } finally {
      setBusy(false);
    }
  }

  async function copiarPix() {
    if (!pix?.qrCode) return;
    try {
      await navigator.clipboard.writeText(pix.qrCode);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast.error('Não foi possível copiar. Selecione o texto à mão.');
    }
  }

  if (etapa === 'sucesso') {
    return (
      <div className="surface p-6 text-center">
        <div className="mx-auto h-12 w-12 rounded-full border border-success/40 bg-success/10 flex items-center justify-center text-success text-xl">
          ✓
        </div>
        <h3 className="mt-4 text-lg font-semibold">Renovação confirmada!</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Sua chave <code className="font-mono text-primary">{licenseHint}</code> foi estendida.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          O novo vencimento reflete o plano {planSelecionado?.name ?? 'selecionado'}.
        </p>
        <button
          onClick={() => {
            setEtapa('plano');
            setPix(null);
            setPlanSelecionado(null);
            window.location.reload();
          }}
          className="btn-primary mt-5"
        >
          Fechar
        </button>
      </div>
    );
  }

  if (etapa === 'pix' && pix) {
    return (
      <div className="surface p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Pague com PIX para renovar</h2>
          <span className="badge">expira em 30 min</span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {pix.planName} · <span className="text-foreground">{formatBRL(pix.amount)}</span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Renova a chave <code className="font-mono">{licenseHint}</code> somando o período ao vencimento atual.
        </p>

        <div className="mt-6 grid place-items-center gap-5">
          {pix.qrBase64 ? (
            <img
              src={`data:image/png;base64,${pix.qrBase64}`}
              alt="QR Code do PIX"
              className="h-48 w-48 rounded-xl border border-border bg-white p-3"
            />
          ) : (
            <div className="grid h-48 w-48 place-items-center rounded-xl border border-border bg-muted text-center text-sm text-muted-foreground">
              QR indisponível — use o código abaixo
            </div>
          )}

          <div className="w-full">
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Pix copia e cola
            </label>
            <div className="flex gap-2">
              <input readOnly className="input font-mono text-xs" value={pix.qrCode} />
              <button onClick={copiarPix} className="btn-outline shrink-0">
                {copiado ? 'copiado ✓' : 'copiar'}
              </button>
            </div>
          </div>

          <div className="w-full rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-center text-sm">
            {aguardando ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 animate-pulse-soft rounded-full bg-primary" />
                Aguardando confirmação do Mercado Pago…
              </span>
            ) : (
              'Assim que o pagamento aprovar, a chave será renovada automaticamente.'
            )}
          </div>

          <button
            onClick={() => {
              stopPoll();
              setAguardando(false);
              setPix(null);
              setEtapa('plano');
            }}
            className="btn-ghost text-sm"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  // Etapa 'plano'
  return (
    <form onSubmit={gerarPix} className="surface p-6">
      <h2 className="text-lg font-semibold">Renovar licença</h2>
      <p className="mt-1.5 text-xs text-muted-foreground">
        Mantém a mesma chave (<code className="font-mono">{licenseHint}</code>) e soma o prazo ao vencimento atual.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {planos.map((p) => (
          <label
            key={p.slug}
            className={`cursor-pointer rounded-xl border p-4 transition ${
              planSelecionado?.slug === p.slug
                ? 'border-primary/60 bg-primary/10'
                : 'border-border bg-muted/40 hover:border-primary/30'
            }`}
          >
            <input
              type="radio"
              name="plan"
              className="sr-only"
              checked={planSelecionado?.slug === p.slug}
              onChange={() => setPlanSelecionado(p)}
              required
            />
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">{p.name}</div>
                <div className="text-xs text-muted-foreground">
                  {p.description}
                </div>
              </div>
              <div className="font-display text-xl font-bold text-premium">
                {formatBRL(p.price_brl)}
              </div>
            </div>
          </label>
        ))}
      </div>

      {erro && (
        <p className="mt-4 rounded-lg border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-sm">
          {erro}
        </p>
      )}

      <button type="submit" className="btn-primary mt-5 w-full py-3" disabled={busy || !planSelecionado}>
        {busy ? 'Gerando PIX…' : 'Gerar código PIX'}
      </button>

      <p className="mt-3 text-center text-xs text-muted-foreground">
        {' '}
        <Link href="/precos" className="text-primary hover:underline">
          Ver todos os planos
        </Link>
      </p>
    </form>
  );
}