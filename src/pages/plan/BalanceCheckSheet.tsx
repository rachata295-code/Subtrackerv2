import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { CurrencyField } from '../../components/ui/CurrencyField';
import { ListRow } from '../../components/ui/ListRow';
import { Money } from '../../components/ui/Money';
import { TextField } from '../../components/ui/TextField';
import { notify } from '../../components/ui/Toaster';
import { hotbarItems } from '../../domain';
import { useCreateBalanceCheck, useCreateTransaction } from '../../hooks/useFinance';
import { formatTHB } from '../../lib/money';
import {
  CATEGORY_LABELS,
  IN_CATEGORIES,
  OUT_CATEGORIES,
  type Category,
  type FinanceData,
  type HotbarItem,
  type ISODate,
  type PaymentSource,
  type Satang,
} from '../../types/finance';
import {
  bahtToSatang,
  formatThaiFullDate,
  formatThaiShortDate,
  getErrorMessage,
  isNotImplementedError,
  isValidISODate,
} from './planUtils';

export interface BalanceCheckSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: FinanceData;
  bank: PaymentSource;
  expected: Satang | null;
  latestCheckedOn: ISODate | null;
  today: ISODate;
}

const EXPENSE_QUICK_CATEGORIES = OUT_CATEGORIES.filter((c) => c !== 'savings' && c !== 'unknown');

interface QuickMissedFormProps {
  mode: 'out' | 'in';
  initialAmountBaht: number | null;
  today: ISODate;
  latestCheckedOn: ISODate | null;
  sourceId: string;
  defaultPotId: string | null;
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmitDone: () => void;
}

function QuickMissedForm({
  mode,
  initialAmountBaht,
  today,
  latestCheckedOn,
  sourceId,
  defaultPotId,
  isSubmitting,
  onCancel,
  onSubmitDone,
}: QuickMissedFormProps) {
  const createTransaction = useCreateTransaction();
  const [amountBaht, setAmountBaht] = useState<number | null>(initialAmountBaht);
  const [date, setDate] = useState<ISODate>(today);
  const [category, setCategory] = useState<Category>(mode === 'in' ? 'parttime' : 'food');
  const [note, setNote] = useState('');
  const [amountError, setAmountError] = useState<string>();
  const [dateError, setDateError] = useState<string>();

  const categories = mode === 'in' ? IN_CATEGORIES : EXPENSE_QUICK_CATEGORIES;
  const beforeLastCheck = Boolean(latestCheckedOn && isValidISODate(date) && date < latestCheckedOn);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    let valid = true;
    if (amountBaht === null || bahtToSatang(amountBaht) <= 0) {
      setAmountError('กรอกจำนวนเงินให้ถูกต้อง');
      valid = false;
    }
    if (!isValidISODate(date)) {
      setDateError('กรอกวันที่ให้ถูกต้อง');
      valid = false;
    }
    if (!valid) return;

    try {
      await createTransaction.mutateAsync({
        date,
        amount: bahtToSatang(amountBaht!),
        direction: mode,
        sourceId,
        potId: mode === 'out' ? defaultPotId : null,
        category,
        note: note.trim(),
      });
      notify(mode === 'in' ? 'บันทึกเงินเข้าแล้ว' : 'บันทึกแล้ว');
      onSubmitDone();
    } catch (err) {
      toast.error(getErrorMessage(err, 'บันทึกรายการไม่สำเร็จ'));
    }
  };

  return (
    <form
      noValidate
      className="flex flex-col gap-3 rounded-tile border border-border bg-raised p-3"
      onSubmit={(e) => void handleSubmit(e)}
    >
      <CurrencyField
        label={mode === 'in' ? 'จำนวนเงินเข้า' : 'จำนวนเงินที่ลืม'}
        value={amountBaht}
        error={amountError}
        onChange={(v) => {
          setAmountBaht(v);
          setAmountError(undefined);
        }}
      />
      <TextField
        label="วันที่"
        type="date"
        value={date}
        error={dateError}
        onChange={(e) => {
          setDate(e.target.value);
          setDateError(undefined);
        }}
      />
      {beforeLastCheck ? (
        <p className="text-xs text-warning">รายการนี้อยู่ก่อนเช็กยอดล่าสุด จึงไม่เปลี่ยนยอดบัญชี</p>
      ) : null}

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="หมวดหมู่">
        {categories.map((cat) => {
          const selected = cat === category;
          return (
            <button
              key={cat}
              type="button"
              aria-pressed={selected}
              onClick={() => setCategory(cat)}
              className={[
                'pressable min-h-tap rounded-pill px-3 text-xs font-medium',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2',
                selected ? 'bg-accent text-on-accent' : 'bg-stone-bg text-stone-ink hover-fine:hover:opacity-80',
              ].join(' ')}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          );
        })}
      </div>

      <TextField
        label="โน้ต"
        placeholder={mode === 'in' ? 'เช่น ค่าพาร์ทไทม์, คืนเงิน' : 'เช่น กาแฟ, ข้าวเที่ยง'}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      <div className="flex items-center gap-2">
        <Button type="submit" variant="secondary" loading={isSubmitting || createTransaction.isPending}>
          {mode === 'in' ? 'บันทึกเงินเข้า' : 'เพิ่มรายจ่าย'}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          ยกเลิก
        </Button>
      </div>
    </form>
  );
}

function BalanceCheckForm({
  data,
  bank,
  expected,
  latestCheckedOn,
  today,
  onClose,
}: Omit<BalanceCheckSheetProps, 'open' | 'onOpenChange'> & { onClose: () => void }) {
  const createBalanceCheck = useCreateBalanceCheck();
  const createTransaction = useCreateTransaction();

  const [actualBaht, setActualBaht] = useState<number | null>(null);
  const [amountError, setAmountError] = useState<string>();
  const [quickMode, setQuickMode] = useState<'out' | 'in' | null>(null);

  const isInitial = expected === null;

  let hotbar: HotbarItem[] = [];
  if (!isInitial) {
    try {
      hotbar = hotbarItems(data, today, 8);
    } catch (err) {
      if (!isNotImplementedError(err)) {
        hotbar = [];
      }
    }
  }

  const recentBankTx = data.transactions
    .filter((t) => t.sourceId === bank.id)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);

  const defaultPotId =
    data.pots.find((p) => p.name === 'ใช้ตามใจ')?.id ?? data.pots[0]?.id ?? null;

  const actualSatang = actualBaht !== null ? bahtToSatang(actualBaht) : null;
  const hasValidActual = actualSatang !== null && actualSatang >= 0;
  const diff = !isInitial && hasValidActual ? actualSatang - expected : null;
  const absDiff = diff !== null ? Math.abs(diff) : 0;

  const isMatched = diff !== null && absDiff < 100;
  const isMissing = diff !== null && diff <= -100;
  const isSurplus = diff !== null && diff >= 100;

  const saveBalanceCheck = async (withAdjustment: boolean) => {
    if (actualBaht === null || actualSatang === null || actualSatang < 0) {
      setAmountError('กรอกจำนวนเงินให้ถูกต้อง');
      return;
    }

    const adjustment =
      withAdjustment && diff !== null && absDiff >= 100
        ? {
            amount: absDiff,
            direction: (diff < 0 ? 'out' : 'in') as 'out' | 'in',
            note: 'ส่วนต่างเช็กยอด',
          }
        : null;

    try {
      await createBalanceCheck.mutateAsync({
        sourceId: bank.id,
        checkedOn: today,
        actual: actualSatang,
        expectedBefore: expected,
        adjustment,
      });
      notify(isInitial ? 'ตั้งยอดเริ่มต้นแล้ว' : 'บันทึกการเช็กยอดแล้ว');
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err, 'บันทึกการเช็กยอดไม่สำเร็จ'));
    }
  };

  const handleHotbarTap = async (item: HotbarItem) => {
    try {
      await createTransaction.mutateAsync({
        date: today,
        amount: item.amount,
        direction: 'out',
        sourceId: bank.id,
        potId: item.potId,
        category: item.category,
        note: item.note,
      });
      notify(`บันทึก${item.note} ${formatTHB(item.amount / 100)}`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'บันทึกรายการไม่สำเร็จ'));
    }
  };

  if (isInitial) {
    return (
      <form
        noValidate
        className="flex flex-col gap-4 pb-2"
        onSubmit={(e) => {
          e.preventDefault();
          void saveBalanceCheck(false);
        }}
      >
        <p className="text-sm text-muted">
          {`ตั้งยอดเริ่มต้นสำหรับ${bank.name} ณ วันที่ ${formatThaiFullDate(today)} (เริ่มต้นนับจากวันนี้)`}
        </p>

        <CurrencyField
          label="ยอดเงินในบัญชีตอนนี้"
          value={actualBaht}
          error={amountError}
          onChange={(v) => {
            setActualBaht(v);
            setAmountError(undefined);
          }}
        />

        <Button type="submit" variant="primary" size="lg" loading={createBalanceCheck.isPending}>
          บันทึกยอดเริ่มต้น
        </Button>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-2">
      <div className="flex items-center justify-between rounded-tile bg-stone-bg px-3 py-2.5 text-sm">
        <span className="text-stone-ink">ในแอปควรเหลือ</span>
        <Money value={expected / 100} size="md" />
      </div>

      <CurrencyField
        label="ยอดจริงในบัญชี"
        value={actualBaht}
        error={amountError}
        onChange={(v) => {
          setActualBaht(v);
          setAmountError(undefined);
        }}
      />

      {isMatched ? (
        <div className="flex flex-col gap-3">
          <div className="rounded-tile bg-teal-bg px-3 py-2.5 text-base font-medium text-teal-ink">
            ตรงกัน 👍
          </div>
          <Button
            variant="primary"
            size="lg"
            loading={createBalanceCheck.isPending}
            onClick={() => void saveBalanceCheck(false)}
          >
            บันทึกยอด
          </Button>
        </div>
      ) : null}

      {isMissing ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2 rounded-tile bg-apricot-bg px-3 py-2.5 text-apricot-ink">
            <span className="text-sm font-medium">หายไป — ลืมจดอะไรไหม?</span>
            <Money value={absDiff / 100} size="md" tone="inherit" />
          </div>

          {hotbar.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted">กดจดรายการที่ซื้อบ่อย</span>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {hotbar.map((item) => (
                  <button
                    key={`${item.note}-${item.amount}-${item.category}-${item.sourceId}`}
                    type="button"
                    disabled={createTransaction.isPending}
                    onClick={() => void handleHotbarTap(item)}
                    className="pressable min-h-tap shrink-0 rounded-pill border border-border bg-surface px-3 text-sm font-medium text-text hover-fine:hover:bg-stone-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
                  >
                    {`${item.note} ${formatTHB(item.amount / 100)}`}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {quickMode === 'out' ? (
            <QuickMissedForm
              mode="out"
              initialAmountBaht={null}
              today={today}
              latestCheckedOn={latestCheckedOn}
              sourceId={bank.id}
              defaultPotId={defaultPotId}
              isSubmitting={createTransaction.isPending}
              onCancel={() => setQuickMode(null)}
              onSubmitDone={() => setQuickMode(null)}
            />
          ) : (
            <Button variant="secondary" onClick={() => setQuickMode('out')}>
              จดรายการที่ลืม
            </Button>
          )}

          {recentBankTx.length > 0 ? (
            <div className="rounded-tile border border-border bg-surface px-3 py-1">
              <p className="py-1.5 text-xs font-medium text-muted">5 รายการล่าสุดของบัญชีนี้</p>
              {recentBankTx.map((tx) => (
                <ListRow
                  key={tx.id}
                  title={tx.note.trim() || CATEGORY_LABELS[tx.category]}
                  detail={formatThaiShortDate(tx.date)}
                  amount={tx.amount / 100}
                  amountKind={tx.direction === 'in' ? 'income' : 'spend'}
                />
              ))}
            </div>
          ) : null}

          <div className="flex flex-col gap-2 pt-1">
            <Button
              variant="primary"
              size="lg"
              loading={createBalanceCheck.isPending}
              onClick={() => void saveBalanceCheck(true)}
            >
              บันทึกส่วนต่างเป็น ลืมจด
            </Button>
            <Button
              variant="secondary"
              disabled={createBalanceCheck.isPending}
              onClick={() => void saveBalanceCheck(false)}
            >
              แค่บันทึกยอด
            </Button>
          </div>
        </div>
      ) : null}

      {isSurplus ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2 rounded-tile bg-sky-bg px-3 py-2.5 text-sky-ink">
            <span className="text-sm font-medium">เกินมา — มีเงินเข้าที่ยังไม่ได้จดไหม?</span>
            <Money value={absDiff / 100} size="md" tone="inherit" />
          </div>

          {quickMode === 'in' ? (
            <QuickMissedForm
              mode="in"
              initialAmountBaht={absDiff / 100}
              today={today}
              latestCheckedOn={latestCheckedOn}
              sourceId={bank.id}
              defaultPotId={null}
              isSubmitting={createTransaction.isPending}
              onCancel={() => setQuickMode(null)}
              onSubmitDone={() => setQuickMode(null)}
            />
          ) : (
            <Button variant="secondary" onClick={() => setQuickMode('in')}>
              จดเงินเข้า
            </Button>
          )}

          <div className="flex flex-col gap-2 pt-1">
            <Button
              variant="primary"
              size="lg"
              loading={createBalanceCheck.isPending}
              onClick={() => void saveBalanceCheck(true)}
            >
              บันทึกส่วนต่างเป็น ลืมจด
            </Button>
            <Button
              variant="secondary"
              disabled={createBalanceCheck.isPending}
              onClick={() => void saveBalanceCheck(false)}
            >
              แค่บันทึกยอด
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function BalanceCheckSheet({
  open,
  onOpenChange,
  data,
  bank,
  expected,
  latestCheckedOn,
  today,
}: BalanceCheckSheetProps) {
  const title = expected === null ? 'ตั้งยอดเริ่มต้น' : 'เช็กกับยอดจริง';
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={title}>
      {open ? (
        <BalanceCheckForm
          key={`${bank.id}-${expected === null ? 'init' : 'reconcile'}`}
          data={data}
          bank={bank}
          expected={expected}
          latestCheckedOn={latestCheckedOn}
          today={today}
          onClose={() => onOpenChange(false)}
        />
      ) : null}
    </BottomSheet>
  );
}
