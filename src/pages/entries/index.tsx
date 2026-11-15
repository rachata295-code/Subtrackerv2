import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
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
import { notify } from '../../components/ui/Toaster';
import {
  useCreateTransaction,
  useDeleteTransaction,
  useFinanceData,
  useUpdateTransaction,
} from '../../hooks/useFinance';
import { useIsDesktop } from '../../hooks/useMediaQuery';
import type { CreateTransactionInput, ISODate, Transaction } from '../../types/finance';
import { EntrySheet } from './EntrySheet';
import {
  CATEGORY_LABEL,
  formatThaiDate,
  formatThaiShort,
  getPeriodOptions,
  groupTransactionsByDay,
  todayBangkok,
  type PeriodOffset,
} from './entriesUtils';

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
  const { data, isLoading, error, refetch } = useFinanceData();
  const createTx = useCreateTransaction();
  const updateTx = useUpdateTransaction();
  const deleteTx = useDeleteTransaction();

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
  const selectedPeriod = periodOptions.find((p) => p.offset === periodOffset)?.period ?? periodOptions[0].period;

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
        ? groupTransactionsByDay(data.transactions, selectedPeriod, activeSourceFilter, activePotFilter)
        : [],
    [data, selectedPeriod, activeSourceFilter, activePotFilter],
  );

  // Clear recentIds whenever a filter changes so rows appearing from filtering never play enter animations.
  const handlePeriodChange = (next: PeriodOffset) => {
    setRecentIds(new Set());
    setPeriodOffset(next);
  };

  const handlePotChange = (next: string) => {
    setRecentIds(new Set());
    setPotFilter(next);
  };

  const handleSourceChange = (next: string) => {
    setRecentIds(new Set());
    setSourceFilter(next);
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

  const handleDelete = async (tx: Transaction) => {
    if (leavingIds.has(tx.id)) return;
    const snapshot: CreateTransactionInput = {
      date: tx.date,
      amount: tx.amount,
      direction: tx.direction,
      sourceId: tx.sourceId,
      potId: tx.potId,
      category: tx.category,
      note: tx.note,
    };
    setSheetOpen(false);
    try {
      await animateAndDelete(tx.id);
    } catch (err) {
      toast.error(`ลบรายการไม่สำเร็จ: ${formatErrorMessage(err)}`);
      return;
    }
    let undone = false;
    notify('ลบรายการแล้ว', {
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
          <div className="mt-4 lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start lg:gap-6">
            {/* Desktop uses SelectField inside a 240px sticky card because 3-4 segment tablists overflow at 240px;
                mobile/tablet keep SegmentedControl chip rows so only one control set is mounted at any width. */}
            <aside aria-label="ตัวกรองรายการ" className="lg:sticky lg:top-6">
              {isDesktop ? (
                <Card className="space-y-3">
                  <SelectField
                    label="รอบเงินเดือน"
                    options={periodFilterOptions}
                    value={periodOffset}
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
                    value={periodOffset}
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
              {dayGroups.length === 0 ? (
                <Card>
                  <EmptyState message="ยังไม่มีรายการในรอบนี้" />
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
                            >
                              <ListRow
                                title={title}
                                detail={detail}
                                amount={tx.amount / 100}
                                amountKind={tx.direction === 'in' ? 'income' : 'spend'}
                                onClick={() => openEdit(tx)}
                              />
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

          <EntrySheet
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            sources={data.sources}
            pots={data.pots}
            today={today}
            editing={editing}
            onSave={handleSave}
            onDelete={handleDelete}
            isSubmitting={createTx.isPending || updateTx.isPending || deleteTx.isPending}
          />
        </>
      ) : null}
    </>
  );
}
