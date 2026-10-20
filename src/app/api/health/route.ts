import { NextResponse } from 'next/server';

import { pingLicenseApi } from '@/lib/license-api';
import { mpConfigured } from '@/lib/mp/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  const [pont, mp] = await Promise.all([
    pingLicenseApi(),
    Promise.resolve(mpConfigured()),
  ]);

  const body = {
    ok: pont.ok,
    service: 'proex',
    timestamp: new Date().toISOString(),
    mercadopago: mp ? 'configurado' : 'ausente',
    ponte: pont.detail,
  };

  return NextResponse.json(body, { status: pont.ok ? 200 : 503 });
}
