import { useState } from 'react';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { CurrencyField } from '../../components/ui/CurrencyField';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { TextField } from '../../components/ui/TextField';
import type { Category, CreateTransactionInput, ISODate, PaymentSource, Pot, Satang } from '../../types/finance';

const NO_POT_VALUE = '__none__';

const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'food', label: 'อาหาร' },
  { value: 'transport', label: 'เดินทาง' },
  { value: 'shopping', label: 'ช้อปปิ้ง' },
  { value: 'entertainment', label: 'บันเทิง' },
  { value: 'health', label: 'สุขภาพ' },
  { value: 'bills', label: 'บิล' },
  { value: 'other', label: 'อื่นๆ' },
];

function bahtToSatang(baht: number): Satang {
  // toPrecision(15) cancels binary float drift before rounding to whole satang.
  return Math.round(Number((baht * 100).toPrecision(15)));
}

interface QuickAddFormProps {
  today: ISODate;
  sources: PaymentSource[];
  pots: Pot[];
  defaultPotId: string | null;
  onSubmit: (input: CreateTransactionInput) => Promise<void>;
}

function QuickAddForm({ today, sources, pots, defaultPotId, onSubmit }: QuickAddFormProps) {
  const defaultSource = sources.find((s) => s.kind === 'bank') ?? sources[0];
  const [amount, setAmount] = useState<number | null>(null);
  const [sourceId, setSourceId] = useState<string>(defaultSource?.id ?? '');
  const [potValue, setPotValue] = useState<string>(defaultPotId ?? NO_POT_VALUE);
  const [category, setCategory] = useState<Category>('food');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  const sourceOptions = sources.map((s) => ({ value: s.id, label: s.name }));
  const potOptions = [
    ...pots.map((p) => ({ value: p.id, label: p.name })),
    { value: NO_POT_VALUE, label: 'แยก' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (amount === null || amount <= 0) {
      setError('กรอกจำนวนเงินให้ถูกต้อง');
      return;
    }
    const satang = bahtToSatang(amount);
    if (satang <= 0) {
      setError('กรอกจำนวนเงินให้ถูกต้อง');
      return;
    }

    setSubmitting(true);
    setError(undefined);
    try {
      await onSubmit({
        date: today,
        amount: satang,
        direction: 'out',
        sourceId,
        potId: potValue === NO_POT_VALUE ? null : potValue,
        category,
        note: note.trim(),
      });
    } catch {
      setError('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง');
      setSubmitting(false);
    }
  };

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <CurrencyField
        label="จำนวนเงิน"
        value={amount}
        error={error}
        onChange={(v) => {
          setAmount(v);
          setError(undefined);
        }}
      />

      {sourceOptions.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-text">ช่องทางจ่าย</span>
          <SegmentedControl label="ช่องทางจ่าย" options={sourceOptions} value={sourceId} onChange={setSourceId} />
        </div>
      ) : null}

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

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-text">หมวดหมู่</span>
        <div role="group" aria-label="หมวดหมู่" className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => {
            const selected = cat.value === category;
            return (
              <button
                key={cat.value}
                type="button"
                aria-pressed={selected}
                onClick={() => setCategory(cat.value)}
                className={[
                  'pressable min-h-tap rounded-pill px-3 text-sm font-medium',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2',
                  selected ? 'bg-accent text-on-accent' : 'bg-stone-bg text-stone-ink hover-fine:hover:opacity-80',
                ].join(' ')}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      <TextField
        label="โน้ต (ไม่บังคับ)"
        value={note}
        placeholder="เช่น ชานม, ข้าวเที่ยง"
        onChange={(e) => setNote(e.target.value)}
      />

      <Button type="submit" variant="primary" size="lg" loading={submitting}>
        บันทึก
      </Button>
    </form>
  );
}

export interface QuickAddSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  today: ISODate;
  sources: PaymentSource[];
  pots: Pot[];
  defaultPotId: string | null;
  onSubmit: (input: CreateTransactionInput) => Promise<void>;
}

export function QuickAddSheet({
  open,
  onOpenChange,
  today,
  sources,
  pots,
  defaultPotId,
  onSubmit,
}: QuickAddSheetProps) {
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title="เพิ่มรายการ">
      {open ? (
        <QuickAddForm
          today={today}
          sources={sources}
          pots={pots}
          defaultPotId={defaultPotId}
          onSubmit={onSubmit}
        />
      ) : null}
    </BottomSheet>
  );
}
