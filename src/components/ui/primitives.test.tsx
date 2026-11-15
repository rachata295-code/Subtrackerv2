import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Button } from './Button';
import { IconButton } from './IconButton';
import { Card } from './Card';
import { Tile } from './Tile';
import { Pill } from './Pill';

afterEach(cleanup);

describe('<Button>', () => {
  it('does not call onClick when disabled', () => {
    const onClick = vi.fn();
    render(
      <Button variant="primary" disabled onClick={onClick}>
        บันทึก
      </Button>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'บันทึก' }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('is busy and disabled while loading, and ignores clicks', () => {
    const onClick = vi.fn();
    render(
      <Button variant="primary" loading onClick={onClick}>
        บันทึก
      </Button>,
    );
    const btn = screen.getByRole('button', { name: 'บันทึก' });
    expect(btn.getAttribute('aria-busy')).toBe('true');
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('calls onClick when enabled and defaults to type=button', () => {
    const onClick = vi.fn();
    render(<Button variant="secondary" onClick={onClick}>ตกลง</Button>);
    const btn = screen.getByRole('button', { name: 'ตกลง' });
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(btn.getAttribute('type')).toBe('button');
  });

  it('is at least 44px tall (h-11) and uses tile radius', () => {
    render(<Button variant="primary">ตกลง</Button>);
    const cls = screen.getByRole('button').className;
    expect(cls).toContain('h-11');
    expect(cls).toContain('rounded-tile');
    expect(cls).toContain('pressable');
  });

  it('maps variants to token classes', () => {
    render(
      <>
        <Button variant="primary">a</Button>
        <Button variant="secondary">b</Button>
        <Button variant="danger">c</Button>
      </>,
    );
    expect(screen.getByRole('button', { name: 'a' }).className).toContain('bg-accent');
    expect(screen.getByRole('button', { name: 'b' }).className).toContain('bg-stone-bg');
    expect(screen.getByRole('button', { name: 'b' }).className).toContain('text-stone-ink');
    expect(screen.getByRole('button', { name: 'c' }).className).toContain('bg-negative');
  });

  it('only styles hover behind the hover-fine variant', () => {
    render(<Button variant="primary">a</Button>);
    const hoverClasses = screen
      .getByRole('button')
      .className.split(/\s+/)
      .filter((c) => c.includes('hover:'));
    expect(hoverClasses.length).toBeGreaterThan(0);
    for (const c of hoverClasses) expect(c.startsWith('hover-fine:hover:')).toBe(true);
  });
});

describe('<IconButton>', () => {
  it('exposes its label as the accessible name', () => {
    render(<IconButton label="เพิ่มรายการ" icon={<svg aria-hidden="true" />} />);
    expect(screen.getByRole('button', { name: 'เพิ่มรายการ' })).toBeTruthy();
  });

  it('has a 44px tap target', () => {
    render(<IconButton label="เพิ่มรายการ" icon={<svg aria-hidden="true" />} />);
    const cls = screen.getByRole('button').className;
    expect(cls).toContain('h-11');
    expect(cls).toContain('w-11');
  });
});

describe('<Card>', () => {
  it('uses the card radius and padding by default, none on request', () => {
    const { container, rerender } = render(<Card>x</Card>);
    const el = () => container.firstElementChild as HTMLElement;
    expect(el().className).toContain('rounded-card');
    expect(el().className).toContain('p-card');
    expect(el().className).not.toContain('shadow');
    rerender(<Card padding="none">x</Card>);
    expect(el().className).not.toContain('p-card');
  });
});

describe('<Tile>', () => {
  it('is a button when clickable and calls onClick', () => {
    const onClick = vi.fn();
    render(<Tile hue="sky" label="ค่าใช้จ่าย" value={1200} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('has no button role without onClick', () => {
    render(<Tile hue="sky" label="ค่าใช้จ่าย" value={1200} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('applies hue classes from the static map', () => {
    const { container } = render(<Tile hue="sky" label="ค่าใช้จ่าย" value={1200} />);
    const cls = (container.firstElementChild as HTMLElement).className;
    expect(cls).toContain('bg-sky-bg');
    expect(cls).toContain('text-sky-ink');
  });

  it('renders the label and the formatted amount', () => {
    render(<Tile hue="teal" label="เหลือ" value={1234.5} />);
    expect(screen.getByText('เหลือ')).toBeTruthy();
    expect(document.body.textContent).toContain('฿1,234');
  });
});

describe('<Pill>', () => {
  it('applies hue classes and the pill radius', () => {
    render(<Pill hue="apricot">ค้างชำระ</Pill>);
    const cls = screen.getByText('ค้างชำระ').className;
    expect(cls).toContain('bg-apricot-bg');
    expect(cls).toContain('text-apricot-ink');
    expect(cls).toContain('rounded-pill');
  });
});

// Motion guard: transition-all / `transition: all` would animate layout properties.
describe('source scan', () => {
  const SRC = resolve(__dirname, '../..');
  const SELF = resolve(__filename);
  const BANNED = /transition-all|transition:\s*all/;

  function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const p = join(dir, name);
      return statSync(p).isDirectory() ? walk(p) : [p];
    });
  }

  it('no file in src/ uses transition-all or `transition: all`', () => {
    const offenders = walk(SRC)
      .filter((f) => /\.(tsx?|css)$/.test(f) && f !== SELF)
      .filter((f) => BANNED.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
