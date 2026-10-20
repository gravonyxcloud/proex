import type { Metadata } from 'next';
import Link from 'next/link';

import { FaqAccordion } from '@/components/marketing/faq';
import { PricingCards } from '@/components/marketing/pricing-cards';
import { Terminal } from '@/components/marketing/terminal';
import {
  BENEFITS,
  DISCLOSURE,
  FAIR_USE,
  FAIR_USE_BAND,
  HERO,
  MODELS,
  PURCHASE,
  STEPS,
  TERMINAL_NOTA,
  TERMINALS,
} from '@/lib/constants';
import { getActivePlans } from '@/lib/plans';

export const metadata: Metadata = {
  title: 'Proex — Claude Code ilimitado por API',
  description:
    'Planos por período com uso ilimitado e política de uso justo de 80 milhões de tokens por hora. PIX ou cartão, chave liberada na aprovação do pagamento.',
  alternates: { canonical: '/' },
};

function SectionTitle({
  id,
  titulo,
  sub,
}: {
  id?: string;
  titulo: string;
  sub?: string;
}) {
  return (
    <div id={id} className="mx-auto mb-10 max-w-3xl text-center scroll-mt-24">
      <h2 className="text-3xl font-bold sm:text-4xl">{titulo}</h2>
      {sub && <p className="mt-4 text-base leading-relaxed text-muted-foreground">{sub}</p>}
    </div>
  );
}

export default async function LandingPage() {
  const plans = await getActivePlans();

  return (
    <>
      {/* ---------------------------------------------------------------- HERO */}
      <section className="glow relative overflow-hidden border-b border-border">
        <div className="grid-bg absolute inset-0" aria-hidden />
        <div className="section relative z-10 pb-24 pt-20 sm:pb-28 sm:pt-28">
          <div className="mx-auto max-w-4xl text-center">
            <span className="badge fade-up">{HERO.rotulo}</span>

            <h1 className="fade-up mt-7 text-4xl font-bold leading-[1.08] sm:text-6xl" style={{ animationDelay: '80ms' }}>
              Seu projeto travou?
              <br />
              <span className="text-premium">Continue com o Claude Code.</span>
            </h1>

            <p className="fade-up mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-muted-foreground" style={{ animationDelay: '160ms' }}>
              {HERO.sub}
            </p>

            <div className="fade-up mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row" style={{ animationDelay: '240ms' }}>
              <Link href="#planos" className="btn-primary w-full px-8 py-4 text-base sm:w-auto">
                {HERO.cta}
                <span aria-hidden>→</span>
              </Link>
              <Link href="#como-funciona" className="btn-outline w-full px-8 py-4 text-base sm:w-auto">
                {HERO.ctaSec}
              </Link>
            </div>

            <p className="mt-7 font-mono text-sm text-muted-foreground">
              PIX ou cartão · chave no e-mail ·{' '}
              <span className="text-primary">{FAIR_USE.unlimitedLabel}</span>
            </p>

            <div className="mt-14 grid gap-4 sm:grid-cols-3">
              {[
                { k: 'Ilimitado', v: 'sem cota total no período' },
                { k: '4 modelos', v: 'Opus 5.5, Fable 5.1, Sonnet 5.5, Haiku 5.5' },
                { k: 'Terminal', v: 'Windows, macOS e Linux' },
              ].map((s) => (
                <div key={s.k} className="surface p-5 text-left">
                  <div className="font-display text-lg font-semibold text-primary">{s.k}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{s.v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- USO JUSTO */}
      <section className="section scroll-mt-20 py-20" id="uso-justo">
        <SectionTitle titulo={FAIR_USE_BAND.titulo} sub={FAIR_USE_BAND.texto} />

        <div className="surface overflow-hidden">
          <div className="border-b border-border bg-white/[0.02] px-6 py-4">
            <div className="flex items-center justify-between text-xs uppercase tracking-widest text-muted-foreground">
              <span>limite de ritmo</span>
              <span className="font-mono text-primary">{FAIR_USE.unlimitedLabel}</span>
            </div>
            <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="rate-bar h-full w-1/3 rounded-full opacity-80" />
            </div>
            <div className="mt-2 flex justify-between font-mono text-[11px] text-muted-foreground">
              <span>janela 0min</span>
              <span>janela 30min</span>
              <span>janela 60min — desliza</span>
            </div>
          </div>

          <dl className="grid divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
            {FAIR_USE_BAND.metricas.map((m) => (
              <div key={m.rotulo} className="p-6">
                <dt className="font-display text-3xl font-bold text-premium">{m.valor}</dt>
                <dd className="mt-1 text-sm font-medium text-foreground">{m.rotulo}</dd>
                <dd className="mt-2.5 text-xs leading-relaxed text-muted-foreground">{m.detalhe}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="surface mt-6 p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-primary">
            Leia antes de pagar
          </h3>
          <ul className="mt-4 grid gap-3 text-sm leading-relaxed text-muted-foreground sm:grid-cols-2">
            <li className="flex gap-3">
              <span className="text-primary" aria-hidden>—</span>
              Não somos a Anthropic nem parceiros oficiais. Você compra acesso por API.
            </li>
            <li className="flex gap-3">
              <span className="text-primary" aria-hidden>—</span>
              A chave só autentica chamadas de API: não entra no claude.ai, no app nem no Desktop.
            </li>
            <li className="flex gap-3">
              <span className="text-primary" aria-hidden>—</span>
              É terminal: no celular o Claude Code não roda.
            </li>
            <li className="flex gap-3">
              <span className="text-primary" aria-hidden>—</span>
              Uma chave, uma pessoa. Dividir suspende o acesso.
            </li>
          </ul>
        </div>
      </section>

      {/* ------------------------------------------------------------ MODELOS */}
      <section className="border-y border-border bg-card/40 py-20">
        <div className="section">
          <SectionTitle
            titulo="Seu acesso, todos os modelos."
            sub="Os quatro modelos vêm inclusos em todos os planos. Troque dentro do Claude Code com /model e compare o resultado e o consumo."
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {MODELS.map((m, i) => (
              <div key={m} className="surface surface-hover p-6">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                    modelo {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="h-2 w-2 rounded-full bg-success shadow-[0_0_10px_hsl(var(--success))]" />
                </div>
                <div className="mt-4 font-display text-xl font-semibold">{m}</div>
                <div className="mt-2 text-xs text-muted-foreground">incluso no período contratado</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- COMO FUNCIONA */}
      <section className="section scroll-mt-20 py-20" id="como-funciona">
        <SectionTitle titulo={STEPS.titulo} sub={STEPS.sub} />

        <ol className="cc-passos__grade grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.itens.map((s, i) => (
            <li key={s.titulo} className="surface relative p-6">
              <span className="font-mono text-xs text-primary">{String(i + 1).padStart(2, '0')}</span>
              <h3 className="mt-3 text-base font-semibold leading-snug">{s.titulo}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{s.texto}</p>
            </li>
          ))}
        </ol>

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          {TERMINALS.map((t) => (
            <Terminal key={t.sistema} sistema={t.sistema} linhas={t.linhas} />
          ))}
        </div>

        <div className="surface mt-6 p-6">
          <p className="text-sm leading-relaxed text-muted-foreground">
            {TERMINAL_NOTA}{' '}
            <code className="rounded bg-muted px-2 py-0.5 font-mono text-primary">
              {TERMINALS[0].linhas[2]}
            </code>
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            O seu código é o seu: ele passa pela ponte da Proex para autenticação e repasse ao
            provedor, como em qualquer revenda de acesso por API. Se a sua regra proíbe isso, é
            motivo para não comprar.
          </p>
        </div>
      </section>

      {/* --------------------------------------------------------- BENEFÍCIOS */}
      <section className="border-y border-border bg-card/40 py-20">
        <div className="section">
          <SectionTitle titulo={BENEFITS.titulo} sub={BENEFITS.sub} />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.itens.map((b) => (
              <div
                key={b.titulo}
                className={`surface p-6 ${b.destaque ? 'border-primary/40 bg-primary/[0.05]' : ''}`}
              >
                <h3 className="text-base font-semibold">{b.titulo}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{b.texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------- PLANOS */}
      <section className="section scroll-mt-20 py-20" id="planos">
        <SectionTitle
          titulo="Escolha o acesso que combina com o seu ritmo."
          sub="Você compra um período. O relógio começa na emissão da chave e não pausa. Sem cota total de tokens — só o limite de ritmo de 80 milhões por hora."
        />
        <PricingCards plans={plans} compact />

        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
          <span>Pagamento processado pelo Mercado Pago</span>
          <span aria-hidden>·</span>
          <span>Chave liberada na aprovação</span>
          <span aria-hidden>·</span>
          <span>7 dias de garantia</span>
        </div>
      </section>

      {/* ----------------------------------------------------- PAGAMENTO */}
      <section className="border-y border-border bg-card/40 py-20">
        <div className="section">
          <SectionTitle titulo={PURCHASE.titulo} />
          <div className="grid gap-5 lg:grid-cols-3">
            {PURCHASE.itens.map((p) => (
              <div key={p.destaque} className="surface p-6">
                <div className="font-display text-lg font-semibold text-primary">{p.destaque}</div>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{p.texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ FAQ */}
      <section className="section scroll-mt-20 py-20" id="faq">
        <SectionTitle titulo="Perguntas" sub="O que mais costuma aparecer antes da compra." />
        <FaqAccordion />
      </section>

      {/* --------------------------------------------------------------- FECHO */}
      <section className="glow relative overflow-hidden border-t border-border">
        <div className="section relative z-10 py-24 text-center">
          <h2 className="mx-auto max-w-2xl text-3xl font-bold leading-tight sm:text-4xl">
            Pronto para parar de contar crédito e{' '}
            <span className="text-premium">voltar a construir?</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-muted-foreground">
            Escolha um período, pague com PIX ou cartão e configure a chave no seu terminal em menos
            de dois minutos.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="#planos" className="btn-primary px-8 py-4 text-base">
              {HERO.cta}
              <span aria-hidden>→</span>
            </Link>
            <Link href="#faq" className="btn-outline px-8 py-4 text-base">
              Perguntas frequentes
            </Link>
          </div>
          <p className="mx-auto mt-8 max-w-2xl text-xs leading-relaxed text-muted-foreground">
            {DISCLOSURE}
          </p>
        </div>
      </section>
    </>
  );
}
