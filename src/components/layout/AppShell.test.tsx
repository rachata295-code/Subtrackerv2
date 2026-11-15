import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppShell } from './AppShell';

afterEach(cleanup);

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
});
