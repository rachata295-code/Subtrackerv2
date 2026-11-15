import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { AllocationBar } from './AllocationBar';

afterEach(cleanup);

const parts = [
  { id: 'a', label: 'ผ่อน', amount: 1000, hue: 'sky' as const },
  { id: 'b', label: 'สมาชิก', amount: 500, hue: 'apricot' as const, state: 'paid' as const },
];

describe('<AllocationBar>', () => {
  it('adds a teal remaining segment and labels what is left', () => {
    const { container } = render(<AllocationBar total={2000} parts={parts} />);
    expect(container.querySelector('[data-segment="__remaining"]')!.className).toContain('bg-teal-mark');
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('เหลือ ฿500.00');
  });

  it('draws paid segments at reduced opacity and uses hue marks', () => {
    const { container } = render(<AllocationBar total={2000} parts={parts} />);
    expect(container.querySelector('[data-segment="b"]')!.className).toContain('opacity-50');
    expect(container.querySelector('[data-segment="a"]')!.className).toContain('bg-sky-mark');
  });

  it('over budget: no remaining segment, negative outline and an aria-label saying so', () => {
    const { container } = render(<AllocationBar total={1000} parts={parts} />);
    expect(container.querySelector('[data-segment="__remaining"]')).toBeNull();
    const bar = screen.getByRole('img');
    expect(bar.getAttribute('aria-label')).toBe('เกินงบ ฿500.00');
    expect(bar.className).toContain('outline-negative');
  });

  it('animates only transform and positions segments with translateX/scaleX', () => {
    const { container } = render(<AllocationBar total={2000} parts={parts} />);
    const second = container.querySelector('[data-segment="b"]') as HTMLElement;
    expect(second.className).toContain('transition-transform');
    expect(second.style.transform).toBe('translateX(50%) scaleX(0.25)');
  });

  // Mockup: 2px gaps between segments. Gaps are separate transform-positioned strips, so they
  // animate with the segments and never touch layout.
  it('separates adjacent segments with a gap strip on each boundary, none after the last', () => {
    const { container } = render(<AllocationBar total={2000} parts={parts} />);
    // a | b | remaining -> gaps after a and after b only
    const gaps = Array.from(container.querySelectorAll<HTMLElement>('[data-gap]'));
    expect(gaps.map((g) => g.dataset.gap)).toEqual(['a', 'b']);
    expect(gaps[0].style.transform).toBe('translateX(50%)');
    expect(gaps[1].style.transform).toBe('translateX(75%)');
    for (const g of gaps) {
      expect(g.className).toContain('transition-transform');
      expect((g.firstElementChild as HTMLElement).className).toContain('w-0.5');
      expect((g.firstElementChild as HTMLElement).className).toContain('bg-surface');
    }
  });

  it('has no gap after the final segment when over budget', () => {
    const { container } = render(<AllocationBar total={1000} parts={parts} />);
    expect(Array.from(container.querySelectorAll<HTMLElement>('[data-gap]')).map((g) => g.dataset.gap)).toEqual(['a']);
  });
});
