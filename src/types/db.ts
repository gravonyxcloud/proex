export type Role = 'customer' | 'admin';

export type PlanSlug = `cc_${number}d`;

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  created_at: string;
  updated_at: string;
}

export interface Plan {
  slug: string;
  name: string;
  dias: number;
  price_brl: number;
  description: string | null;
  highlight: boolean;
  active: boolean;
  sort: number;
  created_at: string;
  updated_at: string;
}

export type OrderStatus =
  | 'pending'
  | 'in_process'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'refunded';

export type PaymentMethod = 'pix' | 'card';

export interface Order {
  id: string;
  external_reference: string;
  customer_id: string | null;
  customer_email: string;
  plan_slug: string;
  amount_brl: number;
  method: PaymentMethod | null;
  status: OrderStatus;
  mp_preference_id: string | null;
  mp_payment_id: string | null;
  mp_payment_status: string | null;
  license_issued: boolean;
  license_error: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export type LicenseStatus = 'active' | 'expired' | 'revoked';

export interface License {
  id: string;
  customer_id: string | null;
  customer_email: string;
  plan_slug: string;
  key: string;
  key_hint: string;
  status: LicenseStatus;
  order_id: string | null;
  issued_at: string;
  expires_at: string;
  revoked_at: string | null;
  revoked_reason: string | null;
  created_at: string;
  updated_at: string;
  /** Entrega da chave por e-mail. Ver supabase/migrations/*_0003_*.sql */
  email_sent_at: string | null;
  email_to: string | null;
  email_error: string | null;
  email_attempts: number;
}

export interface Payment {
  id: string;
  order_id: string;
  customer_id: string | null;
  mp_payment_id: string | null;
  method: PaymentMethod | null;
  amount_brl: number;
  installments: number | null;
  status: string;
  status_detail: string | null;
  paid_at: string | null;
  /** Taxa congelada no momento da cobrança. Ver supabase/migrations/*_0003_*.sql */
  fee_brl: number;
  /** 'mercadopago' = valor real devolvido pela API; 'estimada' = app_settings. */
  fee_source: 'mercadopago' | 'estimada' | null;
  /** Coluna gerada (amount_brl - fee_brl). Nunca escrever. */
  net_brl: number | null;
  created_at: string;
  updated_at: string;
}

/** Linha única de configuração da operação (id = true). */
export interface AppSettings {
  id: boolean;
  store_name: string;
  /** % sobre o bruto cobrado pelo gateway */
  mp_fee_percent: number;
  /** R$ fixo por transação */
  mp_fee_fixed_brl: number;
  /** % do líquido reservado para imposto — NÃO entra em payments.fee_brl */
  tax_percent: number;
  updated_at: string;
}

export type WithdrawalMethod = 'pix' | 'ted' | 'transferencia' | 'dinheiro' | 'outro';

/** Dinheiro que saiu do caixa. */
export interface Withdrawal {
  id: string;
  amount_brl: number;
  withdrawn_at: string;
  method: WithdrawalMethod;
  destination: string | null;
  note: string | null;
  actor: string;
  created_at: string;
  updated_at: string;
}

export type WebhookResult = 'processed' | 'ignored' | 'error';

export interface WebhookEvent {
  id: number;
  event_id: string;
  topic: string | null;
  mp_payment_id: string | null;
  status_raw: string | null;
  payload: unknown;
  result: WebhookResult;
  error: string | null;
  received_at: string;
}

export interface LicenseEvent {
  id: number;
  license_id: string | null;
  order_id: string | null;
  action: 'activate' | 'renew' | 'revoke' | 'reprocess' | 'failed';
  detail: string | null;
  actor: string;
  created_at: string;
}

/** Payload de licença devolvido pela API do gateway. */
export interface LicensePayload {
  id: string;
  key: string;
  email: string;
  name?: string | null;
  plan: string;
  orderId?: string | null;
  active: boolean;
  /** presente em /usage; NAO vem em /activate (verificado em producao) */
  expired?: boolean;
  createdAt?: string | null;
  /** null quando a chave nao expira */
  expiresAt: string | null;
  /** null quando a chave nao expira */
  daysRemaining?: number | null;
  /** true = chave limitada a combos/modelos em `allow` */
  restricted?: boolean;
  allow?: string[];
  /**
   * Limite da politica de uso justo. Em /activate vem DENTRO de `license`,
   * nao em `limits` — a documentacao descrevia `limits.hourlyTokenLimit`,
   * que na pratica nao existe nesse endpoint.
   */
  hourlyTokenLimit?: number;
}

/** Resposta de POST /api/license/activate e /api/license/renew. */
export interface LicenseEnvelope {
  success: boolean;
  /** true = o gateway reutilizou a licenca existente do mesmo orderId */
  reused?: boolean;
  license: LicensePayload;
  limits?: UsageLimits;
}

export interface UsageLimits {
  hourlyTokenLimit: number;
  rollingWindowMinutes: number;
}

export interface UsageTotals {
  requests: number;
  promptTokens: number;
  completionTokens: number;
  tokens: number;
  cost: number;
  lastRequestAt?: string | null;
}

export interface UsageAllTime extends UsageTotals {
  firstRequestAt?: string | null;
}

/** Janela movel de 60 min — a mesma que o gateway aplica (429 quando estoura). */
export interface CurrentHourUsage {
  used: number;
  limit: number;
  remaining: number;
  /** escala 0 a 100 */
  percentUsed: number;
  exceeded: boolean;
  resetAt?: string | null;
}

export interface DailyUsage {
  date: string;
  requests: number;
  promptTokens: number;
  completionTokens: number;
  tokens: number;
  cost: number;
}

export interface ModelUsage {
  model: string;
  provider?: string;
  requests: number;
  tokens: number;
  cost: number;
}

/** Resposta de GET/POST /api/license/usage. */
export interface LicenseUsageResponse {
  success: boolean;
  license: LicensePayload;
  limits?: UsageLimits;
  usage: {
    window: { days: number; since: string };
    totals: UsageTotals;
    allTime: UsageAllTime;
    currentHour: CurrentHourUsage;
    /** serie diaria pronta para grafico, no fuso do gateway */
    daily: DailyUsage[];
    /** 20 modelos mais usados na janela */
    byModel: ModelUsage[];
  };
  overLimit: boolean;
}
