import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockMatchMedia } from './mockMatchMedia';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('mockMatchMedia', () => {
  it('evaluates min-width and max-width queries against the given width', () => {
    mockMatchMedia(375);
    expect(window.matchMedia('(min-width: 1024px)').matches).toBe(false);
    expect(window.matchMedia('(max-width: 767px)').matches).toBe(true);

    mockMatchMedia(768);
    expect(window.matchMedia('(min-width: 768px)').matches).toBe(true);
    expect(window.matchMedia('(max-width: 1023px)').matches).toBe(true);
    expect(window.matchMedia('(min-width: 1024px)').matches).toBe(false);

    mockMatchMedia(1280);
    expect(window.matchMedia('(min-width: 1024px)').matches).toBe(true);
    expect(window.matchMedia('(max-width: 1023px)').matches).toBe(false);
  });

  it('supports compound queries joined with "and" and returns false for unknown queries', () => {
    mockMatchMedia(768);
    expect(window.matchMedia('(min-width: 768px) and (max-width: 1023px)').matches).toBe(true);
    expect(window.matchMedia('(prefers-color-scheme: dark)').matches).toBe(false);
  });

  it('notifies change listeners when width changes across a threshold and supports removeEventListener', () => {
    const mm = mockMatchMedia(375);
    const desktopMql = window.matchMedia('(min-width: 1024px)');
    const onDesktopChange = vi.fn();
    desktopMql.addEventListener('change', onDesktopChange);

    // Crossing below the threshold does not fire a change event because matches stays false.
    mm.setWidth(768);
    expect(onDesktopChange).not.toHaveBeenCalled();

    // Crossing >= 1024 flips matches to true and notifies subscribers.
    mm.setWidth(1280);
    expect(onDesktopChange).toHaveBeenCalledTimes(1);
    expect(onDesktopChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ matches: true, media: '(min-width: 1024px)' }),
    );
    expect(desktopMql.matches).toBe(true);

    desktopMql.removeEventListener('change', onDesktopChange);
    mm.setWidth(375);
    expect(onDesktopChange).toHaveBeenCalledTimes(1);
  });

  it('restores the previous matchMedia when restore() is called', () => {
    const mm = mockMatchMedia(1280);
    expect(typeof window.matchMedia).toBe('function');
    mm.restore();
    expect(window.matchMedia).toBeUndefined();
  });
});
