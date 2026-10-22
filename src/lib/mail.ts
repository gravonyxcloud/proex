import 'server-only';

import nodemailer, { type Transporter } from 'nodemailer';

import { SITE } from '@/lib/constants';
import { getPlan } from '@/lib/plans';

/**
 * Envio da chave por e-mail via SMTP do Zoho Mail.
 *
 * Variáveis (todas server-side, nunca com NEXT_PUBLIC_):
 *   SMTP_HOST      smtp.zoho.com (contas .eu usam smtp.zoho.eu)
 *   SMTP_PORT      465 (SSL) ou 587 (STARTTLS)
 *   SMTP_USER      contato@seudominio.com  — a caixa autenticada
 *   SMTP_PASS      senha de app gerada no Zoho (não é a senha da conta)
 *   MAIL_FROM      "Proex <contato@seudominio.com>". O Zoho só aceita remetente
 *                  igual à caixa autenticada ou um alias verificado dela.
 *   MAIL_REPLY_TO  opcional
 */

export interface SendResult {
  ok: boolean;
  error?: string;
  /** id da mensagem devolvido pelo SMTP, quando aceito */
  messageId?: string;
}

function config() {
  const host = process.env.SMTP_HOST?.trim() || 'smtp.zoho.com';
  const port = Number(process.env.SMTP_PORT ?? 465);
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS;
  const from = process.env.MAIL_FROM?.trim() || (user ? `${SITE.name} <${user}>` : undefined);

  return { host, port, user, pass, from, replyTo: process.env.MAIL_REPLY_TO?.trim() };
}

/** true quando dá para tentar enviar. Sem isso a licença continua valendo. */
export function mailConfigured(): boolean {
  const c = config();
  return Boolean(c.user && c.pass && c.from);
}

let cached: Transporter | null = null;

function transporter(): Transporter {
  if (cached) return cached;
  const c = config();

  cached = nodemailer.createTransport({
    host: c.host,
    // 465 = TLS direto (padrão do Zoho); 587 = STARTTLS obrigatório.
    port: c.port,
    secure: c.port === 465,
    requireTLS: c.port === 587,
    auth: { user: c.user, pass: c.pass },
    // Zoho derruba conexões ociosas; sem pool cada envio abre a sua.
    pool: false,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });

  return cached;
}

const dataBR = (iso: string | null | undefined) => {
  if (!iso) return 'sem vencimento';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? 'sem vencimento' : d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
};

/** Escapa o que vem do banco antes de entrar no HTML do e-mail. */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface LicenseMailInput {
  to: string;
  name?: string | null;
  key: string;
  planSlug: string;
  planName?: string;
  expiresAt?: string | null;
  /** true quando é renovação da mesma chave (muda o texto) */
  renewal?: boolean;
}

/**
 * Envia a chave. Nunca lança: devolve o erro para quem chamou decidir
 * (a licença já está emitida e válida independente do e-mail).
 */
export async function sendLicenseEmail(input: LicenseMailInput): Promise<SendResult> {
  if (!mailConfigured()) {
    return { ok: false, error: 'SMTP não configurado (SMTP_USER/SMTP_PASS/MAIL_FROM).' };
  }

  const c = config();
  const { html, text, subject } = renderLicenseMail(input);

  try {
    const info = await transporter().sendMail({
      from: c.from,
      to: input.to,
      replyTo: c.replyTo || undefined,
      subject,
      text,
      html,
    });

    return info.rejected?.length
      ? { ok: false, error: `Destinatário recusado pelo servidor: ${input.to}` }
      : { ok: true, messageId: info.messageId };
  } catch (err) {
    // registra o erro real do SMTP (auth, limite do Zoho, DNS) sem vazar a senha
    const message = err instanceof Error ? err.message : 'Falha desconhecida no envio.';
    return { ok: false, error: message.slice(0, 500) };
  }
}

function renderLicenseMail(input: LicenseMailInput) {
  // Só o primeiro nome: "Olá, Gabriel" soa melhor que "Olá, Gabriel Silva Costa".
  const primeiroNome = input.name?.trim().split(/\s+/)[0];
  const inicio = primeiroNome ? `Olá, ${primeiroNome}` : 'Olá';
  const plano = input.planName ?? input.planSlug;
  const validade = dataBR(input.expiresAt);

  const subject = input.renewal
    ? `Sua licença Proex foi renovada — validade até ${validade}`
    : `Sua chave Proex chegou — validade até ${validade}`;

  const intro = input.renewal
    ? 'Seu pagamento foi aprovado e a renovação entrou na mesma chave. O prazo novo já está valendo:'
    : 'Seu pagamento foi aprovado e a chave abaixo já está ativa. Ela é a única coisa que você precisa guardar:';

  const heading = input.renewal ? 'Renovação confirmada' : 'Seu acesso está liberado';

  const text = [
    `${inicio}.`,
    '',
    intro,
    '',
    `  chave:      ${input.key}`,
    `  plano:      ${plano}`,
    `  válida até: ${validade}`,
    '',
    'Como configurar (uma vez):',
    '',
    '  Windows / PowerShell:',
    '    irm https://claude.ai/install.ps1 | iex',
    `    setx ANTHROPIC_BASE_URL "${SITE.apiBase}"`,
    `    setx ANTHROPIC_API_KEY "${input.key}"`,
    '    (abra um terminal NOVO depois do setx)',
    '',
    '  macOS / Linux:',
    '    curl -fsSL https://claude.ai/install.sh | bash',
    `    export ANTHROPIC_BASE_URL="${SITE.apiBase}"`,
    `    export ANTHROPIC_API_KEY="${input.key}"`,
    '',
    'Depois entre na pasta do projeto e rode:  claude',
    '',
    `Licença, consumo e suporte: ${SITE.url}/painel`,
    '',
    'Uma chave, uma pessoa: pode usar nos seus computadores, mas dividir com outra',
    'pessoa suspende o acesso.',
    '',
    '—',
    SITE.name,
    `${SITE.url} · suporte: ${SITE.url}/suporte`,
    '',
    'Não somos a Anthropic, nem parceiros, revendedores oficiais ou patrocinados por',
    'ela. Você compra acesso por API: a chave autentica chamadas de API, e só isso.',
  ].join('\n');

  const html = `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#0a0a0c;">
  <!-- preview: o texto que aparece na lista do cliente antes de abrir -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    Sua chave Proex válida até ${esc(validade)}. Configure em dois comandos.
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0c;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#121216;border:1px solid #232329;border-radius:16px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

        <tr><td style="padding:28px 32px 0;">
          <div style="font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#8b8b96;">${esc(SITE.name)}</div>
          <h1 style="margin:10px 0 0;font-size:26px;line-height:1.25;color:#f4f4f6;font-weight:700;">
            ${esc(heading)}
          </h1>
        </td></tr>

        <tr><td style="padding:18px 32px 0;color:#a9a9b4;font-size:15px;line-height:1.65;">
          <p style="margin:0 0 12px;">${esc(inicio)}.</p>
          <p style="margin:0;">${esc(intro)}</p>
        </td></tr>

        <!-- chave -->
        <tr><td style="padding:22px 32px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0c;border:1px solid #2c2c34;border-radius:12px;">
            <tr><td style="padding:18px 20px;">
              <div style="font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#8b8b96;margin-bottom:8px;">sua chave</div>
              <div style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:17px;line-height:1.5;color:#ffffff;word-break:break-all;">${esc(input.key)}</div>
            </td></tr>
          </table>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">
            <tr>
              <td style="padding:12px 16px;background:#16161b;border:1px solid #232329;border-radius:10px 0 0 10px;color:#8b8b96;font-size:11px;letter-spacing:.12em;text-transform:uppercase;">plano</td>
              <td style="padding:12px 16px;background:#16161b;border:1px solid #232329;border-left:0;border-radius:0 10px 10px 0;color:#f4f4f6;font-size:14px;text-align:right;">${esc(plano)}</td>
            </tr>
            <tr><td colspan="2" style="height:8px;"></td></tr>
            <tr>
              <td style="padding:12px 16px;background:#16161b;border:1px solid #232329;border-radius:10px 0 0 10px;color:#8b8b96;font-size:11px;letter-spacing:.12em;text-transform:uppercase;">válida até</td>
              <td style="padding:12px 16px;background:#16161b;border:1px solid #232329;border-left:0;border-radius:0 10px 10px 0;color:#f4f4f6;font-size:14px;text-align:right;">${esc(validade)}</td>
            </tr>
          </table>

          <p style="margin:12px 0 0;font-size:12px;line-height:1.6;color:#8b8b96;">
            Guarde no gerenciador de senhas. Não mande esta chave para ninguém — ela dá
            acesso ao seu consumo.
          </p>
        </td></tr>

        <!-- instalação -->
        <tr><td style="padding:26px 32px 0;">
          <h2 style="margin:0 0 12px;font-size:15px;color:#f4f4f6;font-weight:600;">Configure em dois comandos</h2>
          <div style="font-size:12px;color:#8b8b96;margin-bottom:8px;">Windows, no PowerShell:</div>
          <pre style="margin:0 0 16px;padding:14px 16px;background:#0a0a0c;border:1px solid #2c2c34;border-radius:10px;overflow-x:auto;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12.5px;line-height:1.7;color:#d9d9e0;">irm https://claude.ai/install.ps1 | iex
setx ANTHROPIC_BASE_URL "${esc(SITE.apiBase)}"
setx ANTHROPIC_API_KEY "${esc(input.key)}"</pre>

          <div style="font-size:12px;color:#8b8b96;margin-bottom:8px;">macOS e Linux:</div>
          <pre style="margin:0 0 16px;padding:14px 16px;background:#0a0a0c;border:1px solid #2c2c34;border-radius:10px;overflow-x:auto;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12.5px;line-height:1.7;color:#d9d9e0;">curl -fsSL https://claude.ai/install.sh | bash
export ANTHROPIC_BASE_URL="${esc(SITE.apiBase)}"
export ANTHROPIC_API_KEY="${esc(input.key)}"</pre>

          <p style="margin:0;font-size:13px;line-height:1.65;color:#a9a9b4;">
            No Windows, abra um terminal <strong style="color:#f4f4f6;">novo</strong> depois do
            <code style="font-family:ui-monospace,Menlo,Consolas,monospace;color:#c9c9d4;">setx</code> —
            ele só vale para as próximas sessões. Depois entre na pasta do projeto e rode
            <code style="font-family:ui-monospace,Menlo,Consolas,monospace;color:#c9c9d4;">claude</code>.
          </p>
        </td></tr>

        <!-- botões -->
        <tr><td style="padding:26px 32px 0;">
          <a href="${esc(SITE.url)}/painel" style="display:inline-block;background:#6d5efc;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:13px 22px;border-radius:10px;">
            Abrir meu painel
          </a>
          <a href="${esc(SITE.url)}/suporte" style="display:inline-block;margin-left:8px;color:#a9a9b4;text-decoration:none;font-size:14px;font-weight:600;padding:13px 18px;border:1px solid #2c2c34;border-radius:10px;">
            Falar com o suporte
          </a>
        </td></tr>

        <tr><td style="padding:24px 32px 0;">
          <ul style="margin:0;padding:0;list-style:none;font-size:13px;line-height:1.7;color:#8b8b96;">
            <li>— Uma chave, uma pessoa. Nos seus computadores pode; dividir suspende o acesso.</li>
            <li>— A chave só autentica API: não entra no claude.ai, no app de celular nem no Desktop.</li>
            <li>— Uso ilimitado no período, com teto de ritmo de 80 milhões de tokens por hora.</li>
            <li>— Reembolso em até 7 dias pelo painel.</li>
          </ul>
        </td></tr>

        <tr><td style="padding:24px 32px 28px;border-top:1px solid #232329;margin-top:24px;">
          <div style="height:1px;background:#232329;margin:0 0 18px;"></div>
          <p style="margin:0;font-size:11.5px;line-height:1.65;color:#6f6f7a;">
            ${esc(SITE.name)} · ${esc(SITE.url)} · suporte em ${esc(SITE.url)}/suporte<br>
            ${esc(
              'Não somos a Anthropic, nem parceiros, revendedores oficiais ou patrocinados por ela. Você compra acesso por API: a chave autentica chamadas de API, e só isso.',
            )}
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}

/** Nome amigável do plano para o e-mail (cai no slug se o plano sumiu). */
export async function planLabel(slug: string): Promise<string> {
  const plan = await getPlan(slug).catch(() => null);
  return plan?.name ?? slug;
}

/**
 * Envia o e-mail da licença e grava o resultado NELA.
 *
 * Chamado depois da emissão: se o SMTP falhar, a chave continua válida e o
 * erro fica visível no /admin/chaves com botão de reenviar. Nunca lança.
 */
export async function deliverLicenseEmail(
  licenseId: string,
  options?: { renewal?: boolean; to?: string; name?: string | null },
): Promise<SendResult> {
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();

  // Lê a linha em vez de aceitar os campos: a renovação e o reenvio manual
  // chegam aqui por caminhos diferentes e a chave/vencimento podem ter mudado.
  const { data: license } = await supabase
    .from('licenses')
    .select('id, key, plan_slug, expires_at, customer_email, email_attempts')
    .eq('id', licenseId)
    .maybeSingle<{
      id: string;
      key: string;
      plan_slug: string;
      expires_at: string;
      customer_email: string;
      email_attempts: number;
    }>();

  if (!license) return { ok: false, error: 'Licença não encontrada para envio.' };

  const to = options?.to?.trim() || license.customer_email;
  const name = options?.name ?? (await customerName(license.customer_email));

  const patch: Record<string, unknown> = {
    email_attempts: (license.email_attempts ?? 0) + 1,
    email_to: to,
  };

  const result = await sendLicenseEmail({
    to,
    name,
    key: license.key,
    planSlug: license.plan_slug,
    planName: await planLabel(license.plan_slug),
    expiresAt: license.expires_at,
    renewal: options?.renewal,
  });

  if (result.ok) {
    patch.email_sent_at = new Date().toISOString();
    patch.email_error = null;
  } else {
    patch.email_error = result.error ?? 'Falha desconhecida.';
  }

  await supabase.from('licenses').update(patch).eq('id', license.id);
  return result;
}

/** Nome do cliente para personalizar o e-mail. Opcional: sem ele, "Olá". */
async function customerName(email: string): Promise<string | null> {
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const { data } = await createAdminClient()
    .from('profiles')
    .select('full_name')
    .eq('email', email.toLowerCase())
    .maybeSingle();
  return (data as { full_name: string | null } | null)?.full_name ?? null;
}
