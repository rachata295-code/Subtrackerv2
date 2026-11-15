import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppShell } from './AppShell';
import { mockMatchMedia } from '../../test/mockMatchMedia';

vi.mock('../ThemeProvider', () => ({
  useTheme: () => ({ pref: 'system' as const, resolved: 'light' as const, setPref: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('<AppShell>', () => {
  it('renders a 480px centered column with scrollable main and sticky TabBar', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<h1>หัวข้อหน้า</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    const shell = container.firstElementChild as HTMLElement;
    expect(shell.className).toContain('max-w-phone');
    expect(shell.className).toContain('mx-auto');
    expect(shell.className).toContain('h-dvh');

    const main = screen.getByRole('main');
    expect(main.className).toContain('overflow-y-auto');
    expect(main.className).toContain('flex-1');
    expect(screen.getByRole('heading', { level: 1, name: 'หัวข้อหน้า' })).toBeTruthy();

    const nav = screen.getByRole('navigation', { name: 'เมนูหลัก' });
    expect(nav.className).toContain('sticky');
    expect(nav.className).toContain('bottom-0');
  });

  it('does not mount a duplicate Toaster inside AppShell', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AppShell>
          <p>เนื้อหา</p>
        </AppShell>
      </MemoryRouter>,
    );

    expect(container.querySelector('[data-sonner-toaster]')).toBeNull();
    expect(screen.getByText('เนื้อหา')).toBeTruthy();
  });

  it('at 375px renders mobile/tablet column with TabBar only (no SideNav)', () => {
    mockMatchMedia(375);
    const { container } = render(
      <MemoryRouter initialEntries={['/']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AppShell>
          <h1>หัวข้อหน้า</h1>
        </AppShell>
      </MemoryRouter>,
    );

    const shell = container.firstElementChild as HTMLElement;
    expect(shell.className).toContain('max-w-phone');
    expect(shell.className).toContain('md:max-w-tablet');
    expect(screen.getAllByRole('navigation', { name: 'เมนูหลัก' })).toHaveLength(1);
    expect(screen.getByRole('navigation', { name: 'เมนูหลัก' }).className).toContain('bottom-0');
    expect(screen.queryByRole('button', { name: '+ เพิ่มรายการ' })).toBeNull();
  });

  it('at 768px renders tablet column (md:max-w-tablet) with TabBar only (no SideNav)', () => {
    mockMatchMedia(768);
    const { container } = render(
      <MemoryRouter initialEntries={['/']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AppShell>
          <h1>หัวข้อหน้า</h1>
        </AppShell>
      </MemoryRouter>,
    );

    const shell = container.firstElementChild as HTMLElement;
    expect(shell.className).toContain('max-w-phone');
    expect(shell.className).toContain('md:max-w-tablet');
    expect(screen.getAllByRole('navigation', { name: 'เมนูหลัก' })).toHaveLength(1);
    expect(screen.getByRole('navigation', { name: 'เมนูหลัก' }).className).toContain('bottom-0');
    expect(screen.queryByRole('button', { name: '+ เพิ่มรายการ' })).toBeNull();
  });

  it('at 1280px renders SideNav + max-w-content main without TabBar', () => {
    mockMatchMedia(1280);
    render(
      <MemoryRouter initialEntries={['/']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AppShell>
          <h1>หัวข้อหน้า</h1>
        </AppShell>
      </MemoryRouter>,
    );

    expect(screen.getAllByRole('navigation', { name: 'เมนูหลัก' })).toHaveLength(1);
    expect(screen.getByRole('navigation', { name: 'เมนูหลัก' }).className).not.toContain('bottom-0');
    expect(screen.getByRole('button', { name: '+ เพิ่มรายการ' })).toBeTruthy();

    const main = screen.getByRole('main');
    expect(main.className).toContain('lg:px-8');
    expect(main.className).toContain('overflow-y-auto');
    const contentWrap = main.firstElementChild as HTMLElement;
    expect(contentWrap.className).toContain('mx-auto');
    expect(contentWrap.className).toContain('max-w-content');
  });

  it('swaps between TabBar and SideNav when crossing the desktop breakpoint without duplicating', () => {
    const mm = mockMatchMedia(375);
    render(
      <MemoryRouter initialEntries={['/']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AppShell>
          <h1>หัวข้อหน้า</h1>
        </AppShell>
      </MemoryRouter>,
    );

    expect(screen.queryByRole('button', { name: '+ เพิ่มรายการ' })).toBeNull();
    expect(screen.getAllByRole('navigation', { name: 'เมนูหลัก' })).toHaveLength(1);

    act(() => {
      mm.setWidth(1280);
    });

    expect(screen.getByRole('button', { name: '+ เพิ่มรายการ' })).toBeTruthy();
    expect(screen.getAllByRole('navigation', { name: 'เมนูหลัก' })).toHaveLength(1);
  });
});
