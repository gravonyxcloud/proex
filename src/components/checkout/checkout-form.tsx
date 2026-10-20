'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { useToast } from '@/components/ui/toaster';
import { formatBRL } from '@/lib/money';
import type { Plan } from '@/types/db';

type Etapa = 'dados' | 'pix' | 'redirecionando';

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

export function CheckoutForm({ plan, prefilledEmail }: { plan: Plan; prefilledEmail?: string }) {
  const router = useRouter();
  const toast = useToast();

  const [etapa, setEtapa] = useState<Etapa>('dados');
  const [email, setEmail] = useState(prefilledEmail ?? '');
  const [method, setMethod] = useState<'pix' | 'card'>('pix');
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

  useEffect(() => () => stopPoll(), []);

  async function startPolling(orderId: string) {
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
          toast.success('Pagamento aprovado! Sua chave está pronta.');
          router.push(
            `/checkout/retorno?orderId=${orderId}&email=${encodeURIComponent(email)}`,
          );
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

  async function pagarComPix(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setBusy(true);

    try {
      const res = await fetch('/api/checkout/pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, planSlug: plan.slug }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? 'Não foi possível gerar o PIX.');

      setPix(data as PixResponse);
      setEtapa('pix');
      await startPolling((data as PixResponse).orderId);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao iniciar o pagamento.');
    } finally {
      setBusy(false);
    }
  }

  async function pagarComCartao(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setBusy(true);

    try {
      const res = await fetch('/api/checkout/preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, planSlug: plan.slug }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? 'Não foi possível iniciar o pagamento.');

      setEtapa('redirecionando');
      // Checkout Pro hospedado: a aprovação volta pelo webhook e a
      // /checkout/retorno confirma por polling.
      window.location.assign(data.initPoint as string);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao iniciar o pagamento.');
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
      /* selecione manualmente */
    }
  }

  /* ------------------------------------------------------------- ETAPA PIX */
  if (etapa === 'pix' && pix) {
    return (
      <div className="surface p-7">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Pague com PIX</h2>
          <span className="badge">expira em 30 min</span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {pix.planName} · <span className="text-foreground">{formatBRL(pix.amount)}</span>
        </p>

        <div className="mt-6 grid place-items-center gap-5">
          {pix.qrBase64 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`data:image/png;base64,${pix.qrBase64}`}
              alt="QR Code do PIX"
              className="h-56 w-56 rounded-xl border border-border bg-white p-3"
            />
          ) : (
            <div className="grid h-56 w-56 place-items-center rounded-xl border border-border bg-muted text-center text-sm text-muted-foreground">
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
              'Assim que o pagamento aprovar, a chave aparece aqui.'
            )}
          </div>

          <button
            onClick={() => {
              stopPoll();
              setAguardando(false);
              setPix(null);
              setEtapa('dados');
            }}
            className="btn-ghost text-sm"
          >
            Trocar forma de pagamento
          </button>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------- ETAPA REDIRECIONANDO */
  if (etapa === 'redirecionando') {
    return (
      <div className="surface grid place-items-center p-10 text-center">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="mt-5 font-medium">Abrindo o checkout do Mercado Pago…</p>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Se nada acontecer, verifique o bloqueador de pop-up.
        </p>
        <button onClick={() => setEtapa('dados')} className="btn-ghost mt-5 text-sm">
          Voltar
        </button>
      </div>
    );
  }

  /* --------------------------------------------------------- ETAPA DADOS */
  return (
    <form onSubmit={method === 'pix' ? pagarComPix : pagarComCartao} className="surface p-7">
      <h2 className="text-xl font-bold">Seus dados</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        A chave vai para este e-mail e para o seu painel.
      </p>

      <div className="mt-6">
        <label htmlFor="email" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
          E-mail da compra
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          className="input"
          placeholder="voce@exemplo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {!prefilledEmail && (
          <p className="mt-1.5 text-xs text-muted-foreground">
            Se você já tem conta, use o mesmo e-mail para a licença cair no painel.
          </p>
        )}
      </div>

      <fieldset className="mt-6">
        <legend className="mb-2.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Forma de pagamento
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              { id: 'pix', t: 'PIX', d: 'Aprovação em segundos' },
              { id: 'card', t: 'Cartão de crédito', d: 'Visa, Master, Elo, Amex' },
            ] as const
          ).map((opt) => (
            <label
              key={opt.id}
              className={`cursor-pointer rounded-xl border p-4 transition ${
                method === opt.id
                  ? 'border-primary/60 bg-primary/10'
                  : 'border-border bg-muted/40 hover:border-primary/30'
              }`}
            >
              <input
                type="radio"
                name="method"
                className="sr-only"
                checked={method === opt.id}
                onChange={() => setMethod(opt.id)}
              />
              <div className="text-sm font-semibold">{opt.t}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{opt.d}</div>
            </label>
          ))}
        </div>
      </fieldset>

      {erro && (
        <p className="mt-5 rounded-lg border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-sm">
          {erro}
        </p>
      )}

      <div className="mt-6 flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/40 px-4 py-3">
        <div>
          <div className="text-sm font-medium">{plan.name}</div>
          <div className="text-xs text-muted-foreground">uso ilimitado no período</div>
        </div>
        <div className="font-display text-2xl font-bold text-premium">
          {formatBRL(plan.price_brl)}
        </div>
      </div>

      <button type="submit" className="btn-primary mt-5 w-full py-4 text-base" disabled={busy}>
        {busy
          ? 'Preparando…'
          : method === 'pix'
            ? 'Gerar código PIX'
            : `Pagar com cartão · ${formatBRL(plan.price_brl)}`}
      </button>

      <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">
        Pagamento processado pelo Mercado Pago. Ao continuar você concorda com os termos de uso e a
        política de reembolso de 7 dias. Uma chave, uma pessoa.
      </p>

      <p className="mt-3 text-center text-xs text-muted-foreground">
        Já tem chave?{' '}
        <Link href="/login" className="text-primary hover:underline">
          Entrar no painel
        </Link>
      </p>
    </form>
  );
}
