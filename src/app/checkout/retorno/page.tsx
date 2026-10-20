'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';

import { useToast } from '@/components/ui/toaster';
import { formatBRL } from '@/lib/money';
import { formatDaysLeft, formatDate } from '@/lib/date';

interface StatusResponse {
  status: string;
  licenseIssued: boolean;
  licenseError: string | null;
  amount: number;
  planSlug: string;
  paidAt: string | null;
  license: { key: string; keyHint: string; status: string; expiresAt: string } | null;
}

const POLL_MS = 2500;
const TIMEOUT_MS = 5 * 60_000;

function RetornoInterno() {
  const params = useSearchParams();
  const toast = useToast();

  const orderId = params.get('orderId') ?? '';
  const email = (params.get('email') ?? '').toLowerCase();

  const [data, setData] = useState<StatusResponse | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [revelada, setRevelada] = useState(false);
  const [mostrandoChave, setMostrandoChave] = useState(false);

  const startedAt = useRef(Date.now());
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopped = useRef(false);

  const check = useCallback(async () => {
    if (stopped.current || !orderId || !email) return;

    try {
      const res = await fetch(
        `/api/checkout/status?orderId=${orderId}&email=${encodeURIComponent(email)}`,
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        stopped.current = true;
        setErro(body?.error ?? 'Pedido não encontrado.');
        return;
      }

      const json = (await res.json()) as StatusResponse;
      setData(json);

      if (json.status === 'approved') {
        stopped.current = true;
        if (timer.current) clearInterval(timer.current);
        setMostrandoChave(true);
        if (json.license) toast.success('Pagamento aprovado. Sua chave está pronta!');
        else if (json.licenseError) toast.error('Pagamento aprovado, mas a chave falhou.');
      } else if (json.status === 'rejected' || json.status === 'cancelled') {
        stopped.current = true;
        if (timer.current) clearInterval(timer.current);
        setErro('O pagamento não foi aprovado.');
      }
    } catch {
      /* tenta de novo */
    }
  }, [orderId, email, toast]);

  useEffect(() => {
    if (!orderId || !email) {
      setErro('Pedido inválido.');
      return;
    }

    void check();
    timer.current = setInterval(() => {
      if (Date.now() - startedAt.current > TIMEOUT_MS) {
        if (timer.current) clearInterval(timer.current);
        setErro('Tempo esgotado. O pagamento pode ainda não ter sido confirmado.');
        return;
      }
      void check();
    }, POLL_MS);

    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [check, orderId, email]);

  async function copiarChave() {
    const key = data?.license?.key;
    if (!key) return;
    try {
      await navigator.clipboard.writeText(key);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* selecione manualmente */
    }
  }

  if (erro) {
    return (
      <div className="surface border-danger/40 p-8 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-danger/15 text-xl text-danger">
          !
        </div>
        <h1 className="mt-5 text-2xl font-bold">Não conseguimos confirmar</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{erro}</p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button onClick={() => { startedAt.current = Date.now(); stopped.current = false; setErro(null); void check(); }} className="btn-outline">
            Tentar novamente
          </button>
          <Link href="/suporte" className="btn-ghost">
            Falar com o suporte
          </Link>
        </div>
      </div>
    );
  }

  if (!data || !data.license) {
    return (
      <div className="surface p-10 text-center">
        <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <h1 className="mt-6 text-2xl font-bold">Confirmando o pagamento…</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          O Mercado Pago está processando. Isso leva alguns segundos — não feche esta página.
        </p>
        <div className="mx-auto mt-7 max-w-sm space-y-2 text-left text-sm">
          {[
            'Aguardando confirmação do Mercado Pago',
            'Ativando a sua licença',
            'Entregando a chave',
          ].map((s, i) => (
            <div key={s} className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-4 py-2.5">
              <span className={`h-2 w-2 rounded-full ${i === 0 ? 'animate-pulse-soft bg-primary' : 'bg-border'}`} />
              <span className="text-muted-foreground">{s}</span>
            </div>
          ))}
        </div>
        {data?.licenseError && (
          <p className="mt-5 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-foreground">
            Pagamento recebido. A emissão da chave está demorando — ele vai aparecer no seu painel em
            instantes.
          </p>
        )}
        <Link href="/painel" className="btn-ghost mt-6">
          Ir para o painel
        </Link>
      </div>
    );
  }

  const licenca = data.license;

  return (
    <div className="surface overflow-hidden">
      <div className="border-b border-border bg-success/10 px-7 py-5">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-success/20 text-success">✓</span>
          <div>
            <h1 className="text-xl font-bold">Pagamento aprovado</h1>
            <p className="text-sm text-muted-foreground">
              {formatBRL(data.amount)} · chave liberada na hora
            </p>
          </div>
        </div>
      </div>

      <div className="p-7">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Sua chave de API
        </h2>

        <div className="mt-3 rounded-xl border border-border bg-[#0d0c0b] p-4">
          <code className="block break-all font-mono text-sm text-primary">
            {revelada ? licenca.key : licenca.keyHint}
          </code>
          <div className="mt-3.5 flex flex-wrap gap-2">
            <button onClick={() => setRevelada((v) => !v)} className="btn-outline btn-sm">
              {revelada ? 'ocultar' : 'revelar'}
            </button>
            <button onClick={copiarChave} className="btn-primary btn-sm">
              {copiado ? 'copiado ✓' : 'copiar chave'}
            </button>
            <Link href="#como-usar" className="btn-ghost btn-sm">
              como usar
            </Link>
          </div>
        </div>

        <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-3">
          {[
            { k: 'Plano', v: data.planSlug.replace('cc_', '').replace('d', ' dias') },
            { k: 'Expira em', v: `${formatDate(licenca.expiresAt)} · ${formatDaysLeft(licenca.expiresAt)}` },
            { k: 'Pagamento', v: data.paidAt ? formatDate(data.paidAt) : 'confirmado' },
          ].map((row) => (
            <div key={row.k} className="rounded-xl border border-border bg-muted/40 p-3.5">
              <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">{row.k}</dt>
              <dd className="mt-1 font-medium">{row.v}</dd>
            </div>
          ))}
        </dl>

        <div id="como-usar" className="mt-7 scroll-mt-24 rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold">Configure no seu terminal</h3>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-[#0d0c0b] p-4 font-mono text-xs leading-relaxed text-foreground/85">{`setx ANTHROPIC_BASE_URL "https://api.gravonyx.com"
setx ANTHROPIC_API_KEY "${revelada ? licenca.key : 'sk-px-...'}"`}</pre>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            No Windows abra um terminal <strong className="text-foreground">novo</strong> depois do
            setx. Depois, entre na pasta do projeto e rode{' '}
            <code className="text-primary">claude</code>.
          </p>
        </div>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Link href="/painel" className="btn-primary flex-1">
            Ir para o meu painel
          </Link>
          <Link href="/" className="btn-outline flex-1">
            Voltar ao início
          </Link>
        </div>

        <p className="mt-5 text-center text-xs text-muted-foreground">
          A chave também foi enviada para <span className="text-foreground">{email}</span>.
        </p>
      </div>
    </div>
  );
}

export default function RetornoPage() {
  return (
    <div className="section py-16">
      <div className="mx-auto max-w-xl">
        <Suspense
          fallback={
            <div className="surface grid place-items-center p-10">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          }
        >
          <RetornoInterno />
        </Suspense>
      </div>
    </div>
  );
}
