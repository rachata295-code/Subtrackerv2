import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AnimatedMoney } from '../../components/ui/AnimatedMoney';
import { AnimatedRow, ROW_EXIT_MS } from '../../components/ui/AnimatedRow';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DateBadge } from '../../components/ui/DateBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { ListRow } from '../../components/ui/ListRow';
import { Money } from '../../components/ui/Money';
import { Pill } from '../../components/ui/Pill';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { SelectField } from '../../components/ui/SelectField';
import { Skeleton } from '../../components/ui/Skeleton';
import { SwipeToDelete } from '../../components/ui/SwipeToDelete';
import { notify } from '../../components/ui/Toaster';
import { expectedBalance, forecast, payPeriod, upcomingOutflows } from '../../domain';
import { parseISODate } from '../../domain/date';
import {
  useCompletePlanItem,
  useDeletePlanItem,
  useFinanceData,
  useUncompletePlanItem,
  useUpsertPlanItem,
} from '../../hooks/useFinance';
import { formatTHB } from '../../lib/money';
import {
  CATEGORY_LABELS,
  type Forecast,
  type ISODate,
  type PlanItem,
  type Satang,
  type UpsertPlanItemInput,
} from '../../types/finance';
import { BalanceCheckSheet } from './BalanceCheckSheet';
import { PlanItemSheet } from './PlanItemSheet';
import {
  addDays,
  balanceCheckDiffText,
  bangkokToday,
  daysSinceBalanceCheckLabel,
  formatThaiShortDate,
  getErrorMessage,
  isNotImplementedError,
  latestBalanceCheckForSource,
  pickDefaultBankSource,
  shiftDueDateToPeriod,
  sortBalanceChecksDesc,
} from './planUtils';

export interface PlanPageProps {
  /** Injectable Asia/Bangkok YYYY-MM-DD date for deterministic tests. */
  today?: ISODate;
}

interface LeavingPlan {
  item: PlanItem;
  index: number;
}

export default function PlanPage({ today: todayProp }: PlanPageProps = {}) {
  const today = todayProp ?? bangkokToday();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useFinanceData();
  const upsertPlanItem = useUpsertPlanItem();
  const deletePlanItem = useDeletePlanItem();
  const completePlanItem = useCompletePlanItem();
  const uncompletePlanItem = useUncompletePlanItem();

  const [selectedBankId, setSelectedBankId] = useState<string>('');
  const [checkSheetOpen, setCheckSheetOpen] = useState(false);
  const [planSheetOpen, setPlanSheetOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlanItem | null>(null);
  const [busyPlanIds, setBusyPlanIds] = useState<Set<string>>(() => new Set());
  const [recentPlanIds, setRecentPlanIds] = useState<Set<string>>(() => new Set());
  const [leavingPlans, setLeavingPlans] = useState<LeavingPlan[]>([]);
  const [copyingPrev, setCopyingPrev] = useState(false);

  const exitTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  useEffect(() => {
    const timers = exitTimersRef.current;
    return () => {
      for (const t of timers) clearTimeout(t);
      timers.clear();
    };
  }, []);

  if (isLoading) {
    return (
      <>
        <h1 className="text-title font-semibold text-text">แผน</h1>
        <div className="mt-4 space-y-3.5" role="status" aria-label="กำลังโหลด">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-44 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <h1 className="text-title font-semibold text-text">แผน</h1>
        <Card className="mt-4 flex flex-col items-start gap-3" role="alert">
          <p className="text-base font-medium text-negative">ไม่สามารถโหลดข้อมูลแผนได้</p>
          <p className="text-sm text-muted">{error.message}</p>
          {refetch ? (
            <Button variant="secondary" onClick={() => refetch()}>
              ลองใหม่
            </Button>
          ) : null}
        </Card>
      </>
    );
  }

  const bankSources = (data?.sources ?? []).filter((s) => s.kind === 'bank' && !s.archived);
  if (!data || bankSources.length === 0) {
    return (
      <>
        <h1 className="text-title font-semibold text-text">แผน</h1>
        <Card className="mt-4 flex flex-col items-center pb-6">
          <EmptyState message="ยังไม่มีบัญชีธนาคาร เริ่มเพิ่มได้ในหน้าตั้งค่า" />
          <Button variant="primary" onClick={() => navigate('/settings')}>
            ไปตั้งค่า
          </Button>
        </Card>
      </>
    );
  }

  const defaultBank = pickDefaultBankSource(data) ?? bankSources[0];
  const activeBank = bankSources.find((b) => b.id === selectedBankId) ?? defaultBank;

  const period = payPeriod(today, data.settings.payDay);
  const prevPeriod = payPeriod(addDays(period.start, -1), data.settings.payDay);

  let expected: Satang | null = null;
  let expectedStubbed = false;
  try {
    expected = expectedBalance(activeBank.id, data);
  } catch (err) {
    if (isNotImplementedError(err)) {
      expectedStubbed = true;
    } else {
      throw err;
    }
  }

  let fc: Forecast | null = null;
  let forecastStubbed = false;
  try {
    fc = forecast(data, activeBank.id, today);
  } catch (err) {
    if (isNotImplementedError(err)) {
      forecastStubbed = true;
    } else {
      throw err;
    }
  }

  const latestCheck = latestBalanceCheckForSource(data.balanceChecks, activeBank.id);
  const checkHistory = sortBalanceChecksDesc(
    data.balanceChecks.filter((c) => c.sourceId === activeBank.id),
  );
  const checkAgeLabel = daysSinceBalanceCheckLabel(latestCheck?.checkedOn ?? null, today);

  const sourceById = new Map(data.sources.map((s) => [s.id, s]));

  // Automatic unpaid card/paylater bills due within the current pay period for this bank.
  const autoBills = upcomingOutflows(data, today, 40).filter((o) => {
    if (o.kind !== 'bill' || !o.counted) return false;
    if (payPeriod(addDays(o.date, -1), data.settings.payDay).key !== period.key) return false;
    const src = sourceById.get(o.sourceId);
    const payFrom = src?.payFromSourceId ?? defaultBank.id;
    return payFrom === activeBank.id;
  });

  const currentPlans = data.planItems
    .filter((p) => p.periodKey === period.key && p.sourceId === activeBank.id)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const prevPlans = data.planItems
    .filter((p) => p.periodKey === prevPeriod.key && p.sourceId === activeBank.id)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  // Merge leaving rows so delete animations play cleanly before unmount.
  const leavingIds = new Set(leavingPlans.map((e) => e.item.id));
  const planRows: { item: PlanItem; leaving: boolean }[] = currentPlans.map((item) => ({
    item,
    leaving: leavingIds.has(item.id),
  }));
  const presentIds = new Set(currentPlans.map((p) => p.id));
  for (const entry of [...leavingPlans].sort((a, b) => a.index - b.index)) {
    if (!presentIds.has(entry.item.id)) {
      planRows.splice(Math.min(entry.index, planRows.length), 0, { item: entry.item, leaving: true });
    }
  }

  const setPlanBusy = (id: string, busy: boolean) => {
    setBusyPlanIds((prev) => {
      const next = new Set(prev);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleSavePlan = async (input: UpsertPlanItemInput) => {
    try {
      const saved = await upsertPlanItem.mutateAsync(input);
      if (!input.id) {
        setRecentPlanIds((prev) => new Set(prev).add(saved.id));
      }
      setPlanSheetOpen(false);
      notify('บันทึกแผนแล้ว');
    } catch (err) {
      toast.error(getErrorMessage(err, 'บันทึกแผนไม่สำเร็จ'));
    }
  };

  const handleDeletePlan = async (planId: string, toastMessage?: string): Promise<boolean> => {
    const idx = currentPlans.findIndex((p) => p.id === planId);
    const target = idx >= 0 ? currentPlans[idx] : undefined;
    const snapshot: UpsertPlanItemInput | null = target
      ? {
          periodKey: target.periodKey,
          name: target.name,
          amount: target.amount,
          kind: target.kind,
          sourceId: target.sourceId,
          dueOn: target.dueOn,
          category: target.category,
          doneTxId: target.doneTxId,
          sortOrder: target.sortOrder,
        }
      : null;
    try {
      await deletePlanItem.mutateAsync(planId);
      if (target) {
        setLeavingPlans((prev) => [...prev.filter((e) => e.item.id !== planId), { item: target, index: idx }]);
        const timer = setTimeout(() => {
          exitTimersRef.current.delete(timer);
          setLeavingPlans((prev) => prev.filter((e) => e.item.id !== planId));
        }, ROW_EXIT_MS);
        exitTimersRef.current.add(timer);
      }
      setPlanSheetOpen(false);
      let undone = false;
      notify(toastMessage ?? 'ลบรายการแผนแล้ว', {
        undo: snapshot
          ? () => {
              if (undone) return;
              undone = true;
              void upsertPlanItem
                .mutateAsync(snapshot)
                .then((restored) => {
                  setRecentPlanIds((prev) => new Set(prev).add(restored.id));
                })
                .catch((err) => {
                  toast.error(getErrorMessage(err, 'เลิกทำไม่สำเร็จ'));
                });
            }
          : undefined,
      });
      return true;
    } catch (err) {
      toast.error(getErrorMessage(err, 'ลบรายการแผนไม่สำเร็จ'));
      return false;
    }
  };

  const handleCompletePlan = async (item: PlanItem) => {
    if (busyPlanIds.has(item.id)) return;
    setPlanBusy(item.id, true);
    try {
      await completePlanItem.mutateAsync(item.id);
      notify('บันทึกแล้ว');
    } catch (err) {
      toast.error(getErrorMessage(err, 'บันทึกไม่สำเร็จ'));
    } finally {
      setPlanBusy(item.id, false);
    }
  };

  const handleUncompletePlan = async (item: PlanItem) => {
    if (busyPlanIds.has(item.id)) return;
    setPlanBusy(item.id, true);
    try {
      await uncompletePlanItem.mutateAsync(item.id);
      notify('ยกเลิกแล้ว');
    } catch (err) {
      toast.error(getErrorMessage(err, 'ยกเลิกไม่สำเร็จ'));
    } finally {
      setPlanBusy(item.id, false);
    }
  };

  const handleCopyPrevious = async () => {
    if (copyingPrev || prevPlans.length === 0) return;
    setCopyingPrev(true);
    try {
      const createdIds: string[] = [];
      for (const prevItem of prevPlans) {
        const saved = await upsertPlanItem.mutateAsync({
          periodKey: period.key,
          name: prevItem.name,
          amount: prevItem.amount,
          kind: prevItem.kind,
          sourceId: prevItem.sourceId,
          dueOn: shiftDueDateToPeriod(prevItem.dueOn, period.start, period.end),
          category: prevItem.category,
          doneTxId: null,
          sortOrder: prevItem.sortOrder,
        });
        createdIds.push(saved.id);
      }
      setRecentPlanIds((prev) => {
        const next = new Set(prev);
        for (const id of createdIds) next.add(id);
        return next;
      });
      notify('คัดลอกแผนรอบก่อนแล้ว');
    } catch (err) {
      toast.error(getErrorMessage(err, 'คัดลอกแผนรอบก่อนไม่สำเร็จ'));
    } finally {
      setCopyingPrev(false);
    }
  };

  return (
    <>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-title font-semibold text-text">แผน</h1>
          <p className="mt-0.5 text-sm text-muted">
            {`รอบ ${formatThaiShortDate(period.start)} – ${formatThaiShortDate(period.end)}`}
          </p>
        </div>

        {bankSources.length > 1 ? (
          bankSources.length <= 4 ? (
            <SegmentedControl
              label="เลือกบัญชี"
              options={bankSources.map((b) => ({ value: b.id, label: b.name }))}
              value={activeBank.id}
              onChange={setSelectedBankId}
            />
          ) : (
            <SelectField
              label="เลือกบัญชี"
              options={bankSources.map((b) => ({ value: b.id, label: b.name }))}
              value={activeBank.id}
              onChange={(e) => setSelectedBankId(e.target.value)}
            />
          )
        ) : null}
      </header>

      <div
        data-testid="plan-layout"
        className="mt-4 flex flex-col gap-5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6"
      >
        {/* Left column on desktop: Account card + C5 Available card + Check history */}
        <div data-testid="plan-left" className="contents lg:flex lg:flex-col lg:gap-5">
          {/* 1. Account Card */}
          <Card data-testid="account-balance-card" className="order-1">
            {expectedStubbed ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-text">{activeBank.name}</p>
                <p className="text-sm text-muted">รอเชื่อมต่อฟังก์ชันคำนวณยอดบัญชี</p>
              </div>
            ) : expected === null ? (
              <div className="flex flex-col gap-3">
                <div>
                  <p className="text-sm text-muted">{activeBank.name}</p>
                  <p className="mt-1 text-base font-medium text-text">ยังไม่มีจุดอ้างอิงยอดบัญชี</p>
                  <p className="mt-0.5 text-xs text-muted">
                    ตั้งยอดเงินจริงในบัญชีวันนี้เพื่อให้แอปช่วยนับยอดและจับรายการลืมจด
                  </p>
                </div>
                <Button variant="primary" size="lg" onClick={() => setCheckSheetOpen(true)}>
                  ตั้งยอดเริ่มต้น
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-muted">ในแอปควรเหลือ</p>
                    <div className="mt-0.5">
                      <AnimatedMoney value={expected / 100} size="md" />
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {`${activeBank.name} · เช็กล่าสุด${checkAgeLabel === 'เช็กยอดวันนี้' ? 'วันนี้' : ` ${checkAgeLabel.replace('เช็กยอด ', '')}`}`}
                    </p>
                  </div>
                  <Button variant="primary" onClick={() => setCheckSheetOpen(true)}>
                    เช็กกับยอดจริง
                  </Button>
                </div>
                <p className="text-xs text-muted">
                  ยอดควรเหลือถูกต้องเท่าที่จดเงินเข้า-ออกครบ
                </p>
              </div>
            )}
          </Card>

          {/* 2. "ใช้ได้จริง" Card (C5 formula) */}
          <Card data-testid="forecast-card" className="order-2">
            {forecastStubbed || !fc ? (
              <div className="space-y-1">
                <h2 className="text-section font-semibold text-text">ใช้ได้จริง</h2>
                <p className="text-sm text-muted">รอเชื่อมต่อฟังก์ชันคาดการณ์ (forecast)</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-muted">ใช้ได้จริง</p>
                  <div className="mt-0.5">
                    <AnimatedMoney value={fc.available / 100} size="xl" />
                  </div>
                  {fc.available < 0 ? (
                    <p className="mt-1 text-sm font-medium text-negative">
                      แผนเกินเงินที่มี <Money value={Math.abs(fc.available) / 100} size="sm" tone="inherit" />
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-muted">หลังหักบิลและแผนที่ยังไม่ทำ ใช้ได้ถึงสิ้นรอบ</p>
                  )}
                </div>

                <dl className="space-y-2 border-t border-rule pt-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted">เงินในบัญชีตอนนี้ (ควรเหลือ)</dt>
                    <dd className="shrink-0">
                      <Money value={fc.start / 100} size="sm" />
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted">เงินประจำที่จะเข้า</dt>
                    <dd className="shrink-0">
                      <Money value={fc.incoming / 100} size="sm" kind="income" />
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted">บิลที่ยังไม่จ่าย</dt>
                    <dd className="shrink-0 tabular-nums text-text">{`−${formatTHB(fc.bills / 100)}`}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted">แผนที่ยังไม่ทำ</dt>
                    <dd className="shrink-0 tabular-nums text-text">{`−${formatTHB(fc.plans / 100)}`}</dd>
                  </div>
                </dl>
              </div>
            )}
          </Card>

          {/* 5. Balance Check History (last on mobile, bottom-left on desktop) */}
          <section data-testid="balance-check-history" className="order-5">
            <SectionHeader title="ประวัติเช็กยอด" />
            <Card padding="none" className="mt-1 px-card py-1">
              {checkHistory.length === 0 ? (
                <EmptyState message="ยังไม่มีประวัติเช็กยอด" />
              ) : (
                checkHistory.map((chk) => {
                  const parsed = parseISODate(chk.checkedOn);
                  return (
                    <ListRow
                      key={chk.id}
                      leading={<DateBadge day={parsed.day} month={parsed.month - 1} />}
                      title={balanceCheckDiffText(chk)}
                      detail={activeBank.name}
                      amount={chk.actual / 100}
                    />
                  );
                })
              )}
            </Card>
          </section>
        </div>

        {/* Right column on desktop: Plan this period + Timeline */}
        <div data-testid="plan-right" className="contents lg:flex lg:flex-col lg:gap-5">
          {/* 4. แผนรอบนี้ (mobile order-4, desktop right top) */}
          <section data-testid="plan-items-section" className="order-4 lg:order-none">
            <SectionHeader
              title="แผนรอบนี้"
              actionLabel="เพิ่มแผน"
              onAction={() => {
                setEditingPlan(null);
                setPlanSheetOpen(true);
              }}
            />
            <Card padding="none" className="mt-1 px-card py-1">
              {planRows.length === 0 && autoBills.length === 0 ? (
                <EmptyState message="ยังไม่มีรายการแผนในรอบนี้" />
              ) : (
                <>
                  {planRows.map(({ item, leaving }) => {
                    const isDone = Boolean(item.doneTxId);
                    const isBusy = busyPlanIds.has(item.id);
                    const parsedDue = item.dueOn ? parseISODate(item.dueOn) : null;
                    const kindLabel = item.kind === 'save' ? 'เก็บ' : 'จ่าย';

                    return (
                      <AnimatedRow
                        key={item.id}
                        entering={!leaving && recentPlanIds.has(item.id)}
                        leaving={leaving}
                        className={[
                          'border-b border-rule last:border-b-0',
                          leaving ? 'pointer-events-none' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        <SwipeToDelete
                          label={item.name}
                          disabled={leaving || isBusy}
                          onDelete={() => handleDeletePlan(item.id, `ลบ${item.name}แล้ว`)}
                        >
                          <ListRow
                            leading={
                              parsedDue ? (
                                <DateBadge day={parsedDue.day} month={parsedDue.month - 1} />
                              ) : (
                                <span
                                  aria-hidden="true"
                                  className={`block h-2.5 w-2.5 rounded-dot ${item.kind === 'save' ? 'bg-teal-mark' : 'bg-stone-mark'}`}
                                />
                              )
                            }
                            title={item.name}
                            detail={
                              <span className="inline-flex flex-wrap items-center gap-1.5">
                                <Pill hue={item.kind === 'save' ? 'teal' : 'stone'}>{kindLabel}</Pill>
                                {item.kind === 'pay' ? <span>{CATEGORY_LABELS[item.category]}</span> : null}
                                {isDone ? <span className="text-positive">ทำแล้ว</span> : null}
                              </span>
                            }
                            amount={item.amount / 100}
                            onClick={() => {
                              setEditingPlan(item);
                              setPlanSheetOpen(true);
                            }}
                          />
                          <div className="flex min-h-tap items-center justify-end gap-2 pb-2">
                            {isDone ? (
                              <Button
                                variant="ghost"
                                loading={isBusy}
                                disabled={isBusy}
                                onClick={() => void handleUncompletePlan(item)}
                              >
                                ยกเลิก
                              </Button>
                            ) : (
                              <Button
                                variant="secondary"
                                loading={isBusy}
                                disabled={isBusy}
                                onClick={() => void handleCompletePlan(item)}
                              >
                                {item.kind === 'save' ? 'เก็บแล้ว' : 'จ่ายแล้ว'}
                              </Button>
                            )}
                          </div>
                        </SwipeToDelete>
                      </AnimatedRow>
                    );
                  })}

                  {autoBills.map((bill) => {
                    const parsed = parseISODate(bill.date);
                    const src = sourceById.get(bill.sourceId);
                    return (
                      <ListRow
                        key={`auto-bill-${bill.sourceId}-${bill.statementKey ?? bill.date}`}
                        leading={<DateBadge day={parsed.day} month={parsed.month - 1} dueBy={bill.dueBy} />}
                        title={bill.title}
                        detail={
                          <span className="inline-flex items-center gap-1.5">
                            <Pill hue={src?.hue ?? 'sky'}>บิล</Pill>
                            <span>ไปจ่ายที่หน้าบิล</span>
                          </span>
                        }
                        amount={bill.amount / 100}
                        onClick={() => navigate('/bills')}
                      />
                    );
                  })}
                </>
              )}

              {prevPlans.length > 0 ? (
                <div className="border-t border-rule py-2">
                  <Button
                    variant="ghost"
                    className="w-full"
                    loading={copyingPrev}
                    disabled={copyingPrev}
                    onClick={() => void handleCopyPrevious()}
                  >
                    ใช้แผนรอบก่อน
                  </Button>
                </div>
              ) : null}
            </Card>
          </section>

          {/* 3. Timeline (mobile order-3 right below forecast card, desktop right column) */}
          <section data-testid="forecast-timeline" className="order-3 lg:order-none">
            <SectionHeader title="ไทม์ไลน์รอบนี้" />
            <Card className="mt-1 space-y-3">
              {forecastStubbed || !fc ? (
                <EmptyState message="รอเชื่อมต่อข้อมูลไทม์ไลน์" />
              ) : (
                <>
                  {fc.low ? (
                    <div
                      className={[
                        'rounded-tile px-3 py-2 text-sm font-medium',
                        fc.low.balance < 0
                          ? 'bg-apricot-bg text-apricot-ink'
                          : 'bg-stone-bg text-stone-ink',
                      ].join(' ')}
                    >
                      {fc.low.balance < 0 ? (
                        <span>
                          {`เงินไม่พอวันที่ ${formatThaiShortDate(fc.low.date)} (`}
                          <Money value={fc.low.balance / 100} size="sm" tone="inherit" />
                          {')'}
                        </span>
                      ) : (
                        <span>
                          {`จุดต่ำสุด `}
                          <Money value={fc.low.balance / 100} size="sm" tone="inherit" />
                          {` วันที่ ${formatThaiShortDate(fc.low.date)}`}
                        </span>
                      )}
                    </div>
                  ) : null}

                  {fc.timeline.length === 0 ? (
                    <EmptyState message="ไม่มีรายการที่มีวันกำหนดในรอบนี้" />
                  ) : (
                    <div>
                      {fc.timeline.map((ev, idx) => {
                        const parsed = parseISODate(ev.date);
                        return (
                          <ListRow
                            key={`${ev.date}-${ev.kind}-${ev.title}-${idx}`}
                            leading={<DateBadge day={parsed.day} month={parsed.month - 1} />}
                            title={ev.title}
                            detail={
                              <span className={ev.balance < 0 ? 'text-negative' : 'text-muted'}>
                                {`คงเหลือ ${formatTHB(ev.balance / 100)}`}
                              </span>
                            }
                            amount={ev.amount / 100}
                            amountKind={ev.direction === 'in' ? 'income' : 'spend'}
                          />
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </Card>
          </section>
        </div>
      </div>

      <BalanceCheckSheet
        open={checkSheetOpen}
        onOpenChange={setCheckSheetOpen}
        data={data}
        bank={activeBank}
        expected={expected}
        latestCheckedOn={latestCheck?.checkedOn ?? null}
        today={today}
      />

      <PlanItemSheet
        open={planSheetOpen}
        onOpenChange={setPlanSheetOpen}
        data={data}
        periodKey={period.key}
        defaultSourceId={activeBank.id}
        editing={editingPlan}
        isSubmitting={upsertPlanItem.isPending || deletePlanItem.isPending}
        onSave={handleSavePlan}
        onDelete={(id) => handleDeletePlan(id).then(() => undefined)}
      />
    </>
  );
}
