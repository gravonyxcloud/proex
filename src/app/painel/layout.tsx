import { redirect } from 'next/navigation';

import { PanelNav } from '@/components/panel/panel-nav';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login?next=/painel');

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .maybeSingle();

  return (
    <div className="grid min-h-screen lg:grid-cols-[260px_1fr]">
      <PanelNav
        email={user.email ?? ''}
        fullName={profile?.full_name ?? null}
        isAdmin={profile?.role === 'admin'}
      />
      <div className="min-w-0">
        <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8">{children}</div>
      </div>
    </div>
  );
}
