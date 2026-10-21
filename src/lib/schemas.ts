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

