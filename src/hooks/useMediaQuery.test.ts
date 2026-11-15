import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { DESKTOP_QUERY, useIsDesktop, useMediaQuery } from './useMediaQuery';
import { mockMatchMedia } from '../test/mockMatchMedia';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('useMediaQuery / useIsDesktop', () => {
  it('defines DESKTOP_QUERY as (min-width: 1024px)', () => {
    expect(DESKTOP_QUERY).toBe('(min-width: 1024px)');
  });

  it('returns false when window.matchMedia is not available', () => {
    vi.stubGlobal('matchMedia', undefined);
    const { result } = renderHook(() => useIsDesktop());
    expect(result.current).toBe(false);
  });

  it('reads the initial match synchronously on first render without flashing', () => {
    mockMatchMedia(1280);
    let firstRenderValue: boolean | undefined;
    const { result } = renderHook(() => {
      const val = useIsDesktop();
      if (firstRenderValue === undefined) firstRenderValue = val;
      return val;
    });
    expect(firstRenderValue).toBe(true);
    expect(result.current).toBe(true);

    mockMatchMedia(375);
    let mobileFirstRender: boolean | undefined;
    const { result: mobileResult } = renderHook(() => {
      const val = useIsDesktop();
      if (mobileFirstRender === undefined) mobileFirstRender = val;
      return val;
    });
    expect(mobileFirstRender).toBe(false);
    expect(mobileResult.current).toBe(false);
  });

  it('updates when the media query change event fires', () => {
    const mm = mockMatchMedia(768);
    const { result } = renderHook(() => useIsDesktop());
    expect(result.current).toBe(false);

    act(() => {
      mm.setWidth(1280);
    });
    expect(result.current).toBe(true);

    act(() => {
      mm.setWidth(375);
    });
    expect(result.current).toBe(false);
  });

  it('unsubscribes the change listener on unmount', () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener,
      removeEventListener,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: () => true,
    }));

    const { unmount } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(addEventListener).toHaveBeenCalledTimes(1);
    const handler = addEventListener.mock.calls[0]?.[1];
    expect(addEventListener).toHaveBeenCalledWith('change', handler);

    unmount();
    expect(removeEventListener).toHaveBeenCalledTimes(1);
    expect(removeEventListener).toHaveBeenCalledWith('change', handler);
  });
});
