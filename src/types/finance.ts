import type { Hue } from '../components/ui/hue';

export type { Hue };

/** Integer satang (1 THB = 100 satang) to avoid floating-point drift in domain math. */
export type Satang = number;

/** Calendar date formatted as 'YYYY-MM-DD' in Asia/Bangkok. */
export type ISODate = string;

/** Pay period or statement closing key formatted as 'YYYY-MM'. */
export type PeriodKey = string;

export interface Settings {
  userId: string;
  salary: Satang;
  payDay: number;
}

export type SourceKind = 'bank' | 'credit_card' | 'paylater';

export interface PaymentSource {
  id: string;
  name: string;
  kind: SourceKind;
  hue: Hue;
  archived: boolean;
  // Billing cycle fields are all null for bank accounts because they settle immediately.
  statementCloseDay: number | null;
  dueDay: number | null;
  dueMonthOffset: 0 | 1 | null;
  payFromSourceId: string | null;
}

export interface Pot {
  id: string;
  name: string;
  perPeriod: Satang;
  rollover: boolean;
  hue: Hue;
}

export interface Subscription {
  id: string;
  name: string;
  amount: Satang;
  frequency: 'monthly' | 'yearly';
  billingDay: number;
  billingMonth: number | null;
  sourceId: string;
  potId: string | null;
  active: boolean;
}

export interface Installment {
  id: string;
  name: string;
  perInstallment: Satang;
  count: number;
  firstChargeDate: ISODate;
  sourceId: string;
  // Null excludes the installment from any pot's budget while keeping it on the bill.
  potId: string | null;
}

export type Category =
  | 'food'
  | 'transport'
  | 'shopping'
  | 'entertainment'
  | 'health'
  | 'bills'
  | 'other';

export interface Transaction {
  id: string;
  date: ISODate;
  amount: Satang;
  direction: 'out' | 'in';
  sourceId: string;
  potId: string | null;
  category: Category;
  note: string;
}

export interface BillPayment {
  id: string;
  sourceId: string;
  statementKey: PeriodKey;
  amount: Satang;
  paidOn: ISODate;
}

export interface FinanceData {
  settings: Settings;
  sources: PaymentSource[];
  pots: Pot[];
  subscriptions: Subscription[];
  installments: Installment[];
  transactions: Transaction[];
  payments: BillPayment[];
}

export interface PayPeriod {
  key: PeriodKey;
  start: ISODate;
  end: ISODate;
}

export interface StatementWindow {
  key: PeriodKey;
  start: ISODate;
  end: ISODate;
  dueDate: ISODate;
}

export interface SubscriptionCharge {
  date: ISODate;
  amount: Satang;
}

export interface InstallmentCharge {
  n: number;
  chargeDate: ISODate;
  amount: Satang;
}

export interface Outflow {
  date: ISODate;
  dueBy: boolean;
  title: string;
  amount: Satang;
  sourceId: string;
  kind: 'bill' | 'charge';
  // Card/paylater charges set counted=false so totals count only the bill and avoid double-counting.
  counted: boolean;
  statementKey?: PeriodKey;
}

export interface PotStatus {
  carryIn: Satang;
  budget: Satang;
  reserved: Satang;
  spent: Satang;
  left: Satang;
  over: boolean;
}

export interface UseFinanceData {
  data?: FinanceData;
  isLoading: boolean;
  error: Error | null;
}

export interface UseFinanceMutation<TInput, TResult = void> {
  mutate: (input: TInput) => void;
  mutateAsync: (input: TInput) => Promise<TResult>;
  isPending: boolean;
  error: Error | null;
}

export type UpdateSettingsInput = Pick<Settings, 'salary' | 'payDay'>;
export type UpsertSourceInput = Omit<PaymentSource, 'id'> & { id?: string };
export type UpsertPotInput = Omit<Pot, 'id'> & { id?: string };
export type UpsertSubscriptionInput = Omit<Subscription, 'id'> & { id?: string };
export type UpsertInstallmentInput = Omit<Installment, 'id'> & { id?: string };
export type CreateTransactionInput = Omit<Transaction, 'id'>;
export type PayBillInput = Omit<BillPayment, 'id'>;
