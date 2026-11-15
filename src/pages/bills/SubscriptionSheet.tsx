import { useMemo, useState, type FormEvent } from 'react';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { CurrencyField } from '../../components/ui/CurrencyField';
import { HoldToDelete } from '../../components/ui/HoldToDelete';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { TextField } from '../../components/ui/TextField';
import { notify } from '../../components/ui/Toaster';
import { useDeleteSubscription, useUpsertSubscription } from '../../hooks/useFinance';
import type { FinanceData, Subscription } from '../../types/finance';
import { SelectField } from '../../components/ui/SelectField';
import { THAI_MONTHS_FULL, bahtToSatang, resolvePlayPot, satangToBaht } from './billsLogic';

export interface SubscriptionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: FinanceData;
  initial?: Subscription;
}

interface FormErrors {
  name?: string;
  amount?: string;
  billingDay?: string;
  billingMonth?: string;
  sourceId?: string;
}

function defaultSourceId(data: FinanceData, initial?: Subscription): string {
  if (initial) return initial.sourceId;
  const active = data.sources.filter((s) => !s.archived);
  return (
    active.find((s) => s.kind === 'credit_card')?.id ??
    active.find((s) => s.kind === 'paylater')?.id ??
    active[0]?.id ??
    ''
  );
}

function SubscriptionForm({
  data,
  initial,
  onClose,
}: {
  data: FinanceData;
  initial?: Subscription;
  onClose: () => void;
}) {
  const upsertSubscription = useUpsertSubscription();
  const deleteSubscription = useDeleteSubscription();
  const playPot = resolvePlayPot(data.pots);

  const [name, setName] = useState(initial?.name ?? '');
  const [amount, setAmount] = useState<number | null>(initial ? satangToBaht(initial.amount) : null);
  const [frequency, setFrequency] = useState<'monthly' | 'yearly'>(initial?.frequency ?? 'monthly');
  const [billingDayText, setBillingDayText] = useState(initial ? String(initial.billingDay) : '');
  const [billingMonthText, setBillingMonthText] = useState(
    initial?.billingMonth ? String(initial.billingMonth) : '1',
  );
  const [sourceId, setSourceId] = useState(() => defaultSourceId(data, initial));
  const [potId, setPotId] = useState<string>(() =>
    initial ? (initial.potId ?? '') : (playPot?.id ?? ''),
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);

  const sourceOptions = useMemo(
    () =>
      data.sources
        .filter((s) => !s.archived || s.id === initial?.sourceId)
        .map((s) => ({ value: s.id, label: s.name })),
    [data.sources, initial?.sourceId],
  );

  const potOptions = useMemo(
    () => [
      { value: '', label: 'ไม่นับรวมในก้อน' },
      ...data.pots.map((p) => ({ value: p.id, label: p.name })),
    ],
    [data.pots],
  );

  const monthOptions = useMemo(
    () => THAI_MONTHS_FULL.map((label, idx) => ({ value: String(idx + 1), label })),
    [],
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const nextErrors: FormErrors = {};
    const parsedDay = /^\d+$/.test(billingDayText.trim()) ? Number(billingDayText.trim()) : NaN;
    const parsedMonth = /^\d+$/.test(billingMonthText.trim()) ? Number(billingMonthText.trim()) : NaN;

    if (!name.trim()) nextErrors.name = 'กรุณากรอกชื่อสมาชิก';
    if (amount === null || amount <= 0) nextErrors.amount = 'กรุณากรอกยอดเงินที่มากกว่า 0';
    if (!Number.isInteger(parsedDay) || parsedDay < 1 || parsedDay > 31) {
      nextErrors.billingDay = 'กรุณากรอกวันตัดเงินระหว่าง 1 ถึง 31';
    }
    if (frequency === 'yearly' && (!Number.isInteger(parsedMonth) || parsedMonth < 1 || parsedMonth > 12)) {
      nextErrors.billingMonth = 'กรุณาเลือกเดือนที่ตัดเงิน';
    }
    if (!sourceId) nextErrors.sourceId = 'กรุณาเลือกช่องทาง';

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSaving(true);
    try {
      const saved = await upsertSubscription.mutateAsync({
        ...(initial ? { id: initial.id } : {}),
        name: name.trim(),
        amount: bahtToSatang(amount!),
        frequency,
        billingDay: parsedDay,
        billingMonth: frequency === 'yearly' ? parsedMonth : null,
        sourceId,
        potId: potId || null,
        active: initial?.active ?? true,
      });
      onClose();
      if (initial) {
        notify('แก้ไขสมาชิกแล้ว', {
          undo: () => {
            void upsertSubscription.mutateAsync(initial);
          },
        });
      } else {
        notify('บันทึกสมาชิกแล้ว', {
          undo: () => {
            void deleteSubscription.mutateAsync(saved.id);
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
      await deleteSubscription.mutateAsync(initial.id);
      onClose();
      notify('ลบสมาชิกแล้ว', {
        undo: () => {
          void upsertSubscription.mutateAsync(initial);
        },
      });
    } catch {
      notify('ลบไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <TextField
        label="ชื่อสมาชิก"
        placeholder="เช่น Claude, iCloud"
        value={name}
        error={errors.name}
        onChange={(e) => {
          setName(e.target.value);
          setErrors((prev) => ({ ...prev, name: undefined }));
        }}
      />

      <CurrencyField
        label="ยอดเงิน"
        value={amount}
        error={errors.amount}
        onChange={(v) => {
          setAmount(v);
          setErrors((prev) => ({ ...prev, amount: undefined }));
        }}
      />

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-text">รอบการตัดเงิน</span>
        <SegmentedControl
          label="รอบการตัดเงิน"
          options={[
            { value: 'monthly', label: 'รายเดือน' },
            { value: 'yearly', label: 'รายปี' },
          ]}
          value={frequency}
          onChange={(next) => {
            setFrequency(next);
            setErrors((prev) => ({ ...prev, billingMonth: undefined }));
          }}
        />
      </div>

      <TextField
        label="วันตัดเงิน (1–31)"
        inputMode="numeric"
        placeholder="เช่น 1"
        value={billingDayText}
        error={errors.billingDay}
        onChange={(e) => {
          setBillingDayText(e.target.value);
          setErrors((prev) => ({ ...prev, billingDay: undefined }));
        }}
      />

      {frequency === 'yearly' ? (
        <SelectField
          label="เดือนที่ตัดเงิน"
          options={monthOptions}
          value={billingMonthText}
          error={errors.billingMonth}
          onChange={(e) => {
            setBillingMonthText(e.target.value);
            setErrors((prev) => ({ ...prev, billingMonth: undefined }));
          }}
        />
      ) : null}

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

      <SelectField
        label="ก้อนเงิน"
        options={potOptions}
        value={potId}
        onChange={(e) => setPotId(e.target.value)}
      />

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

export function SubscriptionSheet({ open, onOpenChange, data, initial }: SubscriptionSheetProps) {
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={initial ? 'แก้ไขสมาชิก' : 'เพิ่มสมาชิก'}
    >
      {open ? (
        <SubscriptionForm
          key={initial?.id ?? 'new'}
          data={data}
          initial={initial}
          onClose={() => onOpenChange(false)}
        />
      ) : null}
    </BottomSheet>
  );
}
