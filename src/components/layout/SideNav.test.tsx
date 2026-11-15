import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { SideNav } from './SideNav';

const setPref = vi.fn();
vi.mock('../ThemeProvider', () => ({
  useTheme: () => ({ pref: 'system' as const, resolved: 'light' as const, setPref }),
}));

afterEach(() => {
  cleanup();
  setPref.mockClear();
});

function LocationProbe() {
  const { pathname, search } = useLocation();
  return <div data-testid="location">{`${pathname}${search}`}</div>;
}

function renderSideNav(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <SideNav />
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe('<SideNav>', () => {
  it('displays the SubTracker app name and ThemeSwitch', () => {
    renderSideNav('/');
    expect(screen.getByText('SubTracker')).toBeTruthy();
    const themeSwitch = screen.getByRole('tablist', { name: 'ธีม' });
    expect(within(themeSwitch).getAllByRole('tab')).toHaveLength(3);
  });

  it('navigates to /?add=1 when "+ เพิ่มรายการ" is clicked', () => {
    renderSideNav('/bills');
    fireEvent.click(screen.getByRole('button', { name: '+ เพิ่มรายการ' }));
    expect(screen.getByTestId('location').textContent).toBe('/?add=1');
  });

  it('renders a labelled navigation with the 4 shared menu links', () => {
    renderSideNav('/');
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

  it('marks only the active route with aria-current="page"', () => {
    renderSideNav('/entries');
    expect(screen.getByRole('link', { name: 'รายการ' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'ภาพรวม' }).getAttribute('aria-current')).toBeNull();
    expect(screen.getByRole('link', { name: 'บิล & ผ่อน' }).getAttribute('aria-current')).toBeNull();
    expect(screen.getByRole('link', { name: 'ตั้งค่า' }).getAttribute('aria-current')).toBeNull();
  });

  it('marks no link as current on a non-tab route like /design', () => {
    renderSideNav('/design');
    expect(document.querySelectorAll('[aria-current="page"]')).toHaveLength(0);
  });
});
