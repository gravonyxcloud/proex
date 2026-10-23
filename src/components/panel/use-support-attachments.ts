'use client';

import { useCallback, useRef, useState } from 'react';

import { useToast } from '@/components/ui/toaster';
import { createClient } from '@/lib/supabase/client';
import type { SupportAttachment } from '@/types/db';

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_COUNT = 5;

type UploadState = {
  attachment: Omit<SupportAttachment, 'url'>;
  name: string;
  size: number;
  error?: string;
};

export function useSupportAttachments(ticketId?: string) {
  const toast = useToast();
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [pending, setPending] = useState(0);
  // `uploads.length` fica defasado entre renders; este ref conta os que estão
  // subindo agora para não estourar o limite em duas seleções rápidas.
  const inflightRef = useRef(0);

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? []);
    e.target.value = '';

    // validação local primeiro (mesmos limites do servidor)
    const valid: File[] = [];
    let rejected = 0;
    for (const f of list) {
      if (f.size > MAX_BYTES) {
        toast.error(`${f.name}: maior que 10MB`);
        continue;
      }
      valid.push(f);
    }
    const slots = Math.max(0, MAX_COUNT - uploads.length - inflightRef.current);
    if (valid.length > slots) {
      rejected = valid.length - slots;
      valid.length = slots;
    }
    if (rejected > 0) toast.error(`Máximo de ${MAX_COUNT} anexos por mensagem.`);
    if (valid.length === 0) return;

    // upload imediato de cada arquivo; usa ticketId quando existir, senão 'draft'
    inflightRef.current += valid.length;
    setPending((p) => p + valid.length);
    await Promise.all(
      valid.map(async (f) => {
        const body = new FormData();
        body.append('file', f);
        if (ticketId) body.append('ticketId', ticketId);
        try {
          const res = await fetch('/api/support/upload', { method: 'POST', body });
          const json = await res.json();
          if (!res.ok || !json?.ok) {
            toast.error(`${f.name}: ${json?.error ?? 'falha no upload'}`);
            return;
          }
          setUploads((prev) => [
            ...prev,
            { attachment: json.attachment, name: f.name, size: f.size },
          ]);
        } catch {
          toast.error(`${f.name}: falha no upload`);
        } finally {
          inflightRef.current = Math.max(0, inflightRef.current - 1);
          setPending((p) => Math.max(0, p - 1));
        }
      }),
    );
  }

  /**
   * Remove da lista e apaga do bucket. Sem isso os arquivos ficariam órfãos em
   * `${userId}/draft/...` quando o usuário desiste do anexo — a policy de
   * delete (`foldername[1] = auth.uid()`) permite apagar o próprio arquivo.
   * `reset()` NÃO apaga: no submit bem-sucedido eles já pertencem ao ticket.
   */
  const removeUpload = useCallback((i: number) => {
    setUploads((prev) => {
      const target = prev[i];
      if (target) {
        const supabase = createClient();
        void supabase.storage
          .from(target.attachment.bucket)
          .remove([target.attachment.path])
          .then(({ error }) => {
            if (error) console.warn('Falha ao remover anexo do storage:', error.message);
          });
      }
      return prev.filter((_, idx) => idx !== i);
    });
  }, []);

  // Identidade estável: os effects dos formulários dependem dela e um reset
  // novo a cada render dispararia toast em loop.
  const reset = useCallback(() => {
    setUploads([]);
  }, []);

  /** JSON com os metadados dos anexos já enviados, pro campo hidden. */
  function serialize(): string {
    return JSON.stringify(uploads.map((u) => u.attachment));
  }

  return { uploads, pending, onFiles, removeUpload, reset, serialize };
}
