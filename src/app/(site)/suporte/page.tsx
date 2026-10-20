import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Suporte',
  description: 'Como falar com o suporte Proex e pedir reembolso.',
  alternates: { canonical: '/suporte' },
};

export default function SuportePage() {
  return (
    <div className="section py-20">
      <div className="mx-auto max-w-3xl text-center">
        <span className="badge">Ajuda</span>
        <h1 className="mt-6 text-4xl font-bold sm:text-5xl">Fale com a gente.</h1>
        <p className="mt-5 leading-relaxed text-muted-foreground">
          Chave que não chega ou não autentica é problema nosso e a gente resolve. Pelo painel o
          atendimento é mais rápido, porque já conseguimos ver a sua licença.
        </p>
      </div>

      <div className="mx-auto mt-14 grid max-w-4xl gap-5 md:grid-cols-3">
        {[
          {
            t: 'Suporte pelo painel',
            d: 'Abra a área logada e use a aba Suporte. Identificamos a compra e a chave na hora.',
            a: { label: 'Abrir meu painel', href: '/painel' },
          },
          {
            t: 'Primeira compra',
            d: 'Se ainda não tem conta, crie uma com o mesmo e-mail da compra que a licença aparece sozinha.',
            a: { label: 'Criar conta', href: '/cadastro' },
          },
          {
            t: 'Como configurar',
            d: 'Passo a passo para instalar o Claude Code e apontar para a ponte da Proex.',
            a: { label: 'Ver passo a passo', href: '/#como-funciona' },
          },
        ].map((c) => (
          <div key={c.t} className="surface flex flex-col p-6">
            <h2 className="text-lg font-semibold">{c.t}</h2>
            <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">{c.d}</p>
            <Link href={c.a.href} className="btn-outline mt-6 w-full">
              {c.a.label}
            </Link>
          </div>
        ))}
      </div>

      <div id="reembolso" className="surface mx-auto mt-16 max-w-4xl scroll-mt-24 p-8">
        <h2 className="text-2xl font-bold">Reembolso em 7 dias</h2>
        <div className="mt-5 space-y-4 text-sm leading-relaxed text-muted-foreground">
          <p>
            Se não serviu, você mesmo pede o reembolso pelo painel, em até{' '}
            <strong className="text-foreground">7 dias corridos</strong> da compra. Devolvemos 100% do
            valor pago, no mesmo método usado na compra, em até 5 dias úteis.
          </p>
          <p>
            A garantia vale para plano errado, expectativa não atendida e desistência. Não vale para
            licença suspensa por compartilhamento (uma chave, uma pessoa) nem para indisponibilidade
            do seu próprio projeto.
          </p>
          <p>
            Não temos SLA de disponibilidade: se a ponte cair, a gente avisa, corrige e trata caso a
            caso. Não há crédito automático.
          </p>
        </div>

        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/login?next=/painel" className="btn-primary">
            Pedir reembolso no painel
          </Link>
          <Link href="/precos" className="btn-outline">
            Ver planos
          </Link>
        </div>
      </div>

      <div className="surface mx-auto mt-6 max-w-4xl p-8">
        <h2 className="text-xl font-bold">Antes de abrir um chamado</h2>
        <ul className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
          <li>
            <strong className="text-foreground">Não recebi a chave.</strong> Confirme o e-mail digitado
            no checkout e olhe o spam. Depois fale com o suporte pelo painel.
          </li>
          <li>
            <strong className="text-foreground">A chave não autentica.</strong> Veja se{' '}
            <code className="text-primary">ANTHROPIC_BASE_URL</code> aponta para a ponte e se você
            abriu um terminal novo depois do <code className="text-primary">setx</code>.
          </li>
          <li>
            <strong className="text-foreground">Chegou &quot;rate limit&quot;.</strong> É o uso justo
            de 80 milhões de tokens por hora atuando; a janela desliza sozinha em 60 minutos.
          </li>
        </ul>
      </div>
    </div>
  );
}
