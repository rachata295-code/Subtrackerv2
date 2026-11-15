import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '../lib/supabase';
import type {
  BalanceCheck,
  BillPayment,
  Category,
  ConfirmIncomeInput,
  CreateBalanceCheckInput,
  CreateTransactionInput,
  CreateTransactionsInput,
  FinanceData,
  Hue,
  Installment,
  PayBillInput,
  PaymentSource,
  PlanItem,
  Pot,
  RecurringIncome,
  Satang,
  Settings,
  SourceKind,
  Subscription,
  Transaction,
  UpdateSettingsInput,
  UpsertInstallmentInput,
  UpsertPlanItemInput,
  UpsertPotInput,
  UpsertRecurringIncomeInput,
  UpsertSourceInput,
  UpsertSubscriptionInput,
} from '../types/finance';

export interface SettingsRow {
  user_id: string;
  salary: string | number;
  pay_day: number;
  budget_start_period: string | null;
}

export interface PaymentSourceRow {
  id: string;
  name: string;
  kind: SourceKind;
  hue: Hue;
  archived: boolean;
  statement_close_day: number | null;
  due_day: number | null;
  due_month_offset: 0 | 1 | null;
  pay_from_source_id: string | null;
}

export interface PotRow {
  id: string;
  name: string;
  per_period: string | number;
  rollover: boolean;
  hue: Hue;
}

export interface SubscriptionRow {
  id: string;
  name: string;
  amount: string | number;
  frequency: 'monthly' | 'yearly';
  billing_day: number;
  billing_month: number | null;
  source_id: string;
  pot_id: string | null;
  active: boolean;
}

export interface InstallmentRow {
  id: string;
  name: string;
  per_installment: string | number;
  count: number;
  first_charge_date: string;
  source_id: string;
  pot_id: string | null;
}

export interface TransactionRow {
  id: string;
  date: string;
  amount: string | number;
  direction: 'out' | 'in';
  source_id: string;
  pot_id: string | null;
  category: Category;
  note: string;
  created_at?: string;
  recurring_income_id?: string | null;
  income_due_on?: string | null;
}

export interface BillPaymentRow {
  id: string;
  source_id: string;
  statement_key: string;
  amount: string | number;
  paid_on: string;
  created_at?: string;
}

export interface BalanceCheckRow {
  id: string;
  source_id: string;
  checked_on: string;
  actual: string | number;
  expected_before: string | number | null;
  adjustment_tx_id: string | null;
  created_at: string;
}

export interface PlanItemRow {
  id: string;
  period_key: string;
  name: string;
  amount: string | number;
  kind: 'pay' | 'save';
  source_id: string;
  due_on: string | null;
  category: Category;
  done_tx_id: string | null;
  sort_order: number;
}

export interface RecurringIncomeRow {
  id: string;
  name: string;
  amount: string | number;
  day_of_month: number;
  source_id: string;
  active: boolean;
}

const SETTINGS_COLUMNS = 'user_id, salary, pay_day, budget_start_period';
const SOURCE_COLUMNS =
  'id, name, kind, hue, archived, statement_close_day, due_day, due_month_offset, pay_from_source_id';
const POT_COLUMNS = 'id, name, per_period, rollover, hue';
const SUBSCRIPTION_COLUMNS =
  'id, name, amount, frequency, billing_day, billing_month, source_id, pot_id, active';
const INSTALLMENT_COLUMNS =
  'id, name, per_installment, count, first_charge_date, source_id, pot_id';
const TRANSACTION_COLUMNS =
  'id, date, amount, direction, source_id, pot_id, category, note, created_at, recurring_income_id, income_due_on';
const BILL_PAYMENT_COLUMNS = 'id, source_id, statement_key, amount, paid_on, created_at';
const BALANCE_CHECK_COLUMNS =
  'id, source_id, checked_on, actual, expected_before, adjustment_tx_id, created_at';
const PLAN_ITEM_COLUMNS =
  'id, period_key, name, amount, kind, source_id, due_on, category, done_tx_id, sort_order';
const RECURRING_INCOME_COLUMNS = 'id, name, amount, day_of_month, source_id, active';

function wrapRepoError(message: string, cause: unknown): Error {
  // Assign cause explicitly so the code compiles under tsconfig ES2020 lib while preserving standard Error.cause.
  const err = new Error(message);
  (err as Error & { cause?: unknown }).cause = cause;
  return err;
}

/** Converts a Postgres numeric string/number into integer satang without float drift. */
export function numericToSatang(value: string | number): Satang {
  const num = typeof value === 'string' ? (value.trim() === '' ? Number.NaN : Number(value)) : value;
  if (!Number.isFinite(num)) {
    throw wrapRepoError('จำนวนเงินไม่ถูกต้อง', value);
  }
  const satang = Math.round(num * 100);
  if (!Number.isSafeInteger(satang)) {
    throw wrapRepoError('จำนวนเงินเกินขอบเขตที่รองรับ', value);
  }
  return satang;
}

/** Converts integer satang into a 2-decimal string suitable for Postgres numeric(12,2). */
export function satangToNumeric(satang: Satang): string {
  if (!Number.isFinite(satang)) {
    throw wrapRepoError('จำนวนเงินไม่ถูกต้อง', satang);
  }
  const rounded = Math.round(satang);
  const sign = rounded < 0 ? '-' : '';
  const abs = Math.abs(rounded);
  const baht = Math.floor(abs / 100);
  const cents = abs % 100;
  return `${sign}${baht}.${String(cents).padStart(2, '0')}`;
}

export function mapSettingsFromRow(row: SettingsRow): Settings {
  return {
    userId: row.user_id,
    salary: numericToSatang(row.salary),
    payDay: row.pay_day,
    // Older rows/mocks may omit the column entirely; treat that as unset.
    budgetStartPeriod: row.budget_start_period ?? null,
  };
}

export function mapSourceFromRow(row: PaymentSourceRow): PaymentSource {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    hue: row.hue,
    archived: row.archived,
    statementCloseDay: row.statement_close_day,
    dueDay: row.due_day,
    dueMonthOffset: row.due_month_offset,
    payFromSourceId: row.pay_from_source_id,
  };
}

export function mapSourceToRow(input: Omit<PaymentSource, 'id'>): Omit<PaymentSourceRow, 'id'> {
  return {
    name: input.name,
    kind: input.kind,
    hue: input.hue,
    archived: input.archived,
    statement_close_day: input.statementCloseDay,
    due_day: input.dueDay,
    due_month_offset: input.dueMonthOffset,
    pay_from_source_id: input.payFromSourceId,
  };
}

export function mapPotFromRow(row: PotRow): Pot {
  return {
    id: row.id,
    name: row.name,
    perPeriod: numericToSatang(row.per_period),
    rollover: row.rollover,
    hue: row.hue,
  };
}

export function mapPotToRow(input: Omit<Pot, 'id'>): Omit<PotRow, 'id'> {
  return {
    name: input.name,
    per_period: satangToNumeric(input.perPeriod),
    rollover: input.rollover,
    hue: input.hue,
  };
}

export function mapSubscriptionFromRow(row: SubscriptionRow): Subscription {
  return {
    id: row.id,
    name: row.name,
    amount: numericToSatang(row.amount),
    frequency: row.frequency,
    billingDay: row.billing_day,
    billingMonth: row.billing_month,
    sourceId: row.source_id,
    potId: row.pot_id,
    active: row.active,
  };
}

export function mapSubscriptionToRow(input: Omit<Subscription, 'id'>): Omit<SubscriptionRow, 'id'> {
  return {
    name: input.name,
    amount: satangToNumeric(input.amount),
    frequency: input.frequency,
    billing_day: input.billingDay,
    billing_month: input.billingMonth,
    source_id: input.sourceId,
    pot_id: input.potId,
    active: input.active,
  };
}

export function mapInstallmentFromRow(row: InstallmentRow): Installment {
  return {
    id: row.id,
    name: row.name,
    perInstallment: numericToSatang(row.per_installment),
    count: row.count,
    firstChargeDate: row.first_charge_date,
    sourceId: row.source_id,
    potId: row.pot_id,
  };
}

export function mapInstallmentToRow(input: Omit<Installment, 'id'>): Omit<InstallmentRow, 'id'> {
  return {
    name: input.name,
    per_installment: satangToNumeric(input.perInstallment),
    count: input.count,
    first_charge_date: input.firstChargeDate,
    source_id: input.sourceId,
    pot_id: input.potId,
  };
}

export function mapTransactionFromRow(row: TransactionRow): Transaction {
  return {
    id: row.id,
    date: row.date,
    amount: numericToSatang(row.amount),
    direction: row.direction,
    sourceId: row.source_id,
    potId: row.pot_id,
    category: row.category,
    note: row.note,
    createdAt: row.created_at ?? '1970-01-01T00:00:00.000Z',
    recurringIncomeId: row.recurring_income_id ?? null,
    incomeDueOn: row.income_due_on ?? null,
  };
}

export function mapTransactionToRow(input: CreateTransactionInput): Omit<TransactionRow, 'id'> {
  return {
    date: input.date,
    amount: satangToNumeric(input.amount),
    direction: input.direction,
    source_id: input.sourceId,
    pot_id: input.potId,
    category: input.category,
    note: input.note,
    ...(input.recurringIncomeId !== undefined ? { recurring_income_id: input.recurringIncomeId } : {}),
    ...(input.incomeDueOn !== undefined ? { income_due_on: input.incomeDueOn } : {}),
  };
}

export function mapBillPaymentFromRow(row: BillPaymentRow): BillPayment {
  return {
    id: row.id,
    sourceId: row.source_id,
    statementKey: row.statement_key,
    amount: numericToSatang(row.amount),
    paidOn: row.paid_on,
    createdAt: row.created_at ?? '1970-01-01T00:00:00.000Z',
  };
}

export function mapBillPaymentToRow(input: PayBillInput): Omit<BillPaymentRow, 'id'> {
  return {
    source_id: input.sourceId,
    statement_key: input.statementKey,
    amount: satangToNumeric(input.amount),
    paid_on: input.paidOn,
  };
}

export async function seedDefaults(client: SupabaseClient = getSupabaseClient()): Promise<void> {
  const { error } = await client.rpc('seed_defaults');
  if (error) {
    throw wrapRepoError('สร้างข้อมูลเริ่มต้นไม่สำเร็จ', error);
  }
}

export async function loadFinanceData(client: SupabaseClient = getSupabaseClient()): Promise<FinanceData> {
  const [
    settingsRes,
    sourcesRes,
    potsRes,
    subsRes,
    instsRes,
    txRes,
    paymentsRes,
    balanceChecksRes,
    planItemsRes,
    recurringIncomesRes,
  ] = await Promise.all([
    client.from('settings').select(SETTINGS_COLUMNS).maybeSingle(),
    client
      .from('payment_sources')
      .select(SOURCE_COLUMNS)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true }),
    client
      .from('pots')
      .select(POT_COLUMNS)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true }),
    client
      .from('subscriptions')
      .select(SUBSCRIPTION_COLUMNS)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true }),
    client
      .from('installments')
      .select(INSTALLMENT_COLUMNS)
      .order('first_charge_date', { ascending: true })
      .order('id', { ascending: true }),
    client
      .from('transactions')
      .select(TRANSACTION_COLUMNS)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false }),
    client
      .from('bill_payments')
      .select(BILL_PAYMENT_COLUMNS)
      .order('paid_on', { ascending: false })
      .order('id', { ascending: true }),
    client
      .from('balance_checks')
      .select(BALANCE_CHECK_COLUMNS)
      .order('checked_on', { ascending: false })
      .order('created_at', { ascending: false }),
    client
      .from('plan_items')
      .select(PLAN_ITEM_COLUMNS)
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true }),
    client
      .from('recurring_incomes')
      .select(RECURRING_INCOME_COLUMNS)
      .order('day_of_month', { ascending: true })
      .order('id', { ascending: true }),
  ]);

  if (settingsRes.error) throw wrapRepoError('โหลดการตั้งค่าไม่สำเร็จ', settingsRes.error);
  if (sourcesRes.error) throw wrapRepoError('โหลดช่องทางจ่ายไม่สำเร็จ', sourcesRes.error);
  if (potsRes.error) throw wrapRepoError('โหลดก้อนเงินไม่สำเร็จ', potsRes.error);
  if (subsRes.error) throw wrapRepoError('โหลดรายการสมัครสมาชิกไม่สำเร็จ', subsRes.error);
  if (instsRes.error) throw wrapRepoError('โหลดรายการผ่อนไม่สำเร็จ', instsRes.error);
  if (txRes.error) throw wrapRepoError('โหลดรายการใช้จ่ายไม่สำเร็จ', txRes.error);
  if (paymentsRes.error) throw wrapRepoError('โหลดประวัติการจ่ายบิลไม่สำเร็จ', paymentsRes.error);
  if (balanceChecksRes?.error) throw wrapRepoError('โหลดประวัติเช็กยอดไม่สำเร็จ', balanceChecksRes.error);
  if (planItemsRes?.error) throw wrapRepoError('โหลดรายการแผนไม่สำเร็จ', planItemsRes.error);
  if (recurringIncomesRes?.error) throw wrapRepoError('โหลดเงินประจำไม่สำเร็จ', recurringIncomesRes.error);

  const settings: Settings = settingsRes.data
    ? mapSettingsFromRow(settingsRes.data as SettingsRow)
    : { userId: '', salary: 0, payDay: 10, budgetStartPeriod: null };

  // Prompt 02 replaces the Phase 2 table arrays with full row mappers.
  void balanceChecksRes;
  void planItemsRes;
  void recurringIncomesRes;

  return {
    settings,
    sources: ((sourcesRes.data ?? []) as PaymentSourceRow[]).map(mapSourceFromRow),
    pots: ((potsRes.data ?? []) as PotRow[]).map(mapPotFromRow),
    subscriptions: ((subsRes.data ?? []) as SubscriptionRow[]).map(mapSubscriptionFromRow),
    installments: ((instsRes.data ?? []) as InstallmentRow[]).map(mapInstallmentFromRow),
    transactions: ((txRes.data ?? []) as TransactionRow[]).map(mapTransactionFromRow),
    payments: ((paymentsRes.data ?? []) as BillPaymentRow[]).map(mapBillPaymentFromRow),
    balanceChecks: [],
    planItems: [],
    recurringIncomes: [],
  };
}

export async function updateSettings(
  input: UpdateSettingsInput,
  client: SupabaseClient = getSupabaseClient(),
): Promise<Settings> {
  const userResult = client.auth?.getUser ? await client.auth.getUser() : null;
  const userId = userResult?.data?.user?.id;
  const payload = {
    ...(userId ? { user_id: userId } : {}),
    salary: satangToNumeric(input.salary),
    pay_day: input.payDay,
    // undefined = leave the column alone (upsert only updates keys present in the payload); null clears it.
    ...(input.budgetStartPeriod !== undefined ? { budget_start_period: input.budgetStartPeriod } : {}),
  };

  const { data, error } = await client
    .from('settings')
    .upsert(payload, { onConflict: 'user_id' })
    .select(SETTINGS_COLUMNS)
    .single();

  if (error || !data) {
    throw wrapRepoError('บันทึกการตั้งค่าไม่สำเร็จ', error);
  }
  return mapSettingsFromRow(data as SettingsRow);
}

export async function upsertSource(
  input: UpsertSourceInput,
  client: SupabaseClient = getSupabaseClient(),
): Promise<PaymentSource> {
  const { id, ...rest } = input;
  const payload = mapSourceToRow(rest);

  const query = id
    ? client.from('payment_sources').upsert({ id, ...payload }, { onConflict: 'id' })
    : client.from('payment_sources').insert(payload);

  const { data, error } = await query.select(SOURCE_COLUMNS).single();
  if (error || !data) {
    throw wrapRepoError('บันทึกช่องทางจ่ายไม่สำเร็จ', error);
  }
  return mapSourceFromRow(data as PaymentSourceRow);
}

export async function deleteSource(
  id: string,
  client: SupabaseClient = getSupabaseClient(),
): Promise<void> {
  const { error } = await client.from('payment_sources').delete().eq('id', id);
  if (error) {
    throw wrapRepoError('ลบช่องทางจ่ายไม่สำเร็จ', error);
  }
}

export async function upsertPot(
  input: UpsertPotInput,
  client: SupabaseClient = getSupabaseClient(),
): Promise<Pot> {
  const { id, ...rest } = input;
  const payload = mapPotToRow(rest);

  const query = id
    ? client.from('pots').upsert({ id, ...payload }, { onConflict: 'id' })
    : client.from('pots').insert(payload);

  const { data, error } = await query.select(POT_COLUMNS).single();
  if (error || !data) {
    throw wrapRepoError('บันทึกก้อนเงินไม่สำเร็จ', error);
  }
  return mapPotFromRow(data as PotRow);
}

export async function deletePot(
  id: string,
  client: SupabaseClient = getSupabaseClient(),
): Promise<void> {
  const { error } = await client.from('pots').delete().eq('id', id);
  if (error) {
    throw wrapRepoError('ลบก้อนเงินไม่สำเร็จ', error);
  }
}

export async function upsertSubscription(
  input: UpsertSubscriptionInput,
  client: SupabaseClient = getSupabaseClient(),
): Promise<Subscription> {
  const { id, ...rest } = input;
  const payload = mapSubscriptionToRow(rest);

  const query = id
    ? client.from('subscriptions').upsert({ id, ...payload }, { onConflict: 'id' })
    : client.from('subscriptions').insert(payload);

  const { data, error } = await query.select(SUBSCRIPTION_COLUMNS).single();
  if (error || !data) {
    throw wrapRepoError('บันทึกรายการสมัครสมาชิกไม่สำเร็จ', error);
  }
  return mapSubscriptionFromRow(data as SubscriptionRow);
}

export async function deleteSubscription(
  id: string,
  client: SupabaseClient = getSupabaseClient(),
): Promise<void> {
  const { error } = await client.from('subscriptions').delete().eq('id', id);
  if (error) {
    throw wrapRepoError('ลบรายการสมัครสมาชิกไม่สำเร็จ', error);
  }
}

export async function upsertInstallment(
  input: UpsertInstallmentInput,
  client: SupabaseClient = getSupabaseClient(),
): Promise<Installment> {
  const { id, ...rest } = input;
  const payload = mapInstallmentToRow(rest);

  const query = id
    ? client.from('installments').upsert({ id, ...payload }, { onConflict: 'id' })
    : client.from('installments').insert(payload);

  const { data, error } = await query.select(INSTALLMENT_COLUMNS).single();
  if (error || !data) {
    throw wrapRepoError('บันทึกรายการผ่อนไม่สำเร็จ', error);
  }
  return mapInstallmentFromRow(data as InstallmentRow);
}

export async function deleteInstallment(
  id: string,
  client: SupabaseClient = getSupabaseClient(),
): Promise<void> {
  const { error } = await client.from('installments').delete().eq('id', id);
  if (error) {
    throw wrapRepoError('ลบรายการผ่อนไม่สำเร็จ', error);
  }
}

export async function createTransaction(
  input: CreateTransactionInput,
  client: SupabaseClient = getSupabaseClient(),
): Promise<Transaction> {
  const payload = mapTransactionToRow(input);
  const { data, error } = await client
    .from('transactions')
    .insert(payload)
    .select(TRANSACTION_COLUMNS)
    .single();

  if (error || !data) {
    throw wrapRepoError('บันทึกรายการไม่สำเร็จ', error);
  }
  return mapTransactionFromRow(data as TransactionRow);
}

export async function updateTransaction(
  input: Transaction,
  client: SupabaseClient = getSupabaseClient(),
): Promise<Transaction> {
  const { id, ...rest } = input;
  const payload = mapTransactionToRow(rest);
  const { data, error } = await client
    .from('transactions')
    .update(payload)
    .eq('id', id)
    .select(TRANSACTION_COLUMNS)
    .single();

  if (error || !data) {
    throw wrapRepoError('แก้ไขรายการไม่สำเร็จ', error);
  }
  return mapTransactionFromRow(data as TransactionRow);
}

export async function deleteTransaction(
  id: string,
  client: SupabaseClient = getSupabaseClient(),
): Promise<void> {
  const { error } = await client.from('transactions').delete().eq('id', id);
  if (error) {
    throw wrapRepoError('ลบรายการไม่สำเร็จ', error);
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === '23505'
  );
}

/**
 * Records a bill payment idempotently per (sourceId, statementKey).
 * Pre-checks for an existing record and handles concurrent 23505 unique violations
 * so double-tapping "จ่ายแล้ว" never creates duplicate bill_payments.
 */
export async function payBill(
  input: PayBillInput,
  client: SupabaseClient = getSupabaseClient(),
): Promise<BillPayment> {
  const { data: existing, error: lookupError } = await client
    .from('bill_payments')
    .select(BILL_PAYMENT_COLUMNS)
    .eq('source_id', input.sourceId)
    .eq('statement_key', input.statementKey)
    .maybeSingle();

  if (lookupError) {
    throw wrapRepoError('ตรวจสอบสถานะบิลไม่สำเร็จ', lookupError);
  }
  if (existing) {
    return mapBillPaymentFromRow(existing as BillPaymentRow);
  }

  const payload = mapBillPaymentToRow(input);
  const { data: inserted, error: insertError } = await client
    .from('bill_payments')
    .insert(payload)
    .select(BILL_PAYMENT_COLUMNS)
    .single();

  if (!insertError && inserted) {
    return mapBillPaymentFromRow(inserted as BillPaymentRow);
  }

  // Concurrent requests can race past the pre-check; return the winning row on unique conflict.
  if (isUniqueViolation(insertError)) {
    const { data: raceRow, error: raceError } = await client
      .from('bill_payments')
      .select(BILL_PAYMENT_COLUMNS)
      .eq('source_id', input.sourceId)
      .eq('statement_key', input.statementKey)
      .single();

    if (!raceError && raceRow) {
      return mapBillPaymentFromRow(raceRow as BillPaymentRow);
    }
    throw wrapRepoError('บันทึกการจ่ายบิลไม่สำเร็จ', raceError ?? insertError);
  }

  throw wrapRepoError('บันทึกการจ่ายบิลไม่สำเร็จ', insertError);
}

export async function deleteBillPayment(
  id: string,
  client: SupabaseClient = getSupabaseClient(),
): Promise<void> {
  const { error } = await client.from('bill_payments').delete().eq('id', id);
  if (error) {
    throw wrapRepoError('ยกเลิกการจ่ายบิลไม่สำเร็จ', error);
  }
}

export async function createTransactions(
  inputs: CreateTransactionsInput,
  client?: SupabaseClient,
): Promise<Transaction[]> {
  void inputs;
  void client;
  throw new Error('not implemented: createTransactions');
}

export async function createBalanceCheck(
  input: CreateBalanceCheckInput,
  client?: SupabaseClient,
): Promise<BalanceCheck> {
  void input;
  void client;
  throw new Error('not implemented: createBalanceCheck');
}

export async function upsertPlanItem(
  input: UpsertPlanItemInput,
  client?: SupabaseClient,
): Promise<PlanItem> {
  void input;
  void client;
  throw new Error('not implemented: upsertPlanItem');
}

export async function deletePlanItem(
  id: string,
  client?: SupabaseClient,
): Promise<void> {
  void id;
  void client;
  throw new Error('not implemented: deletePlanItem');
}

export async function completePlanItem(
  id: string,
  client?: SupabaseClient,
): Promise<PlanItem> {
  void id;
  void client;
  throw new Error('not implemented: completePlanItem');
}

export async function uncompletePlanItem(
  id: string,
  client?: SupabaseClient,
): Promise<PlanItem> {
  void id;
  void client;
  throw new Error('not implemented: uncompletePlanItem');
}

export async function upsertRecurringIncome(
  input: UpsertRecurringIncomeInput,
  client?: SupabaseClient,
): Promise<RecurringIncome> {
  void input;
  void client;
  throw new Error('not implemented: upsertRecurringIncome');
}

export async function deleteRecurringIncome(
  id: string,
  client?: SupabaseClient,
): Promise<void> {
  void id;
  void client;
  throw new Error('not implemented: deleteRecurringIncome');
}

export async function confirmIncome(
  input: ConfirmIncomeInput,
  client?: SupabaseClient,
): Promise<Transaction> {
  void input;
  void client;
  throw new Error('not implemented: confirmIncome');
}
