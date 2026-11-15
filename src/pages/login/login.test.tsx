import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../auth';
import type { AuthClient } from '../../auth/types';
import { mockMatchMedia } from '../../test/mockMatchMedia';
import LoginPage from './index';

function createSignedOutClient(): AuthClient {
  return {
    getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
    onAuthStateChange: vi.fn(() => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    })),
    signInWithPassword: vi.fn(async () => ({ data: { user: null, session: null }, error: null })),
    signOut: vi.fn(async () => ({ error: null })),
  };
}

function renderLoginAt(width: number) {
  mockMatchMedia(width);
  return render(
    <AuthProvider client={createSignedOutClient()}>
      <MemoryRouter initialEntries={['/login']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <LoginPage />
      </MemoryRouter>
    </AuthProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('<LoginPage> responsive layout', () => {
  it.each([375, 768, 1280])('keeps the centered login card capped within max-w-sm (<= 400px) at %dpx', async (width) => {
    renderLoginAt(width);

    expect(await screen.findByRole('heading', { level: 1, name: 'เข้าสู่ระบบ' })).toBeTruthy();
    const main = screen.getByRole('main');
    const wrapper = main.parentElement as HTMLElement;

    expect(wrapper.className).toContain('justify-center');
    expect(wrapper.className).toContain('min-h-dvh');
    // Card container must cap width at max-w-sm (384px <= 400px) rather than stretching to max-w-phone (480px).
    expect(main.className).toContain('max-w-sm');
    expect(main.className).toContain('w-full');
    expect(main.className).toContain('mx-auto');
    expect(wrapper.className).not.toContain('max-w-phone');
  });
});
