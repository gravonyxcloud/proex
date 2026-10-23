import { randomUUID } from 'crypto';

import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';

const ALLOWED = new Set([
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

const MAX = 10 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

    const form = await req.formData();
    const file = form.get('file') as File | null;
    const ticketId = (form.get('ticketId') as string | null)?.trim() || null;

    if (!file) return NextResponse.json({ error: 'Arquivo não enviado.' }, { status: 400 });
    if (file.size > MAX) return NextResponse.json({ error: 'Arquivo maior que 10MB.' }, { status: 400 });
    if (!ALLOWED.has(file.type)) return NextResponse.json({ error: 'Tipo de arquivo não permitido.' }, { status: 400 });

    const ext = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
    const safeName = `${randomUUID()}.${ext?.toLowerCase()}`;
    const path = `${user.id}/${ticketId ?? 'draft'}/${safeName}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    const { error } = await supabase.storage
      .from('support-attachments')
      .upload(path, buffer, { contentType: file.type, upsert: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const { data: signed } = await supabase.storage
      .from('support-attachments')
      .createSignedUrl(path, 60 * 60); // 1h

    return NextResponse.json({
      ok: true,
      attachment: {
        bucket: 'support-attachments',
        path,
        name: file.name,
        size: file.size,
        type: file.type,
        url: signed?.signedUrl ?? null,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Erro inesperado.' }, { status: 500 });
  }
}
