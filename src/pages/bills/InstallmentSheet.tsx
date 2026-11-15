import { useMemo, useState, type FormEvent } from 'react';
import { formatTHB } from '../../lib/money';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { CurrencyField } from '../../components/ui/CurrencyField';
import { HoldToDelete } from '../../components/ui/HoldToDelete';
import { Switch } from '../../components/ui/Switch';
import { TextField } from '../../components/ui/TextField';
import { notify } from '../../components/ui/Toaster';
import { useDeleteInstallment, useUpsertInstallment } from '../../hooks/useFinance';
import type { FinanceData, ISODate, Installment } from '../../types/finance';
import { SelectField } from '../../components/ui/SelectField';
import {
  bahtToSatang,
  findOverPeriodsForInstallment,
  formatStatementKeyThai,
  isValidIsoDate,
  resolvePlayPot,
  satangToBaht,
} from './billsLogic';

export interface InstallmentSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: FinanceData;
  today: ISODate;
  initial?: Installment;
}

interface FormErrors {
  name?: string;
  amount?: string;
  count?: string;
  firstChargeDate?: string;
  sourceId?: string;
}

function defaultSourceId(data: FinanceData, initial?: Installment): string {
  if (initial) return initial.sourceId;
  const active = data.sources.filter((s) => !s.archived);
  return (
    active.find((s) => s.kind === 'paylater')?.id ??
    active.find((s) => s.kind === 'credit_card')?.id ??
    active[0]?.id ??
    ''
  );
}

function InstallmentForm({
  data,
  today,
  initial,
  onClose,
}: {
  data: FinanceData;
  today: ISODate;
  initial?: Installment;
  onClose: () => void;
}) {
  const upsertInstallment = useUpsertInstallment();
  const deleteInstallment = useDeleteInstallment();
  const playPot = resolvePlayPot(data.pots);

  const [name, setName] = useState(initial?.name ?? '');
  const [amount, setAmount] = useState<number | null>(
    initial ? satangToBaht(initial.perInstallment) : null,
  );
  const [countText, setCountText] = useState(initial ? String(initial.count) : '');
  const [firstChargeDate, setFirstChargeDate] = useState(initial?.firstChargeDate ?? today);
  const [sourceId, setSourceId] = useState(() => defaultSourceId(data, initial));
  const [countInPlayPot, setCountInPlayPot] = useState(initial ? initial.potId !== null : true);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);

  const sourceOptions = useMemo(
    () =>
      data.sources
        .filter((s) => !s.archived || s.id === initial?.sourceId)
        .map((s) => ({ value: s.id, label: s.name })),
    [data.sources, initial?.sourceId],
  );

  const parsedCount = /^\d+$/.test(countText.trim()) ? Number(countText.trim()) : NaN;
  const resolvedPotId = countInPlayPot ? (playPot?.id ?? null) : null;

  // Simulate potStatus across all touched pay periods before saving so the user sees any over-budget impact live.
  const overPeriods = useMemo(() => {
    if (!playPot || resolvedPotId !== playPot.id) return [];
    if (amount === null || amount <= 0) return [];
    if (!Number.isInteger(parsedCount) || parsedCount < 1 || parsedCount > 120) return [];
    if (!isValidIsoDate(firstChargeDate) || !sourceId) return [];

    const candidate: Installment = {
      id: initial?.id ?? '__draft__',
      name: name.trim() || 'รายการใหม่',
      perInstallment: bahtToSatang(amount),
      count: parsedCount,
      firstChargeDate,
      sourceId,
      potId: playPot.id,
    };
    return findOverPeriodsForInstallment(data, playPot, candidate, initial?.id);
  }, [amount, data, firstChargeDate, initial?.id, name, parsedCount, playPot, resolvedPotId, sourceId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const nextErrors: FormErrors = {};
    if (!name.trim()) nextErrors.name = 'กรุณากรอกชื่อรายการ';
    if (amount === null || amount <= 0) nextErrors.amount = 'กรุณากรอกยอดต่องวดที่มากกว่า 0';
    if (!Number.isInteger(parsedCount) || parsedCount < 1 || parsedCount > 120) {
      nextErrors.count = 'กรุณากรอกจำนวนงวด 1 ถึง 120';
    }
    if (!isValidIsoDate(firstChargeDate)) nextErrors.firstChargeDate = 'กรุณาเลือกวันที่งวดแรกให้ถูกต้อง';
    if (!sourceId) nextErrors.sourceId = 'กรุณาเลือกช่องทาง';

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSaving(true);
    try {
      const saved = await upsertInstallment.mutateAsync({
        ...(initial ? { id: initial.id } : {}),
        name: name.trim(),
        perInstallment: bahtToSatang(amount!),
        count: parsedCount,
        firstChargeDate,
        sourceId,
        potId: resolvedPotId,
      });
      onClose();
      if (initial) {
        notify('แก้ไขรายการผ่อนแล้ว', {
          undo: () => {
            void upsertInstallment.mutateAsync(initial);
          },
        });
      } else {
        notify('บันทึกรายการผ่อนแล้ว', {
          undo: () => {
            void deleteInstallment.mutateAsync(saved.id);
          },
        });
      }
    } catch {
      notify('บันทึกไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!initial || saving) return;
    setSaving(true);
    try {
      await deleteInstallment.mutateAsync(initial.id);
      onClose();
      notify('ลบรายการผ่อนแล้ว', {
        undo: () => {
          void upsertInstallment.mutateAsync(initial);
        },
      });
    } catch {
      notify('ลบไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setSaving(false);
    }
  };

  const firstOver = overPeriods[0];

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <TextField
        label="ชื่อรายการ"
        placeholder="เช่น AirPods"
        value={name}
        error={errors.name}
        onChange={(e) => {
          setName(e.target.value);
          setErrors((prev) => ({ ...prev, name: undefined }));
        }}
      />

      <CurrencyField
        label="ยอดต่องวด"
        value={amount}
        error={errors.amount}
        onChange={(v) => {
          setAmount(v);
          setErrors((prev) => ({ ...prev, amount: undefined }));
        }}
      />

      <TextField
        label="จำนวนงวด"
        inputMode="numeric"
        placeholder="เช่น 10"
        value={countText}
        error={errors.count}
        onChange={(e) => {
          setCountText(e.target.value);
          setErrors((prev) => ({ ...prev, count: undefined }));
        }}
      />

      <TextField
        label="วันที่งวดแรก"
        type="date"
        value={firstChargeDate}
        error={errors.firstChargeDate}
        onChange={(e) => {
          setFirstChargeDate(e.target.value);
          setErrors((prev) => ({ ...prev, firstChargeDate: undefined }));
        }}
      />

      <SelectField
        label="ช่องทาง"
        options={sourceOptions}
        value={sourceId}
        error={errors.sourceId}
        onChange={(e) => {
          setSourceId(e.target.value);
          setErrors((prev) => ({ ...prev, sourceId: undefined }));
        }}
      />

      <Switch
        label="นับรวมในวงเงินใช้ตามใจ"
        checked={countInPlayPot}
        disabled={!playPot}
        onChange={setCountInPlayPot}
      />

      {firstOver && playPot ? (
        <div role="alert" className="rounded-tile border border-warning bg-surface p-3 text-sm text-warning">
          <p className="font-medium">คำเตือน: จะทำให้ก้อน &ldquo;{playPot.name}&rdquo; เกินงบ</p>
          <p className="mt-0.5 tabular-nums">
            รอบ {formatStatementKeyThai(firstOver.period.key)} เกินงบ{' '}
            {formatTHB(satangToBaht(Math.abs(firstOver.status.left)))}
            {overPeriods.length > 1 ? ` (และอีก ${overPeriods.length - 1} รอบ)` : ''}
          </p>
        </div>
      ) : null}

      <Button type="submit" variant="primary" size="lg" loading={saving}>
        บันทึก
      </Button>

      {initial ? (
        // Stop pointer events from reaching Vaul's drawer drag handler during a 1.2s destructive hold.
        <div
          data-vaul-no-drag
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
        >
          <HoldToDelete onConfirm={handleDelete} />
        </div>
      ) : null}
    </form>
  );
}

export function InstallmentSheet({ open, onOpenChange, data, today, initial }: InstallmentSheetProps) {
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={initial ? 'แก้ไขรายการผ่อน' : 'เพิ่มรายการผ่อน'}
    >
      {/* Mount form only while open so inputs and validation reset cleanly on every open. */}
      {open ? (
        <InstallmentForm
          key={initial?.id ?? 'new'}
          data={data}
          today={today}
          initial={initial}
          onClose={() => onOpenChange(false)}
        />
      ) : null}
    </BottomSheet>
  );
}
