import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { AnimatedRow, ROW_EXIT_MS } from '../../components/ui/AnimatedRow';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { IconButton } from '../../components/ui/IconButton';
import { ListRow } from '../../components/ui/ListRow';
import { Money } from '../../components/ui/Money';
import { Pill } from '../../components/ui/Pill';
import { SegmentedControl, type SegmentedOption } from '../../components/ui/SegmentedControl';
import { SelectField, type SelectOption } from '../../components/ui/SelectField';
import { Skeleton } from '../../components/ui/Skeleton';
import { SwipeToDelete } from '../../components/ui/SwipeToDelete';
import { notify } from '../../components/ui/Toaster';
import {
  useCreateTransaction,
  useDeleteTransaction,
  useFinanceData,
  useUpdateTransaction,
} from '../../hooks/useFinance';
import { useIsDesktop } from '../../hooks/useMediaQuery';
import {
  SUMMARY_CATEGORY_LABELS,
  type CreateTransactionInput,
  type ISODate,
  type PeriodKey,
  type SummaryCategory,
  type Transaction,
} from '../../types/finance';
import { EntrySheet } from './EntrySheet';
import { EntriesSummaryView } from './EntriesSummaryView';
import {
  CATEGORY_LABEL,
  formatPeriodMonthYear,
  formatThaiDate,
  formatThaiShort,
  getPeriodOptions,
  getPeriodRange,
  groupTransactionsByDay,
  todayBangkok,
  type PeriodOffset,
} from './entriesUtils';

type EntriesView = 'list' | 'summary';

const VIEW_OPTIONS: SegmentedOption<EntriesView>[] = [
  { value: 'list', label: 'รายการ' },
  { value: 'summary', label: 'สรุป' },
];

function isSummaryCategory(value: string | null): value is SummaryCategory {
  return value !== null && Object.prototype.hasOwnProperty.call(SUMMARY_CATEGORY_LABELS, value);
}

const PERIOD_KEY_RE = /^\d{4}-\d{2}$/;

function isValidPeriodKeyParam(value: string | null): value is PeriodKey {
  return value !== null && PERIOD_KEY_RE.test(value);
}

export interface EntriesPageProps {
  /** Override current Bangkok date for deterministic rendering and tests. */
  today?: ISODate;
}

function formatErrorMessage(err: unknown): string {
  return err instanceof Error && err.message.trim() ? err.message : 'กรุณาลองใหม่';
}

export default function EntriesPage({ today: todayProp }: EntriesPageProps) {
  const today = todayProp ?? todayBangkok();
  const isDesktop = useIsDesktop();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data, isLoading, error, refetch } = useFinanceData();
  const createTx = useCreateTransaction();
  const updateTx = useUpdateTransaction();
  const deleteTx = useDeleteTransaction();

  const view: EntriesView = searchParams.get('view') === 'summary' ? 'summary' : 'list';
  const rawCategory = searchParams.get('category');
  const activeCategoryFilter: SummaryCategory | 'all' = isSummaryCategory(rawCategory) ? rawCategory : 'all';
  const rawPeriodParam = searchParams.get('period');
  const urlPeriodKey = isValidPeriodKeyParam(rawPeriodParam) ? rawPeriodParam : null;

  const [periodOffset, setPeriodOffset] = useState<PeriodOffset>('0');
  const [potFilter, setPotFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [recentIds, setRecentIds] = useState<Set<string>>(() => new Set());
  const [leavingIds, setLeavingIds] = useState<Set<string>>(() => new Set());

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const payDay = data?.settings.payDay ?? 10;
  const periodOptions = useMemo(() => getPeriodOptions(today, payDay), [today, payDay]);
  const currentPeriodKey = periodOptions[0].period.key;
  const matchingOffsetOption = urlPeriodKey
    ? periodOptions.find((p) => p.period.key === urlPeriodKey)
    : undefined;
  const effectiveOffset = matchingOffsetOption ? matchingOffsetOption.offset : periodOffset;
  const selectedPeriod = useMemo(() => {
    if (urlPeriodKey) return getPeriodRange(urlPeriodKey, payDay);
    return periodOptions.find((p) => p.offset === periodOffset)?.period ?? periodOptions[0].period;
  }, [urlPeriodKey, payDay, periodOptions, periodOffset]);
  const isOlderUrlPeriod = urlPeriodKey !== null && !matchingOffsetOption;

  const periodFilterOptions: SegmentedOption<PeriodOffset>[] = useMemo(
    () => periodOptions.map((o) => ({ value: o.offset, label: o.label })),
    [periodOptions],
  );

  const sourcesById = useMemo(() => {
    const map = new Map<string, NonNullable<typeof data>['sources'][number]>();
    for (const s of data?.sources ?? []) map.set(s.id, s);
    return map;
  }, [data?.sources]);

  const potOptions: (SegmentedOption<string> & SelectOption)[] = useMemo(() => {
    const pots = data?.pots ?? [];
    return [{ value: 'all', label: 'ทุกก้อน' }, ...pots.map((p) => ({ value: p.id, label: p.name }))];
  }, [data?.pots]);

  const sourceOptions: (SegmentedOption<string> & SelectOption)[] = useMemo(() => {
    const active = (data?.sources ?? []).filter((s) => !s.archived);
    return [{ value: 'all', label: 'ทั้งหมด' }, ...active.map((s) => ({ value: s.id, label: s.name }))];
  }, [data?.sources]);

  // Reset filters to "all" if the selected pot/source was deleted or archived.
  const activePotFilter = potOptions.some((t) => t.value === potFilter) ? potFilter : 'all';
  const activeSourceFilter = sourceOptions.some((t) => t.value === sourceFilter) ? sourceFilter : 'all';

  const dayGroups = useMemo(
    () =>
      data
        ? groupTransactionsByDay(
            data.transactions,
            selectedPeriod,
            activeSourceFilter,
            activePotFilter,
            activeCategoryFilter,
          )
        : [],
    [data, selectedPeriod, activeSourceFilter, activePotFilter, activeCategoryFilter],
  );

  // Clear recentIds whenever a filter or view changes so rows appearing from filtering never play enter animations.
  const handlePeriodChange = (next: PeriodOffset) => {
    setRecentIds(new Set());
    setPeriodOffset(next);
    if (urlPeriodKey) {
      const updated = new URLSearchParams(searchParams);
      updated.delete('period');
      setSearchParams(updated, { replace: true });
    }
  };

  const handlePotChange = (next: string) => {
    setRecentIds(new Set());
    setPotFilter(next);
  };

  const handleSourceChange = (next: string) => {
    setRecentIds(new Set());
    setSourceFilter(next);
  };

  const handleViewChange = (next: EntriesView) => {
    if (next === view) return;
    setRecentIds(new Set());
    const updated = new URLSearchParams(searchParams);
    if (next === 'summary') {
      updated.set('view', 'summary');
      updated.delete('category');
    } else {
      updated.delete('view');
    }
    // Push history entry so browser Back switches cleanly between ?view=summary and /entries.
    setSearchParams(updated);
  };

  const handleSummaryPeriodChange = (nextKey: PeriodKey) => {
    const matched = periodOptions.find((p) => p.period.key === nextKey);
    if (matched) setPeriodOffset(matched.offset);
    const updated = new URLSearchParams(searchParams);
    if (nextKey === currentPeriodKey) updated.delete('period');
    else updated.set('period', nextKey);
    setSearchParams(updated, { replace: true });
  };

  const handleSelectCategoryFromSummary = (category: SummaryCategory) => {
    setRecentIds(new Set());
    const updated = new URLSearchParams(searchParams);
    updated.delete('view');
    updated.set('category', category);
    if (selectedPeriod.key !== currentPeriodKey) {
      updated.set('period', selectedPeriod.key);
    } else {
      updated.delete('period');
    }
    setSearchParams(updated);
  };

  const handleClearCategoryFilter = () => {
    setRecentIds(new Set());
    const updated = new URLSearchParams(searchParams);
    updated.delete('category');
    setSearchParams(updated, { replace: true });
  };

  const handleClearOlderPeriod = () => {
    setRecentIds(new Set());
    setPeriodOffset('0');
    const updated = new URLSearchParams(searchParams);
    updated.delete('period');
    setSearchParams(updated, { replace: true });
  };

  const openAdd = () => {
    setEditing(null);
    setSheetOpen(true);
  };

  const openEdit = (tx: Transaction) => {
    if (leavingIds.has(tx.id)) return;
    setEditing(tx);
    setSheetOpen(true);
  };

  const animateAndDelete = async (id: string) => {
    if (mountedRef.current) {
      setLeavingIds((prev) => new Set(prev).add(id));
    }
    await new Promise<void>((resolve) => {
      setTimeout(resolve, ROW_EXIT_MS);
    });
    try {
      await deleteTx.mutateAsync(id);
    } finally {
      if (mountedRef.current) {
        setLeavingIds((prev) => {
          if (!prev.has(id)) return prev;
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    }
  };

  const handleSave = async (input: CreateTransactionInput, existingId?: string) => {
    if (existingId && editing) {
      const previous = editing;
      try {
        await updateTx.mutateAsync({ ...editing, ...input, id: existingId });
      } catch (err) {
        toast.error(`แก้ไขรายการไม่สำเร็จ: ${formatErrorMessage(err)}`);
        return;
      }
      setSheetOpen(false);
      let undone = false;
      notify('แก้ไขรายการแล้ว', {
        undo: () => {
          if (undone) return;
          undone = true;
          void updateTx.mutateAsync(previous).catch((err) => {
            toast.error(`เลิกทำไม่สำเร็จ: ${formatErrorMessage(err)}`);
          });
        },
      });
      return;
    }

    let created: Transaction;
    try {
      created = await createTx.mutateAsync(input);
    } catch (err) {
      toast.error(`บันทึกไม่สำเร็จ: ${formatErrorMessage(err)}`);
      return;
    }
    setRecentIds((prev) => new Set(prev).add(created.id));
    setSheetOpen(false);
    let undone = false;
    notify('บันทึกแล้ว', {
      undo: () => {
        if (undone) return;
        undone = true;
        void animateAndDelete(created.id).catch((err) => {
          toast.error(`เลิกทำไม่สำเร็จ: ${formatErrorMessage(err)}`);
        });
      },
    });
  };

  const handleDelete = async (tx: Transaction, toastMessage = 'ลบรายการแล้ว'): Promise<boolean> => {
    if (leavingIds.has(tx.id)) return false;
    const snapshot: CreateTransactionInput = {
      date: tx.date,
      amount: tx.amount,
      direction: tx.direction,
      sourceId: tx.sourceId,
      potId: tx.potId,
      category: tx.category,
      note: tx.note,
      recurringIncomeId: tx.recurringIncomeId,
      incomeDueOn: tx.incomeDueOn,
    };
    setSheetOpen(false);
    try {
      await animateAndDelete(tx.id);
    } catch (err) {
      toast.error(`ลบรายการไม่สำเร็จ: ${formatErrorMessage(err)}`);
      return false;
    }
    let undone = false;
    notify(toastMessage, {
      undo: () => {
        if (undone) return;
        undone = true;
        void createTx
          .mutateAsync(snapshot)
          .then((restored) => {
            if (mountedRef.current) {
              setRecentIds((prev) => new Set(prev).add(restored.id));
            }
          })
          .catch((err) => {
            toast.error(`เลิกทำไม่สำเร็จ: ${formatErrorMessage(err)}`);
          });
      },
    });
    return true;
  };

  return (
    <>
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-title font-semibold text-text">รายการ</h1>
          {data ? (
            <p className="mt-0.5 text-sm text-muted">
              {`รอบ ${formatThaiShort(selectedPeriod.start)} – ${formatThaiShort(selectedPeriod.end)}`}
            </p>
          ) : null}
        </div>
        {data ? (
          <IconButton
            label="เพิ่มรายการ"
            icon={<Plus size={22} strokeWidth={1.6} aria-hidden="true" />}
            onClick={openAdd}
            className="!bg-accent !text-on-accent hover-fine:hover:opacity-90"
          />
        ) : null}
      </header>

      <div className="mt-4">
        <SegmentedControl label="มุมมอง" options={VIEW_OPTIONS} value={view} onChange={handleViewChange} />
      </div>

      {isLoading ? (
        <div className="mt-4 space-y-3" role="status" aria-label="กำลังโหลด">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : error ? (
        <Card className="mt-4 flex flex-col items-start gap-3" role="alert">
          <p className="text-sm text-negative">โหลดรายการไม่สำเร็จ: {error.message}</p>
          {refetch ? (
            <Button variant="secondary" onClick={() => refetch()}>
              ลองใหม่
            </Button>
          ) : null}
        </Card>
      ) : data ? (
        <>
          {view === 'summary' ? (
            <EntriesSummaryView
              data={data}
              today={today}
              selectedPeriodKey={selectedPeriod.key}
              onSelectPeriod={handleSummaryPeriodChange}
              onSelectCategory={handleSelectCategoryFromSummary}
            />
          ) : (
            <div className="mt-4 lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start lg:gap-6">
              {/* Desktop uses SelectField inside a 240px sticky card because 3-4 segment tablists overflow at 240px;
                  mobile/tablet keep SegmentedControl chip rows so only one control set is mounted at any width. */}
              <aside aria-label="ตัวกรองรายการ" className="lg:sticky lg:top-6">
                {isDesktop ? (
                  <Card className="space-y-3">
                    <SelectField
                      label="รอบเงินเดือน"
                      options={periodFilterOptions}
                      value={effectiveOffset}
                      onChange={(e) => handlePeriodChange(e.target.value as PeriodOffset)}
                    />
                    {data.pots.length > 0 ? (
                      <SelectField
                        label="ก้อนเงิน"
                        options={potOptions}
                        value={activePotFilter}
                        onChange={(e) => handlePotChange(e.target.value)}
                      />
                    ) : null}
                    <SelectField
                      label="ช่องทาง"
                      options={sourceOptions}
                      value={activeSourceFilter}
                      onChange={(e) => handleSourceChange(e.target.value)}
                    />
                  </Card>
                ) : (
                  <div className="space-y-2.5">
                    <SegmentedControl
                      label="รอบเงินเดือน"
                      options={periodFilterOptions}
                      value={effectiveOffset}
                      onChange={handlePeriodChange}
                    />
                    {data.pots.length > 0 ? (
                      <SegmentedControl
                        label="กรองก้อนเงิน"
                        options={potOptions}
                        value={activePotFilter}
                        onChange={handlePotChange}
                      />
                    ) : null}
                    <SegmentedControl
                      label="กรองช่องทาง"
                      options={sourceOptions}
                      value={activeSourceFilter}
                      onChange={handleSourceChange}
                    />
                  </div>
                )}
              </aside>

              <div className="mt-4 min-w-0 lg:mt-0">
                {activeCategoryFilter !== 'all' || isOlderUrlPeriod ? (
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    {activeCategoryFilter !== 'all' ? (
                      <span className="inline-flex min-h-tap items-center gap-1.5 rounded-tile bg-stone-bg pl-3 pr-1 text-sm text-text">
                        <span>หมวด: {SUMMARY_CATEGORY_LABELS[activeCategoryFilter]}</span>
                        <button
                          type="button"
                          onClick={handleClearCategoryFilter}
                          aria-label={`ล้างตัวกรองหมวด${SUMMARY_CATEGORY_LABELS[activeCategoryFilter]}`}
                          className="pressable inline-flex h-9 w-9 items-center justify-center rounded-pill text-muted hover-fine:hover:bg-surface hover-fine:hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                        >
                          <X size={16} strokeWidth={1.6} aria-hidden="true" />
                        </button>
                      </span>
                    ) : null}
                    {isOlderUrlPeriod && urlPeriodKey ? (
                      <span className="inline-flex min-h-tap items-center gap-1.5 rounded-tile bg-stone-bg pl-3 pr-1 text-sm text-text">
                        <span>รอบ: {formatPeriodMonthYear(urlPeriodKey)}</span>
                        <button
                          type="button"
                          onClick={handleClearOlderPeriod}
                          aria-label={`กลับไปรอบปัจจุบัน`}
                          className="pressable inline-flex h-9 w-9 items-center justify-center rounded-pill text-muted hover-fine:hover:bg-surface hover-fine:hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                        >
                          <X size={16} strokeWidth={1.6} aria-hidden="true" />
                        </button>
                      </span>
                    ) : null}
                  </div>
                ) : null}

                {dayGroups.length === 0 ? (
                  <Card>
                    <EmptyState
                      message={
                        activeCategoryFilter === 'subscription' || activeCategoryFilter === 'installment'
                          ? 'ไม่มีรายการจดเองในหมวดนี้ (รายการหักรอบอัตโนมัติอยู่ในแท็บ บิล & ผ่อน)'
                          : activeCategoryFilter !== 'all'
                            ? 'ยังไม่มีรายการในหมวดนี้'
                            : 'ยังไม่มีรายการในรอบนี้'
                      }
                    />
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {dayGroups.map((group) => (
                      <section key={group.date} data-testid={`day-group-${group.date}`}>
                        <div className="mb-1.5 flex items-baseline justify-between gap-3 px-1">
                          <h2 className="text-sm font-medium text-muted">{formatThaiDate(group.date)}</h2>
                          <span data-testid={`day-total-${group.date}`} className="text-right">
                            <Money value={group.displayBaht} size="sm" kind={group.displayKind} />
                          </span>
                        </div>
                        <Card padding="none" className="px-card py-1">
                          {group.transactions.map((tx) => {
                            const src = sourcesById.get(tx.sourceId);
                            const title = tx.note.trim() ? tx.note : CATEGORY_LABEL[tx.category];
                            const detail = (
                              <span className="inline-flex items-center gap-1.5">
                                {src ? <Pill hue={src.hue}>{src.name}</Pill> : null}
                                {tx.note.trim() ? <span>{CATEGORY_LABEL[tx.category]}</span> : null}
                              </span>
                            );
                            const isLeaving = leavingIds.has(tx.id);
                            return (
                              <AnimatedRow
                                key={tx.id}
                                entering={recentIds.has(tx.id) && !isLeaving}
                                leaving={isLeaving}
                                className="border-b border-rule last:border-b-0"
                              >
                                <SwipeToDelete
                                  label={title}
                                  disabled={isLeaving}
                                  onDelete={() => handleDelete(tx, `ลบ${title}แล้ว`)}
                                >
                                  <ListRow
                                    title={title}
                                    detail={detail}
                                    amount={tx.amount / 100}
                                    amountKind={tx.direction === 'in' ? 'income' : 'spend'}
                                    onClick={() => openEdit(tx)}
                                  />
                                </SwipeToDelete>
                              </AnimatedRow>
                            );
                          })}
                        </Card>
                      </section>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <EntrySheet
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            sources={data.sources}
            pots={data.pots}
            balanceChecks={data.balanceChecks}
            today={today}
            editing={editing}
            onSave={handleSave}
            onDelete={(tx) => handleDelete(tx).then(() => undefined)}
            isSubmitting={createTx.isPending || updateTx.isPending || deleteTx.isPending}
          />
        </>
      ) : null}
    </>
  );
}
