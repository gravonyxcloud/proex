'use server';

import { revalidatePath } from 'next/cache';

import { activateLicense, LicenseApiError, renewLicense } from '@/lib/license-api';
import { deliverLicenseEmail } from '@/lib/mail';
import { expiresFrom, keyHint, logLicenseEvent } from '@/lib/mp/handle-payment';
import { getPlan } from '@/lib/plans';
import { emailSchema, licenseActionSchema } from '@/lib/schemas';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { ActionState } from '@/actions/plans';

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

/** Ativa uma licença manualmente (venda线下, cortesia, ajuste). */
export async function adminActivate(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  try {
    const actor = await requireAdmin();
    const parsed = licenseActionSchema.safeParse({
      action: 'activate',
      email: formData.get('email'),
      planSlug: formData.get('planSlug'),
      orderId: formData.get('orderId') || undefined,
    });

    if (!parsed.success) return { ok: false, message: parsed.error.errors[0].message };
    if (parsed.data.action !== 'activate') return { ok: false, message: 'Ação inválida.' };

    const plan = await getPlan(parsed.data.planSlug);
    if (!plan) return { ok: false, message: 'Plano inexistente ou inativo.' };

    const admin = createAdminClient();
    const orderId = parsed.data.orderId || `admin_${Date.now()}`;

    // Impede duas chaves ativas para o mesmo e-mail em planos diferentes:
    // isso quebraria a regra de "uma chave, uma pessoa".
    const { data: existing } = await admin
      .from('licenses')
      .select('id, key_hint, status, plan_slug')
      .eq('customer_email', parsed.data.email.toLowerCase())
      .eq('status', 'active')
      .maybeSingle();

    if (existing) {
      return {
        ok: false,
        message: `Este e-mail já tem a chave ${existing.key_hint} ativa (${existing.plan_slug}). Use a renovação para estender o prazo.`,
      };
    }

    const activation = await activateLicense({
      email: parsed.data.email.toLowerCase(),
      planSlug: parsed.data.planSlug,
      orderId,
    });

    const payload = activation.license;
    if (!payload?.key) {
      return { ok: false, message: 'A API de licenças não devolveu a chave.' };
    }

    const { error } = await admin.from('licenses').insert({
      customer_email: parsed.data.email.toLowerCase(),
      plan_slug: parsed.data.planSlug,
      key: payload.key,
      key_hint: keyHint(payload.key),
      status: 'active',
      expires_at: expiresFrom(payload.expiresAt, plan.dias),
    });

    if (error) return { ok: false, message: error.message };

    await logLicenseEvent({
      action: 'activate',
      detail: `Ativação manual · plano ${parsed.data.planSlug} · pedido ${orderId}`,
      actor,
    });

    revalidatePath('/admin/chaves');
    revalidatePath('/admin/clientes');

    return { ok: true, message: `Licença ativada para ${parsed.data.email}.` };
  } catch (err) {
    const msg =
      err instanceof LicenseApiError
        ? `API de licenças recusou: ${err.message}`
        : err instanceof Error
          ? err.message
          : 'Falha ao ativar.';
    return { ok: false, message: msg };
  }
}

/** Estende uma chave existente, mantendo a mesma chave (endpoint /renew). */
export async function adminRenew(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  try {
    const actor = await requireAdmin();
    const parsed = licenseActionSchema.safeParse({
      action: 'renew',
      email: formData.get('email'),
      key: formData.get('key'),
      planSlug: formData.get('planSlug'),
      orderId: formData.get('orderId') || undefined,
    });

    if (!parsed.success) return { ok: false, message: parsed.error.errors[0].message };
    if (parsed.data.action !== 'renew') return { ok: false, message: 'Ação inválida.' };

    const orderId = parsed.data.orderId || `admin_renew_${Date.now()}`;

    const result = await renewLicense({
      email: parsed.data.email.toLowerCase(),
      key: parsed.data.key,
      planSlug: parsed.data.planSlug,
      orderId,
    });

    const dias = Number(parsed.data.planSlug.replace(/^cc_(\d+)d$/, '$1')) || 30;
    const expires = expiresFrom(result.license?.expiresAt, dias);

    const admin = createAdminClient();
    const { data: lic } = await admin
      .from('licenses')
      .update({ expires_at: expires, status: 'active' })
      .eq('key', parsed.data.key)
      .select('id')
      .maybeSingle();

    if (!lic) return { ok: false, message: 'Chave não encontrada no banco local.' };

    await logLicenseEvent({
      licenseId: lic.id,
      action: 'renew',
      detail: `Renovação manual · plano ${parsed.data.planSlug} · vencimento ${expires}`,
      actor,
    });

    revalidatePath('/admin/chaves');
    revalidatePath('/admin/clientes');

    return { ok: true, message: `Licença renovada até ${expires.slice(0, 10)}.` };
  } catch (err) {
    const msg =
      err instanceof LicenseApiError
        ? `API de licenças recusou: ${err.message}`
        : err instanceof Error
          ? err.message
          : 'Falha ao renovar.';
    return { ok: false, message: msg };
  }
}

/**
 * Revogação LOCAL. A API upstream só expõe activate/renew — não existe
 * endpoint de revogação, então o acesso é cortado aqui e o admin deve
 * pedir o endpoint correspondente à equipe da ponte.
 */
export async function adminRevoke(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  try {
    const actor = await requireAdmin();
    const parsed = licenseActionSchema.safeParse({
      action: 'revoke',
      licenseId: formData.get('licenseId'),
      reason: formData.get('reason') || undefined,
    });

    if (!parsed.success) return { ok: false, message: parsed.error.errors[0].message };
    if (parsed.data.action !== 'revoke') return { ok: false, message: 'Ação inválida.' };

    const admin = createAdminClient();
    const { error } = await admin
      .from('licenses')
      .update({
        status: 'revoked',
        revoked_at: new Date().toISOString(),
        revoked_reason: parsed.data.reason ?? 'Revogada pelo administrador',
      })
      .eq('id', parsed.data.licenseId)
      .eq('status', 'active');

    if (error) return { ok: false, message: error.message };

    await logLicenseEvent({
      licenseId: parsed.data.licenseId,
      action: 'revoke',
      detail: `Revogação LOCAL (a ponte ainda não expõe revogação): ${parsed.data.reason ?? 'sem motivo informado'}`,
      actor,
    });

    revalidatePath('/admin/chaves');
    revalidatePath('/admin/clientes');

    return {
      ok: true,
      message:
        'Revogada no painel. A chave continua válida na ponte até existir endpoint upstream — solicite o bloqueio.',
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Falha ao revogar.' };
  }
}

/**
 * Reenvia a chave para o cliente (e-mail perdido, SMTP fora do ar na hora da
 * compra, cobrança de suporte). Reusa a MESMA função do fluxo automático para
 * o corpo do e-mail e o rastreio em licenses.email_* serem idênticos.
 */
export async function adminResendMail(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  try {
    const actor = await requireAdmin();
    const licenseId = String(formData.get('licenseId') ?? '').trim();
    if (!licenseId) return { ok: false, message: 'Licença inválida.' };

    // Destino explícito é permitido (cliente pediu outro endereço), mas cai no
    // e-mail cadastrado quando o campo vem vazio. Valida porque o prompt do
    // admin aceita texto livre e isso vai direto para o cabeçalho SMTP.
    const rawTo = String(formData.get('to') ?? '').trim();
    let to: string | undefined;
    if (rawTo) {
      const parsed = emailSchema.safeParse(rawTo);
      if (!parsed.success) {
        return { ok: false, message: parsed.error.issues[0]?.message ?? 'E-mail inválido.' };
      }
      to = parsed.data;
    }

    const result = await deliverLicenseEmail(licenseId, { to });
    if (!result.ok) {
      return { ok: false, message: `O envio falhou: ${result.error}. A chave não foi entregue.` };
    }

    await logLicenseEvent({
      licenseId,
      action: 'email',
      detail: `Chave reenviada para ${to ?? 'o e-mail cadastrado'}.`,
      actor,
    });

    revalidatePath('/admin/chaves');
    return { ok: true, message: `Chave reenviada para ${to ?? 'o e-mail cadastrado'}.` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Falha ao reenviar.' };
  }
}

export async function adminUnrevoke(licenseId: string): Promise<ActionState> {
  try {
    await requireAdmin();
    const admin = createAdminClient();
    const { error } = await admin
      .from('licenses')
      .update({ status: 'active', revoked_at: null, revoked_reason: null })
      .eq('id', licenseId);

    if (error) return { ok: false, message: error.message };

    await logLicenseEvent({ licenseId, action: 'reprocess', detail: 'Reativada no painel.' });
    revalidatePath('/admin/chaves');

    return { ok: true, message: 'Licença reativada.' };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Falha ao reativar.' };
  }
}