import { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { thaiMonthShort } from '../../lib/thaiDate';
import { TabBar } from '../../components/layout/TabBar';
import { AnimatedRow, ROW_EXIT_MS } from '../../components/ui/AnimatedRow';
import { AllocationBar } from '../../components/ui/AllocationBar';
import { AnimatedMoney } from '../../components/ui/AnimatedMoney';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { CurrencyField } from '../../components/ui/CurrencyField';
import { DateBadge } from '../../components/ui/DateBadge';
import { IconButton } from '../../components/ui/IconButton';
import { ListRow } from '../../components/ui/ListRow';
import { Money } from '../../components/ui/Money';
import { Pill } from '../../components/ui/Pill';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { Switch } from '../../components/ui/Switch';
import { Tile } from '../../components/ui/Tile';
import { notify } from '../../components/ui/Toaster';
import type { Segment } from '../../lib/allocation';
import {
  billAmount,
  derive,
  initialPaidState,
  markPaid,
  samplePeriod,
  sumAmounts,
  upcomingAmount,
  type Bill,
  type BillId,
  type DayMonth,
  type UpcomingRow,
} from './sampleData';

// ---- timing of the "paid" row exit and the one celebration (spec 6) ---------------------------------------------
// The celebration (check draws 300ms) plus the row leaving (ROW_EXIT_MS, 140ms) stays inside 500ms.
/** How long the finished check stays before the row starts to leave. */
const CELEBRATE_MS = 320;

const dayText = (d: DayMonth, dueBy = false) => `${dueBy ? '≤' : ''}${d.day} ${thaiMonthShort(d.month)}`;
const wholeBaht = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

// ---- one bill row in the upcoming list ---------------------------------------------------------------------------

interface BillRowProps {
  row: UpcomingRow;
  bill: Bill;
  paid: boolean;
  /** True when this payment closed the last open bill. */
  celebrate: boolean;
  onPay: () => void;
}

function BillRow({ row, bill, paid, celebrate, onPay }: BillRowProps) {
  const [phase, setPhase] = useState<'open' | 'exiting' | 'gone'>('open');
  const noteId = `pay-${row.id}-note`;

  // Timers hang off `paid` (a state transition), not off the click: a double tap fires the handler twice but
  // flips `paid` once, so the exit is scheduled once.
  useEffect(() => {
    if (!paid) return;
    const leaveAt = celebrate ? CELEBRATE_MS : 0;
    const exit = setTimeout(() => setPhase('exiting'), leaveAt);
    const gone = setTimeout(() => setPhase('gone'), leaveAt + ROW_EXIT_MS);
    return () => {
      clearTimeout(exit);
      clearTimeout(gone);
    };
  }, [paid, celebrate]);

  if (phase === 'gone') return null;

  const note = row.source.kind === 'bill' ? row.source.note : undefined;
  return (
    <AnimatedRow
      // Shared row exit (opacity + translateY, spec 6). The row is inert once paid so a late tap cannot hit it.
      leaving={phase === 'exiting'}
      className={paid ? 'pointer-events-none' : undefined}
    >
      {/* Wrapped so ListRow is the last child of its parent: its own bottom rule (last:border-b-0) then never
          draws between the row and the action below it. */}
      <div>
        <ListRow
          leading={<DateBadge day={row.date.day} month={row.date.month} dueBy={row.dueBy} />}
          title={row.title}
          detail={note ?? <Pill hue={bill.hue}>{bill.label}</Pill>}
          amount={billAmount(bill)}
          strong
        />
      </div>
      {/* pl-14 = DateBadge (44) + row gap (12): lines the action up under the title. Fixed height so the row
          does not jump when the button is replaced by the check or removed. */}
      <div className="flex min-h-tap items-center pb-2 pl-14">
        {!paid ? (
          <>
            <Button variant="secondary" onClick={onPay} aria-describedby={noteId}>
              จ่ายแล้ว
            </Button>
            {/* Two identical "จ่ายแล้ว" buttons need a spoken difference; this is read as the button's description. */}
            <span id={noteId} className="sr-only">
              {row.title} ครบกำหนด {dayText(row.date, row.dueBy)}
            </span>
          </>
        ) : celebrate ? (
          <span role="status" className="flex items-center gap-2 text-sm font-medium text-text">
            <svg
              data-testid="paid-check"
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="text-accent"
            >
              <path className="check-draw" pathLength={1} d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
            จ่ายครบแล้ว
          </span>
        ) : null}
      </div>
    </AnimatedRow>
  );
}

// ---- add-spending sheet ------------------------------------------------------------------------------------------

function AddForm({ onSave }: { onSave: (amount: number, counted: boolean) => void }) {
  const [amount, setAmount] = useState<number | null>(null);
  const [counted, setCounted] = useState(true);
  const [error, setError] = useState<string>();

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        // Zero or empty is not a spend; say so in words rather than silently closing.
        if (amount === null || amount <= 0) {
          setError('กรอกจำนวนเงินให้ถูกต้อง');
          return;
        }
        onSave(amount, counted);
      }}
    >
      <CurrencyField
        label="จำนวนเงิน"
        value={amount}
        error={error}
        onChange={(v) => {
          setAmount(v);
          setError(undefined);
        }}
      />
      <Switch label="นับรวมในวงเงินใช้ตามใจ" checked={counted} onChange={setCounted} />
      <Button type="submit" variant="primary" size="lg">
        บันทึก
      </Button>
    </form>
  );
}

// ---- screen ------------------------------------------------------------------------------------------------------

interface Extra {
  id: number;
  amount: number;
  counted: boolean;
  /** Set when undo starts: the row animates out, but its amount stops counting at once. */
  leaving?: boolean;
}

export default function PreviewHome() {
  const [paidState, setPaidState] = useState(initialPaidState);
  const [extra, setExtra] = useState<Extra[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const nextId = useRef(1);
  // After "จ่ายแล้ว" the pressed button unmounts; without a new target focus would fall to <body> and a keyboard
  // or screen-reader user would lose their place. The owed figure is what just changed, so focus lands there.
  const owedRef = useRef<HTMLDivElement>(null);

  const { start, end } = samplePeriod;
  const d = derive(samplePeriod, paidState.paid, sumAmounts(extra.filter((e) => e.counted && !e.leaving).map((e) => e.amount)));
  const allPaid = paidState.paid.size === samplePeriod.bills.length;

  // Unpaid bills are reserved out of the pot; a paid one is dimmed but stays, so the bar total never changes.
  const parts: Segment[] = [
    ...samplePeriod.bills.map<Segment>((b) => ({
      id: b.id,
      label: b.label,
      amount: billAmount(b),
      hue: b.hue,
      state: paidState.paid.has(b.id) ? 'paid' : 'reserved',
    })),
    { id: 'used', label: 'ใช้เล่นไปแล้ว', amount: d.spent, hue: 'stone' },
  ];

  const pay = (id: BillId) => {
    // Move focus before the button leaves the DOM (it unmounts on the re-render this triggers).
    owedRef.current?.focus();
    setPaidState((s) => markPaid(s, id));
  };

  const save = (amount: number, counted: boolean) => {
    const id = nextId.current++;
    setExtra((prev) => [...prev, { id, amount, counted }]);
    setSheetOpen(false);
    // Undo removes by id, so pressing it twice (or after another save) cannot take away the wrong entry. The numbers
    // revert at once (leaving rows do not count); the row itself plays its exit, then is dropped.
    notify('บันทึกแล้ว', {
      undo: () => {
        setExtra((prev) => prev.map((e) => (e.id === id ? { ...e, leaving: true } : e)));
        setTimeout(() => setExtra((prev) => prev.filter((e) => e.id !== id)), ROW_EXIT_MS);
      },
    });
  };

  return (
    // Full-height column: only <main> scrolls and the TabBar stays pinned at the bottom of the 480px column.
    <div className="mx-auto flex h-dvh w-full max-w-[480px] flex-col bg-ground">
      <main className="flex-1 overflow-y-auto px-screen pb-6 pt-5">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-title font-semibold text-text">ภาพรวม</h1>
            <p className="mt-0.5 text-sm text-muted">
              {`รอบ ${dayText(start)} – ${dayText(end)} · อีก ${d.daysLeft} วัน`}
            </p>
          </div>
          {/* !-prefixed so the accent fill beats IconButton's own text-text / hover:bg-stone-bg. */}
          <IconButton
            label="เพิ่มรายการ"
            icon={<Plus size={22} strokeWidth={1.6} aria-hidden="true" />}
            onClick={() => setSheetOpen(true)}
            className="!bg-accent !text-on-accent hover-fine:hover:opacity-90"
          />
        </header>

        <Card className="mt-4">
          <p className="text-sm text-muted">เหลือใช้เล่น</p>
          <div data-testid="play-left" className="mt-0.5">
            <Money value={d.playLeft} size="xl" />
          </div>
          <p className="mt-1 text-sm text-muted">
            หลังกันเงินจ่ายบิลที่รู้แล้ว · เฉลี่ย <Money value={d.perDay} size="sm" /> ต่อวัน
          </p>

          <div className="mt-3.5">
            <AllocationBar total={d.pot} parts={parts} />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2.5">
            {samplePeriod.bills.map((b) => (
              <Tile
                key={b.id}
                hue={b.hue}
                label={`${b.label} · ${paidState.paid.has(b.id) ? 'จ่ายแล้ว' : dayText(b.due, b.dueBy)}`}
                value={billAmount(b)}
              />
            ))}
            <Tile hue="stone" label="ใช้เล่นไปแล้ว" value={d.spent} />
            <Tile
              hue="teal"
              label={`ก้อน ${wholeBaht.format(samplePeriod.pot)} + ยกมา ${wholeBaht.format(samplePeriod.carry)}`}
              value={d.pot}
            />
          </div>

          {/* The live region is the whole row, so a payment is announced as "ยังต้องจ่ายอีก ฿…" (label + amount)
              rather than a bare number; role=status is polite and atomic. AnimatedMoney's own region is off. */}
          <div
            ref={owedRef}
            tabIndex={-1}
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="mt-2 flex min-h-tap items-center justify-between gap-3 rounded-tile focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
          >
            <span className="text-sm text-muted">ยังต้องจ่ายอีก</span>
            <div data-testid="owed">
              <AnimatedMoney value={d.owed} size="md" live={false} />
            </div>
          </div>
        </Card>

        <div className="mt-5">
          <SectionHeader
            title="เงินออก 30 วันข้างหน้า"
            actionLabel="ดูทั้งหมด"
            onAction={() => notify('ยังไม่เปิดใช้งานในหน้าตัวอย่าง')}
          />
        </div>
        <Card data-testid="upcoming" padding="none" className="mt-1 px-card py-1">
          {samplePeriod.upcoming.map((row) => {
            if (row.source.kind === 'bill') {
              const { billId } = row.source;
              const bill = samplePeriod.bills.find((b) => b.id === billId);
              if (!bill) return null;
              const paid = paidState.paid.has(billId);
              return (
                <BillRow
                  key={row.id}
                  row={row}
                  bill={bill}
                  paid={paid}
                  celebrate={paid && allPaid && paidState.last === billId}
                  onPay={() => pay(billId)}
                />
              );
            }
            const { channel } = row.source;
            return (
              <div key={row.id}>
                <ListRow
                  leading={<DateBadge day={row.date.day} month={row.date.month} dueBy={row.dueBy} />}
                  title={row.title}
                  detail={<Pill hue={channel.hue}>{channel.label}</Pill>}
                  amount={upcomingAmount(samplePeriod, row)}
                />
              </div>
            );
          })}
        </Card>

        {/* Rows the user just added. Only these animate in; the initial lists above never do. */}
        {extra.length > 0 ? (
          <>
            <div className="mt-5">
              <SectionHeader title="รายการที่เพิ่ม" />
            </div>
            <Card data-testid="added" padding="none" className="mt-1 px-card py-1">
              {extra.map((e) => (
                <AnimatedRow key={e.id} entering leaving={e.leaving}>
                  <ListRow title="รายจ่าย" detail={e.counted ? 'นับรวมในวงเงิน' : 'ไม่นับรวม'} amount={e.amount} />
                </AnimatedRow>
              ))}
            </Card>
          </>
        ) : null}
      </main>

      <TabBar />

      <BottomSheet open={sheetOpen} onOpenChange={setSheetOpen} title="เพิ่มรายการ">
        {/* Mounted only while open, so the form starts empty every time. */}
        <AddForm onSave={save} />
      </BottomSheet>
    </div>
  );
}
