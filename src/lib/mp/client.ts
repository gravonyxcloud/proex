import 'server-only';

import { MercadoPagoConfig, Payment, Preference } from 'mercadopago';

let cached: MercadoPagoConfig | null = null;

/** Configuração única do SDK. Access token SOMENTE de servidor. */
export function mpConfig(): MercadoPagoConfig {
  if (cached) return cached;

  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error(
      'MP_ACCESS_TOKEN não configurado. Use o token de produção (APP_USR-...) no painel do Mercado Pago.',
    );
  }

  cached = new MercadoPagoConfig({ accessToken });
  return cached;
}

export function paymentClient() {
  return new Payment(mpConfig());
}

export function preferenceClient() {
  return new Preference(mpConfig());
}

export function mpPublicKey(): string {
  return process.env.MP_PUBLIC_KEY ?? '';
}

export function mpConfigured(): boolean {
  return Boolean(process.env.MP_ACCESS_TOKEN);
}
