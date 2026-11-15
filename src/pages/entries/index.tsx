import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { AnimatedRow } from '../../components/ui/AnimatedRow';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { IconButton } from '../../components/ui/IconButton';
import { ListRow } from '../../components/ui/ListRow';
import { Money } from '../../components/ui/Money';
import { Pill } from '../../components/ui/Pill';
import { SegmentedControl, type SegmentedOption } from '../../components/ui/SegmentedControl';
import { Skeleton } from '../../components/ui/Skeleton';
import { notify } from '../../components/ui/Toaster';
import {
  useCreateTransaction,
  useDeleteTransaction,
  useFinanceData,
  useUpdateTransaction,
} from '../../hooks/useFinance';
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

export default function EntriesPage({ today: todayProp }: EntriesPageProps) {
  const today = todayProp ?? todayBangkok();
  const { data, isLoading, error, refetch } = useFinanceData();
  const createTx = useCreateTransaction();
  const updateTx = useUpdateTransaction();
  const deleteTx = useDeleteTransaction();

  const [periodOffset, setPeriodOffset] = useState<PeriodOffset>('0');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [recentIds, setRecentIds] = useState<Set<string>>(() => new Set());

  const payDay = data?.settings.payDay ?? 10;
  const periodOptions = useMemo(() => getPeriodOptions(today, payDay), [today, payDay]);
  const selectedPeriod = periodOptions.find((p) => p.offset === periodOffset)?.period ?? periodOptions[0].period;

  const sourcesById = useMemo(() => {
    const map = new Map<string, NonNullable<typeof data>['sources'][number]>();
    for (const s of data?.sources ?? []) map.set(s.id, s);
    return map;
  }, [data?.sources]);

  const sourceTabs: SegmentedOption<string>[] = useMemo(() => {
    const active = (data?.sources ?? []).filter((s) => !s.archived);
    return [{ value: 'all', label: 'ทั้งหมด' }, ...active.map((s) => ({ value: s.id, label: s.name }))];
  }, [data?.sources]);

  // Reset filter to "all" if the currently selected source was archived or removed.
  const activeSourceFilter = sourceTabs.some((t) => t.value === sourceFilter) ? sourceFilter : 'all';

  const dayGroups = useMemo(
    () => (data ? groupTransactionsByDay(data.transactions, selectedPeriod, activeSourceFilter) : []),
    [data, selectedPeriod, activeSourceFilter],
  );

  const openAdd = () => {
    setEditing(null);
    setSheetOpen(true);
  };

  const openEdit = (tx: Transaction) => {
    setEditing(tx);
    setSheetOpen(true);
  };

  const handleSave = async (input: CreateTransactionInput, existingId?: string) => {
    if (existingId && editing) {
      const previous = editing;
      await updateTx.mutateAsync({ id: existingId, ...input });
      setSheetOpen(false);
      let undone = false;
      notify('แก้ไขรายการแล้ว', {
        undo: () => {
          if (undone) return;
          undone = true;
          void updateTx.mutateAsync(previous);
        },
      });
      return;
    }

    const created = await createTx.mutateAsync(input);
    setRecentIds((prev) => new Set(prev).add(created.id));
    setSheetOpen(false);
    let undone = false;
    notify('บันทึกแล้ว', {
      undo: () => {
        if (undone) return;
        undone = true;
        void deleteTx.mutateAsync(created.id);
      },
    });
  };

  const handleDelete = async (tx: Transaction) => {
    const snapshot: CreateTransactionInput = {
      date: tx.date,
      amount: tx.amount,
      direction: tx.direction,
      sourceId: tx.sourceId,
      potId: tx.potId,
      category: tx.category,
      note: tx.note,
    };
    await deleteTx.mutateAsync(tx.id);
    setSheetOpen(false);
    let undone = false;
    notify('ลบรายการแล้ว', {
      undo: () => {
        if (undone) return;
        undone = true;
        void createTx.mutateAsync(snapshot);
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
          <div className="mt-4 space-y-2.5">
            <SegmentedControl
              label="รอบเงินเดือน"
              options={periodOptions.map((o) => ({ value: o.offset, label: o.label }))}
              value={periodOffset}
              onChange={setPeriodOffset}
            />
            <SegmentedControl
              label="กรองช่องทาง"
              options={sourceTabs}
              value={activeSourceFilter}
              onChange={setSourceFilter}
            />
          </div>

          {dayGroups.length === 0 ? (
            <Card className="mt-4">
              <EmptyState message="ยังไม่มีรายการในรอบนี้" />
            </Card>
          ) : (
            <div className="mt-4 space-y-4">
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
                      return (
                        <AnimatedRow key={tx.id} entering={recentIds.has(tx.id)}>
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
