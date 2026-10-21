import { AccountForm } from '@/components/panel/account-form';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Conta' };

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export default async function ContaPainelPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [profileRes, licenseRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name, created_at')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('licenses')
      .select('plan_slug, status, expires_at')
      .eq('customer_id', user.id)
      .eq('status', 'active')
      .order('expires_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const profile = profileRes.data;
  const license = licenseRes.data;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Conta</h1>
        <p className="text-sm text-zinc-400">Seus dados e senha de acesso.</p>
      </header>

      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-sm font-medium text-zinc-300">Dados da conta</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-zinc-500">E-mail</dt>
            <dd className="mt-0.5 break-all text-zinc-200">{user.email}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Nome</dt>
            <dd className="mt-0.5 text-zinc-200">{profile?.full_name || '—'}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Plano ativo</dt>
            <dd className="mt-0.5 text-zinc-200">{license?.plan_slug || 'Sem plano ativo'}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Vencimento</dt>
            <dd className="mt-0.5 text-zinc-200">{formatDate(license?.expires_at)}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Conta criada em</dt>
            <dd className="mt-0.5 text-zinc-200">{formatDate(profile?.created_at ?? user.created_at)}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-sm font-medium text-zinc-300">Alterar senha</h2>
        <AccountForm />
      </section>
    </div>
  );
}
