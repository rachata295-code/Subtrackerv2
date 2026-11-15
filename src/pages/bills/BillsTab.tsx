import { useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { billAmount } from '../../domain';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DateBadge } from '../../components/ui/DateBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { ListRow } from '../../components/ui/ListRow';
import { Money } from '../../components/ui/Money';
import { notify } from '../../components/ui/Toaster';
import { HUE_TILE } from '../../components/ui/hue';
import { usePayBill } from '../../hooks/useFinance';
import type { FinanceData, ISODate, PaymentSource } from '../../types/finance';
import {
  formatCycleRange,
  formatStatementKeyThai,
  formatThaiDateShort,
  getCycleCharges,
  getSourceBillCycles,
  parseIsoDate,
  satangToBaht,
} from './billsLogic';

interface SourceBillCardProps {
  src: PaymentSource;
  data: FinanceData;
  today: ISODate;
}

function SourceBillCard({ src, data, today }: SourceBillCardProps) {
  const payBill = usePayBill();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  // Tracks bills paid during this session so fixture/stub dev mode updates immediately alongside query invalidation.
  const [optimisticPaidKeys, setOptimisticPaidKeys] = useState<string[]>([]);
  // When "จ่ายแล้ว" unmounts after payment, focus moves to the status region without scrolling.
  const statusRef = useRef<HTMLDivElement>(null);

  const { current, previous } = getSourceBillCycles(src, today, 3);
  const currentAmount = billAmount(src, current.key, data);
  const isPaid =
    optimisticPaidKeys.includes(current.key) ||
    data.payments.some((p) => p.sourceId === src.id && p.statementKey === current.key);
  const charges = getCycleCharges(src, current, data);
  const dueParts = parseIsoDate(current.dueDate);
  const dueBy = src.kind === 'paylater';
  const payNoteId = `pay-note-${src.id}-${current.key}`;

  const handlePay = async () => {
    if (paying || isPaid) return;
    setPaying(true);
    try {
      await payBill.mutateAsync({
        sourceId: src.id,
        statementKey: current.key,
        amount: currentAmount,
        paidOn: today,
      });
      statusRef.current?.focus({ preventScroll: true });
      setOptimisticPaidKeys((prev) => (prev.includes(current.key) ? prev : [...prev, current.key]));
      notify('บันทึกจ่ายบิลแล้ว');
    } catch {
      notify('บันทึกจ่ายบิลไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setPaying(false);
    }
  };

  const statusText = isPaid ? 'จ่ายแล้ว' : currentAmount > 0 ? 'ยังไม่จ่าย' : 'ไม่มียอด';

  return (
    <Card data-testid={`bill-card-${src.id}`} className="flex flex-col gap-3">
      {/* Hue-tinted header band keeps *-ink on *-bg contrast compliant across both themes. */}
      <div className={`flex items-start justify-between gap-3 rounded-tile p-3 ${HUE_TILE[src.hue]}`}>
        <div className="min-w-0">
          <p className="truncate text-section font-semibold">{src.name}</p>
          <p className="mt-0.5 text-sm">{formatCycleRange(current)}</p>
        </div>
        <div className="shrink-0 text-right">
          <Money value={satangToBaht(currentAmount)} size="md" tone="inherit" />
          <p className="mt-0.5 text-xs font-medium">{statusText}</p>
        </div>
      </div>

      <div
        ref={statusRef}
        tabIndex={-1}
        className="flex min-h-tap items-center justify-between gap-3 rounded-tile focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
      >
        <div className="flex items-center gap-3">
          <DateBadge day={dueParts.day} month={dueParts.month0} dueBy={dueBy} />
          <div className="text-sm">
            <p className="font-medium text-text">
              {dueBy ? `จ่ายภายใน ${formatThaiDateShort(current.dueDate)}` : `ครบกำหนด ${formatThaiDateShort(current.dueDate)}`}
            </p>
            <p className="text-muted">{isPaid ? 'ชำระเรียบร้อยแล้ว' : currentAmount > 0 ? 'รอชำระรอบปัจจุบัน' : 'ไม่มียอดต้องชำระ'}</p>
          </div>
        </div>

        {!isPaid && currentAmount > 0 ? (
          <>
            <Button variant="secondary" loading={paying} onClick={handlePay} aria-describedby={payNoteId}>
              จ่ายแล้ว
            </Button>
            <span id={payNoteId} className="sr-only">
              จ่ายบิล {src.name} รอบ {formatStatementKeyThai(current.key)}
            </span>
          </>
        ) : isPaid ? (
          <span className="inline-flex items-center gap-1 text-sm font-medium text-positive">
            <Check size={16} strokeWidth={2} aria-hidden="true" />
            จ่ายแล้ว
          </span>
        ) : null}
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-muted">รายการในรอบ</p>
        {charges.length > 0 ? (
          <div className="flex flex-col">
            {charges.map((item) => {
              const parts = parseIsoDate(item.date);
              return (
                <ListRow
                  key={item.id}
                  leading={<DateBadge day={parts.day} month={parts.month0} />}
                  title={item.title}
                  detail={item.detail}
                  amount={satangToBaht(item.amount)}
                  amountKind="spend"
                />
              );
            })}
          </div>
        ) : (
          <EmptyState message="ยังไม่มีรายการในรอบนี้" />
        )}
      </div>

      <div className="border-t border-rule pt-1">
        <button
          type="button"
          aria-expanded={historyOpen}
          onClick={() => setHistoryOpen((open) => !open)}
          className="pressable flex min-h-tap w-full items-center justify-between rounded-tile px-1 text-sm font-medium text-muted hover-fine:hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
        >
          <span>ประวัติ 3 รอบก่อน</span>
          <ChevronDown
            size={18}
            strokeWidth={1.6}
            aria-hidden="true"
            className={`transition-transform duration-fast ease-out motion-reduce:transition-none ${historyOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {historyOpen ? (
          <div data-testid={`bill-history-${src.id}`} className="mt-1 flex flex-col border-t border-rule pt-1">
            {previous.map((win) => {
              const amt = billAmount(src, win.key, data);
              const prevPaid =
                optimisticPaidKeys.includes(win.key) ||
                data.payments.some((p) => p.sourceId === src.id && p.statementKey === win.key);
              const prevStatus = prevPaid ? 'จ่ายแล้ว' : amt > 0 ? 'ยังไม่จ่าย' : 'ไม่มียอด';
              return (
                <div
                  key={win.key}
                  data-testid="history-cycle-row"
                  className="flex min-h-tap items-center justify-between gap-3 border-b border-rule py-2 last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text">{formatStatementKeyThai(win.key)}</p>
                    <p className="text-xs text-muted">
                      {formatCycleRange(win)} · <span>{prevStatus}</span>
                    </p>
                  </div>
                  <Money value={satangToBaht(amt)} size="sm" />
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

export interface BillsTabProps {
  data: FinanceData;
  today: ISODate;
}

export function BillsTab({ data, today }: BillsTabProps) {
  const billingSources = data.sources.filter(
    (s) => !s.archived && (s.kind === 'credit_card' || s.kind === 'paylater'),
  );

  if (billingSources.length === 0) {
    return <EmptyState message="ยังไม่มีช่องทางที่มีรอบบิล" />;
  }

  return (
    <div className="flex flex-col gap-gap">
      {billingSources.map((src) => (
        <SourceBillCard key={src.id} src={src} data={data} today={today} />
      ))}
    </div>
  );
}
