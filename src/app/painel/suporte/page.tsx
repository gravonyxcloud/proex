import Link from 'next/link';

import { SupportForm } from '@/components/panel/support-form';
import { createClient } from '@/lib/supabase/server';
import type { License, Order } from '@/types/db';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Suporte' };

export default async function SuportePainelPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [licRes, ordRes] = await Promise.all([
    supabase
      .from('licenses')
      .select('id, plan_slug, status, key_hint, expires_at, issued_at')
      .eq('customer_id', user.id)
      .order('issued_at', { ascending: false })
      .limit(5),
    supabase
      .from('orders')
      .select('id, external_reference, plan_slug, amount_brl, status, created_at')
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const licencas = (licRes.data ?? []) as Pick<
    License,
    'id' | 'plan_slug' | 'status' | 'key_hint' | 'expires_at' | 'issued_at'
  >[];
  const ordens = (ordRes.data ?? []) as Pick<
    Order,
    'id' | 'external_reference' | 'plan_slug' | 'amount_brl' | 'status' | 'created_at'
  >[];

  const contexto = [
    ...licencas.map((l) => `chave ${l.key_hint} · ${l.plan_slug} · ${l.status}`),
    ...ordens.map((o) => `pedido ${o.external_reference} · ${o.plan_slug} · ${o.status}`),
  ].join('\n');

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm text-muted-foreground">Atendimento</p>
        <h1 className="mt-1 text-3xl font-bold">Suporte</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Chave que não chega ou não autentica é problema nosso. Descreva o que aconteceu — já
          anexamos o contexto da sua conta para o atendimento não precisar perguntar de novo.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <SupportForm contexto={contexto} email={user.email ?? ''} />

        <div className="space-y-5">
          <div className="surface p-5">
            <h2 className="text-sm font-semibold">Diagnóstico rápido</h2>
            <ul className="mt-3.5 space-y-3 text-sm leading-relaxed text-muted-foreground">
              <li>
                <strong className="text-foreground">Não autentica.</strong> Confirme que{' '}
                <code className="text-primary">ANTHROPIC_BASE_URL</code> aponta para{' '}
                <code className="text-primary">https://api.gravonyx.com</code> e que você abriu um
                terminal novo depois do <code className="text-primary">setx</code>.
              </li>
              <li>
                <strong className="text-foreground">Rate limit.</strong> É o uso justo de 80M
                tokens/hora agindo; a janela desliza sozinha em 60 minutos.
              </li>
              <li>
                <strong className="text-foreground">Chave expirada.</strong> Veja o vencimento no{' '}
                <Link href="/painel" className="text-primary hover:underline">
                  início do painel
                </Link>{' '}
                e renove mantendo a mesma chave.
              </li>
            </ul>
          </div>

          <div id="reembolso" className="surface scroll-mt-24 p-5">
            <h2 className="text-sm font-semibold">Pedido de reembolso</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              7 dias corridos da compra, 100% do valor no mesmo método, em até 5 dias úteis.
              Descreva o motivo no formulário ao lado marcando a opção de reembolso.
            </p>
            <Link href="/suporte#reembolso" className="btn-outline mt-4 w-full text-xs">
              Ler a política completa
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
