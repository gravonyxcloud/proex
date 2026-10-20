import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin', robots: { index: false, follow: false } };

/**
 * Guard de segundo nível: o middleware já redireciona, mas a verificação
 * aqui roda no servidor do componente e é quem de fato protege o conteúdo
 * caso o middleware seja contornado.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login?next=/admin');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.role !== 'admin') redirect('/painel');

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-5 py-10 sm:px-8">
      <div className="mb-6 flex items-center justify-between gap-4 border-b border-border pb-5">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary font-display text-sm font-bold text-primary-foreground shadow-glow">
            PX
          </span>
          <span className="font-display text-lg font-semibold">Proex</span>
          <span className="ml-2 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
            admin
          </span>
        </Link>

        <div className="flex items-center gap-3 text-sm">
          <Link href="/painel" className="btn-ghost btn-sm">
            Meu painel
          </Link>
        </div>
      </div>

      {children}
    </div>
  );
}