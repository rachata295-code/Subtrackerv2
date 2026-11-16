import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AppShell } from '../../components/layout/AppShell';
import { ROW_EXIT_MS } from '../../components/ui/AnimatedRow';
import { AppToaster } from '../../components/ui/Toaster';
import { financeFixture } from '../../fixtures/finance';
import { mockMatchMedia } from '../../test/mockMatchMedia';
import type {
  AmountExpressionResult,
  BillPayment,
  CreateTransactionInput,
  CreateTransactionsInput,
  HotbarItem,
  ISODate,
  Outflow,
  PayBillInput,
  Pot,
  Transaction,
  UseFinanceData,
} from '../../types/finance';
import { parseAmount } from '../../lib/parseAmount';
import * as domain from '../../domain';
import * as financeHooks from '../../hooks/useFinance';
import OverviewPage from './index';

// Mock ThemeProvider so AppToaster reads a deterministic theme without touching localStorage.
vi.mock('../../components/ThemeProvider', () => ({
  useTheme: () => ({ pref: 'light', resolved: 'light', setPref: () => {} }),
}));

const TODAY: ISODate = '2026-11-15';

const FIXTURE_HOTBAR: HotbarItem[] = [
  {
    note: 'ข้าวมันไก่',
    amount: 4_500,
    category: 'food',
    sourceId: 'src-bank',
    potId: 'pot-essential',
    count: 3,
    lastDate: '2026-11-08',
  },
  {
    note: 'ชานม',
    amount: 8_500,
    category: 'food',
    sourceId: 'src-bank',
    potId: 'pot-essential',
    count: 2,
    lastDate: '2026-11-06',
  },
];

function specEvaluateAmountExpression(text: string): AmountExpressionResult {
  const trimmed = text.trim();
  if (!trimmed) return { error: 'กรอกจำนวนเงินให้ถูกต้อง' };
  const normalized = trimmed.replace(/\u2212/g, '-');
  if (/[^0-9.,+\-\s฿]/.test(normalized)) return { error: 'รูปแบบตัวเลขไม่ถูกต้อง' };
  const parts = normalized.split(/([+-])/);
  if (parts.length === 0 || parts[0] === '' || parts[parts.length - 1] === '') {
    return { error: 'นิพจน์ไม่สมบูรณ์' };
  }
  let total = 0;
  let op = 1;
  for (let i = 0; i < parts.length; i++) {
    const token = parts[i]!.trim();
    if (i % 2 === 1) {
      op = token === '-' ? -1 : 1;
      continue;
    }
    const parsed = parseAmount(token);
    if (parsed === null) return { error: 'รูปแบบตัวเลขไม่ถูกต้อง' };
    total += op * Math.round(Number((parsed * 100).toPrecision(15)));
  }
  if (total <= 0) return { error: 'ยอดต้องมากกว่า 0' };
  return { value: total };
}

let mockFinanceState: UseFinanceData = {
  data: financeFixture,
  isLoading: false,
  error: null,
};

let createTxSpy = vi.fn<(input: CreateTransactionInput) => Promise<Transaction>>();
let createTxsSpy = vi.fn<(inputs: CreateTransactionsInput) => Promise<Transaction[]>>();
let deleteTxSpy = vi.fn<(id: string) => Promise<void>>();
let payBillSpy = vi.fn<(input: PayBillInput) => Promise<BillPayment>>();
let deleteBillPaymentSpy = vi.fn<(id: string) => Promise<void>>();

function LocationProbe({
  onUpdate,
}: {
  onUpdate: (loc: { pathname: string; search: string }, navigate: ReturnType<typeof useNavigate>) => void;
}) {
  const loc = useLocation();
  const navigate = useNavigate();
  onUpdate({ pathname: loc.pathname, search: loc.search }, navigate);
  return null;
}

function renderOverview(options?: {
  initialEntries?: string[];
  withShell?: boolean;
  onLocation?: (loc: { pathname: string; search: string }, navigate: ReturnType<typeof useNavigate>) => void;
}) {
  const { initialEntries = ['/'], withShell = false, onLocation } = options ?? {};
  const pageRoute = <Route path="/" element={<OverviewPage today={TODAY} />} />;
  return render(
    <MemoryRouter initialEntries={initialEntries} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        {withShell ? (
          <Route element={<AppShell />}>
            {pageRoute}
            <Route path="/bills" element={<h1>บิล & ผ่อน</h1>} />
            <Route path="/entries" element={<h1>รายการ</h1>} />
            <Route path="/settings" element={<h1>ตั้งค่า</h1>} />
          </Route>
        ) : (
          <>
            {pageRoute}
            <Route path="/bills" element={<h1>บิล & ผ่อน</h1>} />
            <Route path="/entries" element={<h1>รายการ</h1>} />
            <Route path="/settings" element={<h1>ตั้งค่า</h1>} />
          </>
        )}
      </Routes>
      {onLocation ? <LocationProbe onUpdate={onLocation} /> : null}
      <AppToaster />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockFinanceState = { data: financeFixture, isLoading: false, error: null };
  createTxSpy = vi.fn(async (input) => ({
    id: 'tx-new-1',
    ...input,
    createdAt: input.createdAt ?? `${input.date}T12:00:00.000Z`,
    recurringIncomeId: input.recurringIncomeId ?? null,
    incomeDueOn: input.incomeDueOn ?? null,
  }));
  createTxsSpy = vi.fn(async (inputs) =>
    inputs.map((input, idx) => ({
      id: `tx-batch-${idx + 1}`,
      ...input,
      createdAt: input.createdAt ?? `${input.date}T12:00:0${idx}.000Z`,
      recurringIncomeId: input.recurringIncomeId ?? null,
      incomeDueOn: input.incomeDueOn ?? null,
    })),
  );
  deleteTxSpy = vi.fn(async () => {});
  payBillSpy = vi.fn(async (input) => ({
    id: 'pay-new-1',
    ...input,
    createdAt: input.createdAt ?? `${input.paidOn}T12:00:00.000Z`,
  }));
  deleteBillPaymentSpy = vi.fn(async () => {});

  const origEval = domain.evaluateAmountExpression;
  vi.spyOn(domain, 'evaluateAmountExpression').mockImplementation((text) => {
    try {
      return origEval(text);
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('not implemented')) {
        return specEvaluateAmountExpression(text);
      }
      throw err;
    }
  });
  const origHotbar = domain.hotbarItems;
  vi.spyOn(domain, 'hotbarItems').mockImplementation((data, today, limit) => {
    try {
      return origHotbar(data, today, limit);
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('not implemented')) {
        return data.transactions.length === 0 ? [] : FIXTURE_HOTBAR;
      }
      throw err;
    }
  });

  vi.spyOn(financeHooks, 'useFinanceData').mockImplementation(() => mockFinanceState);
  vi.spyOn(financeHooks, 'useCreateTransaction').mockImplementation(() => ({
    mutate: (input) => {
      void createTxSpy(input);
    },
    mutateAsync: createTxSpy,
    isPending: false,
    error: null,
  }));
  vi.spyOn(financeHooks, 'useCreateTransactions').mockImplementation(() => ({
    mutate: (inputs) => {
      void createTxsSpy(inputs);
    },
    mutateAsync: createTxsSpy,
    isPending: false,
    error: null,
  }));
  vi.spyOn(financeHooks, 'useDeleteTransaction').mockImplementation(() => ({
    mutate: (id) => {
      void deleteTxSpy(id);
    },
    mutateAsync: deleteTxSpy,
    isPending: false,
    error: null,
  }));
  vi.spyOn(financeHooks, 'usePayBill').mockImplementation(() => ({
    mutate: (input) => {
      void payBillSpy(input);
    },
    mutateAsync: payBillSpy,
    isPending: false,
    error: null,
  }));
  vi.spyOn(financeHooks, 'useDeleteBillPayment').mockImplementation(() => ({
    mutate: (id) => {
      void deleteBillPaymentSpy(id);
    },
    mutateAsync: deleteBillPaymentSpy,
    isPending: false,
    error: null,
  }));
});

afterEach(() => {
  cleanup();
  toast.dismiss();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const playLeft = () => screen.getByTestId('play-left');
const owed = () => screen.getByTestId('owed');
const tileAmount = (label: string) => screen.getByText(label).parentElement!.textContent!.slice(label.length);

describe('<OverviewPage>', () => {
  it('shows header, period from payPeriod, days left, and 662.07 from fixtures', () => {
    renderOverview();
    expect(screen.getByRole('heading', { level: 1, name: 'ภาพรวม' })).toBeTruthy();
    expect(screen.getByText('รอบ 10 พ.ย. – 9 ธ.ค. · อีก 25 วัน')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'เพิ่มรายการ' })).toBeTruthy();

    expect(playLeft().textContent).toBe('฿662.07');
    expect(playLeft().querySelector('.text-money-xl')).toBeTruthy();
    expect(document.querySelectorAll('.text-money-xl')).toHaveLength(1);

    expect(owed().textContent).toBe('฿2,458.93');
    expect(screen.getByRole('img', { name: 'เหลือ ฿662.07' })).toBeTruthy();

    expect(tileAmount('บัตรเครดิต · 24 พ.ย.')).toBe('฿1,077.00');
    expect(tileAmount('SPayLater · ≤10 ธ.ค.')).toBe('฿1,381.93');
    expect(tileAmount('ใช้เล่นไปแล้ว')).toBe('฿420.00');
    expect(tileAmount('ก้อน 3,000 + ยกมา 541')).toBe('฿3,541.00');
  });

  it('shows essential pot (pot 2) in a single row with spent, budget, and left', () => {
    mockFinanceState = {
      ...mockFinanceState,
      data: {
        ...financeFixture,
        transactions: [
          ...financeFixture.transactions,
          {
            id: 'tx-nov-essential',
            date: '2026-11-12',
            amount: 250_000,
            direction: 'out',
            sourceId: 'src-bank',
            potId: 'pot-essential',
            category: 'other',
            note: 'ค่าห้อง',
            createdAt: '2026-11-12T10:00:00.000Z',
            recurringIncomeId: null,
            incomeDueOn: null,
          },
        ],
      },
    };
    renderOverview();
    const essential = screen.getByTestId('essential-pot');
    expect(within(essential).getByRole('heading', { level: 2, name: 'ใช้จ่ายจำเป็น' })).toBeTruthy();
    expect(within(essential).getByText('ใช้ไป')).toBeTruthy();
    expect(within(essential).getByText('งบ')).toBeTruthy();
    expect(within(essential).getByText('เหลือ')).toBeTruthy();
    expect(essential.textContent).toContain('฿2,500.00');
    expect(essential.textContent).toContain('฿7,200.00');
    expect(essential.textContent).toContain('฿4,700.00');
  });

  it('renders upcoming outflows with bills strong + pay button, charges with Pill + เข้าบิล <เดือน>, and total excluding charges', () => {
    renderOverview();
    const upcoming = screen.getByTestId('upcoming');
    expect(within(upcoming).getByText('บิล บัตรเครดิต')).toBeTruthy();
    expect(within(upcoming).getByText('Gemini + YouTube')).toBeTruthy();
    expect(within(upcoming).getByText('Claude')).toBeTruthy();
    expect(within(upcoming).getByText('iCloud')).toBeTruthy();
    expect(within(upcoming).getByText('บิล SPayLater')).toBeTruthy();

    // Charge rows show channel pill and "เข้าบิล ธ.ค."
    expect(within(upcoming).getAllByText('เข้าบิล ธ.ค.')).toHaveLength(3);
    // Total outflow counts only bills (1,077.00 + 1,381.93 = 2,458.93), never charges.
    expect(screen.getByTestId('upcoming-total').textContent).toBe('฿2,458.93');
  });

  it('caps upcoming outflows at 5 rows and navigates to /bills on ดูทั้งหมด', () => {
    const base = domain.upcomingOutflows(financeFixture, TODAY);
    vi.spyOn(domain, 'upcomingOutflows').mockReturnValue([
      ...base,
      {
        date: '2026-12-12',
        dueBy: false,
        title: 'Netflix',
        amount: 41_900,
        sourceId: 'src-card',
        kind: 'charge',
        counted: false,
        statementKey: '2027-01',
      } satisfies Outflow,
    ]);
    renderOverview();
    const upcoming = screen.getByTestId('upcoming');
    expect(within(upcoming).queryByText('Netflix')).toBeNull();

    fireEvent.click(within(upcoming.parentElement!).getByRole('button', { name: 'ดูทั้งหมด' }));
    expect(screen.getByRole('heading', { level: 1, name: 'บิล & ผ่อน' })).toBeTruthy();
  });

  it('calls usePayBill only once on double-tap and moves focus to owed region with preventScroll', async () => {
    renderOverview();
    const payButtons = screen.getAllByRole('button', { name: 'จ่ายแล้ว' });
    const firstPay = payButtons[0];
    const target = owed().closest('[role="status"]') as HTMLElement;
    const focusSpy = vi.spyOn(target, 'focus');

    firstPay.focus();
    act(() => {
      fireEvent.click(firstPay);
      fireEvent.click(firstPay);
    });

    expect(payBillSpy).toHaveBeenCalledTimes(1);
    expect(payBillSpy).toHaveBeenCalledWith({
      sourceId: 'src-card',
      statementKey: '2026-11',
      amount: 107_700,
      paidOn: TODAY,
    });
    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
    focusSpy.mockRestore();
  });

  it('opens quick-add BottomSheet (no Switch), validates, calls useCreateTransaction, and supports toast undo', async () => {
    renderOverview();
    fireEvent.click(screen.getByRole('button', { name: 'เพิ่มรายการ' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByLabelText('จำนวนเงิน')).toBeTruthy();
    expect(within(dialog).getByRole('tablist', { name: 'ช่องทางจ่าย' })).toBeTruthy();
    expect(within(dialog).getByRole('tablist', { name: 'ก้อนเงิน' })).toBeTruthy();
    expect(within(dialog).getByRole('group', { name: 'หมวดหมู่' })).toBeTruthy();
    expect(within(dialog).queryByRole('switch')).toBeNull();

    // Empty amount shows error and keeps sheet open.
    fireEvent.click(within(dialog).getByRole('button', { name: 'บันทึก' }));
    expect(within(dialog).getByText('กรอกจำนวนเงินให้ถูกต้อง')).toBeTruthy();
    expect(createTxSpy).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByLabelText('จำนวนเงิน'), { target: { value: '125.50' } });
    fireEvent.click(within(dialog).getByRole('tab', { name: 'บัตรเครดิต' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'อาหาร' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'บันทึก' }));

    await waitFor(() => expect(createTxSpy).toHaveBeenCalledTimes(1));
    expect(createTxSpy).toHaveBeenCalledWith({
      date: TODAY,
      amount: 12_550,
      direction: 'out',
      sourceId: 'src-card',
      potId: 'pot-play',
      category: 'food',
      note: '',
    });

    expect(await screen.findByText('บันทึกแล้ว')).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: 'เลิกทำ' }));
    await waitFor(() => expect(deleteTxSpy).toHaveBeenCalledWith('tx-new-1'));
  });

  it('renders over-budget status tokens when potStatus.over is true', () => {
    const realPotStatus = domain.potStatus;
    vi.spyOn(domain, 'potStatus').mockImplementation((pot: Pot, periodKey, data) => {
      if (pot.id === 'pot-essential') return realPotStatus(pot, periodKey, data);
      return {
        carryIn: 0,
        budget: 300_000,
        reserved: 245_893,
        spent: 79_107,
        left: -25_000,
        over: true,
      };
    });
    renderOverview();
    expect(playLeft().textContent).toBe('−฿250.00');
    expect(playLeft().querySelector('.text-negative')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'เกินงบ ฿250.00' }).className).toContain('outline-negative');
  });

  it('renders Skeleton loading state when isLoading is true', () => {
    mockFinanceState = { data: undefined, isLoading: true, error: null };
    renderOverview();
    expect(screen.getByRole('heading', { level: 1, name: 'ภาพรวม' })).toBeTruthy();
    expect(screen.getByRole('status', { name: 'กำลังโหลด' })).toBeTruthy();
    expect(screen.queryByTestId('play-left')).toBeNull();
  });

  it('renders ErrorState with retry button when useFinanceData returns an error', () => {
    const refetch = vi.fn();
    mockFinanceState = {
      data: undefined,
      isLoading: false,
      error: new Error('network failed'),
      refetch,
    } as UseFinanceData;
    renderOverview();
    expect(screen.getByRole('alert')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'ลองใหม่' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('renders ErrorState instead of crashing when domain calculation throws', () => {
    vi.spyOn(domain, 'payPeriod').mockImplementation(() => {
      throw new Error('domain failure');
    });
    renderOverview();
    expect(screen.getByRole('heading', { level: 1, name: 'ภาพรวม' })).toBeTruthy();
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'ลองใหม่' })).toBeTruthy();
  });

  it('renders EmptyState inviting to settings when data is missing or unconfigured', () => {
    mockFinanceState = { data: undefined, isLoading: false, error: null };
    renderOverview();
    expect(screen.getByText('ยังไม่มีข้อมูลบัญชีหรือก้อนเงิน เริ่มต้นได้ในหน้าตั้งค่า')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'ไปตั้งค่า' }));
    expect(screen.getByRole('heading', { level: 1, name: 'ตั้งค่า' })).toBeTruthy();
  });

  it('keeps playLeft at 662.07 and drops owed to 1,381.93 after card bill payment is recorded', () => {
    mockFinanceState = {
      data: {
        ...financeFixture,
        payments: [
          ...financeFixture.payments,
          {
            id: 'pay-nov-card',
            sourceId: 'src-card',
            statementKey: '2026-11',
            amount: 107_700,
            paidOn: TODAY,
            createdAt: '2026-11-15T12:00:00.000Z',
          },
        ],
      },
      isLoading: false,
      error: null,
    };
    renderOverview();
    expect(playLeft().textContent).toBe('฿662.07');
    expect(owed().textContent).toBe('฿1,381.93');
    expect(tileAmount('บัตรเครดิต · จ่ายแล้ว')).toBe('฿1,077.00');
    expect(tileAmount('ใช้เล่นไปแล้ว')).toBe('฿420.00');
    expect(screen.getByRole('img', { name: 'เหลือ ฿662.07' })).toBeTruthy();
    expect(document.querySelector('[data-segment="src-card"]')!.className).toContain('opacity-50');
  });

  it('at 375px keeps single-column mobile layout with recent transactions hidden', () => {
    mockMatchMedia(375);
    renderOverview({ withShell: true });

    const grid = screen.getByTestId('overview-layout');
    expect(grid.className).toContain('flex-col');
    expect(grid.className).toContain('lg:grid-cols-[minmax(0,1fr)_360px]');

    const potsGrid = screen.getByTestId('pots-grid');
    expect(potsGrid.className).toContain('md:grid-cols-2');

    // Essential pot stays at the bottom on mobile (order-4) while shifting into the 2-pot grid at md+.
    expect(screen.getByTestId('essential-pot').className).toContain('order-4');
    expect(screen.getByTestId('essential-pot').className).toContain('md:order-2');

    // Recent transactions are desktop-only so mobile 375px stays unchanged.
    expect(screen.getByTestId('recent-transactions').className).toContain('hidden');
    expect(screen.getByTestId('recent-transactions').className).toContain('lg:block');

    // Quick add uses bottom sheet on mobile.
    fireEvent.click(screen.getByRole('button', { name: 'เพิ่มรายการ' }));
    expect(screen.getByRole('dialog').getAttribute('data-vaul-drawer-direction')).toBe('bottom');
  });

  it('at 1280px renders 2-column desktop layout with pots side by side, upcoming, and 5 recent entries', () => {
    mockMatchMedia(1280);
    renderOverview({ withShell: true });

    const grid = screen.getByTestId('overview-layout');
    expect(grid.className).toContain('lg:grid');
    expect(grid.className).toContain('lg:grid-cols-[minmax(0,1fr)_360px]');

    const leftCol = screen.getByTestId('overview-left');
    const rightCol = screen.getByTestId('overview-right');

    expect(within(leftCol).getByRole('heading', { level: 1, name: 'ภาพรวม' })).toBeTruthy();
    expect(within(leftCol).getByTestId('pots-grid').className).toContain('md:grid-cols-2');
    expect(within(leftCol).getByTestId('essential-pot')).toBeTruthy();
    expect(within(leftCol).getByRole('img', { name: 'เหลือ ฿662.07' })).toBeTruthy();

    expect(within(rightCol).getByTestId('upcoming')).toBeTruthy();
    const recent = within(rightCol).getByTestId('recent-transactions');
    expect(within(recent).getByRole('heading', { level: 2, name: 'รายการล่าสุด' })).toBeTruthy();
    // Fixture has 3 transactions in Nov period (and 1 in Oct which must be excluded).
    expect(within(recent).getByText('เกม')).toBeTruthy();
    expect(within(recent).getByText('ชานม')).toBeTruthy();
    expect(within(recent).getByText('หนัง')).toBeTruthy();
    expect(within(recent).queryByText('ปรับยอดยกมา')).toBeNull();

    // Quick add uses right-side drawer on desktop.
    fireEvent.click(screen.getByRole('button', { name: '+ เพิ่มรายการ' }));
    expect(screen.getByRole('dialog').getAttribute('data-vaul-drawer-direction')).toBe('right');
  });

  it('caps recent transactions at 5 latest entries of the current period and navigates to /entries', () => {
    mockMatchMedia(1280);
    const extraTx: Transaction[] = [
      { id: 'tx-nov-1', date: '2026-11-10', amount: 5_000, direction: 'out', sourceId: 'src-bank', potId: 'pot-play', category: 'food', note: 'ข้าวเช้า', createdAt: '2026-11-10T08:00:00.000Z', recurringIncomeId: null, incomeDueOn: null },
      { id: 'tx-nov-2', date: '2026-11-11', amount: 6_000, direction: 'out', sourceId: 'src-bank', potId: 'pot-play', category: 'food', note: 'กาแฟ', createdAt: '2026-11-11T08:00:00.000Z', recurringIncomeId: null, incomeDueOn: null },
      { id: 'tx-nov-3', date: '2026-11-15', amount: 7_000, direction: 'out', sourceId: 'src-card', potId: 'pot-play', category: 'shopping', note: 'ของใช้', createdAt: '2026-11-15T08:00:00.000Z', recurringIncomeId: null, incomeDueOn: null },
    ];
    mockFinanceState = {
      ...mockFinanceState,
      data: {
        ...financeFixture,
        transactions: [...extraTx, ...financeFixture.transactions],
      },
    };
    renderOverview();

    const recent = screen.getByTestId('recent-transactions');
    // 6 Nov transactions exist; oldest ('ข้าวเช้า' on Nov 10) must be dropped by the 5-row cap.
    expect(within(recent).getByText('ของใช้')).toBeTruthy();
    expect(within(recent).getByText('เกม')).toBeTruthy();
    expect(within(recent).getByText('ชานม')).toBeTruthy();
    expect(within(recent).getByText('หนัง')).toBeTruthy();
    expect(within(recent).getByText('กาแฟ')).toBeTruthy();
    expect(within(recent).queryByText('ข้าวเช้า')).toBeNull();

    fireEvent.click(within(recent).getByRole('button', { name: 'ดูทั้งหมด' }));
    expect(screen.getByRole('heading', { level: 1, name: 'รายการ' })).toBeTruthy();
  });

  it('opens QuickAddSheet once on /?add=1, strips add with replace, and does not reopen on back', async () => {
    mockMatchMedia(1280);
    let currentLoc = { pathname: '/', search: '' };
    let navFn: ReturnType<typeof useNavigate> | null = null;

    renderOverview({
      initialEntries: ['/bills', '/?add=1'],
      onLocation: (loc, nav) => {
        currentLoc = loc;
        navFn = nav;
      },
    });

    expect(await screen.findByRole('dialog')).toBeTruthy();
    await waitFor(() => {
      expect(currentLoc.pathname).toBe('/');
      expect(currentLoc.search).toBe('');
    });

    // Close the sheet, navigate away, then go back -> sheet must stay closed.
    fireEvent.click(screen.getByRole('button', { name: 'ปิด' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    act(() => {
      navFn!('/entries');
    });
    expect(screen.getByRole('heading', { level: 1, name: 'รายการ' })).toBeTruthy();

    act(() => {
      navFn!(-1);
    });
    expect(screen.getByRole('heading', { level: 1, name: 'ภาพรวม' })).toBeTruthy();
    expect(currentLoc.search).toBe('');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('does not play row enter/exit animations on initial mount', () => {
    const { container } = renderOverview();
    expect(container.querySelector('.row-enter')).toBeNull();
    expect(container.querySelector('.row-exit')).toBeNull();
    expect(container.querySelector('[data-leaving="true"]')).toBeNull();
    expect(container.querySelector('.money-in')).toBeNull();
    expect(container.querySelector('.money-out')).toBeNull();
  });

  it('animates newly added recent row on enter, paid bill row on exit, and shows bill-specific + error toasts', async () => {
    mockMatchMedia(1280);
    // Simulate reactive query data updates when createTransaction or payBill succeeds.
    createTxSpy = vi.fn(async (input) => {
      const created: Transaction = {
        id: 'tx-added-anim',
        ...input,
        createdAt: input.createdAt ?? `${input.date}T12:00:00.000Z`,
        recurringIncomeId: input.recurringIncomeId ?? null,
        incomeDueOn: input.incomeDueOn ?? null,
      };
      mockFinanceState = {
        ...mockFinanceState,
        data: {
          ...mockFinanceState.data!,
          transactions: [created, ...mockFinanceState.data!.transactions],
        },
      };
      return created;
    });
    payBillSpy = vi.fn(async (input) => {
      const payment: BillPayment = {
        id: 'pay-anim-1',
        ...input,
        createdAt: input.createdAt ?? `${input.paidOn}T12:00:00.000Z`,
      };
      mockFinanceState = {
        ...mockFinanceState,
        data: {
          ...mockFinanceState.data!,
          payments: [payment, ...mockFinanceState.data!.payments],
        },
      };
      return payment;
    });

    const { rerender } = renderOverview();

    // 1. Quick add -> "บันทึกแล้ว" toast + new row gets .row-enter (existing rows do not).
    fireEvent.click(screen.getByRole('button', { name: 'เพิ่มรายการ' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('จำนวนเงิน'), { target: { value: '99' } });
    fireEvent.change(within(dialog).getByLabelText('โน้ต (ไม่บังคับ)'), { target: { value: 'มัทฉะ' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'บันทึก' }));

    expect(await screen.findByText('บันทึกแล้ว')).toBeTruthy();
    // Rerender to reflect updated mockFinanceState from query invalidation.
    rerender(
      <MemoryRouter initialEntries={['/']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/" element={<OverviewPage today={TODAY} />} />
        </Routes>
        <AppToaster />
      </MemoryRouter>,
    );

    const recent = screen.getByTestId('recent-transactions');
    const addedTitle = within(recent).getByText('มัทฉะ');
    expect(addedTitle.closest('.row-enter')).toBeTruthy();
    expect(within(recent).getByText('เกม').closest('.row-enter')).toBeNull();
    // AnimatedMoney on play-left crossfades on change.
    expect(screen.getByTestId('play-left').querySelector('.money-in')).toBeTruthy();

    // 2. Pay bill -> toast "จ่ายบิล บัตรเครดิตแล้ว" + exiting row plays .row-exit before unmounting.
    const payButtons = screen.getAllByRole('button', { name: 'จ่ายแล้ว' });
    const upcoming = screen.getByTestId('upcoming');
    fireEvent.click(payButtons[0]);

    await waitFor(() => {
      const exitingRow = within(upcoming).getByText('บิล บัตรเครดิต').closest('[data-leaving="true"]');
      expect(exitingRow).toBeTruthy();
      expect(exitingRow!.className).toContain('row-exit');
    });
    expect(await screen.findByText('จ่ายบิล บัตรเครดิตแล้ว')).toBeTruthy();
    rerender(
      <MemoryRouter initialEntries={['/']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/" element={<OverviewPage today={TODAY} />} />
        </Routes>
        <AppToaster />
      </MemoryRouter>,
    );

    await waitFor(() => expect(within(upcoming).queryByText('บิล บัตรเครดิต')).toBeNull(), {
      timeout: ROW_EXIT_MS + 1000,
    });
  });

  it('shows error toast when quick add or bill payment fails', async () => {
    createTxSpy = vi.fn(async () => {
      throw new Error('เพิ่มรายการล้มเหลวจากเซิร์ฟเวอร์');
    });
    payBillSpy = vi.fn(async () => {
      throw new Error('เครือข่ายขัดข้อง');
    });

    renderOverview();

    fireEvent.click(screen.getByRole('button', { name: 'เพิ่มรายการ' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('จำนวนเงิน'), { target: { value: '50' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'บันทึก' }));

    expect(await screen.findByText(/เพิ่มรายการล้มเหลวจากเซิร์ฟเวอร์/)).toBeTruthy();
    // Sheet stays open on error.
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'ปิด' }));

    const payButtons = screen.getAllByRole('button', { name: 'จ่ายแล้ว' });
    fireEvent.click(payButtons[0]);
    expect(await screen.findByText(/เครือข่ายขัดข้อง/)).toBeTruthy();
  });

  it('switches QuickAddSheet between รายจ่าย and เงินเข้า with IN_CATEGORIES and null potId', async () => {
    renderOverview();
    fireEvent.click(screen.getByRole('button', { name: 'เพิ่มรายการ' }));
    const dialog = screen.getByRole('dialog');

    expect(within(dialog).getByRole('tablist', { name: 'ประเภท' })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'เก็บเงิน' })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'ลืมจด' })).toBeTruthy();

    fireEvent.click(within(dialog).getByRole('tab', { name: 'เงินเข้า' }));
    expect(within(dialog).getByRole('button', { name: 'เงินประจำ' })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'พาร์ทไทม์' })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'ฟรีแลนซ์' })).toBeTruthy();
    expect(within(dialog).queryByRole('button', { name: 'อาหาร' })).toBeNull();
    expect(within(dialog).queryByRole('tablist', { name: 'ก้อนเงิน' })).toBeNull();

    fireEvent.change(within(dialog).getByLabelText('จำนวนเงิน'), { target: { value: '500' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'พาร์ทไทม์' }));
    fireEvent.change(within(dialog).getByLabelText('โน้ต (ไม่บังคับ)'), { target: { value: 'สอนพิเศษ' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'บันทึก' }));

    await waitFor(() => expect(createTxSpy).toHaveBeenCalledTimes(1));
    expect(createTxSpy).toHaveBeenCalledWith({
      date: TODAY,
      amount: 50_000,
      direction: 'in',
      sourceId: 'src-bank',
      potId: null,
      category: 'parttime',
      note: 'สอนพิเศษ',
    });
  });

  it('adds and deletes multiple rows with AnimatedRow and saves all at once via useCreateTransactions', async () => {
    renderOverview();
    fireEvent.click(screen.getByRole('button', { name: 'เพิ่มรายการ' }));
    const dialog = screen.getByRole('dialog');

    fireEvent.click(within(dialog).getByRole('button', { name: '+ เพิ่มอีกรายการ' }));
    fireEvent.click(within(dialog).getByRole('button', { name: '+ เพิ่มอีกรายการ' }));

    // Delete the 3rd row, then re-add so we also verify AnimatedRow remove/add.
    fireEvent.click(within(dialog).getByRole('button', { name: 'ลบรายการที่ 3' }));
    await waitFor(() => expect(within(dialog).getAllByLabelText('จำนวนเงิน')).toHaveLength(2), {
      timeout: ROW_EXIT_MS + 500,
    });
    fireEvent.click(within(dialog).getByRole('button', { name: '+ เพิ่มอีกรายการ' }));

    const amountInputs = within(dialog).getAllByLabelText('จำนวนเงิน');
    const noteInputs = within(dialog).getAllByLabelText('โน้ต (ไม่บังคับ)');
    expect(amountInputs).toHaveLength(3);

    fireEvent.change(amountInputs[0]!, { target: { value: '45' } });
    fireEvent.change(noteInputs[0]!, { target: { value: 'ข้าวมันไก่' } });
    fireEvent.change(amountInputs[1]!, { target: { value: '120+20' } });
    fireEvent.change(noteInputs[1]!, { target: { value: 'กาแฟ' } });
    fireEvent.change(amountInputs[2]!, { target: { value: '80' } });
    fireEvent.change(noteInputs[2]!, { target: { value: 'รถไฟฟ้า' } });

    const submitBtn = within(dialog).getByRole('button', { name: 'บันทึก 3 รายการ · ฿265' });
    fireEvent.click(submitBtn);

    await waitFor(() => expect(createTxsSpy).toHaveBeenCalledTimes(1));
    expect(createTxSpy).not.toHaveBeenCalled();
    expect(createTxsSpy).toHaveBeenCalledWith([
      {
        date: TODAY,
        amount: 4_500,
        direction: 'out',
        sourceId: 'src-bank',
        potId: 'pot-play',
        category: 'food',
        note: 'ข้าวมันไก่',
      },
      {
        date: TODAY,
        amount: 14_000,
        direction: 'out',
        sourceId: 'src-bank',
        potId: 'pot-play',
        category: 'food',
        note: 'กาแฟ',
      },
      {
        date: TODAY,
        amount: 8_000,
        direction: 'out',
        sourceId: 'src-bank',
        potId: 'pot-play',
        category: 'food',
        note: 'รถไฟฟ้า',
      },
    ]);

    expect(await screen.findByText('บันทึก 3 รายการแล้ว')).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: 'เลิกทำ' }));
    await waitFor(() => expect(deleteTxSpy).toHaveBeenCalledTimes(3));
  });

  it('aborts entire batch without calling useCreateTransactions when any row is invalid or batch fails', async () => {
    createTxsSpy = vi.fn(async () => {
      throw new Error('บันทึกล้มเหลวทั้งชุด');
    });

    renderOverview();
    fireEvent.click(screen.getByRole('button', { name: 'เพิ่มรายการ' }));
    const dialog = screen.getByRole('dialog');

    fireEvent.click(within(dialog).getByRole('button', { name: '+ เพิ่มอีกรายการ' }));
    const amountInputs = within(dialog).getAllByLabelText('จำนวนเงิน');
    fireEvent.change(amountInputs[0]!, { target: { value: '50' } });
    // Leave row 2 empty -> invalid.
    fireEvent.click(within(dialog).getByRole('button', { name: /บันทึก 2 รายการ/ }));

    expect(createTxsSpy).not.toHaveBeenCalled();
    expect(within(dialog).getByText('กรอกจำนวนเงินให้ถูกต้อง')).toBeTruthy();

    // Fix row 2, then test repo failure keeps sheet open + shows error toast.
    fireEvent.change(amountInputs[1]!, { target: { value: '60' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'บันทึก 2 รายการ · ฿110' }));
    expect(await screen.findByText(/บันทึกล้มเหลวทั้งชุด/)).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('warns when date is before the bank account latest BalanceCheck (SPEC §5 C2) and still allows saving', async () => {
    renderOverview();
    fireEvent.click(screen.getByRole('button', { name: 'เพิ่มรายการ' }));
    const dialog = screen.getByRole('dialog');

    // financeFixture has BalanceCheck on 2026-11-10 for src-bank.
    expect(within(dialog).queryByText('รายการนี้อยู่ก่อนเช็กยอดล่าสุด จึงไม่เปลี่ยนยอดบัญชี')).toBeNull();
    fireEvent.change(within(dialog).getByLabelText('วันที่'), { target: { value: '2026-11-09' } });
    expect(within(dialog).getByText('รายการนี้อยู่ก่อนเช็กยอดล่าสุด จึงไม่เปลี่ยนยอดบัญชี')).toBeTruthy();

    // Switching to credit card clears the bank BalanceCheck warning.
    fireEvent.click(within(dialog).getByRole('tab', { name: 'บัตรเครดิต' }));
    expect(within(dialog).queryByText('รายการนี้อยู่ก่อนเช็กยอดล่าสุด จึงไม่เปลี่ยนยอดบัญชี')).toBeNull();

    // Switching back to bank keeps the warning, and submit still succeeds.
    fireEvent.click(within(dialog).getByRole('tab', { name: 'บัญชี' }));
    expect(within(dialog).getByText('รายการนี้อยู่ก่อนเช็กยอดล่าสุด จึงไม่เปลี่ยนยอดบัญชี')).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText('จำนวนเงิน'), { target: { value: '75' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'บันทึก' }));

    await waitFor(() => expect(createTxSpy).toHaveBeenCalledWith(expect.objectContaining({ date: '2026-11-09', amount: 7_500 })));
  });

  it('shows HotBar under overview header and inside QuickAddSheet, supports tap save + undo and long-press prefill at 375px and 1280px', async () => {
    for (const width of [375, 1280]) {
      mockMatchMedia(width);
      const { unmount } = renderOverview({ withShell: true });

      const riceBtn = screen.getByRole('button', { name: 'ข้าวมันไก่ ฿45' });
      expect(riceBtn.className).toContain('pressable');
      expect(riceBtn.className).toContain('min-h-tap');

      // Tap saves immediately with fixture values.
      fireEvent.click(riceBtn);
      await waitFor(() => expect(createTxSpy).toHaveBeenCalledTimes(1));
      expect(createTxSpy).toHaveBeenLastCalledWith({
        date: TODAY,
        amount: 4_500,
        direction: 'out',
        sourceId: 'src-bank',
        potId: 'pot-essential',
        category: 'food',
        note: 'ข้าวมันไก่',
      });
      expect(await screen.findByText('บันทึกข้าวมันไก่ ฿45')).toBeTruthy();
      fireEvent.click(await screen.findByRole('button', { name: 'เลิกทำ' }));
      await waitFor(() => expect(deleteTxSpy).toHaveBeenCalledWith('tx-new-1'));

      // Right-click (or long-press) opens QuickAddSheet prefilled with item values, and HotBar also appears inside sheet.
      const teaBtn = screen.getByRole('button', { name: 'ชานม ฿85' });
      fireEvent.contextMenu(teaBtn);

      const dialog = await screen.findByRole('dialog');
      expect(dialog.getAttribute('data-vaul-drawer-direction')).toBe(width >= 1024 ? 'right' : 'bottom');
      expect((within(dialog).getByLabelText('จำนวนเงิน') as HTMLInputElement).value).toBe('85');
      expect((within(dialog).getByLabelText('โน้ต (ไม่บังคับ)') as HTMLInputElement).value).toBe('ชานม');
      expect(within(dialog).getByRole('button', { name: 'ข้าวมันไก่ ฿45' })).toBeTruthy();

      createTxSpy.mockClear();
      deleteTxSpy.mockClear();
      toast.dismiss();
      unmount();
    }
  });

  it('orders header -> IncomeDueCard -> AvailableCard -> HotBar -> pots-grid without desktop flex order inversion (SPEC §5 C6)', () => {
    mockMatchMedia(1280);
    renderOverview({ withShell: true });

    const leftCol = screen.getByTestId('overview-left');
    const heading = within(leftCol).getByRole('heading', { level: 1, name: 'ภาพรวม' }).closest('header')!;
    const incomeCard = within(leftCol).getByTestId('income-due-cards');
    const availableCard = within(leftCol).getByTestId('available-card');
    const hotbar = within(leftCol).getByRole('region', { name: 'ทางลัดจดเร็ว' });
    const potsGrid = within(leftCol).getByTestId('pots-grid');

    // DOM order must be header -> IncomeDueCard -> AvailableCard -> HotBar -> pots-grid
    expect(heading.compareDocumentPosition(incomeCard) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(incomeCard.compareDocumentPosition(availableCard) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(availableCard.compareDocumentPosition(hotbar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(hotbar.compareDocumentPosition(potsGrid) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // HotBar must not have lg:order-none (which gave it order:0 and jumped above order-1 header on desktop)
    expect(hotbar.className).toContain('order-1');
    expect(hotbar.className).not.toContain('lg:order-none');
  });

  it('supports per-row overrides via ตัวเลือกเพิ่ม and forces potId=null for savings/unknown (SPEC §4 B2 & §6)', async () => {
    renderOverview();
    fireEvent.click(screen.getByRole('button', { name: 'เพิ่มรายการ' }));
    const dialog = screen.getByRole('dialog');

    fireEvent.click(within(dialog).getByRole('button', { name: '+ เพิ่มอีกรายการ' }));
    const amountInputs = within(dialog).getAllByLabelText('จำนวนเงิน');
    fireEvent.change(amountInputs[0]!, { target: { value: '100' } });
    fireEvent.change(amountInputs[1]!, { target: { value: '200' } });

    // Row 1: category "เก็บเงิน" (savings) must force potId: null per SPEC §6.
    const categoryGroups = within(dialog).getAllByRole('group', { name: 'หมวดหมู่' });
    fireEvent.click(within(categoryGroups[0]!).getByRole('button', { name: 'เก็บเงิน' }));

    // Row 2: expand "ตัวเลือกเพิ่ม" and override date to before BalanceCheck (2026-11-08) and source to credit card -> no warning,
    // then back to bank -> warning appears inside row 2 overrides.
    const advButtons = within(dialog).getAllByRole('button', { name: 'ตัวเลือกเพิ่ม' });
    fireEvent.click(advButtons[1]!);
    fireEvent.change(within(dialog).getByLabelText('วันที่ (รายการนี้)'), { target: { value: '2026-11-08' } });
    expect(within(dialog).getByText('รายการนี้อยู่ก่อนเช็กยอดล่าสุด จึงไม่เปลี่ยนยอดบัญชี')).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText('ช่องทาง (รายการนี้)'), { target: { value: 'src-card' } });
    expect(within(dialog).queryByText('รายการนี้อยู่ก่อนเช็กยอดล่าสุด จึงไม่เปลี่ยนยอดบัญชี')).toBeNull();

    fireEvent.click(within(dialog).getByRole('button', { name: 'บันทึก 2 รายการ · ฿300' }));
    await waitFor(() => expect(createTxsSpy).toHaveBeenCalledTimes(1));
    expect(createTxsSpy).toHaveBeenCalledWith([
      {
        date: TODAY,
        amount: 10_000,
        direction: 'out',
        sourceId: 'src-bank',
        potId: null,
        category: 'savings',
        note: '',
      },
      {
        date: '2026-11-08',
        amount: 20_000,
        direction: 'out',
        sourceId: 'src-card',
        potId: 'pot-play',
        category: 'food',
        note: '',
      },
    ]);
  });

  it('preserves QuickAddSheet draft (typing 45+60 -> close -> reopen still visible), supports ล้างฟอร์ม, and clears draft after save (SPEC §A1)', async () => {
    renderOverview();

    // 1. Open QuickAddSheet, type 45+60 (= 105) and a note
    fireEvent.click(screen.getByRole('button', { name: 'เพิ่มรายการ' }));
    let dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('จำนวนเงิน'), { target: { value: '45+60' } });
    expect(within(dialog).getByText('= ฿105.00')).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText('โน้ต (ไม่บังคับ)'), { target: { value: 'ข้าวมันไก่+ชานม' } });

    // 2. Close without saving (via Escape) and reopen -> draft must still be visible
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    fireEvent.click(screen.getByRole('button', { name: 'เพิ่มรายการ' }));
    dialog = screen.getByRole('dialog');
    expect((within(dialog).getByLabelText('จำนวนเงิน') as HTMLInputElement).value).toMatch(/45\+60|105/);
    expect((within(dialog).getByLabelText('โน้ต (ไม่บังคับ)') as HTMLInputElement).value).toBe('ข้าวมันไก่+ชานม');

    // 3. Click "ล้างฟอร์ม" -> resets fields immediately
    fireEvent.click(within(dialog).getByRole('button', { name: 'ล้างฟอร์ม' }));
    expect((within(dialog).getByLabelText('จำนวนเงิน') as HTMLInputElement).value).toBe('');
    expect((within(dialog).getByLabelText('โน้ต (ไม่บังคับ)') as HTMLInputElement).value).toBe('');

    // 4. Type again, save -> clears draft for the next open
    fireEvent.change(within(dialog).getByLabelText('จำนวนเงิน'), { target: { value: '45+60' } });
    fireEvent.change(within(dialog).getByLabelText('โน้ต (ไม่บังคับ)'), { target: { value: 'มื้อเที่ยง' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'บันทึก' }));
    await waitFor(() => expect(createTxSpy).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    fireEvent.click(screen.getByRole('button', { name: 'เพิ่มรายการ' }));
    dialog = screen.getByRole('dialog');
    expect((within(dialog).getByLabelText('จำนวนเงิน') as HTMLInputElement).value).toBe('');
    expect((within(dialog).getByLabelText('โน้ต (ไม่บังคับ)') as HTMLInputElement).value).toBe('');
  });
});
