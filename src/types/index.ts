export type TransactionType = "expense" | "income" | "conversion" | "installment-payment";
export type InterestType = "none" | "french";
export type PlanStatus = "active" | "paid";
export type PaymentStatus = "pending" | "paid";
export type PendingStatus = "waiting" | "confirmed" | "dismissed";
export type WebhookStatus = "pending" | "processing" | "done" | "failed";

export interface Profile {
  user_id: string;
  display_name: string | null;
  primary_currency: string;
  created_at: string;
}

export interface Balance {
  id: string;
  user_id: string;
  currency_code: string;
  amount: number;
  updated_at: string;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  is_default: boolean;
  color: string;
  icon: string;
  created_at: string;
}

export interface CategoryBudget {
  id: string;
  user_id: string;
  category_id: string;
  monthly_limit: number;
  currency_code: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  currency_code: string;
  description: string;
  category_id: string | null;
  card_name: string | null;
  notes: string | null;
  date: string;
  to_currency_code: string | null;
  to_amount: number | null;
  exchange_rate: number | null;
  created_at: string;
  deleted_at: string | null;
  category?: Category;
}

export interface InstallmentPlan {
  id: string;
  user_id: string;
  name: string;
  total_amount: number;
  currency_code: string;
  n_installments: number;
  installment_amount: number;
  tna: number | null;
  interest_type: InterestType;
  card_name: string | null;
  category_id: string | null;
  first_payment_date: string;
  status: PlanStatus;
  created_at: string;
}

export interface InstallmentPayment {
  id: string;
  plan_id: string;
  user_id: string;
  payment_number: number;
  amount: number;
  due_date: string;
  transaction_id: string | null;
  status: PaymentStatus;
}

export interface ParserRule {
  id: string;
  user_id: string;
  pattern: string;
  type: TransactionType;
  category_id: string | null;
  currency_code: string | null;
  confidence: number;
  match_count: number;
  created_at: string;
}

export interface PendingTransaction {
  id: string;
  user_id: string;
  raw_text: string;
  neo_interpretation: ParsedTransaction | null;
  status: PendingStatus;
  expires_at: string;
  created_at: string;
}

export interface ParsedTransaction {
  type: TransactionType;
  amount: number;
  currency_code: string;
  description: string;
  category_name?: string;
  card_name?: string;
  to_currency_code?: string;
  to_amount?: number;
  exchange_rate?: number;
  confidence: number;
  needs_confirmation: boolean;
  question?: string;
}

export interface InstallmentCalculation {
  installment_amount: number;
  total_to_pay: number;
  financing_cost: number;
  implied_tna?: number;
}
