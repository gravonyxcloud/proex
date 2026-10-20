'use server';

import { revalidatePath } from 'next/cache';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { planUpsertSchema } from '@/lib/schemas';

export type ActionState = { ok: boolean; message: string };

async function requireAdmin(): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('Sessão expirada. Entre novamente.');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.role !== 'admin') throw new Error('Acesso restrito a administradores.');

  return user.email ?? 'admin';
}

export async function savePlan(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireAdmin();

    const parsed = planUpsertSchema.safeParse({
      slug: formData.get('slug'),
      name: formData.get('name'),
      dias: formData.get('dias'),
      price_brl: formData.get('price_brl'),
      description: formData.get('description') ?? null,
      highlight: formData.get('highlight') === 'on',
      active: formData.get('active') === 'on',
      sort: formData.get('sort') ?? 0,
    });

    if (!parsed.success) {
      return { ok: false, message: parsed.error.errors[0].message };
    }

    const { slug, ...rest } = parsed.data;
    const admin = createAdminClient();

    const { error } = await admin.from('plans').upsert({
      slug,
      name: rest.name,
      dias: rest.dias,
      price_brl: rest.price_brl,
      description: rest.description ?? null,
      highlight: rest.highlight ?? false,
      active: rest.active ?? true,
      sort: rest.sort ?? 0,
    });

    if (error) return { ok: false, message: error.message };

    revalidatePath('/');
    revalidatePath('/precos');
    revalidatePath('/admin/planos');

    return { ok: true, message: `Plano ${rest.name} salvo.` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Falha ao salvar.' };
  }
}

export async function togglePlan(
  slug: string,
  field: 'active' | 'highlight',
): Promise<ActionState> {
  try {
    await requireAdmin();
    const admin = createAdminClient();

    const { data: current } = await admin
      .from('plans')
      .select('active, highlight')
      .eq('slug', slug)
      .single();

    if (!current) return { ok: false, message: 'Plano não encontrado.' };

    const atual: boolean = field === 'active' ? current.active : current.highlight;
    const { error } = await admin
      .from('plans')
      .update({ [field]: !atual })
      .eq('slug', slug);

    if (error) return { ok: false, message: error.message };

    revalidatePath('/');
    revalidatePath('/precos');
    revalidatePath('/admin/planos');

    return { ok: true, message: 'Plano atualizado.' };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Falha ao atualizar.' };
  }
}