import { useState, type FormEvent } from 'react';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { CurrencyField } from '../../components/ui/CurrencyField';
import { HoldToDelete } from '../../components/ui/HoldToDelete';
import { SelectField } from '../../components/ui/SelectField';
import { Switch } from '../../components/ui/Switch';
import { TextField } from '../../components/ui/TextField';
import type { FinanceData, RecurringIncome, UpsertRecurringIncomeInput } from '../../types/finance';
import { parseDayOfMonth } from './settingsUtils';

export interface RecurringIncomeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: FinanceData;
  editing: RecurringIncome | null;
  onSave: (input: UpsertRecurringIncomeInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isSubmitting?: boolean;
}

function RecurringIncomeForm({
  data,
  editing,
  onSave,
  onDelete,
  isSubmitting,
}: Omit<RecurringIncomeSheetProps, 'open' | 'onOpenChange'>) {
  const bankSources = data.sources.filter(
    (s) => s.kind === 'bank' && (!s.archived || s.id === editing?.sourceId),
  );
  const sourceOptions = bankSources.map((s) => ({ value: s.id, label: s.name }));

  const [name, setName] = useState(editing?.name ?? '');
  const [amountBaht, setAmountBaht] = useState<number | null>(editing ? editing.amount / 100 : null);
  const [dayText, setDayText] = useState(editing ? String(editing.dayOfMonth) : '');
  const [sourceId, setSourceId] = useState(editing?.sourceId ?? bankSources[0]?.id ?? '');
  const [active, setActive] = useState(editing?.active ?? true);

  const [nameError, setNameError] = useState<string>();
  const [amountError, setAmountError] = useState<string>();
  const [dayError, setDayError] = useState<string>();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    let valid = true;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError('กรอกชื่อรายการ');
      valid = false;
    }

    const amountSatang = amountBaht !== null ? Math.round(Number((amountBaht * 100).toPrecision(15))) : 0;
    if (amountBaht === null || amountSatang <= 0) {
      setAmountError('กรอกจำนวนเงินให้ถูกต้อง');
      valid = false;
    }

    const parsedDay = parseDayOfMonth(dayText);
    if (parsedDay === null) {
      setDayError('กรุณาระบุวันที่ 1–31');
      valid = false;
    }

    if (!valid || !sourceId) return;

    await onSave({
      ...(editing ? { id: editing.id } : {}),
      name: trimmedName,
      amount: amountSatang,
      dayOfMonth: parsedDay!,
      sourceId,
      active,
    });
  };

  return (
    <form noValidate className="flex flex-col gap-4 pb-2" onSubmit={(e) => void handleSubmit(e)}>
      <TextField
        label="ชื่อรายการ"
        placeholder="เช่น เงินจากแม่"
        value={name}
        error={nameError}
        onChange={(e) => {
          setName(e.target.value);
          setNameError(undefined);
        }}
      />

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
        label="วันที่เข้าของเดือน (1–31)"
        inputMode="numeric"
        placeholder="เช่น 10 หรือ 24"
        value={dayText}
        error={dayError}
        onChange={(e) => {
          setDayText(e.target.value);
          setDayError(undefined);
        }}
      />

      <SelectField
        label="เข้าบัญชี"
        options={sourceOptions}
        value={sourceId}
        onChange={(e) => setSourceId(e.target.value)}
      />

      <Switch label="เปิดใช้งาน" checked={active} onChange={setActive} />

      <Button type="submit" variant="primary" size="lg" loading={isSubmitting} disabled={sourceOptions.length === 0}>
        บันทึก
      </Button>

      {editing ? (
        <HoldToDelete
          label="กดค้างเพื่อลบ"
          onConfirm={() => {
            void onDelete(editing.id);
          }}
        />
      ) : null}
    </form>
  );
}

export function RecurringIncomeSheet({
  open,
  onOpenChange,
  data,
  editing,
  onSave,
  onDelete,
  isSubmitting,
}: RecurringIncomeSheetProps) {
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={editing ? 'แก้ไขเงินประจำ' : 'เพิ่มเงินประจำ'}>
      {open ? (
        <RecurringIncomeForm
          key={editing?.id ?? 'new-recurring-income'}
          data={data}
          editing={editing}
          onSave={onSave}
          onDelete={onDelete}
          isSubmitting={isSubmitting}
        />
      ) : null}
    </BottomSheet>
  );
}
