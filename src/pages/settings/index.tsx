import { useEffect, useRef, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import { toast } from 'sonner';
import { useOptionalAuth } from '../../auth';
import { ThemeSwitch } from '../../components/ThemeSwitch';
import { AnimatedRow, ROW_EXIT_MS } from '../../components/ui/AnimatedRow';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { CurrencyField } from '../../components/ui/CurrencyField';
import { EmptyState } from '../../components/ui/EmptyState';
import { ListRow } from '../../components/ui/ListRow';
import { Pill } from '../../components/ui/Pill';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { Skeleton } from '../../components/ui/Skeleton';
import { SelectField } from '../../components/ui/SelectField';
import { TextField } from '../../components/ui/TextField';
import { notify } from '../../components/ui/Toaster';
import { HUE_MARK } from '../../components/ui/hue';
import {
  useDeletePot,
  useDeleteRecurringIncome,
  useDeleteSource,
  useFinanceData,
  useUpdateSettings,
  useUpsertPot,
  useUpsertRecurringIncome,
  useUpsertSource,
} from '../../hooks/useFinance';
import type {
  ISODate,
  PaymentSource,
  PeriodKey,
  Pot,
  RecurringIncome,
  Settings,
  UpsertPotInput,
  UpsertRecurringIncomeInput,
  UpsertSourceInput,
} from '../../types/finance';
import { PotSheet } from './PotSheet';
import { RecurringIncomeSheet } from './RecurringIncomeSheet';
import { SourceSheet } from './SourceSheet';
import { todayBangkok } from '../entries/entriesUtils';
import { BUDGET_START_NONE, budgetStartOptions, formatSourceSummary, parseDayOfMonth } from './settingsUtils';

export interface SettingsPageProps {
  /** Optional signOut override for isolated tests; defaults to AuthProvider's signOut. */
  onSignOut?: () => void | Promise<void>;
  /** Override today (Asia/Bangkok YYYY-MM-DD) so the period picker is deterministic in tests. */
  today?: ISODate;
}

function SalaryForm({
  settings,
  today,
  isPending,
  onSave,
}: {
  settings: Settings;
  today: ISODate;
  isPending: boolean;
  onSave: (salarySatang: number, payDay: number, budgetStartPeriod: PeriodKey | null) => Promise<void>;
}) {
  const [salary, setSalary] = useState<number | null>(settings.salary / 100);
  const [payDayText, setPayDayText] = useState<string>(String(settings.payDay));
  const [budgetStart, setBudgetStart] = useState<string>(settings.budgetStartPeriod ?? BUDGET_START_NONE);
  const [salaryError, setSalaryError] = useState<string>();
  const [payDayError, setPayDayError] = useState<string>();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    let valid = true;

    if (salary === null || salary <= 0) {
      setSalaryError('กรอกเงินเดือนให้ถูกต้อง');
      valid = false;
    }

    const parsedPayDay = parseDayOfMonth(payDayText);
    if (parsedPayDay === null) {
      setPayDayError('กรุณาระบุวันที่ 1–31');
      valid = false;
    }

    if (!valid) return;
    await onSave(Math.round(salary! * 100), parsedPayDay!, budgetStart === BUDGET_START_NONE ? null : budgetStart);
  };

  return (
    <Card>
      <form noValidate className="flex flex-col gap-4" onSubmit={(e) => void handleSubmit(e)}>
        <CurrencyField
          label="เงินเดือน"
          value={salary}
          error={salaryError}
          onChange={(v) => {
            setSalary(v);
            setSalaryError(undefined);
          }}
        />
        <TextField
          label="วันเงินเดือนเข้า"
          inputMode="numeric"
          placeholder="1–31"
          value={payDayText}
          error={payDayError}
          onChange={(e) => {
            setPayDayText(e.target.value);
            setPayDayError(undefined);
          }}
        />
        <SelectField
          label="เริ่มนับก้อนเงินตั้งแต่รอบ"
          value={budgetStart}
          options={budgetStartOptions(today, settings.payDay, settings.budgetStartPeriod)}
          onChange={(e) => setBudgetStart(e.target.value)}
        />
        {/* Only primary button on the screen (SPEC / PLAN §5.1). */}
        <Button type="submit" variant="primary" size="lg" loading={isPending}>
          บันทึก
        </Button>
      </form>
    </Card>
  );
}

interface LeavingEntry<T> {
  item: T;
  index: number;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

/** Keeps deleted/archived rows in their original slot for ROW_EXIT_MS so the exit animation plays before unmounting. */
function mergeLeavingRows<T extends { id: string }>(
  current: T[],
  leaving: LeavingEntry<T>[],
): { item: T; leaving: boolean }[] {
  const leavingIds = new Set(leaving.map((entry) => entry.item.id));
  const result = current.map((item) => ({ item, leaving: leavingIds.has(item.id) }));
  const presentIds = new Set(current.map((item) => item.id));
  const missing = leaving.filter((entry) => !presentIds.has(entry.item.id)).sort((a, b) => a.index - b.index);
  for (const entry of missing) {
    const targetIdx = Math.min(entry.index, result.length);
    result.splice(targetIdx, 0, { item: entry.item, leaving: true });
  }
  return result;
}

export default function SettingsPage({ onSignOut, today: todayProp }: SettingsPageProps) {
  const today = todayProp ?? todayBangkok();
  const auth = useOptionalAuth();
  const { data, isLoading, error, refetch } = useFinanceData();
  const updateSettings = useUpdateSettings();
  const upsertSource = useUpsertSource();
  const deleteSource = useDeleteSource();
  const upsertPot = useUpsertPot();
  const deletePot = useDeletePot();
  const upsertRecurringIncome = useUpsertRecurringIncome();
  const deleteRecurringIncome = useDeleteRecurringIncome();

  const [sourceSheetOpen, setSourceSheetOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<PaymentSource | null>(null);
  const [potSheetOpen, setPotSheetOpen] = useState(false);
  const [editingPot, setEditingPot] = useState<Pot | null>(null);
  const [incomeSheetOpen, setIncomeSheetOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState<RecurringIncome | null>(null);

  // Track rows added/moved or removed after mount so initial paint never animates (SPEC §5).
  const [recentActiveSourceIds, setRecentActiveSourceIds] = useState<Set<string>>(() => new Set());
  const [recentArchivedSourceIds, setRecentArchivedSourceIds] = useState<Set<string>>(() => new Set());
  const [recentPotIds, setRecentPotIds] = useState<Set<string>>(() => new Set());
  const [recentIncomeIds, setRecentIncomeIds] = useState<Set<string>>(() => new Set());
  const [leavingActiveSources, setLeavingActiveSources] = useState<LeavingEntry<PaymentSource>[]>([]);
  const [leavingArchivedSources, setLeavingArchivedSources] = useState<LeavingEntry<PaymentSource>[]>([]);
  const [leavingPots, setLeavingPots] = useState<LeavingEntry<Pot>[]>([]);
  const [leavingIncomes, setLeavingIncomes] = useState<LeavingEntry<RecurringIncome>[]>([]);

  const exitTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  useEffect(() => {
    const timers = exitTimersRef.current;
    return () => {
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
    };
  }, []);

  const scheduleRowExit = <T extends { id: string }>(
    item: T,
    index: number,
    setLeaving: Dispatch<SetStateAction<LeavingEntry<T>[]>>,
  ) => {
    setLeaving((prev) => [...prev.filter((entry) => entry.item.id !== item.id), { item, index: Math.max(0, index) }]);
    const timer = setTimeout(() => {
      exitTimersRef.current.delete(timer);
      setLeaving((prev) => prev.filter((entry) => entry.item.id !== item.id));
    }, ROW_EXIT_MS);
    exitTimersRef.current.add(timer);
  };

  const activeSources = (data?.sources ?? []).filter((s) => !s.archived);
  const archivedSources = (data?.sources ?? []).filter((s) => s.archived);

  const handleSaveSalary = async (salary: number, payDay: number, budgetStartPeriod: PeriodKey | null) => {
    try {
      await updateSettings.mutateAsync({ salary, payDay, budgetStartPeriod });
      notify('บันทึกการตั้งค่าแล้ว');
    } catch (err) {
      toast.error(getErrorMessage(err, 'บันทึกการตั้งค่าไม่สำเร็จ'));
    }
  };

  const handleSaveSource = async (input: UpsertSourceInput) => {
    try {
      const saved = await upsertSource.mutateAsync(input);
      if (!input.id) {
        setRecentActiveSourceIds((prev) => new Set(prev).add(saved.id));
      }
      setSourceSheetOpen(false);
      notify('บันทึกช่องทางจ่ายแล้ว');
    } catch (err) {
      toast.error(getErrorMessage(err, 'บันทึกช่องทางจ่ายไม่สำเร็จ'));
    }
  };

  const handleArchiveToggleSource = async (source: PaymentSource) => {
    const nextArchived = !source.archived;
    const list = source.archived ? archivedSources : activeSources;
    const index = list.findIndex((s) => s.id === source.id);
    try {
      const saved = await upsertSource.mutateAsync({ ...source, archived: nextArchived });
      if (nextArchived) {
        scheduleRowExit(source, index, setLeavingActiveSources);
        setRecentArchivedSourceIds((prev) => new Set(prev).add(saved.id));
      } else {
        scheduleRowExit(source, index, setLeavingArchivedSources);
        setRecentActiveSourceIds((prev) => new Set(prev).add(saved.id));
      }
      setSourceSheetOpen(false);
      notify(nextArchived ? 'เก็บถาวรช่องทางแล้ว' : 'นำช่องทางกลับมาใช้แล้ว');
    } catch (err) {
      toast.error(getErrorMessage(err, 'อัปเดตสถานะช่องทางจ่ายไม่สำเร็จ'));
    }
  };

  const handleDeleteSource = async (sourceId: string) => {
    const activeIdx = activeSources.findIndex((s) => s.id === sourceId);
    const archivedIdx = archivedSources.findIndex((s) => s.id === sourceId);
    const target = activeIdx >= 0 ? activeSources[activeIdx] : archivedIdx >= 0 ? archivedSources[archivedIdx] : undefined;
    try {
      await deleteSource.mutateAsync(sourceId);
      if (target) {
        if (activeIdx >= 0) {
          scheduleRowExit(target, activeIdx, setLeavingActiveSources);
        } else {
          scheduleRowExit(target, archivedIdx, setLeavingArchivedSources);
        }
      }
      setSourceSheetOpen(false);
      notify('ลบช่องทางแล้ว');
    } catch (err) {
      toast.error(getErrorMessage(err, 'ลบช่องทางจ่ายไม่สำเร็จ'));
    }
  };

  const handleSavePot = async (input: UpsertPotInput) => {
    try {
      const saved = await upsertPot.mutateAsync(input);
      if (!input.id) {
        setRecentPotIds((prev) => new Set(prev).add(saved.id));
      }
      setPotSheetOpen(false);
      notify('บันทึกก้อนเงินแล้ว');
    } catch (err) {
      toast.error(getErrorMessage(err, 'บันทึกก้อนเงินไม่สำเร็จ'));
    }
  };

  const handleDeletePot = async (potId: string) => {
    const potIdx = (data?.pots ?? []).findIndex((p) => p.id === potId);
    const target = potIdx >= 0 ? data?.pots[potIdx] : undefined;
    try {
      await deletePot.mutateAsync(potId);
      if (target) {
        scheduleRowExit(target, potIdx, setLeavingPots);
      }
      setPotSheetOpen(false);
      notify('ลบก้อนเงินแล้ว');
    } catch (err) {
      toast.error(getErrorMessage(err, 'ลบก้อนเงินไม่สำเร็จ'));
    }
  };

  const handleSaveRecurringIncome = async (input: UpsertRecurringIncomeInput) => {
    try {
      const saved = await upsertRecurringIncome.mutateAsync(input);
      if (!input.id) {
        setRecentIncomeIds((prev) => new Set(prev).add(saved.id));
      }
      setIncomeSheetOpen(false);
      notify('บันทึกเงินประจำแล้ว');
    } catch (err) {
      toast.error(getErrorMessage(err, 'บันทึกเงินประจำไม่สำเร็จ'));
    }
  };

  const handleDeleteRecurringIncome = async (id: string) => {
    const list = data?.recurringIncomes ?? [];
    const idx = list.findIndex((r) => r.id === id);
    const target = idx >= 0 ? list[idx] : undefined;
    try {
      await deleteRecurringIncome.mutateAsync(id);
      if (target) {
        scheduleRowExit(target, idx, setLeavingIncomes);
      }
      setIncomeSheetOpen(false);
      notify('ลบเงินประจำแล้ว');
    } catch (err) {
      toast.error(getErrorMessage(err, 'ลบเงินประจำไม่สำเร็จ'));
    }
  };

  const handleSignOut = async () => {
    const signOutFn = onSignOut ?? auth?.signOut;
    if (!signOutFn) return;
    try {
      await signOutFn();
    } catch (err) {
      toast.error(getErrorMessage(err, 'ออกจากระบบไม่สำเร็จ'));
    }
  };

  const activeSourceRows = mergeLeavingRows(activeSources, leavingActiveSources);
  const archivedSourceRows = mergeLeavingRows(archivedSources, leavingArchivedSources);
  const potRows = mergeLeavingRows(data?.pots ?? [], leavingPots);
  const incomeRows = mergeLeavingRows(data?.recurringIncomes ?? [], leavingIncomes);
  const sourceNameById = new Map((data?.sources ?? []).map((s) => [s.id, s.name]));

  return (
    <>
      <h1 className="text-title font-semibold text-text">ตั้งค่า</h1>

      {isLoading ? (
        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2" role="status" aria-label="กำลังโหลด">
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : error ? (
        <Card className="mt-4 flex flex-col items-start gap-3" role="alert">
          <p className="text-sm text-negative">โหลดการตั้งค่าไม่สำเร็จ: {error.message}</p>
          {refetch ? (
            <Button variant="secondary" onClick={() => refetch()}>
              ลองใหม่
            </Button>
          ) : null}
        </Card>
      ) : data ? (
        <div data-testid="settings-grid" className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-start">
          {/* Group Salary + Recurring Income together so income settings stay paired in column 1. */}
          <div className="space-y-5">
            <section>
              <SectionHeader title="รายได้และรอบเงินเดือน" />
              <div className="mt-1">
                <SalaryForm
                  key={`${data.settings.salary}-${data.settings.payDay}-${data.settings.budgetStartPeriod ?? ''}`}
                  settings={data.settings}
                  today={today}
                  isPending={updateSettings.isPending}
                  onSave={handleSaveSalary}
                />
              </div>
            </section>

            <section data-testid="recurring-incomes-section">
              <SectionHeader
                title="เงินประจำ"
                actionLabel="เพิ่มเงินประจำ"
                onAction={() => {
                  setEditingIncome(null);
                  setIncomeSheetOpen(true);
                }}
              />
              <Card padding="none" className="mt-1 px-card py-1">
                {incomeRows.length === 0 ? (
                  <EmptyState message="ยังไม่มีรายการเงินประจำ" />
                ) : (
                  incomeRows.map(({ item: inc, leaving }) => {
                    const bankName = sourceNameById.get(inc.sourceId) ?? 'บัญชี';
                    const detail = `วันที่ ${inc.dayOfMonth} ของเดือน · ${bankName}${inc.active ? '' : ' · ปิดใช้งาน'}`;
                    return (
                      <AnimatedRow
                        key={inc.id}
                        entering={!leaving && recentIncomeIds.has(inc.id)}
                        leaving={leaving}
                        className="border-b border-rule last:border-b-0"
                      >
                        <ListRow
                          title={inc.name}
                          detail={detail}
                          amount={inc.amount / 100}
                          amountKind="income"
                          onClick={() => {
                            setEditingIncome(inc);
                            setIncomeSheetOpen(true);
                          }}
                        />
                      </AnimatedRow>
                    );
                  })
                )}
              </Card>
            </section>
          </div>

          <section>
            <SectionHeader
              title="ช่องทางจ่าย"
              actionLabel="เพิ่มช่องทาง"
              onAction={() => {
                setEditingSource(null);
                setSourceSheetOpen(true);
              }}
            />
            <Card padding="none" className="mt-1 px-card py-1">
              {activeSourceRows.length === 0 ? (
                <EmptyState message="ยังไม่มีช่องทางจ่าย" />
              ) : (
                activeSourceRows.map(({ item: src, leaving }) => (
                  <AnimatedRow
                    key={src.id}
                    entering={!leaving && recentActiveSourceIds.has(src.id)}
                    leaving={leaving}
                    className="border-b border-rule last:border-b-0"
                  >
                    <ListRow
                      leading={<span aria-hidden="true" className={`block h-2.5 w-2.5 rounded-dot ${HUE_MARK[src.hue]}`} />}
                      title={src.name}
                      detail={formatSourceSummary(src, data.sources)}
                      amount={null}
                      onClick={() => {
                        setEditingSource(src);
                        setSourceSheetOpen(true);
                      }}
                    />
                  </AnimatedRow>
                ))
              )}
            </Card>

            {archivedSourceRows.length > 0 ? (
              <div className="mt-3">
                <p className="mb-1 px-1 text-sm text-muted">เก็บถาวรแล้ว</p>
                <Card padding="none" className="px-card py-1">
                  {archivedSourceRows.map(({ item: src, leaving }) => (
                    <AnimatedRow
                      key={src.id}
                      entering={!leaving && recentArchivedSourceIds.has(src.id)}
                      leaving={leaving}
                      className="border-b border-rule last:border-b-0"
                    >
                      <ListRow
                        leading={<Pill hue={src.hue}>เก็บถาวร</Pill>}
                        title={src.name}
                        detail={formatSourceSummary(src, data.sources)}
                        amount={null}
                        onClick={() => {
                          setEditingSource(src);
                          setSourceSheetOpen(true);
                        }}
                      />
                    </AnimatedRow>
                  ))}
                </Card>
              </div>
            ) : null}
          </section>

          <section>
            <SectionHeader
              title="ก้อนเงิน"
              actionLabel="เพิ่มก้อนเงิน"
              onAction={() => {
                setEditingPot(null);
                setPotSheetOpen(true);
              }}
            />
            <Card padding="none" className="mt-1 px-card py-1">
              {potRows.length === 0 ? (
                <EmptyState message="ยังไม่มีก้อนเงิน" />
              ) : (
                potRows.map(({ item: pot, leaving }) => (
                  <AnimatedRow
                    key={pot.id}
                    entering={!leaving && recentPotIds.has(pot.id)}
                    leaving={leaving}
                    className="border-b border-rule last:border-b-0"
                  >
                    <ListRow
                      leading={<span aria-hidden="true" className={`block h-2.5 w-2.5 rounded-dot ${HUE_MARK[pot.hue]}`} />}
                      title={pot.name}
                      detail={pot.rollover ? 'ยกยอดคงเหลือไปรอบถัดไป' : 'ไม่ยกยอด'}
                      amount={pot.perPeriod / 100}
                      onClick={() => {
                        setEditingPot(pot);
                        setPotSheetOpen(true);
                      }}
                    />
                  </AnimatedRow>
                ))
              )}
            </Card>
          </section>

          {/* Group Theme + Account together so the 2-column desktop layout stays clean. */}
          <div className="space-y-5">
            <section>
              <SectionHeader title="ธีม" />
              <Card className="mt-1">
                <ThemeSwitch />
              </Card>
            </section>

            <section className="pt-1">
              <Button variant="secondary" size="lg" className="w-full" onClick={() => void handleSignOut()}>
                ออกจากระบบ
              </Button>
            </section>
          </div>

          <SourceSheet
            open={sourceSheetOpen}
            onOpenChange={setSourceSheetOpen}
            data={data}
            editing={editingSource}
            onSave={handleSaveSource}
            onArchiveToggle={handleArchiveToggleSource}
            onDelete={handleDeleteSource}
            isSubmitting={upsertSource.isPending || deleteSource.isPending}
          />

          <PotSheet
            open={potSheetOpen}
            onOpenChange={setPotSheetOpen}
            data={data}
            editing={editingPot}
            onSave={handleSavePot}
            onDelete={handleDeletePot}
            isSubmitting={upsertPot.isPending || deletePot.isPending}
          />

          <RecurringIncomeSheet
            open={incomeSheetOpen}
            onOpenChange={setIncomeSheetOpen}
            data={data}
            editing={editingIncome}
            onSave={handleSaveRecurringIncome}
            onDelete={handleDeleteRecurringIncome}
            isSubmitting={upsertRecurringIncome.isPending || deleteRecurringIncome.isPending}
          />
        </div>
      ) : null}
    </>
  );
}
