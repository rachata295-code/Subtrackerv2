import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { HotBar } from '../../components/HotBar';
import { AnimatedRow, ROW_EXIT_MS } from '../../components/ui/AnimatedRow';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { CurrencyField } from '../../components/ui/CurrencyField';
import { IconButton } from '../../components/ui/IconButton';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { SelectField } from '../../components/ui/SelectField';
import { TextField } from '../../components/ui/TextField';
import { formatTHB } from '../../lib/money';
import {
  CATEGORY_LABELS,
  IN_CATEGORIES,
  OUT_CATEGORIES,
  type BalanceCheck,
  type Category,
  type CreateTransactionInput,
  type FinanceData,
  type HotbarItem,
  type ISODate,
  type PaymentSource,
  type Pot,
  type Satang,
  type Transaction,
} from '../../types/finance';

const NO_POT_VALUE = '__none__';
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const BEFORE_CHECK_WARNING = 'รายการนี้อยู่ก่อนเช็กยอดล่าสุด จึงไม่เปลี่ยนยอดบัญชี';

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

function bahtToSatang(baht: number): Satang {
  // toPrecision(15) cancels binary float drift before rounding to whole satang.
  return Math.round(Number((baht * 100).toPrecision(15)));
}

function isValidISODate(value: string): value is ISODate {
  if (!ISO_DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function latestCheckDateForSource(
  sourceId: string,
  sources: PaymentSource[],
  balanceChecks: BalanceCheck[],
): ISODate | null {
  const src = sources.find((s) => s.id === sourceId);
  if (!src || src.kind !== 'bank') return null;
  let latest: ISODate | null = null;
  for (const check of balanceChecks) {
    if (check.sourceId !== sourceId) continue;
    if (latest === null || check.checkedOn > latest) {
      latest = check.checkedOn;
    }
  }
  return latest;
}

interface DraftRow {
  id: string;
  amount: number | null;
  category: Category;
  note: string;
  amountError?: string;
  dateError?: string;
  showAdvanced: boolean;
  dateOverride?: ISODate;
  sourceIdOverride?: string;
  potValueOverride?: string;
}

function createDraftRow(id: string, overrides?: Partial<DraftRow>): DraftRow {
  return {
    id,
    amount: null,
    category: 'food',
    note: '',
    showAdvanced: false,
    ...overrides,
  };
}

interface QuickAddFormProps {
  today: ISODate;
  data: FinanceData;
  sources: PaymentSource[];
  pots: Pot[];
  defaultPotId: string | null;
  prefill?: HotbarItem | null;
  onSubmit: (inputs: CreateTransactionInput[]) => Promise<void>;
  onHotbarSaved?: (tx: Transaction) => void;
  onClose: () => void;
}

function QuickAddForm({
  today,
  data,
  sources,
  pots,
  defaultPotId,
  prefill,
  onSubmit,
  onHotbarSaved,
  onClose,
}: QuickAddFormProps) {
  const defaultSource = sources.find((s) => s.kind === 'bank') ?? sources[0];
  const resolvedPrefillSource =
    prefill && sources.some((s) => s.id === prefill.sourceId) ? prefill.sourceId : (defaultSource?.id ?? '');

  const nextRowIdRef = useRef(1);
  const exitTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const [direction, setDirection] = useState<'out' | 'in'>('out');
  const [date, setDate] = useState<string>(today);
  const [dateError, setDateError] = useState<string>();
  const [sourceId, setSourceId] = useState<string>(resolvedPrefillSource);
  const [potValue, setPotValue] = useState<string>(
    prefill ? (prefill.potId ?? NO_POT_VALUE) : (defaultPotId ?? NO_POT_VALUE),
  );
  const [rows, setRows] = useState<DraftRow[]>(() => [
    createDraftRow('row-0', {
      amount: prefill ? prefill.amount / 100 : null,
      category: prefill ? prefill.category : 'food',
      note: prefill ? prefill.note : '',
    }),
  ]);
  const [addedRowIds, setAddedRowIds] = useState<Set<string>>(() => new Set());
  const [leavingRowIds, setLeavingRowIds] = useState<Set<string>>(() => new Set());
  const [submitError, setSubmitError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const timers = exitTimersRef.current;
    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    };
  }, []);

  const visibleRows = rows.filter((r) => !leavingRowIds.has(r.id));
  const categories = direction === 'out' ? OUT_CATEGORIES : IN_CATEGORIES;
  const sourceOptions = sources.map((s) => ({ value: s.id, label: s.name }));
  const potOptions = [
    ...pots.map((p) => ({ value: p.id, label: p.name })),
    { value: NO_POT_VALUE, label: 'แยก' },
  ];

  const headerCheckedOn = latestCheckDateForSource(sourceId, sources, data.balanceChecks);
  const showHeaderBeforeCheckWarning =
    headerCheckedOn !== null && isValidISODate(date) && date < headerCheckedOn;

  const handleDirectionChange = (next: 'out' | 'in') => {
    setDirection(next);
    const validCategories = next === 'out' ? OUT_CATEGORIES : IN_CATEGORIES;
    const fallbackCategory = validCategories[0];
    setRows((prev) =>
      prev.map((row) =>
        validCategories.includes(row.category) ? row : { ...row, category: fallbackCategory },
      ),
    );
  };

  const updateRow = (rowId: string, updater: (row: DraftRow) => DraftRow) => {
    setSubmitError(undefined);
    setRows((prev) => prev.map((r) => (r.id === rowId ? updater(r) : r)));
  };

  const handleAddRow = () => {
    const id = `row-${nextRowIdRef.current++}`;
    setAddedRowIds((prev) => new Set(prev).add(id));
    setRows((prev) => [
      ...prev,
      createDraftRow(id, {
        category: direction === 'out' ? 'food' : 'allowance',
      }),
    ]);
  };

  const handleRemoveRow = (rowId: string) => {
    if (visibleRows.length <= 1 || leavingRowIds.has(rowId)) return;
    setLeavingRowIds((prev) => new Set(prev).add(rowId));
    const timer = setTimeout(() => {
      exitTimersRef.current.delete(rowId);
      setLeavingRowIds((prev) => {
        const next = new Set(prev);
        next.delete(rowId);
        return next;
      });
      setRows((prev) => prev.filter((r) => r.id !== rowId));
    }, ROW_EXIT_MS);
    exitTimersRef.current.set(rowId, timer);
  };

  const handlePrefillFromHotbar = (item: HotbarItem) => {
    setDirection('out');
    if (sources.some((s) => s.id === item.sourceId)) {
      setSourceId(item.sourceId);
    }
    setPotValue(item.potId ?? NO_POT_VALUE);
    setSubmitError(undefined);

    const first = visibleRows[0];
    if (first && first.amount === null && first.note.trim() === '') {
      updateRow(first.id, (r) => ({
        ...r,
        amount: item.amount / 100,
        category: item.category,
        note: item.note,
        amountError: undefined,
      }));
      return;
    }

    const id = `row-${nextRowIdRef.current++}`;
    setAddedRowIds((prev) => new Set(prev).add(id));
    setRows((prev) => [
      ...prev,
      createDraftRow(id, {
        amount: item.amount / 100,
        category: item.category,
        note: item.note,
      }),
    ]);
  };

  const totalSatang = visibleRows.reduce((sum, row) => {
    if (row.amount === null || row.amount <= 0) return sum;
    return sum + bahtToSatang(row.amount);
  }, 0);

  const submitLabel =
    visibleRows.length === 1
      ? 'บันทึก'
      : totalSatang > 0
        ? `บันทึก ${visibleRows.length} รายการ · ${formatCompactBaht(totalSatang)}`
        : `บันทึก ${visibleRows.length} รายการ`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    let allValid = true;
    if (!isValidISODate(date)) {
      setDateError('ระบุวันที่ให้ถูกต้อง');
      allValid = false;
    }

    const validatedRows = rows.map((row) => {
      if (leavingRowIds.has(row.id)) return row;
      let amountError: string | undefined;
      let rowDateError: string | undefined;
      if (row.amount === null || row.amount <= 0 || bahtToSatang(row.amount) <= 0) {
        amountError = 'กรอกจำนวนเงินให้ถูกต้อง';
        allValid = false;
      }
      if (row.dateOverride !== undefined && !isValidISODate(row.dateOverride)) {
        rowDateError = 'ระบุวันที่ให้ถูกต้อง';
        allValid = false;
      }
      return { ...row, amountError, dateError: rowDateError };
    });

    if (!sourceId) allValid = false;

    if (!allValid) {
      setRows(validatedRows);
      return;
    }

    const inputs: CreateTransactionInput[] = visibleRows.map((row) => {
      const effectiveDate = row.dateOverride ?? date;
      const effectiveSource = row.sourceIdOverride ?? sourceId;
      const effectivePotValue = row.potValueOverride ?? potValue;
      // SPEC §6: income, savings, and unknown adjustment entries never attach to a spending pot.
      const effectivePotId =
        direction === 'in' || row.category === 'savings' || row.category === 'unknown'
          ? null
          : effectivePotValue === NO_POT_VALUE
            ? null
            : effectivePotValue;

      return {
        date: effectiveDate,
        amount: bahtToSatang(row.amount!),
        direction,
        sourceId: effectiveSource,
        potId: effectivePotId,
        category: row.category,
        note: row.note.trim(),
      };
    });

    setSubmitting(true);
    setSubmitError(undefined);
    try {
      await onSubmit(inputs);
    } catch {
      setSubmitError('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง');
      setSubmitting(false);
    }
  };

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <HotBar
        data={data}
        today={today}
        onEdit={handlePrefillFromHotbar}
        onSaved={(tx) => {
          onHotbarSaved?.(tx);
          onClose();
        }}
      />

      <SegmentedControl
        label="ประเภท"
        options={[
          { value: 'out', label: 'รายจ่าย' },
          { value: 'in', label: 'เงินเข้า' },
        ]}
        value={direction}
        onChange={handleDirectionChange}
      />

      <div className="flex flex-col gap-1.5">
        <TextField
          type="date"
          label="วันที่"
          value={date}
          error={dateError}
          onChange={(e) => {
            setDate(e.target.value);
            setDateError(undefined);
          }}
        />
        {showHeaderBeforeCheckWarning ? (
          <p className="text-sm text-warning" role="status">
            {BEFORE_CHECK_WARNING}
          </p>
        ) : null}
      </div>

      {sourceOptions.length > 0 ? (
        sourceOptions.length <= 4 ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-text">ช่องทางจ่าย</span>
            <SegmentedControl label="ช่องทางจ่าย" options={sourceOptions} value={sourceId} onChange={setSourceId} />
          </div>
        ) : (
          <SelectField
            label="ช่องทางจ่าย"
            options={sourceOptions}
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
          />
        )
      ) : null}

      {direction === 'out' ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-text">ก้อนเงิน</span>
          {potOptions.length <= 4 ? (
            <SegmentedControl label="ก้อนเงิน" options={potOptions} value={potValue} onChange={setPotValue} />
          ) : (
            <div role="group" aria-label="ก้อนเงิน" className="flex flex-wrap gap-2">
              {potOptions.map((opt) => {
                const selected = opt.value === potValue;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setPotValue(opt.value)}
                    className={[
                      'pressable min-h-tap rounded-pill px-3 text-sm font-medium',
                      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2',
                      selected ? 'bg-accent text-on-accent' : 'bg-stone-bg text-stone-ink hover-fine:hover:opacity-80',
                    ].join(' ')}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        {rows.map((row, index) => {
          const isLeaving = leavingRowIds.has(row.id);
          const isMulti = visibleRows.length > 1 || rows.length > 1;
          const rowDate = row.dateOverride ?? date;
          const rowSourceId = row.sourceIdOverride ?? sourceId;
          const rowPotValue = row.potValueOverride ?? potValue;
          const rowCheckedOn = latestCheckDateForSource(rowSourceId, sources, data.balanceChecks);
          const hasRowOverride = row.dateOverride !== undefined || row.sourceIdOverride !== undefined;
          const showRowWarning =
            hasRowOverride && rowCheckedOn !== null && isValidISODate(rowDate) && rowDate < rowCheckedOn;

          return (
            <AnimatedRow
              key={row.id}
              entering={addedRowIds.has(row.id)}
              leaving={isLeaving}
              className={[
                'flex flex-col gap-3',
                isMulti ? 'rounded-tile border border-border bg-raised p-3' : '',
                isLeaving ? 'pointer-events-none' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {isMulti ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-muted">{`รายการที่ ${index + 1}`}</span>
                  {visibleRows.length > 1 ? (
                    <IconButton
                      label={`ลบรายการที่ ${index + 1}`}
                      icon={<Trash2 size={18} strokeWidth={1.6} aria-hidden="true" />}
                      onClick={() => handleRemoveRow(row.id)}
                    />
                  ) : null}
                </div>
              ) : null}

              <CurrencyField
                label="จำนวนเงิน"
                value={row.amount}
                error={row.amountError}
                onChange={(v) =>
                  updateRow(row.id, (r) => ({
                    ...r,
                    amount: v,
                    amountError: undefined,
                  }))
                }
              />

              <TextField
                label="โน้ต (ไม่บังคับ)"
                value={row.note}
                placeholder="เช่น ชานม, ข้าวเที่ยง"
                onChange={(e) =>
                  updateRow(row.id, (r) => ({
                    ...r,
                    note: e.target.value,
                  }))
                }
              />

              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-text">หมวดหมู่</span>
                <div role="group" aria-label="หมวดหมู่" className="flex flex-wrap gap-2">
                  {categories.map((cat) => {
                    const selected = cat === row.category;
                    return (
                      <button
                        key={cat}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => updateRow(row.id, (r) => ({ ...r, category: cat }))}
                        className={[
                          'pressable min-h-tap rounded-pill px-3 text-sm font-medium',
                          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2',
                          selected
                            ? 'bg-accent text-on-accent'
                            : 'bg-stone-bg text-stone-ink hover-fine:hover:opacity-80',
                        ].join(' ')}
                      >
                        {CATEGORY_LABELS[cat]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <button
                  type="button"
                  aria-expanded={row.showAdvanced}
                  onClick={() =>
                    updateRow(row.id, (r) => ({
                      ...r,
                      showAdvanced: !r.showAdvanced,
                    }))
                  }
                  className="pressable inline-flex min-h-tap items-center gap-1 rounded-pill px-2 text-sm font-medium text-muted hover-fine:hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
                >
                  <span>ตัวเลือกเพิ่ม</span>
                  {row.showAdvanced ? (
                    <ChevronUp size={16} strokeWidth={1.6} aria-hidden="true" />
                  ) : (
                    <ChevronDown size={16} strokeWidth={1.6} aria-hidden="true" />
                  )}
                </button>

                {row.showAdvanced ? (
                  <div className="mt-2 flex flex-col gap-3 rounded-tile border border-border bg-surface p-3">
                    <div className="flex flex-col gap-1.5">
                      <TextField
                        type="date"
                        label="วันที่ (รายการนี้)"
                        value={rowDate}
                        error={row.dateError}
                        onChange={(e) =>
                          updateRow(row.id, (r) => ({
                            ...r,
                            dateOverride: e.target.value,
                            dateError: undefined,
                          }))
                        }
                      />
                      {showRowWarning ? (
                        <p className="text-sm text-warning" role="status">
                          {BEFORE_CHECK_WARNING}
                        </p>
                      ) : null}
                    </div>

                    {sourceOptions.length > 0 ? (
                      <SelectField
                        label="ช่องทาง (รายการนี้)"
                        options={sourceOptions}
                        value={rowSourceId}
                        onChange={(e) =>
                          updateRow(row.id, (r) => ({
                            ...r,
                            sourceIdOverride: e.target.value,
                          }))
                        }
                      />
                    ) : null}

                    {direction === 'out' ? (
                      <SelectField
                        label="ก้อนเงิน (รายการนี้)"
                        options={potOptions}
                        value={rowPotValue}
                        onChange={(e) =>
                          updateRow(row.id, (r) => ({
                            ...r,
                            potValueOverride: e.target.value,
                          }))
                        }
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>
            </AnimatedRow>
          );
        })}
      </div>

      <Button type="button" variant="secondary" onClick={handleAddRow}>
        + เพิ่มอีกรายการ
      </Button>

      {submitError ? (
        <p className="text-sm text-negative" role="alert">
          {submitError}
        </p>
      ) : null}

      <Button type="submit" variant="primary" size="lg" loading={submitting}>
        {submitLabel}
      </Button>
    </form>
  );
}

export interface QuickAddSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  today: ISODate;
  data: FinanceData;
  sources: PaymentSource[];
  pots: Pot[];
  defaultPotId: string | null;
  prefill?: HotbarItem | null;
  onSubmit: (inputs: CreateTransactionInput[]) => Promise<void>;
  onHotbarSaved?: (tx: Transaction) => void;
}

export function QuickAddSheet({
  open,
  onOpenChange,
  today,
  data,
  sources,
  pots,
  defaultPotId,
  prefill,
  onSubmit,
  onHotbarSaved,
}: QuickAddSheetProps) {
  const formKey = prefill ? `prefill-${prefill.note}-${prefill.amount}-${prefill.category}` : 'fresh';

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title="เพิ่มรายการ">
      {open ? (
        <QuickAddForm
          key={formKey}
          today={today}
          data={data}
          sources={sources}
          pots={pots}
          defaultPotId={defaultPotId}
          prefill={prefill}
          onSubmit={onSubmit}
          onHotbarSaved={onHotbarSaved}
          onClose={() => onOpenChange(false)}
        />
      ) : null}
    </BottomSheet>
  );
}
