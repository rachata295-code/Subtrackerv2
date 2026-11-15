import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { createElement } from 'react';
import { readThemePref, resolveTheme, writeThemePref } from './theme';
import { ThemeProvider } from '../components/ThemeProvider';

const throwingStorage = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
} as unknown as Storage;

function storageWith(value: string | null): Storage {
  return { getItem: () => value, setItem: () => undefined } as unknown as Storage;
}

describe('resolveTheme', () => {
  it('follows the system when pref is system', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });
  it('ignores the system when pref is explicit', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});

describe('readThemePref / writeThemePref', () => {
  it('returns system when storage throws', () => {
    expect(readThemePref(throwingStorage)).toBe('system');
  });
  it('returns system for an invalid stored value', () => {
    expect(readThemePref(storageWith('purple'))).toBe('system');
  });
  it('returns system when nothing is stored', () => {
    expect(readThemePref(storageWith(null))).toBe('system');
  });
  it('returns a valid stored value', () => {
    expect(readThemePref(storageWith('dark'))).toBe('dark');
  });
  it('does not throw when writing to a throwing storage', () => {
    expect(() => writeThemePref('dark', throwingStorage)).not.toThrow();
  });
});

describe('ThemeProvider', () => {
  let listeners: Array<(e: MediaQueryListEvent) => void> = [];
  let matches = false;

  beforeEach(() => {
    listeners = [];
    matches = false;
    document.head.innerHTML = '<meta name="theme-color" content="#f3f5f7">';
    delete document.documentElement.dataset.theme;
    // Node 25+ ships a half-working global localStorage that shadows jsdom's, so use a fake for determinism.
    vi.stubGlobal('localStorage', storageWith(null));
    vi.stubGlobal('matchMedia', (query: string) => ({
      get matches() {
        return matches;
      },
      media: query,
      addEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => listeners.push(cb),
      removeEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => {
        listeners = listeners.filter((l) => l !== cb);
      },
    }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('applies the dark theme and theme-color when the system flips to dark', () => {
    render(createElement(ThemeProvider, null, createElement('div')));
    expect(document.documentElement.dataset.theme).toBe('light');

    act(() => {
      matches = true;
      listeners.forEach((l) => l({ matches: true } as MediaQueryListEvent));
    });

    expect(document.documentElement.dataset.theme).toBe('dark');
    const meta = document.querySelector('meta[name="theme-color"]');
    expect(meta?.getAttribute('content')).toBe('#111214');
  });
});
