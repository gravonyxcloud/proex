import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import type { SupportAttachment } from '@/types/db';

export const SUPPORT_ATTACHMENT_BUCKET = 'support-attachments';
export const SUPPORT_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
export const SUPPORT_ATTACHMENT_MAX_COUNT = 5;

const ALLOWED_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'application/pdf',
  'text/plain',
]);

/**
 * O cliente manda a lista em JSON num campo hidden (mesmos metadados que
 * /api/support/upload retorna). Nunca confia no que veio: bucket é forçado,
 * o path precisa ficar dentro de `${userId}/{uuid}` da própria sessão.
 */
const attachmentDtoSchema = z.object({
  bucket: z.literal(SUPPORT_ATTACHMENT_BUCKET),
  path: z
    .string()
    .trim()
    .regex(/^[\w-]{36}\/[\w-]{1,36}\/[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}\.[a-z0-9]{1,10}$/i),
  name: z.string().trim().min(1).max(200),
  size: z.number().int().positive().max(SUPPORT_ATTACHMENT_MAX_BYTES),
  type: z.string().refine((t) => ALLOWED_TYPES.has(t), { message: 'Tipo de arquivo não permitido.' }),
});

export function parseSupportAttachments(
  raw: FormDataEntryValue | null,
  opts: { userId: string; ticketId?: string },
): { ok: true; attachments: SupportAttachment[] } | { ok: false; message: string } {
  if (raw == null || raw === '') return { ok: true, attachments: [] };
  if (typeof raw !== 'string') return { ok: false, message: 'Anexos inválidos.' };

  let list: unknown;
  try {
    list = JSON.parse(raw);
  } catch {
    return { ok: false, message: 'Anexos inválidos.' };
  }
  if (!Array.isArray(list)) return { ok: false, message: 'Anexos inválidos.' };
  if (list.length > SUPPORT_ATTACHMENT_MAX_COUNT) {
    return { ok: false, message: `Máximo de ${SUPPORT_ATTACHMENT_MAX_COUNT} anexos por mensagem.` };
  }

  const attachments: SupportAttachment[] = [];
  for (const item of list) {
    const parsed = attachmentDtoSchema.safeParse(item);
    if (!parsed.success) return { ok: false, message: 'Um dos anexos é inválido ou não foi enviado por você.' };
    const a = parsed.data;
    // path no formato userId/ticketId/uuid.ext — ticketId precisa bater (ou ser 'draft' no abra)
    const [ownerId, scopedId] = a.path.split('/');
    if (ownerId !== opts.userId) return { ok: false, message: 'Anexo não pertence à sua sessão.' };
    if (opts.ticketId ? scopedId !== opts.ticketId : scopedId !== 'draft') {
      return { ok: false, message: 'Anexo não pertence a este ticket.' };
    }
    const { bucket: _b, path: _p, ...rest } = a;
    attachments.push({ bucket: SUPPORT_ATTACHMENT_BUCKET, path: a.path, ...rest });
  }
  return { ok: true, attachments };
}

/**
 * Signed URLs frescas para exibição. O bucket é privado, então a URL nunca é
 * persistida — cada render gera as suas (1h).
 *
 * Usa `createSignedUrls` (lote) em vez de N chamadas: um ticket com várias
 * mensagens x anexos antes disparava uma requisição por arquivo a cada render.
 */
export async function getSignedSupportAttachments(
  attachments: SupportAttachment[],
): Promise<SupportAttachment[]> {
  if (attachments.length === 0) return [];

  const supabase = createClient();
  // Agrupa por bucket: o path assinado é sempre relativo ao bucket de origem.
  const byBucket = new Map<string, number[]>();
  attachments.forEach((a, i) => {
    const list = byBucket.get(a.bucket) ?? [];
    list.push(i);
    byBucket.set(a.bucket, list);
  });

  const urls: (string | undefined)[] = new Array(attachments.length).fill(undefined);
  await Promise.all(
    Array.from(byBucket.entries()).map(async ([bucket, indexes]) => {
      try {
        const { data, error } = await supabase.storage
          .from(bucket)
          .createSignedUrls(
            indexes.map((i) => attachments[i].path),
            60 * 60,
          );
        if (error || !data) return;
        data.forEach((d, k) => {
          if (d.signedUrl) urls[indexes[k]] = d.signedUrl;
        });
      } catch {
        // sem URL: a UI degrada para o nome do arquivo
      }
    }),
  );

  return attachments.map((a, i) => ({ ...a, url: urls[i] }));
}
