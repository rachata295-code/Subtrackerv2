import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ListRow } from './ListRow';
import { DateBadge } from './DateBadge';
import { SectionHeader } from './SectionHeader';
import { EmptyState } from './EmptyState';
import { Skeleton } from './Skeleton';

afterEach(cleanup);

describe('<DateBadge>', () => {
  it('shows the day and Thai month', () => {
    render(<DateBadge day={5} month={10} />);
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getByText('พ.ย.')).toBeTruthy();
  });

  it('prefixes ≤ for a due-by date', () => {
    render(<DateBadge day={10} month={11} dueBy />);
    expect(screen.getByText('≤10')).toBeTruthy();
    expect(screen.getByText('ธ.ค.')).toBeTruthy();
  });
});

describe('<ListRow>', () => {
  // Review Focus 1: a long title with a large amount must truncate the title, never push the amount out.
  const LONG = 'ค่าผ่อนโทรศัพท์มือถือเครื่องใหม่ งวด 10/24';

  it('truncates a long title and keeps the amount on one line', () => {
    render(<ListRow title={LONG} amount={123456.78} />);
    const title = screen.getByText(LONG);
    expect(title.className).toContain('truncate');
    expect(title.parentElement!.className).toContain('min-w-0');

    const amount = screen.getByText('฿123,456').parentElement!;
    expect(amount.className).toContain('whitespace-nowrap');
    expect(amount.className).toContain('shrink-0');
  });

  it('right-aligns the amount', () => {
    render(<ListRow title="เน็ตบ้าน" amount={599} />);
    expect(screen.getByText('฿599').parentElement!.className).toContain('text-right');
  });

  it('renders leading and detail content', () => {
    render(<ListRow title="เน็ตบ้าน" amount={599} leading={<span>L</span>} detail={<span>ทุกเดือน</span>} />);
    expect(screen.getByText('L')).toBeTruthy();
    expect(screen.getByText('ทุกเดือน')).toBeTruthy();
  });

  it('is a button only when onClick is given', () => {
    const onClick = vi.fn();
    const { rerender } = render(<ListRow title="เน็ตบ้าน" amount={599} />);
    expect(screen.queryByRole('button')).toBeNull();
    rerender(<ListRow title="เน็ตบ้าน" amount={599} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('makes the title semibold when strong', () => {
    render(<ListRow title="เน็ตบ้าน" amount={599} strong />);
    expect(screen.getByText('เน็ตบ้าน').className).toContain('font-semibold');
  });

  it('renders an em dash for a null amount', () => {
    render(<ListRow title="เน็ตบ้าน" amount={null} />);
    expect(screen.getByText('—')).toBeTruthy();
  });
});

describe('<SectionHeader>', () => {
  it('renders the title as a heading with no action by default', () => {
    render(<SectionHeader title="กำลังจะถึง" />);
    // Spec 5.4: section titles are 18px (text-section), not the 16px body size.
    expect(screen.getByRole('heading', { name: 'กำลังจะถึง' }).className).toContain('text-section');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders an action that fires onAction', () => {
    const onAction = vi.fn();
    render(<SectionHeader title="กำลังจะถึง" actionLabel="ดูทั้งหมด" onAction={onAction} />);
    fireEvent.click(screen.getByRole('button', { name: 'ดูทั้งหมด' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});

describe('<EmptyState>', () => {
  it('renders only its message, with no image or svg', () => {
    const { container } = render(<EmptyState message="ยังไม่มีรายการ" />);
    expect(screen.getByText('ยังไม่มีรายการ')).toBeTruthy();
    expect(container.querySelector('img, svg')).toBeNull();
  });
});

describe('<Skeleton>', () => {
  it('is hidden from assistive tech and accepts a className', () => {
    const { container } = render(<Skeleton className="h-4 w-24" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.className).toContain('h-4 w-24');
  });
});
