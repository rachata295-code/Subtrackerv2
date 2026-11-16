import { useState, type FormEvent } from 'react';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { CurrencyField } from '../../components/ui/CurrencyField';
import { HoldToDelete } from '../../components/ui/HoldToDelete';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { SelectField } from '../../components/ui/SelectField';
import { TextField } from '../../components/ui/TextField';
import { useDraft } from '../../hooks/useDraft';
import {
  CATEGORY_LABELS,
  OUT_CATEGORIES,
  type Category,
  type FinanceData,
  type ISODate,
  type PeriodKey,
  type PlanItem,
  type UpsertPlanItemInput,
} from '../../types/finance';
import { bahtToSatang, findDuplicateBillMatch, isValidISODate } from './planUtils';

export interface PlanItemSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: FinanceData;
  periodKey: PeriodKey;
  defaultSourceId: string;
  editing: PlanItem | null;
  isSubmitting?: boolean;
  onSave: (input: UpsertPlanItemInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const PLAN_ITEM_DRAFT_KEY = 'plan-item';

const KIND_OPTIONS: { value: 'pay' | 'save'; label: string }[] = [
  { value: 'pay', label: 'ต้องจ่าย' },
  { value: 'save', label: 'เก็บเงิน' },
];

const PLAN_PAY_CATEGORIES = OUT_CATEGORIES.filter((c) => c !== 'savings' && c !== 'unknown');

interface PlanItemDraftState {
  kind: 'pay' | 'save';
  name: string;
  amountBaht: number | null;
  sourceId: string;
  category: Category;
  dueOn: string;
}

function PlanItemForm({
  data,
  periodKey,
  defaultSourceId,
  editing,
  isSubmitting,
  onSave,
  onDelete,
}: Omit<PlanItemSheetProps, 'open' | 'onOpenChange'>) {
  // SPEC §5 C5: PlanItems may only use bank accounts (credit cards / paylater are billed automatically).
  const bankSources = data.sources.filter((s) => s.kind === 'bank' && (!s.archived || s.id === editing?.sourceId));
  const sourceOptions = bankSources.map((s) => ({ value: s.id, label: s.name }));
  const fallbackSourceId = editing?.sourceId ?? defaultSourceId ?? bankSources[0]?.id ?? '';

  const [draft, setDraft, clearDraft] = useDraft<PlanItemDraftState>(
    PLAN_ITEM_DRAFT_KEY,
    () => ({
      kind: editing?.kind ?? 'pay',
      name: editing?.name ?? '',
      amountBaht: editing ? editing.amount / 100 : null,
      sourceId: fallbackSourceId,
      category: editing?.kind === 'pay' ? editing.category : 'bills',
      dueOn: editing?.dueOn ?? '',
    }),
    { enabled: !editing },
  );

  const { kind, name, amountBaht, category, dueOn } = draft;
  const sourceId = bankSources.some((s) => s.id === draft.sourceId) ? draft.sourceId : fallbackSourceId;

  const [nameError, setNameError] = useState<string>();
  const [amountError, setAmountError] = useState<string>();
  const [dueOnError, setDueOnError] = useState<string>();

  const duplicateMatch = findDuplicateBillMatch(name, data);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    let valid = true;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError('กรอกชื่อรายการ');
      valid = false;
    }
    if (amountBaht === null || bahtToSatang(amountBaht) <= 0) {
      setAmountError('กรอกจำนวนเงินให้ถูกต้อง');
      valid = false;
    }
    const trimmedDue = dueOn.trim();
    let resolvedDue: ISODate | null = null;
    if (trimmedDue !== '') {
      if (!isValidISODate(trimmedDue)) {
        setDueOnError('กรอกวันที่ให้ถูกต้อง');
        valid = false;
      } else {
        resolvedDue = trimmedDue;
      }
    }

    if (!valid) return;

    await onSave({
      ...(editing ? { id: editing.id } : {}),
      periodKey: editing?.periodKey ?? periodKey,
      name: trimmedName,
      amount: bahtToSatang(amountBaht!),
      kind,
      sourceId,
      dueOn: resolvedDue,
      category: kind === 'save' ? 'savings' : category,
    });
    if (!editing) {
      clearDraft();
    }
  };

  return (
    <form noValidate className="flex flex-col gap-4 pb-2" onSubmit={(e) => void handleSubmit(e)}>
      <SegmentedControl
        label="ประเภทแผน"
        options={KIND_OPTIONS}
        value={kind}
        onChange={(next) => setDraft((prev) => ({ ...prev, kind: next }))}
      />

      <div>
        <TextField
          label="ชื่อรายการ"
          placeholder={kind === 'save' ? 'เช่น เก็บเงินออม' : 'เช่น ค่าหอ, ค่าเน็ต'}
          value={name}
          error={nameError}
          onChange={(e) => {
            setDraft((prev) => ({ ...prev, name: e.target.value }));
            setNameError(undefined);
          }}
        />
        {duplicateMatch ? (
          <p className="mt-1.5 rounded-tile bg-apricot-bg px-3 py-2 text-xs text-apricot-ink">
            {`ชื่อนี้คล้ายกับบิลอัตโนมัติ "${duplicateMatch}" (บิลบัตร/ผ่อนถูกนับให้อัตโนมัติแล้ว)`}
          </p>
        ) : null}
      </div>

      <CurrencyField
        label="จำนวนเงิน"
        value={amountBaht}
        error={amountError}
        onChange={(v) => {
          setDraft((prev) => ({ ...prev, amountBaht: v }));
          setAmountError(undefined);
        }}
      />

      <SelectField
        label="จากบัญชี"
        options={sourceOptions}
        value={sourceId}
        onChange={(e) => setDraft((prev) => ({ ...prev, sourceId: e.target.value }))}
      />

      {kind === 'pay' ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-text">หมวดหมู่เมื่อจ่ายแล้ว</span>
          <div className="flex flex-wrap gap-2" role="group" aria-label="หมวดหมู่">
            {PLAN_PAY_CATEGORIES.map((cat) => {
              const selected = cat === category;
              return (
                <button
                  key={cat}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setDraft((prev) => ({ ...prev, category: cat }))}
                  className={[
                    'pressable min-h-tap rounded-pill px-3 text-sm font-medium',
                    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2',
                    selected ? 'bg-accent text-on-accent' : 'bg-stone-bg text-stone-ink hover-fine:hover:opacity-80',
                  ].join(' ')}
                >
                  {CATEGORY_LABELS[cat]}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <TextField
        label="วันที่ครบกำหนด (ไม่บังคับ)"
        type="date"
        value={dueOn}
        error={dueOnError}
        onChange={(e) => {
          setDraft((prev) => ({ ...prev, dueOn: e.target.value }));
          setDueOnError(undefined);
        }}
      />

      <Button type="submit" variant="primary" size="lg" loading={isSubmitting}>
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

export function PlanItemSheet({
  open,
  onOpenChange,
  data,
  periodKey,
  defaultSourceId,
  editing,
  isSubmitting,
  onSave,
  onDelete,
}: PlanItemSheetProps) {
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={editing ? 'แก้ไขแผน' : 'เพิ่มแผนรอบนี้'}>
      {open ? (
        <PlanItemForm
          key={editing?.id ?? 'new-plan-item'}
          data={data}
          periodKey={periodKey}
          defaultSourceId={defaultSourceId}
          editing={editing}
          isSubmitting={isSubmitting}
          onSave={onSave}
          onDelete={onDelete}
        />
      ) : null}
    </BottomSheet>
  );
}
