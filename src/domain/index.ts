import type {
  FinanceData,
  ISODate,
  Installment,
  InstallmentCharge,
  Outflow,
  PayPeriod,
  PaymentSource,
  PeriodKey,
  Pot,
  PotStatus,
  Satang,
  StatementWindow,
  Subscription,
  SubscriptionCharge,
} from '../types/finance';

// Stub implementations for SPEC §4; prompt 02 replaces these with pure domain logic.

export function payPeriod(date: ISODate, payDay: number): PayPeriod {
  void date;
  void payDay;
  throw new Error('not implemented: payPeriod');
}

export function statementFor(src: PaymentSource, chargeDate: ISODate): StatementWindow {
  void src;
  void chargeDate;
  throw new Error('not implemented: statementFor');
}

export function subscriptionCharges(
  sub: Subscription,
  from: ISODate,
  to: ISODate,
): SubscriptionCharge[] {
  void sub;
  void from;
  void to;
  throw new Error('not implemented: subscriptionCharges');
}

export function installmentSchedule(inst: Installment): InstallmentCharge[] {
  void inst;
  throw new Error('not implemented: installmentSchedule');
}

export function billAmount(src: PaymentSource, statementKey: PeriodKey, data: FinanceData): Satang {
  void src;
  void statementKey;
  void data;
  throw new Error('not implemented: billAmount');
}

export function upcomingOutflows(data: FinanceData, today: ISODate, days = 30): Outflow[] {
  void data;
  void today;
  void days;
  throw new Error('not implemented: upcomingOutflows');
}

export function potStatus(pot: Pot, periodKey: PeriodKey, data: FinanceData): PotStatus {
  void pot;
  void periodKey;
  void data;
  throw new Error('not implemented: potStatus');
}
