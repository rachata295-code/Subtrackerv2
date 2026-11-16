import { useMemo, useState, type FormEvent } from 'react';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { CurrencyField } from '../../components/ui/CurrencyField';
import { HoldToDelete } from '../../components/ui/HoldToDelete';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { TextField } from '../../components/ui/TextField';
import { notify } from '../../components/ui/Toaster';
import { useDraft } from '../../hooks/useDraft';
import { useDeleteSubscription, useUpsertSubscription } from '../../hooks/useFinance';
import type { FinanceData, Subscription } from '../../types/finance';
import { SelectField } from '../../components/ui/SelectField';
import {
  THAI_MONTHS_FULL,
  bahtToSatang,
  formatRepoError,
  resolvePlayPot,
  satangToBaht,
} from './billsLogic';

export interface SubscriptionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: FinanceData;
  initial?: Subscription;
}

const SUBSCRIPTION_DRAFT_KEY = 'subscription';

interface FormErrors {
  name?: string;
  amount?: string;
  billingDay?: string;
  billingMonth?: string;
  sourceId?: string;
}

interface SubscriptionDraftState {
  name: string;
  amount: number | null;
  frequency: 'monthly' | 'yearly';
  billingDayText: string;
  billingMonthText: string;
  sourceId: string;
  potId: string;
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
  const fallbackSourceId = defaultSourceId(data, initial);

  const [draft, setDraft, clearDraft] = useDraft<SubscriptionDraftState>(
    SUBSCRIPTION_DRAFT_KEY,
    () => ({
      name: initial?.name ?? '',
      amount: initial ? satangToBaht(initial.amount) : null,
      frequency: initial?.frequency ?? 'monthly',
      billingDayText: initial ? String(initial.billingDay) : '',
      billingMonthText: initial?.billingMonth ? String(initial.billingMonth) : '1',
      sourceId: fallbackSourceId,
      potId: initial ? (initial.potId ?? '') : (playPot?.id ?? ''),
    }),
    { enabled: !initial },
  );

  const { name, amount, frequency, billingDayText, billingMonthText, potId } = draft;
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);

  const sourceOptions = useMemo(
    () =>
      data.sources
        .filter((s) => !s.archived || s.id === initial?.sourceId)
        .map((s) => ({ value: s.id, label: s.name })),
    [data.sources, initial?.sourceId],
  );

  const sourceId = sourceOptions.some((o) => o.value === draft.sourceId)
    ? draft.sourceId
    : fallbackSourceId;

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
      if (!initial) {
        clearDraft();
      }
      onClose();
      if (initial) {
        notify('แก้ไขสมาชิกแล้ว', {
          undo: () => {
            void upsertSubscription.mutateAsync(initial).catch((err) => {
              notify(formatRepoError('เลิกทำไม่สำเร็จ', err, 'เลิกทำไม่สำเร็จ'));
            });
          },
        });
      } else {
        notify('บันทึกสมาชิกแล้ว', {
          undo: () => {
            void deleteSubscription.mutateAsync(saved.id).catch((err) => {
              notify(formatRepoError('เลิกทำไม่สำเร็จ', err, 'เลิกทำไม่สำเร็จ'));
            });
          },
        });
      }
    } catch (err) {
      notify(formatRepoError('บันทึกไม่สำเร็จ', err, 'บันทึกไม่สำเร็จ กรุณาลองใหม่'));
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
          void upsertSubscription.mutateAsync(initial).catch((err) => {
            notify(formatRepoError('เลิกทำไม่สำเร็จ', err, 'เลิกทำไม่สำเร็จ'));
          });
        },
      });
    } catch (err) {
      notify(formatRepoError('ลบไม่สำเร็จ', err, 'ลบไม่สำเร็จ กรุณาลองใหม่'));
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
          setDraft((prev) => ({ ...prev, name: e.target.value }));
          setErrors((prev) => ({ ...prev, name: undefined }));
        }}
      />

      <CurrencyField
        label="ยอดเงิน"
        value={amount}
        error={errors.amount}
        onChange={(v) => {
          setDraft((prev) => ({ ...prev, amount: v }));
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
            setDraft((prev) => ({ ...prev, frequency: next }));
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
          setDraft((prev) => ({ ...prev, billingDayText: e.target.value }));
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
            setDraft((prev) => ({ ...prev, billingMonthText: e.target.value }));
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
          setDraft((prev) => ({ ...prev, sourceId: e.target.value }));
          setErrors((prev) => ({ ...prev, sourceId: undefined }));
        }}
      />

      <SelectField
        label="ก้อนเงิน"
        options={potOptions}
        value={potId}
        onChange={(e) => setDraft((prev) => ({ ...prev, potId: e.target.value }))}
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
