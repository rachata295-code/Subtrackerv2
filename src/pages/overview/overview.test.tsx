import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { toast } from 'sonner';
import { financeFixture } from '../../fixtures/finance';
import type {
  BillPayment,
  CreateTransactionInput,
  ISODate,
  Outflow,
  PayBillInput,
  Pot,
  Transaction,
  UseFinanceData,
} from '../../types/finance';
import { AppToaster } from '../../components/ui/Toaster';
import * as domain from '../../domain';
import * as financeHooks from '../../hooks/useFinance';
import OverviewPage from './index';

// Mock ThemeProvider so AppToaster reads a deterministic theme without touching localStorage.
vi.mock('../../components/ThemeProvider', () => ({
  useTheme: () => ({ pref: 'light', resolved: 'light', setPref: () => {} }),
}));

const TODAY: ISODate = '2026-11-15';

let mockFinanceState: UseFinanceData = {
  data: financeFixture,
  isLoading: false,
  error: null,
};

let createTxSpy = vi.fn<(input: CreateTransactionInput) => Promise<Transaction>>();
let deleteTxSpy = vi.fn<(id: string) => Promise<void>>();
let payBillSpy = vi.fn<(input: PayBillInput) => Promise<BillPayment>>();
let deleteBillPaymentSpy = vi.fn<(id: string) => Promise<void>>();

function renderOverview() {
  return render(
    <MemoryRouter initialEntries={['/']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/" element={<OverviewPage today={TODAY} />} />
        <Route path="/bills" element={<h1>บิล & ผ่อน</h1>} />
        <Route path="/settings" element={<h1>ตั้งค่า</h1>} />
      </Routes>
      <AppToaster />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockFinanceState = { data: financeFixture, isLoading: false, error: null };
  createTxSpy = vi.fn(async (input) => ({ id: 'tx-new-1', ...input }));
  deleteTxSpy = vi.fn(async () => {});
  payBillSpy = vi.fn(async (input) => ({ id: 'pay-new-1', ...input }));
  deleteBillPaymentSpy = vi.fn(async () => {});

  vi.spyOn(financeHooks, 'useFinanceData').mockImplementation(() => mockFinanceState);
  vi.spyOn(financeHooks, 'useCreateTransaction').mockImplementation(() => ({
    mutate: (input) => {
      void createTxSpy(input);
    },
    mutateAsync: createTxSpy,
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

    fireEvent.click(screen.getByRole('button', { name: 'ดูทั้งหมด' }));
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
});
