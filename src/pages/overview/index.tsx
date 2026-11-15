import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { AllocationBar } from '../../components/ui/AllocationBar';
import { AnimatedMoney } from '../../components/ui/AnimatedMoney';
import { AnimatedRow, ROW_EXIT_MS } from '../../components/ui/AnimatedRow';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DateBadge } from '../../components/ui/DateBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { IconButton } from '../../components/ui/IconButton';
import { ListRow } from '../../components/ui/ListRow';
import { Money } from '../../components/ui/Money';
import { Pill } from '../../components/ui/Pill';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { Skeleton } from '../../components/ui/Skeleton';
import { Tile } from '../../components/ui/Tile';
import { notify } from '../../components/ui/Toaster';
import { billAmount, payPeriod, potStatus, statementFor, upcomingOutflows } from '../../domain';
import {
  useCreateTransaction,
  useDeleteBillPayment,
  useDeleteTransaction,
  useFinanceData,
  usePayBill,
} from '../../hooks/useFinance';
import type { Segment } from '../../lib/allocation';
import {
  CATEGORY_LABELS,
  type Category,
  type CreateTransactionInput,
  type FinanceData,
  type ISODate,
  type Outflow,
  type PayPeriod,
  type PaymentSource,
  type PeriodKey,
  type Pot,
  type PotStatus,
  type Satang,
  type StatementWindow,
  type Transaction,
} from '../../types/finance';
import {
  addDays,
  bangkokToday,
  diffDays,
  formatPeriodMonthShort,
  formatThaiShortDate,
  parseISODate,
} from './date';
import { QuickAddSheet } from './QuickAddSheet';
import { AvailableCard } from '../../components/AvailableCard';
import { IncomeDueCard } from '../../components/IncomeDueCard';

const UPCOMING_DAYS = 30;
const UPCOMING_CAP = 5;
const RECENT_CAP = 5;
const wholeBaht = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

const CATEGORY_LABEL: Record<Category, string> = CATEGORY_LABELS;

const toBaht = (satang: Satang): number => satang / 100;

interface PeriodBill {
  source: PaymentSource;
  statementKey: PeriodKey;
  dueDate: ISODate;
  dueBy: boolean;
  amount: Satang;
  paid: boolean;
}

interface DerivedOverview {
  period: PayPeriod;
  daysLeft: number;
  playPot: Pot;
  playStatus: PotStatus;
  perDayBaht: number;
  essentialPot: Pot | null;
  essentialStatus: PotStatus | null;
  periodBills: PeriodBill[];
  manualPlaySpent: Satang;
  owedSatang: Satang;
  outflows: Outflow[];
  visibleOutflows: Outflow[];
  upcomingCountedTotal: Satang;
  recentTransactions: Transaction[];
  sourceById: Map<string, PaymentSource>;
  chargeMonths: Map<Outflow, string>;
}

function collectPeriodBills(
  data: FinanceData,
  period: PayPeriod,
  activeSources: PaymentSource[],
): PeriodBill[] {
  const bills: PeriodBill[] = [];
  // Probe across a 40-day lead-in through period.end so any statement closeDay / dueMonthOffset is discovered.
  const probes: ISODate[] = [addDays(period.start, -1), period.start, period.end];
  for (let d = addDays(period.start, -40); d <= period.end; d = addDays(d, 5)) {
    probes.push(d);
  }

  for (const src of activeSources) {
    if (src.kind === 'bank') continue;
    const seen = new Map<PeriodKey, StatementWindow>();
    for (const probe of probes) {
      const stmt = statementFor(src, probe);
      if (!seen.has(stmt.key)) seen.set(stmt.key, stmt);
    }

    for (const stmt of seen.values()) {
      // SPEC §4: a bill belongs to the pay period covering (dueDate - 1 day).
      const duePayDate = addDays(stmt.dueDate, -1);
      if (duePayDate < period.start || duePayDate > period.end) continue;

      const amount = billAmount(src, stmt.key, data);
      const paid = data.payments.some((p) => p.sourceId === src.id && p.statementKey === stmt.key);
      bills.push({
        source: src,
        statementKey: stmt.key,
        dueDate: stmt.dueDate,
        dueBy: src.kind === 'paylater',
        amount,
        paid,
      });
    }
  }

  bills.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return bills;
}

function deriveOverview(data: FinanceData, today: ISODate): DerivedOverview {
  const period = payPeriod(today, data.settings.payDay);
  // Inclusive remaining days (today through period.end) keeps daily average safe even on the final day.
  const daysLeft = Math.max(1, diffDays(today, period.end) + 1);

  const activeSources = data.sources.filter((s) => !s.archived);
  const sourceById = new Map(data.sources.map((s) => [s.id, s]));

  const playPot =
    data.pots.find((p) => p.name === 'ใช้ตามใจ') ??
    data.pots.find((p) => p.rollover) ??
    data.pots[0];
  const essentialPot = data.pots.find((p) => p.id !== playPot.id) ?? null;

  const playStatus = potStatus(playPot, period.key, data);
  const essentialStatus = essentialPot ? potStatus(essentialPot, period.key, data) : null;
  const perDayBaht = playStatus.left > 0 ? toBaht(playStatus.left) / daysLeft : 0;

  const periodBills = collectPeriodBills(data, period, activeSources);
  const paidBillsTotal = periodBills.filter((b) => b.paid).reduce((sum, b) => sum + b.amount, 0);
  // potStatus.spent includes paid bills; subtract them so the AllocationBar does not double-count paid segments.
  const manualPlaySpent = Math.max(0, playStatus.spent - paidBillsTotal);
  const owedSatang = periodBills.filter((b) => !b.paid).reduce((sum, b) => sum + b.amount, 0);

  const outflows = upcomingOutflows(data, today, UPCOMING_DAYS);
  const visibleOutflows = outflows.slice(0, UPCOMING_CAP);
  const upcomingCountedTotal = outflows
    .filter((o) => o.counted)
    .reduce((sum, o) => sum + o.amount, 0);

  // Latest transactions within the active pay period, newest date first (capped at 5 for desktop panel).
  const recentTransactions = data.transactions
    .filter((tx) => tx.date >= period.start && tx.date <= period.end)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, RECENT_CAP);

  const chargeMonths = new Map<Outflow, string>();
  for (const row of visibleOutflows) {
    if (row.kind !== 'charge') continue;
    const src = sourceById.get(row.sourceId);
    const stmtKey = row.statementKey ?? (src ? statementFor(src, row.date).key : undefined);
    if (stmtKey) chargeMonths.set(row, formatPeriodMonthShort(stmtKey));
  }

  return {
    period,
    daysLeft,
    playPot,
    playStatus,
    perDayBaht,
    essentialPot,
    essentialStatus,
    periodBills,
    manualPlaySpent,
    owedSatang,
    outflows,
    visibleOutflows,
    upcomingCountedTotal,
    recentTransactions,
    sourceById,
    chargeMonths,
  };
}

function formatPotTileLabel(perPeriod: Satang, carryIn: Satang): string {
  const base = `ก้อน ${wholeBaht.format(toBaht(perPeriod))}`;
  if (carryIn > 0) return `${base} + ยกมา ${wholeBaht.format(toBaht(carryIn))}`;
  if (carryIn < 0) return `${base} − ยกมา ${wholeBaht.format(toBaht(Math.abs(carryIn)))}`;
  return base;
}

function LoadingSkeleton() {
  return (
    <div className="mt-4 flex flex-col gap-3.5" role="status" aria-label="กำลังโหลด">
      <Skeleton className="h-4 w-48" />
      <Card className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-3 w-full" />
        <div className="grid grid-cols-2 gap-2.5">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </Card>
      <Card className="space-y-2.5">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </Card>
    </div>
  );
}

interface OverviewPageProps {
  /** Injectable current Bangkok date for deterministic tests; defaults to live Asia/Bangkok today. */
  today?: ISODate;
}

interface ExitingBill {
  row: Outflow;
  index: number;
}

function getOutflowBillKey(row: Outflow): string {
  return `${row.sourceId}:${row.statementKey ?? row.date}`;
}

function getOutflowRowKey(row: Outflow): string {
  return `${row.kind}:${row.sourceId}:${row.statementKey ?? row.date}:${row.title}`;
}

function formatErrorSuffix(err: unknown): string {
  return err instanceof Error && err.message ? `: ${err.message}` : '';
}

export default function OverviewPage({ today: todayProp }: OverviewPageProps = {}) {
  const today = todayProp ?? bangkokToday();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const finance = useFinanceData();
  const createTransaction = useCreateTransaction();
  const deleteTransaction = useDeleteTransaction();
  const payBill = usePayBill();
  const deleteBillPayment = useDeleteBillPayment();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [payingKeys, setPayingKeys] = useState<Set<string>>(() => new Set());
  const [exitingBills, setExitingBills] = useState<Map<string, ExitingBill>>(() => new Map());
  // Only rows created after first paint animate in; initial list rows stay static (SPEC §5).
  const [addedTxIds, setAddedTxIds] = useState<Set<string>>(() => new Set());
  const [, setRetryTick] = useState(0);

  // Synchronous lock prevents duplicate payBill mutations when a user double-taps before React re-renders.
  const payingKeysRef = useRef<Set<string>>(new Set());
  const exitTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  // After "จ่ายแล้ว" the pressed button may unmount; keep focus in place on the owed status region.
  const owedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (searchParams.get('add') !== '1') return;
    setSheetOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete('add');
    // Replace rather than push so pressing Back never re-opens the quick-add sheet (SPEC §3.5).
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const timers = exitTimersRef.current;
    return () => {
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
    };
  }, []);

  const handleRetry = () => {
    setRetryTick((n) => n + 1);
    if (typeof finance.refetch === 'function') {
      finance.refetch();
    } else if (typeof navigator !== 'undefined' && !navigator.userAgent.includes('jsdom')) {
      window.location.reload();
    }
  };

  if (finance.isLoading) {
    return (
      <>
        <header className="flex items-start justify-between gap-3">
          <h1 className="text-title font-semibold text-text">ภาพรวม</h1>
        </header>
        <LoadingSkeleton />
      </>
    );
  }

  if (finance.error) {
    return (
      <>
        <header className="flex items-start justify-between gap-3">
          <h1 className="text-title font-semibold text-text">ภาพรวม</h1>
        </header>
        <Card className="mt-4 flex flex-col items-start gap-3" role="alert">
          <p className="text-base font-medium text-negative">ไม่สามารถโหลดข้อมูลได้</p>
          <p className="text-sm text-muted">{finance.error.message}</p>
          <Button variant="secondary" onClick={handleRetry}>
            ลองใหม่
          </Button>
        </Card>
      </>
    );
  }

  const data = finance.data;
  if (!data || data.pots.length === 0 || data.sources.length === 0) {
    return (
      <>
        <header className="flex items-start justify-between gap-3">
          <h1 className="text-title font-semibold text-text">ภาพรวม</h1>
        </header>
        <Card className="mt-4 flex flex-col items-center pb-6">
          <EmptyState message="ยังไม่มีข้อมูลบัญชีหรือก้อนเงิน เริ่มต้นได้ในหน้าตั้งค่า" />
          <Button variant="primary" onClick={() => navigate('/settings')}>
            ไปตั้งค่า
          </Button>
        </Card>
      </>
    );
  }

  let derived: DerivedOverview | null = null;
  let domainError: Error | null = null;
  try {
    derived = deriveOverview(data, today);
  } catch (err) {
    domainError = err instanceof Error ? err : new Error(String(err));
  }

  if (domainError || !derived) {
    return (
      <>
        <header className="flex items-start justify-between gap-3">
          <h1 className="text-title font-semibold text-text">ภาพรวม</h1>
        </header>
        <Card className="mt-4 flex flex-col items-start gap-3" role="alert">
          <p className="text-base font-medium text-negative">คำนวณภาพรวมไม่สำเร็จ</p>
          <p className="text-sm text-muted">{domainError?.message ?? 'เกิดข้อผิดพลาด'}</p>
          <Button variant="secondary" onClick={handleRetry}>
            ลองใหม่
          </Button>
        </Card>
      </>
    );
  }

  const {
    period,
    daysLeft,
    playPot,
    playStatus,
    perDayBaht,
    essentialPot,
    essentialStatus,
    periodBills,
    manualPlaySpent,
    owedSatang,
    outflows,
    visibleOutflows,
    upcomingCountedTotal,
    recentTransactions,
    sourceById,
    chargeMonths,
  } = derived;

  const activeSources = data.sources.filter((s) => !s.archived);

  const barParts: Segment[] = [
    ...periodBills.map<Segment>((b) => ({
      id: b.source.id,
      label: b.source.name,
      amount: Math.max(0, toBaht(b.amount)),
      hue: b.source.hue,
      state: b.paid ? 'paid' : 'reserved',
    })),
    {
      id: 'used',
      label: 'ใช้เล่นไปแล้ว',
      amount: Math.max(0, toBaht(manualPlaySpent)),
      hue: 'stone',
    },
  ];

  const clearExitingBill = (billKey: string) => {
    const existingTimer = exitTimersRef.current.get(billKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
      exitTimersRef.current.delete(billKey);
    }
    setExitingBills((prev) => {
      if (!prev.has(billKey)) return prev;
      const next = new Map(prev);
      next.delete(billKey);
      return next;
    });
  };

  const handlePayBill = (row: Outflow, rowIndex: number) => {
    const billKey = getOutflowBillKey(row);
    if (payingKeysRef.current.has(billKey)) return;
    payingKeysRef.current.add(billKey);
    owedRef.current?.focus({ preventScroll: true });
    setPayingKeys((prev) => new Set(prev).add(billKey));

    void payBill
      .mutateAsync({
        sourceId: row.sourceId,
        statementKey: row.statementKey ?? period.key,
        amount: row.amount,
        paidOn: today,
      })
      .then((payment) => {
        // Hold a snapshot of the paid bill row for ROW_EXIT_MS so it animates out instead of vanishing on refetch.
        setExitingBills((prev) => new Map(prev).set(billKey, { row, index: rowIndex }));
        const existingTimer = exitTimersRef.current.get(billKey);
        if (existingTimer) clearTimeout(existingTimer);
        const timer = setTimeout(() => {
          exitTimersRef.current.delete(billKey);
          setExitingBills((prev) => {
            if (!prev.has(billKey)) return prev;
            const next = new Map(prev);
            next.delete(billKey);
            return next;
          });
        }, ROW_EXIT_MS);
        exitTimersRef.current.set(billKey, timer);

        let undone = false;
        notify(`จ่าย${row.title}แล้ว`, {
          undo: () => {
            if (undone) return;
            undone = true;
            clearExitingBill(billKey);
            payingKeysRef.current.delete(billKey);
            setPayingKeys((prev) => {
              const next = new Set(prev);
              next.delete(billKey);
              return next;
            });
            void deleteBillPayment.mutateAsync(payment.id).catch((err) => {
              notify(`เลิกทำไม่สำเร็จ${formatErrorSuffix(err)}`);
            });
          },
        });
      })
      .catch((err) => {
        payingKeysRef.current.delete(billKey);
        setPayingKeys((prev) => {
          const next = new Set(prev);
          next.delete(billKey);
          return next;
        });
        notify(`บันทึกการจ่ายบิลไม่สำเร็จ${formatErrorSuffix(err)}`);
      });
  };

  const handleCreateTransaction = async (input: CreateTransactionInput) => {
    try {
      const created = await createTransaction.mutateAsync(input);
      setAddedTxIds((prev) => new Set(prev).add(created.id));
      setSheetOpen(false);
      let undone = false;
      notify('บันทึกแล้ว', {
        undo: () => {
          if (undone) return;
          undone = true;
          setAddedTxIds((prev) => {
            if (!prev.has(created.id)) return prev;
            const next = new Set(prev);
            next.delete(created.id);
            return next;
          });
          void deleteTransaction.mutateAsync(created.id).catch((err) => {
            notify(`เลิกทำไม่สำเร็จ${formatErrorSuffix(err)}`);
          });
        },
      });
    } catch (err) {
      notify(`บันทึกไม่สำเร็จ${formatErrorSuffix(err)}`);
      throw err;
    }
  };

  const upcomingRows = visibleOutflows.map((row) => ({
    row,
    rowKey: getOutflowRowKey(row),
    leaving: row.kind === 'bill' && exitingBills.has(getOutflowBillKey(row)),
  }));
  const visibleBillKeys = new Set(visibleOutflows.filter((r) => r.kind === 'bill').map(getOutflowBillKey));
  for (const [billKey, entry] of exitingBills.entries()) {
    if (visibleBillKeys.has(billKey)) continue;
    upcomingRows.splice(Math.min(entry.index, upcomingRows.length), 0, {
      row: entry.row,
      rowKey: getOutflowRowKey(entry.row),
      leaving: true,
    });
  }

  return (
    <>
      <div
        data-testid="overview-layout"
        className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-6"
      >
        {/* Left column on desktop; display:contents on smaller screens so sections interleave in mobile order. */}
        <div data-testid="overview-left" className="contents lg:flex lg:flex-col lg:gap-5">
          <header className="order-1 flex items-start justify-between gap-3">
            <div>
              <h1 className="text-title font-semibold text-text">ภาพรวม</h1>
              <p className="mt-0.5 text-sm text-muted">
                {`รอบ ${formatThaiShortDate(period.start)} – ${formatThaiShortDate(period.end)} · อีก ${daysLeft} วัน`}
              </p>
            </div>
            {/* !-prefixed so the accent fill beats IconButton's own text-text / hover:bg-stone-bg.
                Hidden on desktop where SideNav owns the single primary "+ เพิ่มรายการ" button. */}
            <IconButton
              label="เพิ่มรายการ"
              icon={<Plus size={22} strokeWidth={1.6} aria-hidden="true" />}
              onClick={() => setSheetOpen(true)}
              className="!bg-accent !text-on-accent hover-fine:hover:opacity-90 lg:hidden"
            />
          </header>

          <IncomeDueCard data={data} today={today} />
          <AvailableCard data={data} today={today} />

          <div
            data-testid="pots-grid"
            className={`contents md:order-2 md:grid ${essentialPot ? 'md:grid-cols-2' : 'md:grid-cols-1'} md:gap-3.5`}
          >
            {/* Mobile wraps play-pot summary + allocation bar in one Card; md+ splits them around essentialPot. */}
            <div className="order-2 rounded-card border border-border bg-surface p-card md:contents">
              <div className="md:order-1 md:flex md:flex-col md:justify-between md:rounded-card md:border md:border-border md:bg-surface md:p-card">
                <div>
                  <p className="text-sm text-muted">เหลือใช้เล่น</p>
                  <div data-testid="play-left" className="mt-0.5">
                    <AnimatedMoney value={toBaht(playStatus.left)} size="xl" />
                  </div>
                </div>
                {playStatus.over ? (
                  <p className="mt-1 text-sm font-medium text-negative">
                    เกินงบ <Money value={toBaht(Math.abs(playStatus.left))} size="sm" tone="inherit" />
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-muted">
                    หลังกันเงินจ่ายบิลที่รู้แล้ว · เฉลี่ย <Money value={perDayBaht} size="sm" /> ต่อวัน
                  </p>
                )}
              </div>

              <div className="mt-3.5 md:order-3 md:col-span-2 md:mt-0 md:rounded-card md:border md:border-border md:bg-surface md:p-card">
                <AllocationBar total={Math.max(0, toBaht(playStatus.budget))} parts={barParts} />

                <div className="mt-3 grid grid-cols-2 gap-2.5">
                  {periodBills.map((b) => (
                    <Tile
                      key={`${b.source.id}-${b.statementKey}`}
                      hue={b.source.hue}
                      label={`${b.source.name} · ${b.paid ? 'จ่ายแล้ว' : formatThaiShortDate(b.dueDate, b.dueBy)}`}
                      value={toBaht(b.amount)}
                    />
                  ))}
                  <Tile hue="stone" label="ใช้เล่นไปแล้ว" value={toBaht(manualPlaySpent)} />
                  <Tile
                    hue={playPot.hue}
                    label={formatPotTileLabel(playPot.perPeriod, playStatus.carryIn)}
                    value={toBaht(playStatus.budget)}
                  />
                </div>

                <div
                  ref={owedRef}
                  tabIndex={-1}
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                  className="mt-2 flex min-h-tap items-center justify-between gap-3 rounded-tile focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
                >
                  <span className="text-sm text-muted">ยังต้องจ่ายอีก</span>
                  <div data-testid="owed">
                    <AnimatedMoney value={toBaht(owedSatang)} size="md" live={false} />
                  </div>
                </div>
              </div>
            </div>

            {essentialPot && essentialStatus ? (
              <section
                className="order-4 md:order-2 md:flex md:flex-col md:justify-between md:rounded-card md:border md:border-border md:bg-surface md:p-card"
                aria-label={essentialPot.name}
                data-testid="essential-pot"
              >
                <h2 className="flex min-h-tap items-center text-section font-semibold text-text md:min-h-0">
                  {essentialPot.name}
                </h2>
                <Card className="mt-1 md:mt-3 md:rounded-none md:border-0 md:bg-transparent md:p-0">
                  <div className="grid grid-cols-3 gap-2 md:flex md:flex-col md:gap-1.5">
                    <div className="md:flex md:items-baseline md:justify-between md:gap-2">
                      <p className="text-xs text-muted md:text-sm">ใช้ไป</p>
                      <p className="mt-0.5 md:mt-0">
                        <AnimatedMoney value={toBaht(essentialStatus.spent + essentialStatus.reserved)} size="md" />
                      </p>
                    </div>
                    <div className="text-center md:flex md:items-baseline md:justify-between md:gap-2 md:text-left">
                      <p className="text-xs text-muted md:text-sm">งบ</p>
                      <p className="mt-0.5 md:mt-0">
                        <AnimatedMoney value={toBaht(essentialStatus.budget)} size="md" />
                      </p>
                    </div>
                    <div className="text-right md:flex md:items-baseline md:justify-between md:gap-2">
                      <p className="text-xs text-muted md:text-sm">เหลือ</p>
                      <p className="mt-0.5 md:mt-0">
                        <AnimatedMoney value={toBaht(essentialStatus.left)} size="md" />
                      </p>
                    </div>
                  </div>
                </Card>
              </section>
            ) : null}
          </div>
        </div>

        <div data-testid="overview-right" className="order-3 flex flex-col gap-5 lg:order-none">
          <section>
            <SectionHeader
              title="เงินออก 30 วันข้างหน้า"
              actionLabel="ดูทั้งหมด"
              onAction={() => navigate('/bills')}
            />
            <Card data-testid="upcoming" padding="none" className="mt-1 px-card py-1">
              {upcomingRows.length === 0 ? (
                <EmptyState message="ไม่มีเงินออกใน 30 วันข้างหน้า" />
              ) : (
                <>
                  {upcomingRows.map(({ row, rowKey, leaving }, index) => {
                    const parsed = parseISODate(row.date);
                    const src = sourceById.get(row.sourceId);

                    if (row.kind === 'bill') {
                      const billKey = getOutflowBillKey(row);
                      const isPaying = payingKeys.has(billKey);
                      const noteId = `pay-${billKey}-note`;
                      const payFrom = src?.payFromSourceId ? sourceById.get(src.payFromSourceId) : undefined;
                      const detail = payFrom ? `จาก${payFrom.name}` : src ? <Pill hue={src.hue}>{src.name}</Pill> : undefined;

                      return (
                        <AnimatedRow
                          key={rowKey}
                          leaving={leaving}
                          className={leaving ? 'pointer-events-none' : undefined}
                        >
                          <div>
                            <ListRow
                              leading={<DateBadge day={parsed.day} month={parsed.month0} dueBy={row.dueBy} />}
                              title={row.title}
                              detail={detail}
                              amount={toBaht(row.amount)}
                              strong
                            />
                          </div>
                          <div className="flex min-h-tap items-center pb-2 pl-14">
                            <Button
                              variant="secondary"
                              loading={isPaying}
                              disabled={isPaying || leaving}
                              onClick={() => handlePayBill(row, index)}
                              aria-describedby={noteId}
                            >
                              จ่ายแล้ว
                            </Button>
                            <span id={noteId} className="sr-only">
                              {row.title} ครบกำหนด {formatThaiShortDate(row.date, row.dueBy)}
                            </span>
                          </div>
                        </AnimatedRow>
                      );
                    }

                    const billMonth = chargeMonths.get(row);
                    return (
                      <div key={rowKey}>
                        <ListRow
                          leading={<DateBadge day={parsed.day} month={parsed.month0} dueBy={row.dueBy} />}
                          title={row.title}
                          detail={
                            <span className="inline-flex items-center gap-1.5">
                              {src ? <Pill hue={src.hue}>{src.name}</Pill> : null}
                              {billMonth ? <span>{`เข้าบิล ${billMonth}`}</span> : null}
                            </span>
                          }
                          amount={toBaht(row.amount)}
                        />
                      </div>
                    );
                  })}

                  {outflows.length > 0 ? (
                    <div className="flex min-h-tap items-center justify-between gap-3 border-t border-rule py-2 text-sm">
                      <span className="text-muted">รวมเงินออก (ไม่นับเข้าบิล)</span>
                      <span data-testid="upcoming-total">
                        <AnimatedMoney value={toBaht(upcomingCountedTotal)} size="md" />
                      </span>
                    </div>
                  ) : null}
                </>
              )}
            </Card>
          </section>

          {/* Desktop-only panel (SPEC §4); kept hidden below lg so mobile 375px matches Phase 1. */}
          <section data-testid="recent-transactions" className="hidden lg:block">
            <SectionHeader
              title="รายการล่าสุด"
              actionLabel="ดูทั้งหมด"
              onAction={() => navigate('/entries')}
            />
            <Card padding="none" className="mt-1 px-card py-1">
              {recentTransactions.length === 0 ? (
                <EmptyState message="ยังไม่มีรายการในรอบนี้" />
              ) : (
                recentTransactions.map((tx) => {
                  const parsed = parseISODate(tx.date);
                  const src = sourceById.get(tx.sourceId);
                  const title = tx.note.trim() ? tx.note : CATEGORY_LABEL[tx.category];
                  const detail = (
                    <span className="inline-flex items-center gap-1.5">
                      {src ? <Pill hue={src.hue}>{src.name}</Pill> : null}
                      {tx.note.trim() ? <span>{CATEGORY_LABEL[tx.category]}</span> : null}
                    </span>
                  );
                  return (
                    <AnimatedRow key={tx.id} entering={addedTxIds.has(tx.id)}>
                      <ListRow
                        leading={<DateBadge day={parsed.day} month={parsed.month0} />}
                        title={title}
                        detail={detail}
                        amount={toBaht(tx.amount)}
                        amountKind={tx.direction === 'in' ? 'income' : 'spend'}
                      />
                    </AnimatedRow>
                  );
                })
              )}
            </Card>
          </section>
        </div>
      </div>

      <QuickAddSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        today={today}
        sources={activeSources}
        pots={data.pots}
        defaultPotId={playPot.id}
        onSubmit={handleCreateTransaction}
      />
    </>
  );
}
