import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { BottomSheet } from './ui/BottomSheet';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { CurrencyField } from './ui/CurrencyField';
import { Money } from './ui/Money';
import { TextField } from './ui/TextField';
import { notify } from './ui/Toaster';
import { pendingIncomes } from '../domain';
import { useConfirmIncome } from '../hooks/useFinance';
import {
  bahtToSatang,
  formatThaiShortDate,
  getErrorMessage,
  isNotImplementedError,
  isValidISODate,
} from '../pages/plan/planUtils';
import type { FinanceData, ISODate, PendingIncome } from '../types/finance';

const DISMISS_STORAGE_KEY = 'subtracker:income-dismissed';

function itemKey(item: Pick<PendingIncome, 'recurringIncomeId' | 'dueOn'>): string {
  return `${item.recurringIncomeId}:${item.dueOn}`;
}

function readDismissedMap(): Record<string, ISODate> {
  try {
    const raw = localStorage.getItem(DISMISS_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, ISODate>;
  } catch {
    return {};
  }
}

function writeDismissedMap(map: Record<string, ISODate>): void {
  try {
    localStorage.setItem(DISMISS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage quota or private-mode access errors; in-memory state still hides the card today.
  }
}

interface ConfirmIncomeSheetProps {
  item: PendingIncome | null;
  today: ISODate;
  isPending: boolean;
  onClose: () => void;
  onConfirm: (amountSatang: number, date: ISODate) => Promise<void>;
}

function ConfirmIncomeForm({
  item,
  today,
  isPending,
  onConfirm,
}: {
  item: PendingIncome;
  today: ISODate;
  isPending: boolean;
  onConfirm: (amountSatang: number, date: ISODate) => Promise<void>;
}) {
  const [amountBaht, setAmountBaht] = useState<number | null>(item.amount / 100);
  const [date, setDate] = useState<ISODate>(today);
  const [amountError, setAmountError] = useState<string>();
  const [dateError, setDateError] = useState<string>();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    let valid = true;

    if (amountBaht === null || bahtToSatang(amountBaht) <= 0) {
      setAmountError('กรอกจำนวนเงินให้ถูกต้อง');
      valid = false;
    }
    if (!isValidISODate(date)) {
      setDateError('กรอกวันที่ให้ถูกต้อง');
      valid = false;
    }
    if (!valid) return;

    await onConfirm(bahtToSatang(amountBaht!), date);
  };

  return (
    <form noValidate className="flex flex-col gap-4 pb-2" onSubmit={(e) => void handleSubmit(e)}>
      <CurrencyField
        label="จำนวนเงิน"
        value={amountBaht}
        error={amountError}
        onChange={(v) => {
          setAmountBaht(v);
          setAmountError(undefined);
        }}
      />
      <TextField
        label="วันที่รับเงิน"
        type="date"
        value={date}
        error={dateError}
        onChange={(e) => {
          setDate(e.target.value);
          setDateError(undefined);
        }}
      />
      <Button type="submit" variant="primary" size="lg" loading={isPending}>
        ยืนยันเงินเข้า
      </Button>
    </form>
  );
}

function ConfirmIncomeSheet({ item, today, isPending, onClose, onConfirm }: ConfirmIncomeSheetProps) {
  return (
    <BottomSheet
      open={Boolean(item)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={item ? `ยืนยันรับ${item.name}` : 'ยืนยันเงินเข้า'}
    >
      {item ? (
        <ConfirmIncomeForm
          key={`${item.recurringIncomeId}:${item.dueOn}`}
          item={item}
          today={today}
          isPending={isPending}
          onConfirm={onConfirm}
        />
      ) : null}
    </BottomSheet>
  );
}

export interface IncomeDueCardProps {
  data: FinanceData;
  today: ISODate;
  className?: string;
}

export function IncomeDueCard({ data, today, className = 'order-1' }: IncomeDueCardProps) {
  const confirmIncome = useConfirmIncome();
  const [dismissedMap, setDismissedMap] = useState<Record<string, ISODate>>(() => readDismissedMap());
  const [editingItem, setEditingItem] = useState<PendingIncome | null>(null);
  const [confirmingKey, setConfirmingKey] = useState<string | null>(null);

  let items: PendingIncome[] = [];
  try {
    items = pendingIncomes(data, today);
  } catch (err) {
    if (isNotImplementedError(err)) return null;
    return null;
  }

  const visibleItems = items.filter((item) => dismissedMap[itemKey(item)] !== today);
  if (visibleItems.length === 0) return null;

  const sourceNameById = new Map(data.sources.map((s) => [s.id, s.name]));

  const handleConfirm = async (item: PendingIncome, amountSatang: number, date: ISODate) => {
    const key = itemKey(item);
    if (confirmingKey === key) return;
    setConfirmingKey(key);
    try {
      await confirmIncome.mutateAsync({
        recurringIncomeId: item.recurringIncomeId,
        incomeDueOn: item.dueOn,
        amount: amountSatang,
        date,
        sourceId: item.sourceId,
        note: item.name,
      });
      setEditingItem(null);
      notify('บันทึกเงินเข้าแล้ว');
    } catch (err) {
      toast.error(getErrorMessage(err, 'บันทึกเงินเข้าไม่สำเร็จ'));
    } finally {
      setConfirmingKey(null);
    }
  };

  const handleDismissToday = (item: PendingIncome) => {
    const next = { ...dismissedMap, [itemKey(item)]: today };
    setDismissedMap(next);
    writeDismissedMap(next);
  };

  return (
    <div data-testid="income-due-cards" className={`flex flex-col gap-3 ${className}`.trim()}>
      {visibleItems.map((item) => {
        const key = itemKey(item);
        const bankName = sourceNameById.get(item.sourceId);
        const isBusy = confirmingKey === key || confirmIncome.isPending;

        return (
          <Card key={key} className="border-border bg-raised">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-base font-semibold text-text">{`${item.name}เข้าแล้ว?`}</p>
                <p className="mt-0.5 text-sm text-muted">
                  {`ครบกำหนด ${formatThaiShortDate(item.dueOn)}${bankName ? ` · เข้า${bankName}` : ''}`}
                </p>
              </div>
              <div className="shrink-0">
                <Money value={item.amount / 100} size="md" />
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                loading={isBusy}
                disabled={isBusy}
                onClick={() => void handleConfirm(item, item.amount, today)}
              >
                เข้าแล้ว
              </Button>
              <Button
                variant="ghost"
                disabled={isBusy}
                onClick={() => setEditingItem(item)}
              >
                แก้ยอด/วัน
              </Button>
              <Button
                variant="ghost"
                disabled={isBusy}
                onClick={() => handleDismissToday(item)}
              >
                ยังไม่เข้า
              </Button>
            </div>
          </Card>
        );
      })}

      <ConfirmIncomeSheet
        item={editingItem}
        today={today}
        isPending={confirmIncome.isPending}
        onClose={() => setEditingItem(null)}
        onConfirm={async (amountSatang, date) => {
          if (!editingItem) return;
          await handleConfirm(editingItem, amountSatang, date);
        }}
      />
    </div>
  );
}
