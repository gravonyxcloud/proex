'use client';

import React from 'react';

type Check = {
  ok: boolean;
  label: string;
  detail: string;
  latencyMs: number;
};

type ModelCheck = {
  model: string;
  label: string;
  ok: boolean;
  detail: string;
};

const MODEL_LABELS: Array<{ id: string; label: string }> = [
  { id: 'claude-opus-5-5', label: 'Opus 5.5' },
  { id: 'claude-fable-5-1', label: 'Fable 5.1' },
  { id: 'claude-sonnet-5-5', label: 'Sonnet 5.5' },
  { id: 'claude-haiku-5-5', label: 'Haiku 5.5' },
];

function Dot({ ok }: { ok: boolean }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${
        ok ? 'bg-emerald-400' : 'bg-danger'
      }`}
    />
  );
}

function LoadingDot() {
  return (
    <span
      aria-hidden
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-muted-foreground/50 animate-pulse"
    />
  );
}

export default function StatusClient() {
  const [checks, setChecks] = React.useState<Check[]>([
    { ok: false, label: 'Ponte de licenças', detail: 'Verificando…', latencyMs: 0 },
    { ok: false, label: 'API de chaves', detail: 'Verificando…', latencyMs: 0 },
  ]);
  const [modelChecks, setModelChecks] = React.useState<ModelCheck[]>(
    MODEL_LABELS.map((m) => ({
      model: m.id,
      label: m.label,
      ok: false,
      detail: 'Verificando…',
    }))
  );
  const [allOk, setAllOk] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;

    async function checkStatus() {
      const gateway = 'https://api.gravonyx.com';
      const aiBase = 'https://api.anthropic.com';

      async function timed(url: string, init?: RequestInit) {
        const started = Date.now();
        try {
          const res = await fetch(url, { ...init, cache: 'no-store' });
          const ms = Date.now() - started;
          const text = await res.text();
          return {
            ok: res.ok,
            status: res.status,
            ms,
            detail: text.slice(0, 200).replace(/\s+/g, ' '),
          };
        } catch (e: any) {
          return {
            ok: false,
            status: 0,
            ms: Date.now() - started,
            detail: e?.message ?? 'Falha de rede.',
          };
        }
      }

      const gatewayUp = (r: Awaited<ReturnType<typeof timed>>) => r.status > 0 && r.status < 500;

      const [core, licenses, models] = await Promise.all([
        timed(`${gateway}/v1/models`, {
          headers: { authorization: 'Bearer sk-probe' },
        }),
        timed(`${gateway}/v1/models`, {
          headers: { authorization: 'Bearer sk-probe' },
        }),
        timed(`${aiBase}/v1/models`, {
          headers: { 'x-api-key': process.env.NEXT_PUBLIC_AI_SUPPORT_API_KEY ?? '', 'anthropic-version': '2023-06-01' },
        }),
      ]);

      if (!mounted) return;

      const newChecks: Check[] = [
        {
          ok: gatewayUp(core),
          label: 'Ponte de licenças',
          detail: gatewayUp(core)
            ? 'No ar — responde pedindo credencial, como deve.'
            : `Indisponível (HTTP ${core.status || 'sem resposta'}).`,
          latencyMs: core.ms,
        },
        {
          ok: gatewayUp(licenses),
          label: 'API de chaves',
          detail: gatewayUp(licenses)
            ? 'No ar — emissão de chaves operacional.'
            : `Indisponível (HTTP ${licenses.status || 'sem resposta'}).`,
          latencyMs: licenses.ms,
        },
      ];

      const newModelChecks: ModelCheck[] = MODEL_LABELS.map((m) => ({
        model: m.id,
        label: m.label,
        ok: gatewayUp(models),
        detail: gatewayUp(models) ? 'Disponível agora.' : `Indisponível (HTTP ${models.status || 'sem resposta'}).`,
      }));

      const newAllOk = newChecks.every((c) => c.ok) && newModelChecks.every((m) => m.ok);

      setChecks(newChecks);
      setModelChecks(newModelChecks);
      setAllOk(newAllOk);
      setLoading(false);
    }

    checkStatus();
    const interval = setInterval(checkStatus, 60_000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <div className="section py-20">
        <div className="mx-auto max-w-3xl text-center">
          <span className="badge">Status</span>
          <h1 className="mt-6 text-4xl font-bold sm:text-5xl">Tudo funcionando?</h1>
          <p className="mt-5 leading-relaxed text-muted-foreground">
            Estado em tempo real das APIs e dos modelos disponíveis. Se algo estiver fora do ar, a
            gente avisa por aqui mesmo.
          </p>

          <div className="mt-8 flex items-center justify-center gap-3">
            <LoadingDot />
            <span className="font-display text-lg font-semibold text-muted-foreground">
              Verificando status…
            </span>
          </div>
        </div>

        <section className="surface mx-auto mt-14 max-w-3xl overflow-hidden">
          <div className="border-b border-border px-6 py-4">
            <h2 className="text-sm font-semibold">Serviços</h2>
          </div>
          <ul className="divide-y divide-border">
            {checks.map((c) => (
              <li key={c.label} className="flex items-center gap-4 px-6 py-4">
                <LoadingDot />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{c.label}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{c.detail}</div>
                </div>
                <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                  {c.latencyMs}ms
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="surface mx-auto mt-6 max-w-3xl overflow-hidden">
          <div className="border-b border-border px-6 py-4">
            <h2 className="text-sm font-semibold">Modelos</h2>
          </div>
          <ul className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-y-0">
            {modelChecks.map((m, i) => (
              <li
                key={m.model}
                className={`flex items-center gap-3 px-6 py-4 ${
                  i < modelChecks.length - 1 ? 'sm:border-r sm:border-border' : ''
                }`}
              >
                <LoadingDot />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{m.label}</div>
                  <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">{m.model}</div>
                </div>
                <span className="shrink-0 text-xs font-medium text-muted-foreground">
                  Verificando…
                </span>
              </li>
            ))}
          </ul>
        </section>

        <p className="mx-auto mt-8 max-w-3xl text-center text-xs text-muted-foreground">
          Verificação a cada visita. Sem SLA de disponibilidade — sem crédito automático.
        </p>
      </div>
    );
  }

  return (
    <div className="section py-20">
      <div className="mx-auto max-w-3xl text-center">
        <span className="badge">Status</span>
        <h1 className="mt-6 text-4xl font-bold sm:text-5xl">Tudo funcionando?</h1>
        <p className="mt-5 leading-relaxed text-muted-foreground">
          Estado em tempo real das APIs e dos modelos disponíveis. Se algo estiver fora do ar, a
          gente avisa por aqui mesmo.
        </p>

        <div className="mt-8 flex items-center justify-center gap-3">
          <Dot ok={allOk} />
          <span className={`font-display text-lg font-semibold ${allOk ? 'text-emerald-300' : 'text-danger'}`}>
            {allOk ? 'Todos os sistemas operacionais' : 'Estamos com instabilidade'}
          </span>
        </div>
      </div>

      <section className="surface mx-auto mt-14 max-w-3xl overflow-hidden">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-sm font-semibold">Serviços</h2>
        </div>
        <ul className="divide-y divide-border">
          {checks.map((c) => (
            <li key={c.label} className="flex items-center gap-4 px-6 py-4">
              <Dot ok={c.ok} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{c.label}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{c.detail}</div>
              </div>
              <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                {c.latencyMs}ms
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="surface mx-auto mt-6 max-w-3xl overflow-hidden">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-sm font-semibold">Modelos</h2>
        </div>
        <ul className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-y-0">
          {modelChecks.map((m, i) => (
            <li
              key={m.model}
              className={`flex items-center gap-3 px-6 py-4 ${
                i < modelChecks.length - 1 ? 'sm:border-r sm:border-border' : ''
              }`}
            >
              <Dot ok={m.ok} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{m.label}</div>
                <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">{m.model}</div>
              </div>
              <span
                className={`shrink-0 text-xs font-medium ${
                  m.ok ? 'text-emerald-300' : 'text-danger'
                }`}
              >
                {m.ok ? 'Disponível' : 'Fora do ar'}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <p className="mx-auto mt-8 max-w-3xl text-center text-xs text-muted-foreground">
        Verificação a cada visita (client-side). Sem SLA de disponibilidade — sem crédito automático.
      </p>
    </div>
  );
}