import { useMemo, useState, type FormEvent } from 'react';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { CurrencyField } from '../../components/ui/CurrencyField';
import { HoldToDelete } from '../../components/ui/HoldToDelete';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { SelectField } from '../../components/ui/SelectField';
import { TextField } from '../../components/ui/TextField';
import { CATEGORY_OPTIONS, isValidISODate } from './entriesUtils';
import type {
  Category,
  CreateTransactionInput,
  ISODate,
  PaymentSource,
  Pot,
  Transaction,
} from '../../types/finance';

export interface EntrySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sources: PaymentSource[];
  pots: Pot[];
  today: ISODate;
  editing: Transaction | null;
  onSave: (input: CreateTransactionInput, existingId?: string) => Promise<void>;
  onDelete: (tx: Transaction) => Promise<void>;
  isSubmitting?: boolean;
}

const DIRECTION_OPTIONS: { value: 'out' | 'in'; label: string }[] = [
  { value: 'out', label: 'รายจ่าย' },
  { value: 'in', label: 'รายรับ' },
];

function EntryForm({
  sources,
  pots,
  today,
  editing,
  onSave,
  onDelete,
  isSubmitting,
}: Omit<EntrySheetProps, 'open' | 'onOpenChange'>) {
  const selectableSources = sources.filter((s) => !s.archived || s.id === editing?.sourceId);
  const defaultSourceId =
    editing?.sourceId ??
    selectableSources.find((s) => s.kind === 'bank')?.id ??
    selectableSources[0]?.id ??
    '';

  const [direction, setDirection] = useState<'out' | 'in'>(editing?.direction ?? 'out');
  const [amount, setAmount] = useState<number | null>(editing ? editing.amount / 100 : null);
  const [sourceId, setSourceId] = useState<string>(defaultSourceId);
  const [potId, setPotId] = useState<string>(editing ? (editing.potId ?? '') : (pots[0]?.id ?? ''));
  const [category, setCategory] = useState<Category>(editing?.category ?? 'food');
  const [date, setDate] = useState<string>(editing?.date ?? today);
  const [note, setNote] = useState<string>(editing?.note ?? '');

  const [amountError, setAmountError] = useState<string>();
  const [dateError, setDateError] = useState<string>();

  const sourceOptions = useMemo(
    () => selectableSources.map((src) => ({ value: src.id, label: src.name })),
    [selectableSources],
  );
  const potOptions = useMemo(
    () => [{ value: '', label: 'ไม่ระบุก้อน' }, ...pots.map((pot) => ({ value: pot.id, label: pot.name }))],
    [pots],
  );
  const categoryOptions = useMemo(
    () => CATEGORY_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label })),
    [],
  );

  const handleDirectionChange = (next: 'out' | 'in') => {
    setDirection(next);
    // Income generally does not come out of a spending pot; clear only on new entries.
    if (!editing) {
      setPotId(next === 'in' ? '' : (pots[0]?.id ?? ''));
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    let valid = true;
    if (amount === null || amount <= 0) {
      setAmountError('กรอกจำนวนเงินให้ถูกต้อง');
      valid = false;
    }
    if (!isValidISODate(date)) {
      setDateError('ระบุวันที่ให้ถูกต้อง');
      valid = false;
    }
    if (!sourceId || !valid) return;

    await onSave(
      {
        date,
        amount: Math.round(amount! * 100),
        direction,
        sourceId,
        potId: potId || null,
        category,
        note: note.trim(),
      },
      editing?.id,
    );
  };

  return (
    <form noValidate className="flex flex-col gap-4 pb-2" onSubmit={(e) => void handleSubmit(e)}>
      <SegmentedControl label="ประเภท" options={DIRECTION_OPTIONS} value={direction} onChange={handleDirectionChange} />

      <CurrencyField
        label="จำนวนเงิน"
        value={amount}
        error={amountError}
        onChange={(v) => {
          setAmount(v);
          setAmountError(undefined);
        }}
      />

      <SelectField
        label="ช่องทาง"
        options={sourceOptions}
        value={sourceId}
        onChange={(e) => setSourceId(e.target.value)}
      />

      <SelectField
        label="ก้อนเงิน"
        options={potOptions}
        value={potId}
        onChange={(e) => setPotId(e.target.value)}
      />

      <SelectField
        label="หมวดหมู่"
        options={categoryOptions}
        value={category}
        onChange={(e) => setCategory(e.target.value as Category)}
      />

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

      <TextField
        label="โน้ต"
        placeholder="เช่น กาแฟ, ค่ารถ"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      <Button type="submit" variant="primary" size="lg" loading={isSubmitting}>
        บันทึก
      </Button>

      {editing ? (
        <HoldToDelete
          label="กดค้างเพื่อลบ"
          onConfirm={() => {
            void onDelete(editing);
          }}
        />
      ) : null}
    </form>
  );
}

export function EntrySheet({
  open,
  onOpenChange,
  sources,
  pots,
  today,
  editing,
  onSave,
  onDelete,
  isSubmitting,
}: EntrySheetProps) {
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={editing ? 'แก้ไขรายการ' : 'เพิ่มรายการ'}>
      {open ? (
        <EntryForm
          key={editing?.id ?? 'new'}
          sources={sources}
          pots={pots}
          today={today}
          editing={editing}
          onSave={onSave}
          onDelete={onDelete}
          isSubmitting={isSubmitting}
        />
      ) : null}
    </BottomSheet>
  );
}
