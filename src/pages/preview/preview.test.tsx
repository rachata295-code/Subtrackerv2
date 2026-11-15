import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { toast } from 'sonner';
import { formatTHB } from '../../lib/money';
import { AnimatedMoney } from '../../components/ui/AnimatedMoney';
import { AppToaster } from '../../components/ui/Toaster';
import PreviewHome from './PreviewHome';
import {
  billAmount,
  daysLeft,
  derive,
  initialPaidState,
  markPaid,
  samplePeriod,
  sumAmounts,
  upcomingAmount,
  type BillId,
} from './sampleData';

// The real provider reads localStorage (Node prints an experimental warning under jsdom); the toaster and the
// theme-less screen only need a resolved theme.
vi.mock('../../components/ThemeProvider', () => ({
  useTheme: () => ({ pref: 'light', resolved: 'light', setPref: () => {} }),
}));

afterEach(() => {
  cleanup();
  toast.dismiss();
});

/** "฿1,381.93" or "−฿240.50" -> integer satang, so sums are exact. */
function satang(text: string): number {
  const m = /^([−-]?)฿([\d,]+)\.(\d{2})$/.exec(text.trim());
  if (!m) throw new Error(`Not a 2-decimal baht amount: "${text}"`);
  const n = Number(m[2].replace(/,/g, '')) * 100 + Number(m[3]);
  return m[1] ? -n : n;
}

const NONE = new Set<BillId>();

describe('sampleData', () => {
  it('has a total pot of exactly 3541.00, summed from pot + carry', () => {
    const d = derive(samplePeriod, NONE);
    expect(d.pot).toBe(3541);
    expect(formatTHB(d.pot)).toBe('฿3,541.00');
  });

  it('sums bills from their line items', () => {
    const [card, spay] = samplePeriod.bills;
    expect(billAmount(card)).toBe(1077);
    expect(billAmount(spay)).toBe(1381.93);
    expect(card.items.map((i) => [i.label, i.amount])).toEqual([
      ['Claude', 699],
      ['Gemini + YouTube', 279],
      ['iCloud', 99],
    ]);
    expect(samplePeriod.play.map((p) => p.amount)).toEqual([220, 85, 115]);
    expect(derive(samplePeriod, NONE).spent).toBe(420);
  });

  it('keeps bills + spent + playLeft === pot to the satang, from the displayed 2-decimal values', () => {
    const d = derive(samplePeriod, NONE);
    const shown = [d.billsTotal, d.spent, d.playLeft].map((n) => satang(formatTHB(n)));
    expect(shown.reduce((a, b) => a + b, 0)).toBe(satang(formatTHB(d.pot)));
    expect(formatTHB(d.playLeft)).toBe('฿662.07');
  });

  it('is unaffected by float noise (0.1 + 0.2)', () => {
    expect(sumAmounts([0.1, 0.2])).toBe(0.3);
  });

  it('lists upcoming money in date order, resolving amounts from the rows', () => {
    const rows = samplePeriod.upcoming;
    expect(rows.map((r) => r.title)).toEqual(['จ่ายบิลบัตร', 'Gemini + YouTube', 'Claude', 'AirPods งวด 3/10']);
    const key = (r: (typeof rows)[number]) => r.date.month * 100 + r.date.day;
    expect(rows.map(key)).toEqual([...rows.map(key)].sort((a, b) => a - b));
    expect(rows.map((r) => upcomingAmount(samplePeriod, r))).toEqual([1077, 279, 699, 1381.93]);
  });

  it('counts 25 days from 15 พ.ย. to 10 ธ.ค.', () => {
    expect(daysLeft(samplePeriod)).toBe(25);
  });

  it('owed drops by the paid bill only, and playLeft does not move', () => {
    const before = derive(samplePeriod, NONE);
    const after = derive(samplePeriod, new Set<BillId>(['card']));
    expect(before.owed).toBe(2458.93);
    expect(after.owed).toBe(1381.93);
    expect(after.playLeft).toBe(before.playLeft);
  });

  it('markPaid is idempotent: a second payment returns the same state', () => {
    const once = markPaid(initialPaidState, 'card');
    expect(markPaid(once, 'card')).toBe(once);
    expect([...once.paid]).toEqual(['card']);
  });
});

describe('<AnimatedMoney>', () => {
  it('renders the value with no animation on first paint', () => {
    const { container } = render(<AnimatedMoney value={2458.93} />);
    expect(container.textContent).toBe('฿2,458.93');
    expect(container.querySelector('.money-in, .money-out')).toBeNull();
  });

  it('crossfades old to new on change, then settles on the new value only', async () => {
    const { container, rerender } = render(<AnimatedMoney value={2458.93} />);
    rerender(<AnimatedMoney value={1381.93} />);
    // Both layers exist while the fade runs; the old one is hidden from assistive tech.
    const old = container.querySelector('.money-out');
    expect(old?.textContent).toBe('฿2,458.93');
    expect(old?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('.money-in')?.textContent).toBe('฿1,381.93');
    await waitFor(() => expect(container.textContent).toBe('฿1,381.93'));
    expect(container.querySelector('.money-out')).toBeNull();
  });

  it('does not loop when the value is NaN (Object.is, not !==)', () => {
    const { container, rerender } = render(<AnimatedMoney value={NaN} />);
    // With `!==`, NaN !== NaN is always true and the render-phase setState would never settle.
    rerender(<AnimatedMoney value={NaN} />);
    expect(container.textContent).toBe('—');
    expect(container.querySelector('.money-in, .money-out')).toBeNull();
  });

  it('settles on the latest value when changed again mid-fade', async () => {
    const { container, rerender } = render(<AnimatedMoney value={100} />);
    rerender(<AnimatedMoney value={200} />);
    rerender(<AnimatedMoney value={300} />);
    await waitFor(() => expect(container.textContent).toBe('฿300.00'));
  });
});

function renderHome() {
  return render(
    <MemoryRouter initialEntries={['/preview-home']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <PreviewHome />
      <AppToaster />
    </MemoryRouter>,
  );
}

const owed = () => screen.getByTestId('owed');
const playLeft = () => screen.getByTestId('play-left');
const payButtons = () => screen.getAllByRole('button', { name: 'จ่ายแล้ว' });
/** Tile amount: the tile's label is its first span, the amount the second. */
const tileAmount = (label: string) => screen.getByText(label).parentElement!.textContent!.slice(label.length);

describe('<PreviewHome>', () => {
  it('shows the header, period and days left', () => {
    renderHome();
    expect(screen.getByRole('heading', { level: 1, name: 'ภาพรวม' })).toBeTruthy();
    expect(screen.getByText('รอบ 10 พ.ย. – 10 ธ.ค. · อีก 25 วัน')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'เพิ่มรายการ' })).toBeTruthy();
  });

  it('makes "เหลือใช้เล่น" the largest figure, at ฿662.07, and "ยังต้องจ่ายอีก" starts at ฿2,458.93', () => {
    renderHome();
    expect(screen.getByText('เหลือใช้เล่น')).toBeTruthy();
    expect(playLeft().textContent).toBe('฿662.07');
    expect(playLeft().querySelector('.text-money-xl')).toBeTruthy();
    expect(owed().textContent).toBe('฿2,458.93');
    // No other money figure on the screen is xl.
    expect(document.querySelectorAll('.text-money-xl')).toHaveLength(1);
  });

  it('shows tiles that add up to the pot on screen, to the satang', () => {
    renderHome();
    const card = satang(tileAmount('บิลบัตร · 24 พ.ย.'));
    const spay = satang(tileAmount('SPayLater · ≤10 ธ.ค.'));
    const used = satang(tileAmount('ใช้เล่นไปแล้ว'));
    const pot = satang(tileAmount('ก้อน 3,000 + ยกมา 541'));
    expect(pot).toBe(354100);
    expect(card + spay + used + satang(playLeft().textContent!)).toBe(pot);
  });

  it('lists the four upcoming payments in date order', () => {
    renderHome();
    const list = screen.getByTestId('upcoming');
    const titles = ['จ่ายบิลบัตร', 'Gemini + YouTube', 'Claude', 'AirPods งวด 3/10'].map((t) => within(list).getByText(t));
    for (let i = 1; i < titles.length; i++) {
      expect(titles[i - 1].compareDocumentPosition(titles[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    expect(within(list).getByText('≤10')).toBeTruthy();
    expect(within(list).getByText('SPayLater')).toBeTruthy();
  });

  it('paying the card bill updates "ยังต้องจ่ายอีก", keeps "เหลือใช้เล่น" and removes the 24 พ.ย. row', async () => {
    renderHome();
    expect(screen.getByRole('img', { name: 'เหลือ ฿662.07' })).toBeTruthy();
    fireEvent.click(payButtons()[0]);

    await waitFor(() => expect(owed().textContent).toBe('฿1,381.93'));
    expect(playLeft().textContent).toBe('฿662.07');
    await waitFor(() => expect(screen.queryByText('จ่ายบิลบัตร')).toBeNull());
    // The pot is unchanged: the bar still totals 3,541 and still reports the same remainder.
    expect(screen.getByRole('img', { name: 'เหลือ ฿662.07' })).toBeTruthy();
    expect(tileAmount('ก้อน 3,000 + ยกมา 541')).toBe('฿3,541.00');
    // The paid card segment is dimmed, not removed.
    expect(document.querySelector('[data-segment="card"]')!.className).toContain('opacity-50');
    // The fade-out layer of the animated figure has gone, leaving only the new value.
    await waitFor(() => expect(document.querySelector('.money-out')).toBeNull());
  });

  it('paying twice quickly is idempotent: still ฿1,381.93 (not ฿304.93) and the bar total holds', async () => {
    renderHome();
    const button = payButtons()[0];
    // Both taps happen inside ONE act, so React has not re-rendered between them: the second tap still hits the
    // live button and the same handler, exactly like a real double tap. (Separate fireEvent calls each flush, so
    // the button would already be gone by the second one and the test would prove nothing.)
    act(() => {
      expect(button.isConnected).toBe(true);
      fireEvent.click(button);
      expect(button.isConnected).toBe(true);
      fireEvent.click(button);
    });
    await waitFor(() => expect(owed().textContent).toBe('฿1,381.93'));
    // Let any pending timers run, then re-check: nothing may drift afterwards.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 400));
    });
    expect(owed().textContent).toBe('฿1,381.93');
    expect(playLeft().textContent).toBe('฿662.07');
    expect(tileAmount('ก้อน 3,000 + ยกมา 541')).toBe('฿3,541.00');
    expect(screen.getByRole('img', { name: 'เหลือ ฿662.07' })).toBeTruthy();
  });

  it('moves focus to the owed status region after paying, instead of dropping it to <body>', async () => {
    renderHome();
    const button = payButtons()[0];
    button.focus();
    expect(document.activeElement).toBe(button);
    fireEvent.click(button);
    // The pressed button unmounts on this render; focus must already have a home.
    await waitFor(() => expect(owed().textContent).toBe('฿1,381.93'));
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toBe(owed().closest('[role="status"]'));
    expect(document.activeElement!.getAttribute('tabindex')).toBe('-1');
    // Still there once the paid row has fully left.
    await waitFor(() => expect(screen.queryByText('จ่ายบิลบัตร')).toBeNull());
    expect(document.activeElement).not.toBe(document.body);
  });

  it('moves focus without scrolling, so a pay tapped far down the list keeps the user in place', () => {
    renderHome();
    const target = owed().closest('[role="status"]') as HTMLElement;
    const spy = vi.spyOn(target, 'focus');
    fireEvent.click(payButtons()[0]);
    expect(spy).toHaveBeenCalledWith({ preventScroll: true });
    spy.mockRestore();
  });

  it('plays the shared row exit on the paid row before removing it', async () => {
    renderHome();
    const title = screen.getByText('จ่ายบิลบัตร');
    fireEvent.click(payButtons()[0]);
    await waitFor(() => expect(title.closest('.row-exit')).toBeTruthy());
    await waitFor(() => expect(screen.queryByText('จ่ายบิลบัตร')).toBeNull());
  });

  it('announces the owed figure together with its label, not as a bare amount', async () => {
    renderHome();
    const live = owed().closest('[aria-live]')!;
    expect(live.getAttribute('aria-live')).toBe('polite');
    expect(live.textContent).toBe('ยังต้องจ่ายอีก฿2,458.93');
    // Only one live region owns the figure: a nested one would announce the bare amount a second time.
    expect(live.querySelectorAll('[aria-live]')).toHaveLength(0);
    fireEvent.click(payButtons()[0]);
    await waitFor(() => expect(live.textContent).toBe('ยังต้องจ่ายอีก฿1,381.93'));
  });

  it('paying the last open bill draws a check, then the row leaves', async () => {
    renderHome();
    fireEvent.click(payButtons()[0]);
    await waitFor(() => expect(screen.queryByText('จ่ายบิลบัตร')).toBeNull());
    // Only the card bill's payment so far: no celebration yet.
    expect(screen.queryByTestId('paid-check')).toBeNull();

    fireEvent.click(payButtons()[0]);
    const check = await screen.findByTestId('paid-check');
    expect(check.querySelector('path')!.getAttribute('class')).toContain('check-draw');
    await waitFor(() => expect(owed().textContent).toBe('฿0.00'));
    await waitFor(() => expect(screen.queryByText('AirPods งวด 3/10', { selector: 'span' })).toBeNull(), { timeout: 1500 });
    expect(playLeft().textContent).toBe('฿662.07');
    expect(screen.queryAllByRole('button', { name: 'จ่ายแล้ว' })).toHaveLength(0);
  });

  describe('add sheet', () => {
    const open = () => fireEvent.click(screen.getByRole('button', { name: 'เพิ่มรายการ' }));
    const dialog = () => screen.getByRole('dialog');

    it('opens with a currency field, a switch and a save button', () => {
      renderHome();
      open();
      expect(within(dialog()).getByLabelText('จำนวนเงิน')).toBeTruthy();
      expect(within(dialog()).getByRole('switch', { name: 'นับรวมในวงเงินใช้ตามใจ' })).toBeTruthy();
      expect(within(dialog()).getByRole('button', { name: 'บันทึก' })).toBeTruthy();
    });

    it('rejects an empty amount with an error and stays open', () => {
      renderHome();
      open();
      fireEvent.click(within(dialog()).getByRole('button', { name: 'บันทึก' }));
      expect(within(dialog()).getByText('กรอกจำนวนเงินให้ถูกต้อง')).toBeTruthy();
      expect(screen.queryByText('บันทึกแล้ว')).toBeNull();
    });

    it('saves, shows a toast with undo, and undo takes the spending back', async () => {
      renderHome();
      open();
      fireEvent.change(within(dialog()).getByLabelText('จำนวนเงิน'), { target: { value: '100' } });
      fireEvent.click(within(dialog()).getByRole('button', { name: 'บันทึก' }));

      expect(await screen.findByText('บันทึกแล้ว')).toBeTruthy();
      expect(playLeft().textContent).toBe('฿562.07');
      expect(tileAmount('ใช้เล่นไปแล้ว')).toBe('฿520.00');

      fireEvent.click(await screen.findByRole('button', { name: 'เลิกทำ' }));
      await waitFor(() => expect(playLeft().textContent).toBe('฿662.07'));
      expect(tileAmount('ใช้เล่นไปแล้ว')).toBe('฿420.00');
    });

    it('adds a row that enters with the shared motion, and undo plays the exit before removing it', async () => {
      renderHome();
      expect(screen.queryByTestId('added')).toBeNull();
      open();
      fireEvent.change(within(dialog()).getByLabelText('จำนวนเงิน'), { target: { value: '100' } });
      fireEvent.click(within(dialog()).getByRole('button', { name: 'บันทึก' }));

      const added = await screen.findByTestId('added');
      const row = within(added).getByText('รายจ่าย').closest('.row-enter');
      expect(row).toBeTruthy();
      expect(added.textContent).toContain('฿100.00');
      // The initial upcoming rows never animate in.
      expect(document.querySelector('[data-testid="upcoming"] .row-enter')).toBeNull();

      fireEvent.click(await screen.findByRole('button', { name: 'เลิกทำ' }));
      await waitFor(() => expect(row!.classList.contains('row-exit')).toBe(true));
      // The amount stops counting at once; the row is removed after its exit.
      expect(playLeft().textContent).toBe('฿662.07');
      await waitFor(() => expect(screen.queryByTestId('added')).toBeNull());
    });

    it('does not count the amount into the play budget when the switch is off', async () => {
      renderHome();
      open();
      fireEvent.change(within(dialog()).getByLabelText('จำนวนเงิน'), { target: { value: '100' } });
      fireEvent.click(within(dialog()).getByRole('switch', { name: 'นับรวมในวงเงินใช้ตามใจ' }));
      fireEvent.click(within(dialog()).getByRole('button', { name: 'บันทึก' }));
      expect(await screen.findByText('บันทึกแล้ว')).toBeTruthy();
      expect(playLeft().textContent).toBe('฿662.07');
    });
  });
});
