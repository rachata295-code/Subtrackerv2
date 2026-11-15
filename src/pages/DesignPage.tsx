import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import tokensCss from '../styles/tokens.css?raw';
import { contrastRatio, parseTokens } from '../lib/contrast';
import type { Segment } from '../lib/allocation';
import { ThemeSwitch } from '../components/ThemeSwitch';
import { AnimatedRow, ROW_EXIT_MS } from '../components/ui/AnimatedRow';
import { AllocationBar } from '../components/ui/AllocationBar';
import { BottomSheet } from '../components/ui/BottomSheet';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { CurrencyField } from '../components/ui/CurrencyField';
import { DateBadge } from '../components/ui/DateBadge';
import { EmptyState } from '../components/ui/EmptyState';
import { HoldToDelete } from '../components/ui/HoldToDelete';
import { IconButton } from '../components/ui/IconButton';
import { ListRow } from '../components/ui/ListRow';
import { Money } from '../components/ui/Money';
import { Pill } from '../components/ui/Pill';
import { SectionHeader } from '../components/ui/SectionHeader';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { Skeleton } from '../components/ui/Skeleton';
import { Switch } from '../components/ui/Switch';
import { TextField } from '../components/ui/TextField';
import { Tile } from '../components/ui/Tile';
import { notify } from '../components/ui/Toaster';
import { HUE_MARK, type Hue } from '../components/ui/hue';

// ---------------------------------------------------------------------------------------------
// Colour tokens. Ratios are computed from tokens.css itself (not retyped), so this page cannot drift
// from the values the app actually ships.
// ---------------------------------------------------------------------------------------------

const TOKENS = parseTokens(tokensCss);
const HUES: Hue[] = ['sky', 'apricot', 'teal', 'stone', 'lilac', 'rose'];
const HUE_LABEL: Record<Hue, string> = {
  sky: 'sky · บัตร',
  apricot: 'apricot · SPayLater',
  teal: 'teal · ก้อนใช้เล่น',
  stone: 'stone · ใช้ไปแล้ว',
  lilac: 'lilac · สำรอง',
  rose: 'rose · สำรอง',
};

interface Pair {
  id: string;
  label: string;
  fg: string;
  bg: string;
  /** Minimum ratio the guard test enforces for this pair; undefined for decorative lines. */
  min?: 3 | 4.5;
  /** `ui` pairs are lines/marks, drawn as a bar instead of "Aa". */
  kind?: 'text' | 'ui';
}

const NEUTRAL_PAIRS: Pair[] = [
  { id: 'text-on-ground', label: 'text / ground', fg: 'text', bg: 'ground', min: 4.5 },
  { id: 'text-on-surface', label: 'text / surface', fg: 'text', bg: 'surface', min: 4.5 },
  { id: 'text-on-raised', label: 'text / raised', fg: 'text', bg: 'raised', min: 4.5 },
  { id: 'muted-on-surface', label: 'muted / surface', fg: 'muted', bg: 'surface', min: 4.5 },
  { id: 'border-on-surface', label: 'border / surface', fg: 'border', bg: 'surface', kind: 'ui' },
  { id: 'rule-on-surface', label: 'rule / surface', fg: 'rule', bg: 'surface', kind: 'ui' },
  { id: 'control-on-surface', label: 'control / surface', fg: 'control', bg: 'surface', kind: 'ui' },
];

const STATUS_PAIRS: Pair[] = [
  { id: 'accent-on-surface', label: 'accent / surface', fg: 'accent', bg: 'surface', min: 3 },
  { id: 'positive-on-surface', label: 'positive / surface', fg: 'positive', bg: 'surface', min: 4.5 },
  { id: 'negative-on-surface', label: 'negative / surface', fg: 'negative', bg: 'surface', min: 4.5 },
  { id: 'warning-on-surface', label: 'warning / surface', fg: 'warning', bg: 'surface', min: 4.5 },
  { id: 'on-accent-on-accent', label: 'on-accent / accent', fg: 'on-accent', bg: 'accent', min: 4.5 },
  { id: 'on-accent-on-negative', label: 'on-accent / negative', fg: 'on-accent', bg: 'negative', min: 4.5 },
];

const HUE_PAIRS: Pair[] = HUES.flatMap((h) => [
  { id: `${h}-ink-on-bg`, label: `${h} ink / bg`, fg: `${h}-ink`, bg: `${h}-bg`, min: 4.5 as const },
  { id: `${h}-mark-on-surface`, label: `${h} mark / surface`, fg: `${h}-mark`, bg: 'surface', min: 3 as const, kind: 'ui' as const },
]);

const ratio = (theme: 'light' | 'dark', p: Pair) => `${contrastRatio(TOKENS[theme][p.fg], TOKENS[theme][p.bg]).toFixed(2)}:1`;

function Swatch({ pair }: { pair: Pair }) {
  return (
    // Outer testid counts all swatches; the inner one picks out a single pair.
    <div data-testid="swatch" className="min-w-0">
      <div data-testid={`swatch-${pair.id}`}>
        <div
          // Colours come from the live CSS variables, so the swatch recolours with the theme like the real UI.
          style={{ background: `rgb(var(--${pair.bg}))`, color: `rgb(var(--${pair.fg}))` }}
          className="flex h-11 items-center justify-center rounded-tile border border-border text-base font-semibold"
        >
          {pair.kind === 'ui' ? <span className="h-2 w-10 rounded-dot bg-current" /> : 'Aa'}
        </div>
        <p className="mt-1 truncate text-xs font-medium text-text">{pair.label}</p>
        <p className="text-xs tabular-nums text-muted">
          สว่าง {ratio('light', pair)} · มืด {ratio('dark', pair)}
        </p>
        {pair.min ? <p className="text-xs tabular-nums text-muted">เกณฑ์ ≥{pair.min}</p> : null}
      </div>
    </div>
  );
}

function SwatchGrid({ pairs }: { pairs: Pair[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-3">
      {pairs.map((p) => (
        <Swatch key={p.id} pair={p} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Layout helpers
// ---------------------------------------------------------------------------------------------

// Every group heading is a SectionHeader, so the component is shown with and without its action right here
// (a nested demo would add stray h2s to the page outline).
function Section({ title, action, children }: { title: string; action?: { label: string; onAction: () => void }; children: ReactNode }) {
  return (
    <section className="mt-6">
      <SectionHeader title={title} actionLabel={action?.label} onAction={action?.onAction} />
      <Card className="mt-1 flex flex-col gap-5">{children}</Card>
    </section>
  );
}

function Sub({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-medium text-muted">{label}</h3>
      {children}
    </div>
  );
}

/** One labelled row with the value right-aligned, which is how money sits in real lists. */
function Line({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-tap items-center justify-between gap-3 border-b border-rule last:border-b-0">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Stateful demos (the components are controlled, so each demo owns its value)
// ---------------------------------------------------------------------------------------------

function CurrencyDemo({ label, initial, error, disabled }: { label: string; initial: number | null; error?: string; disabled?: boolean }) {
  const [value, setValue] = useState<number | null>(initial);
  return <CurrencyField label={label} value={value} onChange={setValue} error={error} disabled={disabled} />;
}

function SwitchDemo({ label, initial, disabled }: { label: string; initial: boolean; disabled?: boolean }) {
  const [on, setOn] = useState(initial);
  return <Switch label={label} checked={on} onChange={setOn} disabled={disabled} />;
}

const RANGE_OPTIONS = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'card', label: 'บัตร' },
  { value: 'spay', label: 'SPayLater' },
];

function SegmentedDemo() {
  const [range, setRange] = useState('all');
  return <SegmentedControl label="ช่วงที่แสดง" options={RANGE_OPTIONS} value={range} onChange={setRange} />;
}

/** Adds and removes one sample row so the shared row enter/exit (spec 6) can be felt, and checked under reduced motion. */
function RowMotionDemo() {
  const [phase, setPhase] = useState<'absent' | 'present' | 'leaving'>('absent');

  const toggle = () => {
    if (phase === 'absent') {
      setPhase('present');
    } else if (phase === 'present') {
      setPhase('leaving');
      // The exit keyframes run ROW_EXIT_MS; only then is it safe to unmount the row.
      setTimeout(() => setPhase('absent'), ROW_EXIT_MS);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div>
        <Button variant="secondary" onClick={toggle} disabled={phase === 'leaving'}>
          {phase === 'present' ? 'ลบแถวตัวอย่าง' : 'เพิ่มแถวตัวอย่าง'}
        </Button>
      </div>
      {/* Reserved height so the demo does not shove the rest of the page up and down while it plays. */}
      <div className="min-h-[60px]" data-testid="row-motion-slot">
        {phase !== 'absent' ? (
          <AnimatedRow entering leaving={phase === 'leaving'}>
            <ListRow title="แถวตัวอย่าง" detail="เข้า 180ms · ออก 140ms" amount={99} />
          </AnimatedRow>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Sample figures for the allocation bars (display only; the real screen derives its own in preview/sampleData)
// ---------------------------------------------------------------------------------------------

const BAR_PARTS: Segment[] = [
  { id: 'card', label: 'บิลบัตร', amount: 1077, hue: 'sky' },
  { id: 'spay', label: 'SPayLater', amount: 1381.93, hue: 'apricot' },
  { id: 'used', label: 'ใช้เล่นไปแล้ว', amount: 420, hue: 'stone' },
];

const LONG_TITLE = 'ค่าสมาชิกรายปีบริการสตรีมมิ่งเพลงและวิดีโอความละเอียดสูงสำหรับทั้งครอบครัว';

// ---------------------------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------------------------

export default function DesignPage() {
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-ground">
      <main className="mx-auto w-full max-w-[480px] px-screen pb-16 pt-5">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-title font-semibold text-text">Design system</h1>
          <Link
            to="/preview-home"
            className="-mr-2 inline-flex min-h-tap items-center rounded-tile px-2 text-sm font-medium text-accent hover-fine:hover:bg-stone-bg"
          >
            หน้าตัวอย่าง
          </Link>
        </div>
        {/* Sticky so the theme can be flipped from anywhere on this long page while checking both themes. */}
        <div className="sticky top-0 z-10 -mx-screen bg-ground px-screen py-2">
          <ThemeSwitch />
        </div>

        <Section title="สี">
          <Sub label="พื้นและเส้น">
            <SwatchGrid pairs={NEUTRAL_PAIRS} />
          </Sub>
          <Sub label="สถานะและปุ่ม">
            <SwatchGrid pairs={STATUS_PAIRS} />
          </Sub>
          <Sub label="เฉด (ink บน bg, mark บน surface)">
            <SwatchGrid pairs={HUE_PAIRS} />
          </Sub>
        </Section>

        <Section title="ตัวอักษร">
          <Sub label="ขนาด">
            <Line label="title 26 · 600">
              <span className="text-title font-semibold text-text">ภาพรวม</span>
            </Line>
            <Line label="section 18 · 600">
              <span className="text-section font-semibold text-text">เงินออก 30 วันข้างหน้า</span>
            </Line>
            <Line label="money-xl 36 · 600">
              <Money value={662.07} size="xl" />
            </Line>
            <Line label="money 17 · 500">
              <Money value={1381.93} size="md" />
            </Line>
            <Line label="body 16 · 400">
              <span className="text-base text-text">จ่ายบิลบัตร Aa</span>
            </Line>
            <Line label="small 14 · 400">
              <span className="text-sm text-muted">จากบัญชี Aa</span>
            </Line>
            <Line label="meta 12 · 500">
              <span className="text-xs font-medium text-muted">บัตร Aa</span>
            </Line>
          </Sub>
          <Sub label="น้ำหนัก (ไทยและอังกฤษ)">
            <p className="text-base font-normal text-text">400 · SubTracker ติดตามรายจ่าย 0123456789</p>
            <p className="text-base font-medium text-text">500 · SubTracker ติดตามรายจ่าย 0123456789</p>
            <p className="text-base font-semibold text-text">600 · SubTracker ติดตามรายจ่าย 0123456789</p>
          </Sub>
        </Section>

        <Section title="ปุ่ม">
          {(['primary', 'secondary', 'ghost', 'danger'] as const).map((variant) => (
            <Sub key={variant} label={`${variant} · default / disabled / loading`}>
              <div className="flex flex-wrap gap-2">
                <Button variant={variant}>บันทึก</Button>
                <Button variant={variant} disabled>
                  บันทึก
                </Button>
                <Button variant={variant} loading>
                  บันทึก
                </Button>
              </div>
            </Sub>
          ))}
          <Sub label="ขนาด lg">
            <Button variant="primary" size="lg" className="w-full">
              จ่ายแล้ว
            </Button>
          </Sub>
          <Sub label="IconButton · default / disabled">
            <div className="flex gap-2">
              <IconButton label="เพิ่มรายการ" icon={<Plus size={22} strokeWidth={1.6} aria-hidden="true" />} />
              <IconButton label="เพิ่มรายการ (ปิดใช้งาน)" disabled icon={<Plus size={22} strokeWidth={1.6} aria-hidden="true" />} />
            </div>
          </Sub>
        </Section>

        <Section title="Tile & Pill">
          <Sub label="ครบทั้ง 6 เฉด · Tile + Pill + mark (lilac และ rose คือเฉดสำรอง)">
            <div className="grid grid-cols-2 gap-x-2.5 gap-y-4">
              {HUES.map((h, i) => (
                <div key={h} data-testid={`hue-${h}`} className="min-w-0">
                  <Tile hue={h} label={HUE_LABEL[h]} value={[1077, 1381.93, 420, 3541, 279, 99][i]} />
                  <div className="mt-2 flex items-center gap-2">
                    <Pill hue={h}>{h}</Pill>
                    <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-dot ${HUE_MARK[h]}`} />
                    <span data-testid={`hue-${h}-mark`} aria-hidden="true" className={`h-3 min-w-0 flex-1 rounded-pill ${HUE_MARK[h]}`} />
                  </div>
                </div>
              ))}
            </div>
          </Sub>
          <Sub label="สภาวะ · กดได้ / null / ศูนย์ / ยาวมาก">
            <div className="grid grid-cols-2 gap-2.5">
              <Tile hue="sky" label="กดได้" value={1077} onClick={() => notify('กด Tile แล้ว')} />
              <Tile hue="apricot" label="ยังไม่มีข้อมูล" value={null} />
              <Tile hue="teal" label="ศูนย์" value={0} />
              <Tile hue="stone" label="ยอดยาวมาก" value={1234567.89} />
            </div>
          </Sub>
        </Section>

        <Section title="ตัวเลขเงิน">
          <div>
            <Line label="xl · spend">
              <Money value={3541} size="xl" kind="spend" />
            </Line>
            <Line label="md · spend">
              <Money value={1077} size="md" kind="spend" />
            </Line>
            <Line label="sm · spend">
              <Money value={279} size="sm" kind="spend" />
            </Line>
            <Line label="md · income">
              <Money value={1250.5} size="md" kind="income" />
            </Line>
            <Line label="md · neutral ติดลบ (เกินงบ)">
              <Money value={-240.5} size="md" kind="neutral" />
            </Line>
            <Line label="md · ศูนย์">
              <Money value={0} size="md" />
            </Line>
            <Line label="md · null">
              <Money value={null} size="md" />
            </Line>
            <Line label="xl · null">
              <Money value={null} size="xl" />
            </Line>
            <Line label="md · ยอดยาวมาก">
              <Money value={1234567.89} size="md" />
            </Line>
          </div>
        </Section>

        <Section title="แถบสัดส่วน">
          <Sub label="ปกติ · เหลือ ฿662.07">
            <AllocationBar total={3541} parts={BAR_PARTS} />
          </Sub>
          <Sub label="บิลบัตรจ่ายแล้ว (จางลง) + จองไว้">
            <AllocationBar
              total={3541}
              parts={[
                { ...BAR_PARTS[0], state: 'paid' },
                { ...BAR_PARTS[1], state: 'reserved' },
                BAR_PARTS[2],
              ]}
            />
          </Sub>
          <Sub label="ใช้หมดพอดี">
            <AllocationBar total={2000} parts={[{ id: 'a', label: 'A', amount: 1200, hue: 'sky' }, { id: 'b', label: 'B', amount: 800, hue: 'apricot' }]} />
          </Sub>
          <Sub label="เกินงบ (กรอบ negative + ข้อความ)">
            <AllocationBar total={2000} parts={[{ id: 'a', label: 'A', amount: 1200, hue: 'sky' }, { id: 'b', label: 'B', amount: 1040.5, hue: 'apricot' }]} />
          </Sub>
          <Sub label="ยังไม่มีรายการ">
            <AllocationBar total={3541} parts={[]} />
          </Sub>
          <Sub label="งบเป็นศูนย์">
            <AllocationBar total={0} parts={[]} />
          </Sub>
        </Section>

        <Section title="แถวรายการ" action={{ label: 'ดูทั้งหมด', onAction: () => notify('ดูทั้งหมด') }}>
          <Sub label="DateBadge · วันที่ / ภายในวันที่">
            <div className="flex gap-2">
              <DateBadge day={24} month={10} />
              <DateBadge day={10} month={11} dueBy />
            </div>
          </Sub>
          <Sub label="ListRow">
            <ListRow leading={<DateBadge day={24} month={10} />} title="จ่ายบิลบัตร" detail="จากบัญชี" amount={1077} strong />
            <ListRow
              leading={<DateBadge day={25} month={10} />}
              title="Gemini + YouTube"
              detail={<Pill hue="sky">บัตร</Pill>}
              amount={279}
            />
            <ListRow title="เงินเดือน" detail="เข้าบัญชี" amount={25000} amountKind="income" />
            <ListRow title="กดได้" detail="แตะเพื่อดูรายละเอียด" amount={99} onClick={() => notify('กดแถวแล้ว')} />
            <ListRow title="ยังไม่ระบุยอด" detail="amount เป็น null" amount={null} />
            <ListRow title="ยอดเป็นศูนย์" amount={0} />
            <ListRow title={LONG_TITLE} detail="ชื่อยาวตัดด้วย … ส่วนยอดไม่ถูกบีบ" amount={1234567.89} />
          </Sub>
          <Sub label="แถวเข้า / ออก · เลื่อนขึ้น 8px เข้า, ลอยขึ้น 4px ออก (reduced motion: จางอย่างเดียว)">
            <RowMotionDemo />
          </Sub>
        </Section>

        <Section title="ฟอร์ม">
          <Sub label="TextField · ปกติ / มีค่า / error / disabled">
            <div className="flex flex-col gap-3">
              <TextField label="ชื่อรายการ" placeholder="เช่น Netflix" />
              <TextField label="ชื่อรายการ" defaultValue="Claude" />
              <TextField label="ชื่อรายการ" defaultValue="" error="กรุณากรอกชื่อรายการ" />
              <TextField label="ชื่อรายการ" defaultValue="Claude" disabled />
            </div>
          </Sub>
          <Sub label="CurrencyField · ว่าง / มีค่า / error / disabled">
            <div className="flex flex-col gap-3">
              <CurrencyDemo label="จำนวนเงิน" initial={null} />
              <CurrencyDemo label="จำนวนเงิน" initial={1381.93} />
              <CurrencyDemo label="จำนวนเงิน" initial={null} error="กรอกจำนวนเงินให้ถูกต้อง" />
              <CurrencyDemo label="จำนวนเงิน" initial={3000} disabled />
            </div>
          </Sub>
          <Sub label="Switch · เปิด / ปิด / disabled">
            <SwitchDemo label="นับรวมในวงเงินใช้ตามใจ" initial />
            <SwitchDemo label="แจ้งเตือนก่อนครบกำหนด" initial={false} />
            <SwitchDemo label="ปิดใช้งาน" initial={false} disabled />
          </Sub>
          <Sub label="SegmentedControl">
            <SegmentedDemo />
          </Sub>
        </Section>

        <Section title="Sheet & Toast">
          <Button variant="secondary" onClick={() => setSheetOpen(true)}>
            เปิด Sheet
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => notify('บันทึกแล้ว')}>
              Toast
            </Button>
            <Button variant="secondary" onClick={() => notify('บันทึกแล้ว', { undo: () => notify('เลิกทำแล้ว') })}>
              Toast + เลิกทำ
            </Button>
          </div>
          <Sub label="HoldToDelete · กดค้าง 1.2 วินาที หรือกด Enter สองครั้ง">
            <HoldToDelete onConfirm={() => notify('ลบแล้ว')} />
          </Sub>
          <BottomSheet open={sheetOpen} onOpenChange={setSheetOpen} title="เพิ่มรายการ">
            <div className="flex flex-col gap-4">
              <CurrencyDemo label="จำนวนเงิน" initial={null} />
              <Button
                variant="primary"
                size="lg"
                onClick={() => {
                  setSheetOpen(false);
                  notify('บันทึกแล้ว');
                }}
              >
                บันทึก
              </Button>
            </div>
          </BottomSheet>
        </Section>

        <Section title="สถานะว่าง/โหลด">
          <Sub label="EmptyState">
            <EmptyState message="ยังไม่มีรายการ กด + เพื่อเพิ่มรายการแรก" />
          </Sub>
          <Sub label="Skeleton">
            <div className="flex items-center gap-3 py-2">
              <Skeleton className="h-11 w-11 shrink-0" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-5 w-16" />
            </div>
          </Sub>
        </Section>
      </main>
    </div>
  );
}
