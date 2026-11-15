import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SegmentedControl } from './SegmentedControl';
import { TabBar } from '../layout/TabBar';

afterEach(cleanup);

const OPTIONS = [
  { value: 'a', label: 'เดือน' },
  { value: 'b', label: 'ปี' },
  { value: 'c', label: 'ทั้งหมด' },
] as const;

describe('<SegmentedControl>', () => {
  it('exposes a labelled tablist with the selected tab marked', () => {
    render(<SegmentedControl label="ช่วงเวลา" options={[...OPTIONS]} value="b" onChange={() => {}} />);
    expect(screen.getByRole('tablist', { name: 'ช่วงเวลา' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'ปี' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'เดือน' }).getAttribute('aria-selected')).toBe('false');
  });

  it('ArrowRight selects the next value and ArrowLeft the previous', () => {
    const onChange = vi.fn();
    render(<SegmentedControl label="ช่วงเวลา" options={[...OPTIONS]} value="a" onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole('tab', { name: 'เดือน' }), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith('b');
    fireEvent.keyDown(screen.getByRole('tab', { name: 'เดือน' }), { key: 'ArrowLeft' });
    // Wraps around so the keyboard never dead-ends.
    expect(onChange).toHaveBeenLastCalledWith('c');
  });

  it('clicking a tab selects it', () => {
    const onChange = vi.fn();
    render(<SegmentedControl label="ช่วงเวลา" options={[...OPTIONS]} value="a" onChange={onChange} />);
    fireEvent.click(screen.getByRole('tab', { name: 'ทั้งหมด' }));
    expect(onChange).toHaveBeenCalledWith('c');
  });

  it('slides the indicator with transform translateX only', () => {
    render(<SegmentedControl label="ช่วงเวลา" options={[...OPTIONS]} value="c" onChange={() => {}} />);
    const indicator = screen.getByTestId('segmented-indicator');
    expect(indicator.style.transform).toBe('translateX(200%)');
  });

  it('uses compact non-wrapping sizing when rendering 4 or more segments so mobile labels never clip', () => {
    const fourOptions = [
      { value: 'all', label: 'ทั้งหมด' },
      { value: 'bank', label: 'บัญชี' },
      { value: 'card', label: 'บัตรเครดิต' },
      { value: 'paylater', label: 'SPayLater' },
    ];
    render(<SegmentedControl label="กรองช่องทาง" options={fourOptions} value="all" onChange={() => {}} />);
    const tab = screen.getByRole('tab', { name: 'SPayLater' });
    expect(tab.className).toContain('text-sm');
    expect(tab.className).toContain('px-1.5');
    expect(tab.className).toContain('truncate');
  });
});

describe('<TabBar>', () => {
  function renderAt(path: string) {
    return render(
      <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <TabBar />
      </MemoryRouter>,
    );
  }

  it('is a labelled navigation with 4 links pointing to the phase-1 tabs', () => {
    renderAt('/');
    const nav = screen.getByRole('navigation', { name: 'เมนูหลัก' });
    const links = Array.from(nav.querySelectorAll('a'));
    expect(links).toHaveLength(4);
    expect(links.map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['ภาพรวม', '/'],
      ['รายการ', '/entries'],
      ['บิล & ผ่อน', '/bills'],
      ['ตั้งค่า', '/settings'],
    ]);
  });

  it('marks only the current route as aria-current="page"', () => {
    renderAt('/bills');
    expect(screen.getByRole('link', { name: 'บิล & ผ่อน' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'ภาพรวม' }).getAttribute('aria-current')).toBeNull();
    expect(screen.getByRole('link', { name: 'รายการ' }).getAttribute('aria-current')).toBeNull();
    expect(screen.getByRole('link', { name: 'ตั้งค่า' }).getAttribute('aria-current')).toBeNull();
  });

  it('marks no tab current when on a non-tab route like /design', () => {
    renderAt('/design');
    expect(document.querySelectorAll('[aria-current="page"]')).toHaveLength(0);
  });

  it('reserves the iOS home-indicator safe area', () => {
    renderAt('/');
    const nav = screen.getByRole('navigation', { name: 'เมนูหลัก' });
    expect(nav.getAttribute('style')).toContain('safe-area-inset-bottom');
  });
});
