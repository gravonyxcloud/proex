import { AdminShell } from '@/components/admin/admin-shell';
import { PlanForm } from '@/components/admin/plan-form';
import { PlanList } from '@/components/admin/plan-list';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Plan } from '@/types/db';

export const dynamic = 'force-dynamic';

export default async function PlanosAdmin({ searchParams }: { searchParams: { editar?: string } }) {
  const supabase = createAdminClient();
  const { data } = await supabase.from('plans').select('*').order('sort', { ascending: true });

  const planos = (data ?? []) as Plan[];
  const alvo = searchParams.editar
    ? planos.find((p) => p.slug === searchParams.editar)
    : undefined;

  return (
    <AdminShell
      titulo="Planos"
      descricao="Preços, prazos e disponibilidade. Tudo que aparece em /precos vem daqui. O checkout congela o valor no momento do pedido — mudar o preço não altera pagamentos em andamento."
    >
      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <PlanList planos={planos} />
        <PlanForm plano={alvo} />
      </div>

      <div className="surface border-primary/30 p-5 text-sm leading-relaxed text-muted-foreground">
        <strong className="text-foreground">Slug do plano = plano aceito pela API de licenças.</strong>{' '}
        A API upstream só aceita <code className="text-primary">3d</code>,{' '}
        <code className="text-primary">7d</code>, <code className="text-primary">15d</code> e{' '}
        <code className="text-primary">30d</code>. Criar um slug fora desses valores vai quebrar a
        ativação automática no momento do pagamento.
      </div>
    </AdminShell>
  );
}