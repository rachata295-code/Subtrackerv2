import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useVisualViewportHeight } from './useVisualViewportHeight';

class MockVisualViewport extends EventTarget {
  height: number;
  offsetTop: number;

  constructor(height: number, offsetTop = 0) {
    super();
    this.height = height;
    this.offsetTop = offsetTop;
  }
}

describe('useVisualViewportHeight', () => {
  const originalInnerHeight = window.innerHeight;
  const originalVisualViewport = window.visualViewport;

  beforeEach(() => {
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      writable: true,
      value: 667,
    });
    document.documentElement.style.removeProperty('--vvh');
    document.documentElement.style.removeProperty('--vv-offset-bottom');
  });

  afterEach(() => {
    cleanup();
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      writable: true,
      value: originalInnerHeight,
    });
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      writable: true,
      value: originalVisualViewport,
    });
    document.documentElement.style.removeProperty('--vvh');
    document.documentElement.style.removeProperty('--vv-offset-bottom');
    vi.restoreAllMocks();
  });

  it('sets --vvh from visualViewport.height and updates on resize and scroll', () => {
    const vv = new MockVisualViewport(667, 0);
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      writable: true,
      value: vv,
    });

    const { result } = renderHook(() => useVisualViewportHeight());
    expect(result.current).toBe(667);
    expect(document.documentElement.style.getPropertyValue('--vvh')).toBe('667px');
    expect(document.documentElement.style.getPropertyValue('--vv-offset-bottom')).toBe('0px');

    // Simulate keyboard opening (~300px): visualViewport shrinks to 367px while innerHeight stays 667px
    act(() => {
      vv.height = 367;
      vv.dispatchEvent(new Event('resize'));
    });

    expect(result.current).toBe(367);
    expect(document.documentElement.style.getPropertyValue('--vvh')).toBe('367px');
    expect(document.documentElement.style.getPropertyValue('--vv-offset-bottom')).toBe('300px');

    // Simulate iOS visualViewport scroll (offsetTop shifts by 40px)
    act(() => {
      vv.offsetTop = 40;
      vv.dispatchEvent(new Event('scroll'));
    });

    expect(document.documentElement.style.getPropertyValue('--vvh')).toBe('367px');
    expect(document.documentElement.style.getPropertyValue('--vv-offset-bottom')).toBe('260px');
  });

  it('falls back to window.innerHeight when visualViewport is unavailable', () => {
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      writable: true,
      value: undefined,
    });

    const { result } = renderHook(() => useVisualViewportHeight());
    expect(result.current).toBe(667);
    expect(document.documentElement.style.getPropertyValue('--vvh')).toBe('667px');

    act(() => {
      window.innerHeight = 500;
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current).toBe(500);
    expect(document.documentElement.style.getPropertyValue('--vvh')).toBe('500px');
  });

  it('scrolls the focused input into view ({ block: "center" }) after visualViewport resize', () => {
    const vv = new MockVisualViewport(667, 0);
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      writable: true,
      value: vv,
    });

    const input = document.createElement('input');
    const scrollSpy = vi.fn();
    input.scrollIntoView = scrollSpy;
    document.body.appendChild(input);
    input.focus();

    renderHook(() => useVisualViewportHeight());

    act(() => {
      vv.height = 367;
      vv.dispatchEvent(new Event('resize'));
    });

    expect(scrollSpy).toHaveBeenCalledWith({ block: 'center' });
    input.remove();
  });
});
