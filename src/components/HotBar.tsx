import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { hotbarItems } from '../domain';
import { useCreateTransaction, useDeleteTransaction } from '../hooks/useFinance';
import { formatTHB } from '../lib/money';
import {
  CATEGORY_LABELS,
  type FinanceData,
  type HotbarItem,
  type ISODate,
  type Satang,
  type Transaction,
} from '../types/finance';

export const HOTBAR_LONG_PRESS_MS = 500;
const HOTBAR_TOAST_MS = 5000;
const MOVE_CANCEL_PX = 8;

const compactBahtFormatter = new Intl.NumberFormat('th-TH', {
  numberingSystem: 'latn',
  maximumFractionDigits: 0,
});

function formatCompactBaht(satang: Satang): string {
  const baht = satang / 100;
  if (satang % 100 === 0) {
    return `฿${compactBahtFormatter.format(baht)}`;
  }
  return formatTHB(baht);
}

function itemKey(item: HotbarItem): string {
  return `${item.note.trim().toLowerCase()}|${item.amount}|${item.category}|${item.sourceId}|${item.potId ?? ''}`;
}

function itemLabel(item: HotbarItem): string {
  return item.note.trim() || CATEGORY_LABELS[item.category];
}

function formatErrorSuffix(err: unknown): string {
  return err instanceof Error && err.message ? `: ${err.message}` : '';
}

export interface HotBarProps {
  data: FinanceData;
  today: ISODate;
  /** Called on 500ms long-press or right-click to open/prefill QuickAddSheet. */
  onEdit?: (item: HotbarItem) => void;
  /** Called after a quick-tap transaction is saved. */
  onSaved?: (tx: Transaction) => void;
  className?: string;
}

export function HotBar({ data, today, onEdit, onSaved, className }: HotBarProps) {
  const createTransaction = useCreateTransaction();
  const deleteTransaction = useDeleteTransaction();
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const savingKeyRef = useRef<string | null>(null);

  const holdTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  // Suppresses the synthetic click that follows pointerup when a 500ms long-press already opened edit.
  const longPressedRef = useRef(false);
  // Prevents firing onEdit twice when Android/touch browsers emit contextmenu right after a 500ms hold.
  const editFiredOnHoldRef = useRef(false);

  const clearHoldTimer = useCallback(() => {
    clearTimeout(holdTimerRef.current);
    holdTimerRef.current = undefined;
    pointerStartRef.current = null;
  }, []);

  useEffect(() => () => clearTimeout(holdTimerRef.current), []);

  let items: HotbarItem[] = [];
  try {
    items = hotbarItems(data, today);
  } catch {
    // Gracefully stay hidden if the domain stub is not yet merged or data is incomplete.
    items = [];
  }

  if (items.length === 0) return null;

  const handleQuickSave = async (item: HotbarItem, key: string) => {
    if (savingKeyRef.current) return;
    savingKeyRef.current = key;
    setSavingKey(key);

    try {
      const created = await createTransaction.mutateAsync({
        date: today,
        amount: item.amount,
        direction: 'out',
        sourceId: item.sourceId,
        potId: item.potId,
        category: item.category,
        note: item.note,
      });
      onSaved?.(created);

      const label = itemLabel(item);
      const amountText = formatCompactBaht(item.amount);
      let undone = false;
      toast(`บันทึก${label} ${amountText}`, {
        duration: HOTBAR_TOAST_MS,
        action: {
          label: 'เลิกทำ',
          onClick: () => {
            if (undone) return;
            undone = true;
            void deleteTransaction.mutateAsync(created.id).catch((err) => {
              toast(`เลิกทำไม่สำเร็จ${formatErrorSuffix(err)}`);
            });
          },
        },
      });
    } catch (err) {
      toast(`บันทึกไม่สำเร็จ${formatErrorSuffix(err)}`);
    } finally {
      savingKeyRef.current = null;
      setSavingKey(null);
    }
  };

  return (
    <div
      role="region"
      aria-label="ทางลัดจดเร็ว"
      className={['flex gap-2 overflow-x-auto pb-1', className].filter(Boolean).join(' ')}
    >
      {items.map((item) => {
        const key = itemKey(item);
        const label = itemLabel(item);
        const amountText = formatCompactBaht(item.amount);
        const isSaving = savingKey === key;

        return (
          <button
            key={key}
            type="button"
            disabled={isSaving}
            onPointerDown={(e) => {
              if (e.pointerType === 'mouse' && e.button !== 0) return;
              longPressedRef.current = false;
              editFiredOnHoldRef.current = false;
              pointerStartRef.current = { x: e.clientX, y: e.clientY };
              clearTimeout(holdTimerRef.current);
              holdTimerRef.current = setTimeout(() => {
                holdTimerRef.current = undefined;
                longPressedRef.current = true;
                editFiredOnHoldRef.current = true;
                onEdit?.(item);
              }, HOTBAR_LONG_PRESS_MS);
            }}
            onPointerMove={(e) => {
              const start = pointerStartRef.current;
              if (!start || holdTimerRef.current === undefined) return;
              if (Math.abs(e.clientX - start.x) > MOVE_CANCEL_PX || Math.abs(e.clientY - start.y) > MOVE_CANCEL_PX) {
                clearHoldTimer();
              }
            }}
            onPointerUp={clearHoldTimer}
            onPointerLeave={clearHoldTimer}
            onPointerCancel={clearHoldTimer}
            onBlur={clearHoldTimer}
            onContextMenu={(e) => {
              e.preventDefault();
              clearHoldTimer();
              if (editFiredOnHoldRef.current) {
                editFiredOnHoldRef.current = false;
                return;
              }
              onEdit?.(item);
            }}
            onClick={() => {
              if (longPressedRef.current) {
                longPressedRef.current = false;
                return;
              }
              void handleQuickSave(item, key);
            }}
            style={{ WebkitTouchCallout: 'none' }}
            className={[
              'pressable inline-flex min-h-tap shrink-0 touch-pan-x select-none items-center gap-1.5 rounded-pill',
              'bg-stone-bg px-3 text-sm font-medium text-stone-ink',
              'hover-fine:enabled:hover:opacity-80 disabled:opacity-50',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2',
            ].join(' ')}
          >
            <span>{label}</span>
            <span className="tabular-nums">{amountText}</span>
          </button>
        );
      })}
    </div>
  );
}
