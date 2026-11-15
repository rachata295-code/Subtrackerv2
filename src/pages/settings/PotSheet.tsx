import { useState, type FormEvent } from 'react';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { CurrencyField } from '../../components/ui/CurrencyField';
import { HoldToDelete } from '../../components/ui/HoldToDelete';
import { Switch } from '../../components/ui/Switch';
import { TextField } from '../../components/ui/TextField';
import type { Hue } from '../../components/ui/hue';
import type { FinanceData, Pot, UpsertPotInput } from '../../types/finance';
import { HueSwatches } from './HueSwatches';
import { hasLinkedPotRecords, pickAvailableHue } from './settingsUtils';

export interface PotSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: FinanceData;
  editing: Pot | null;
  onSave: (input: UpsertPotInput) => Promise<void>;
  onDelete: (potId: string) => Promise<void>;
  isSubmitting?: boolean;
}

function PotForm({
  data,
  editing,
  onSave,
  onDelete,
  isSubmitting,
}: Omit<PotSheetProps, 'open' | 'onOpenChange'>) {
  const usedHues = data.pots.filter((p) => p.id !== editing?.id).map((p) => p.hue);

  const [name, setName] = useState(editing?.name ?? '');
  const [perPeriod, setPerPeriod] = useState<number | null>(editing ? editing.perPeriod / 100 : null);
  const [rollover, setRollover] = useState(editing?.rollover ?? false);
  const [hue, setHue] = useState<Hue>(editing?.hue ?? pickAvailableHue(usedHues));

  const [nameError, setNameError] = useState<string>();
  const [amountError, setAmountError] = useState<string>();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    let valid = true;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError('กรอกชื่อก้อนเงิน');
      valid = false;
    }
    if (perPeriod === null || perPeriod <= 0) {
      setAmountError('กรอกจำนวนเงินให้ถูกต้อง');
      valid = false;
    }
    if (!valid) return;

    await onSave({
      ...(editing ? { id: editing.id } : {}),
      name: trimmedName,
      perPeriod: Math.round(perPeriod! * 100),
      rollover,
      hue,
    });
  };

  const linked = editing ? hasLinkedPotRecords(editing.id, data) : false;

  return (
    <form noValidate className="flex flex-col gap-4 pb-2" onSubmit={(e) => void handleSubmit(e)}>
      <TextField
        label="ชื่อก้อนเงิน"
        placeholder="เช่น ใช้ตามใจ, ออม"
        value={name}
        error={nameError}
        onChange={(e) => {
          setName(e.target.value);
          setNameError(undefined);
        }}
      />

      <CurrencyField
        label="งบต่อรอบ"
        value={perPeriod}
        error={amountError}
        onChange={(v) => {
          setPerPeriod(v);
          setAmountError(undefined);
        }}
      />

      <Switch label="ยกยอดคงเหลือไปรอบถัดไป" checked={rollover} onChange={setRollover} />

      <HueSwatches value={hue} usedHues={usedHues} onChange={setHue} />

      <Button type="submit" variant="primary" size="lg" loading={isSubmitting}>
        บันทึก
      </Button>

      {editing ? (
        linked ? (
          <p className="text-center text-sm text-muted">ก้อนเงินนี้มีรายการผูกอยู่ ไม่สามารถลบได้</p>
        ) : (
          <HoldToDelete
            label="กดค้างเพื่อลบ"
            onConfirm={() => {
              void onDelete(editing.id);
            }}
          />
        )
      ) : null}
    </form>
  );
}

export function PotSheet({
  open,
  onOpenChange,
  data,
  editing,
  onSave,
  onDelete,
  isSubmitting,
}: PotSheetProps) {
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={editing ? 'แก้ไขก้อนเงิน' : 'เพิ่มก้อนเงิน'}>
      {open ? (
        <PotForm
          key={editing?.id ?? 'new-pot'}
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
