import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DesignPage from './DesignPage';

// The real provider reads localStorage, which makes Node print an experimental-feature warning under jsdom.
// A controllable stub also lets us assert what ThemeSwitch writes.
const setPref = vi.fn();
let mockPref: 'system' | 'light' | 'dark' = 'system';
vi.mock('../components/ThemeProvider', () => ({
  useTheme: () => ({ pref: mockPref, resolved: mockPref === 'dark' ? 'dark' : 'light', setPref }),
}));

afterEach(() => {
  cleanup();
  setPref.mockClear();
  mockPref = 'system';
});

const renderPage = () =>
  render(
    // Same future flags as App.tsx, otherwise React Router prints v7 warnings into the test output.
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <DesignPage />
    </MemoryRouter>,
  );

const GROUPS = [
  'สี',
  'ตัวอักษร',
  'ปุ่ม',
  'Tile & Pill',
  'ตัวเลขเงิน',
  'แถบสัดส่วน',
  'แถวรายการ',
  'ฟอร์ม',
  'Sheet & Toast',
  'สถานะว่าง/โหลด',
];

describe('<DesignPage>', () => {
  it('has the h1 and one h2 per component group, in order', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'Design system' })).toBeTruthy();
    const h2s = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(h2s).toEqual(GROUPS);
  });

  it('has a theme switch bound to the theme provider', () => {
    renderPage();
    const group = screen.getByRole('tablist', { name: 'ธีม' });
    const tabs = within(group).getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['ระบบ', 'สว่าง', 'มืด']);
    expect(within(group).getByRole('tab', { name: 'ระบบ' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.click(within(group).getByRole('tab', { name: 'มืด' }));
    expect(setPref).toHaveBeenCalledWith('dark');
  });

  it('shows every colour token as a swatch with a contrast ratio for both themes', () => {
    renderPage();
    const swatches = screen.getAllByTestId('swatch');
    // 6 neutrals + accent + 3 status + 2 label fills + 6 hues x (ink on bg, mark on surface) = more than 20.
    expect(swatches.length).toBeGreaterThan(20);
    for (const s of swatches) {
      expect(s.textContent).toMatch(/\d+\.\d{2}:1/);
    }
    // text on surface is 17+:1 in light; the exact figure comes from tokens.css so only the shape is pinned.
    const textOnSurface = screen.getByTestId('swatch-text-on-surface');
    expect(textOnSurface.textContent).toMatch(/สว่าง \d+\.\d{2}:1/);
    expect(textOnSurface.textContent).toMatch(/มืด \d+\.\d{2}:1/);
  });

  it('shows the spare hues lilac and rose as tile, pill and mark', () => {
    renderPage();
    for (const hue of ['lilac', 'rose']) {
      expect(screen.getByTestId(`hue-${hue}`)).toBeTruthy();
      expect(screen.getByTestId(`hue-${hue}-mark`).className).toContain(`bg-${hue}-mark`);
    }
  });

  it('shows the edge states: null, zero, over budget, empty list, error', () => {
    renderPage();
    // null money renders an em dash.
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    // Over-budget bar states the overage in words.
    expect(screen.getAllByRole('img').some((el) => /เกินงบ/.test(el.getAttribute('aria-label') ?? ''))).toBe(true);
    // A field in error shows its message as text.
    expect(screen.getAllByText('กรอกจำนวนเงินให้ถูกต้อง').length).toBeGreaterThan(0);
    // An empty state with a message.
    expect(screen.getByText('ยังไม่มีรายการ กด + เพื่อเพิ่มรายการแรก')).toBeTruthy();
  });

  it('shows disabled and loading buttons', () => {
    renderPage();
    const disabled = screen.getAllByRole('button').filter((b) => (b as HTMLButtonElement).disabled);
    expect(disabled.length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button').some((b) => b.getAttribute('aria-busy') === 'true')).toBe(true);
  });

  it('adds a sample row that animates in, then removes it with the faster exit', async () => {
    renderPage();
    const slot = screen.getByTestId('row-motion-slot');
    expect(within(slot).queryByText('แถวตัวอย่าง')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'เพิ่มแถวตัวอย่าง' }));
    const row = within(slot).getByText('แถวตัวอย่าง').closest('.row-enter');
    expect(row).toBeTruthy();
    expect(row!.classList.contains('row-exit')).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'ลบแถวตัวอย่าง' }));
    // First the exit class is applied, and only afterwards is the row unmounted.
    expect(row!.classList.contains('row-exit')).toBe(true);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 200));
    });
    await waitFor(() => expect(within(slot).queryByText('แถวตัวอย่าง')).toBeNull());
  });
});
