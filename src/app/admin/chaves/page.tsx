import { AdminShell } from '@/components/admin/admin-shell';
import { LicencaManager } from '@/components/admin/licenca-manager';
import { createAdminClient } from '@/lib/supabase/admin';
import type { License, Order, Plan } from '@/types/db';

export const dynamic = 'force-dynamic';

export default async function ChavesAdmin() {
  const supabase = createAdminClient();
  const agora = new Date().toISOString();

  const [licRes, planRes, pendRes] = await Promise.all([
    supabase
      .from('licenses')
      .select('*, profiles(full_name)')
      .order('created_at', { ascending: false })
      .limit(300),
    supabase.from('plans').select('*').eq('active', true).order('sort'),
    supabase
      .from('orders')
      .select('*')
      .or('status.eq.pending,status.eq.in_process,license_issued.eq.false')
      .order('created_at', { ascending: false })
      .limit(100),
  ]);

  const licencas = (licRes.data ?? []) as (License & {
    profiles?: { full_name: string | null } | null;
  })[];
  const planos = (planRes.data ?? []) as Plan[];

  // Só pendências relevantes: pagamento aprovado sem chave, ou ordem aberta.
  const pendentes = ((pendRes.data ?? []) as Order[]).filter(
    (o) =>
      (o.status === 'pending' || o.status === 'in_process') ||
      (o.status === 'approved' && !o.license_issued),
  );

  const ativas = licencas.filter((l) => l.status === 'active' && l.expires_at > agora).length;

  return (
    <AdminShell
      titulo="Licenças"
      descricao={`${licencas.length} chaves no total · ${ativas} ativas. Toda ação aqui é auditada em license_events.`}
    >
      <LicencaManager licencas={licencas} planos={planos} pendentes={pendentes} />
    </AdminShell>
  );
}