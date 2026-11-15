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
  /**
   * First pay period the pot rollover chain counts from (carryIn = 0 there). Older periods still show
   * their own figures but never carry forward. null = fall back to the first period with a transaction/payment.
   */
  budgetStartPeriod: PeriodKey | null;
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
  | 'other'
  | 'savings'
  | 'unknown'
  | 'allowance'
  | 'parttime'
  | 'freelance';

/** Categories shown in spending summary charts (includes virtual charge categories not stored in DB). */
export type SummaryCategory = Category | 'subscription' | 'installment';

export const OUT_CATEGORIES: readonly Category[] = [
  'food',
  'transport',
  'shopping',
  'entertainment',
  'health',
  'bills',
  'other',
  'savings',
  'unknown',
];

export const IN_CATEGORIES: readonly Category[] = [
  'allowance',
  'parttime',
  'freelance',
  'other',
  'unknown',
];

export const CATEGORY_LABELS: Record<Category, string> = {
  food: 'อาหาร',
  transport: 'เดินทาง',
  shopping: 'ช้อปปิ้ง',
  entertainment: 'บันเทิง',
  health: 'สุขภาพ',
  bills: 'บิล/ค่าบริการ',
  other: 'อื่นๆ',
  savings: 'เก็บเงิน',
  unknown: 'ลืมจด',
  allowance: 'เงินประจำ',
  parttime: 'พาร์ทไทม์',
  freelance: 'ฟรีแลนซ์',
};

export const SUMMARY_CATEGORY_LABELS: Record<SummaryCategory, string> = {
  ...CATEGORY_LABELS,
  subscription: 'สมัครสมาชิก',
  installment: 'ผ่อนชำระ',
};

export interface Transaction {
  id: string;
  date: ISODate;
  amount: Satang;
  direction: 'out' | 'in';
  sourceId: string;
  potId: string | null;
  category: Category;
  note: string;
  createdAt: string;
  recurringIncomeId: string | null;
  incomeDueOn: ISODate | null;
}

export interface BillPayment {
  id: string;
  sourceId: string;
  statementKey: PeriodKey;
  amount: Satang;
  paidOn: ISODate;
  createdAt: string;
}

export interface RecurringIncome {
  id: string;
  name: string;
  amount: Satang;
  dayOfMonth: number;
  sourceId: string;
  active: boolean;
}

export interface BalanceCheck {
  id: string;
  sourceId: string;
  checkedOn: ISODate;
  actual: Satang;
  expectedBefore: Satang | null;
  adjustmentTxId: string | null;
  createdAt: string;
}

export interface PlanItem {
  id: string;
  periodKey: PeriodKey;
  name: string;
  amount: Satang;
  kind: 'pay' | 'save';
  sourceId: string;
  dueOn: ISODate | null;
  category: Category;
  doneTxId: string | null;
  sortOrder: number;
}

export interface FinanceData {
  settings: Settings;
  sources: PaymentSource[];
  pots: Pot[];
  subscriptions: Subscription[];
  installments: Installment[];
  transactions: Transaction[];
  payments: BillPayment[];
  balanceChecks: BalanceCheck[];
  planItems: PlanItem[];
  recurringIncomes: RecurringIncome[];
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

export interface CategorySpend {
  category: SummaryCategory;
  amount: Satang;
  percent: number;
}

export interface PeriodSpending {
  periodKey: PeriodKey;
  total: Satang;
  saved: Satang;
  unknown: Satang;
  categories: CategorySpend[];
}

export interface HotbarItem {
  note: string;
  amount: Satang;
  category: Category;
  sourceId: string;
  potId: string | null;
  count: number;
  lastDate: ISODate;
}

export type AmountExpressionResult =
  | { value: Satang; error?: undefined }
  | { error: string; value?: undefined };

export interface PendingIncome {
  recurringIncomeId: string;
  name: string;
  amount: Satang;
  sourceId: string;
  dueOn: ISODate;
}

export interface ForecastEvent {
  date: ISODate;
  kind: 'income' | 'bill' | 'plan';
  direction: 'in' | 'out';
  title: string;
  amount: Satang;
  balance: Satang;
}

export interface ForecastLow {
  date: ISODate;
  balance: Satang;
}

export interface Forecast {
  start: Satang;
  incoming: Satang;
  bills: Satang;
  plans: Satang;
  potsLeft: Satang;
  available: Satang;
  timeline: ForecastEvent[];
  low: ForecastLow | null;
}

export interface UseFinanceData {
  data?: FinanceData;
  isLoading: boolean;
  error: Error | null;
  refetch?: () => void;
}

export interface UseFinanceMutation<TInput, TResult = void> {
  mutate: (input: TInput) => void;
  mutateAsync: (input: TInput) => Promise<TResult>;
  isPending: boolean;
  error: Error | null;
}

// budgetStartPeriod is optional so callers that only edit salary/payDay leave the stored value untouched;
// pass null explicitly to clear it.
export type UpdateSettingsInput = Pick<Settings, 'salary' | 'payDay'> & Partial<Pick<Settings, 'budgetStartPeriod'>>;
export type UpsertSourceInput = Omit<PaymentSource, 'id'> & { id?: string };
export type UpsertPotInput = Omit<Pot, 'id'> & { id?: string };
export type UpsertSubscriptionInput = Omit<Subscription, 'id'> & { id?: string };
export type UpsertInstallmentInput = Omit<Installment, 'id'> & { id?: string };

// createdAt, recurringIncomeId, and incomeDueOn are optional on creation so manual forms only need core fields.
export type CreateTransactionInput = Omit<
  Transaction,
  'id' | 'createdAt' | 'recurringIncomeId' | 'incomeDueOn'
> & {
  createdAt?: string;
  recurringIncomeId?: string | null;
  incomeDueOn?: ISODate | null;
};

export type CreateTransactionsInput = CreateTransactionInput[];

export type PayBillInput = Omit<BillPayment, 'id' | 'createdAt'> & {
  createdAt?: string;
};

export interface BalanceCheckAdjustmentInput {
  amount: Satang;
  direction: 'out' | 'in';
  note?: string;
}

export interface CreateBalanceCheckInput {
  sourceId: string;
  checkedOn?: ISODate;
  actual: Satang;
  expectedBefore: Satang | null;
  adjustment?: BalanceCheckAdjustmentInput | null;
}

export type UpsertPlanItemInput = Omit<PlanItem, 'id' | 'doneTxId' | 'sortOrder'> & {
  id?: string;
  doneTxId?: string | null;
  sortOrder?: number;
};

export type UpsertRecurringIncomeInput = Omit<RecurringIncome, 'id'> & { id?: string };

export interface ConfirmIncomeInput {
  recurringIncomeId: string;
  incomeDueOn: ISODate;
  amount: Satang;
  date: ISODate;
  sourceId?: string;
  note?: string;
}
