import { z } from 'zod';

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Informe o seu e-mail.')
  .max(254, 'E-mail muito longo.')
  .email('E-mail inválido.');

export const passwordSchema = z
  .string()
  .min(8, 'A senha precisa de pelo menos 8 caracteres.')
  .max(72, 'Senha muito longa.');

export const planSlugSchema = z
  .string()
  .trim()
  .regex(/^cc_\d+d$/, 'Plano inválido.')
  .max(16);

export const checkoutSchema = z.object({
  planSlug: planSlugSchema,
  email: emailSchema,
  method: z.enum(['pix', 'card']),
  full_name: z.string().trim().min(2, 'Informe seu nome.').max(120).optional(),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Informe a senha.'),
});

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  full_name: z.string().trim().min(2, 'Informe seu nome.').max(120),
});

export const resetSchema = z.object({ email: emailSchema });

export const newPasswordSchema = z
  .object({
    password: passwordSchema,
    confirm: z.string().min(1, 'Confirme a nova senha.'),
  })
  .refine((data) => data.password === data.confirm, {
    message: 'As senhas não coincidem.',
    path: ['confirm'],
  });

export const planUpsertSchema = z.object({
  slug: planSlugSchema,
  name: z.string().trim().min(3, 'Nome muito curto.').max(80),
  dias: z.coerce.number().int().min(1).max(365),
  price_brl: z.coerce.number().min(0).max(99_999),
  description: z.string().trim().max(200).optional().nullable(),
  highlight: z.coerce.boolean().optional(),
  active: z.coerce.boolean().optional(),
  sort: z.coerce.number().int().min(0).max(999).optional(),
});

/** Taxas da operação em /admin/contabilidade. Ver migration *_0003_*.sql */
export const appSettingsSchema = z.object({
  store_name: z.string().trim().min(1, 'Informe o nome da loja.').max(60),
  mp_fee_percent: z.coerce
    .number()
    .min(0, 'A taxa não pode ser negativa.')
    .max(100, 'A taxa não pode passar de 100%.'),
  mp_fee_fixed_brl: z.coerce.number().min(0, 'A taxa fixa não pode ser negativa.').max(999),
  tax_percent: z.coerce
    .number()
    .min(0, 'A reserva não pode ser negativa.')
    .max(100, 'A reserva não pode passar de 100%.'),
});

export const withdrawalSchema = z.object({
  amount_brl: z.coerce
    .number({ invalid_type_error: 'Informe um valor.' })
    .positive('O valor do saque precisa ser maior que zero.')
    .max(9_999_999, 'Valor acima do limite.'),
  // input type="date" manda 'YYYY-MM-DD'; data pura (sem fuso) evita o dia
  // pular quando o navegador está em outro offset.
  withdrawn_at: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida.')
    .optional(),
  method: z.enum(['pix', 'ted', 'transferencia', 'dinheiro', 'outro']),
  destination: z.string().trim().max(120, 'Destino muito longo.').optional().nullable(),
  note: z.string().trim().max(280, 'Observação muito longa.').optional().nullable(),
});

export const licenseActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('activate'),
    email: emailSchema,
    planSlug: planSlugSchema,
    orderId: z.string().trim().max(64).optional(),
  }),
  z.object({
    action: z.literal('renew'),
    email: emailSchema,
    key: z.string().trim().min(8),
    planSlug: planSlugSchema,
    orderId: z.string().trim().max(64).optional(),
  }),
  z.object({
    action: z.literal('revoke'),
    licenseId: z.string().uuid(),
    reason: z.string().trim().max(200).optional(),
  }),
  z.object({
    action: z.literal('reprocess'),
    orderId: z.string().uuid(),
  }),
]);

export const supportCategorySchema = z.enum([
  'chave_nao_chegou',
  'nao_autentica',
  'rate_limit',
  'renovacao',
  'reembolso',
  'configuracao',
  'outro',
]);

export const supportTicketCreateSchema = z.object({
  subject: z.string().trim().min(5, 'Assunto muito curto.').max(120),
  category: supportCategorySchema,
  message: z.string().trim().min(15, 'Descreva com mais detalhes (mínimo 15 caracteres).').max(8000),
});

export const supportTicketReplySchema = z.object({
  ticketId: z.string().uuid(),
  message: z.string().trim().min(1, 'Escreva uma mensagem.').max(8000),
});

