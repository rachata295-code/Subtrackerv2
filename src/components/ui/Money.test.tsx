import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { Money, type MoneyKind, type MoneySize } from './Money';

afterEach(cleanup);

const MINUS = '−';

// Money renders a single root span; its class list and text are what callers rely on.
function root(ui: ReactElement): HTMLElement {
  const { container } = render(ui);
  return container.firstElementChild as HTMLElement;
}

describe('<Money>', () => {
  it('renders an em dash in muted for null', () => {
    const el = root(<Money value={null} />);
    expect(el.textContent).toBe('—');
    expect(el.className).toContain('text-muted');
  });

  it('treats non-finite values like null rather than printing NaN', () => {
    expect(root(<Money value={NaN} />).textContent).toBe('—');
  });

  it('renders zero as ฿0.00 in muted, even for income', () => {
    const el = root(<Money value={0} kind="income" />);
    expect(el.textContent).toBe('฿0.00');
    expect(el.className).toContain('text-muted');
    expect(el.className).not.toContain('text-positive');
  });

  it('renders income with + in positive', () => {
    const el = root(<Money value={100} kind="income" />);
    expect(el.textContent).toBe('+฿100.00');
    expect(el.className).toContain('text-positive');
  });

  it('renders spend in ink and never red, even for a negative value', () => {
    for (const value of [662.07, -50]) {
      const el = root(<Money value={value} kind="spend" />);
      expect(el.outerHTML).not.toContain('text-negative');
      expect(el.className).toContain('text-text');
      cleanup();
    }
  });

  it('renders a negative neutral value (over budget) in negative', () => {
    const el = root(<Money value={-458.93} kind="neutral" />);
    expect(el.textContent).toBe(`${MINUS}฿458.93`);
    expect(el.className).toContain('text-negative');
  });

  it('renders a positive neutral value in ink', () => {
    const el = root(<Money value={1381.93} />);
    expect(el.textContent).toBe('฿1,381.93');
    expect(el.className).toContain('text-text');
    expect(el.className).not.toContain('text-negative');
  });

  it('uses tabular numerals at every size', () => {
    for (const size of ['xl', 'md', 'sm'] as MoneySize[]) {
      expect(root(<Money value={12.3} size={size} />).className).toContain('tabular-nums');
      cleanup();
    }
  });

  it('shrinks and mutes satang at xl only', () => {
    const xl = render(<Money value={662.07} size="xl" />);
    const satang = xl.getByText('.07');
    expect(satang.className).toContain('text-muted');
    expect(satang.className).toContain('text-money');
    expect(xl.container.textContent).toBe('฿662.07');
    cleanup();

    const md = render(<Money value={662.07} size="md" />);
    expect(md.getByText('.07').className).not.toContain('text-muted');
  });

  it('exports the kind and size unions for other components', () => {
    const kinds: MoneyKind[] = ['spend', 'income', 'neutral'];
    const sizes: MoneySize[] = ['xl', 'md', 'sm'];
    expect(kinds).toHaveLength(3);
    expect(sizes).toHaveLength(3);
  });

  it("tone='inherit' adds no colour class, even for zero, null and negative", () => {
    for (const value of [1200, 0, null, -5]) {
      const el = root(<Money value={value} tone="inherit" />);
      expect(el.className).not.toMatch(/text-(text|muted|positive|negative)/);
      cleanup();
    }
  });

  it("tone='auto' (default) keeps the colour rules", () => {
    expect(root(<Money value={1200} />).className).toContain('text-text');
  });
});
