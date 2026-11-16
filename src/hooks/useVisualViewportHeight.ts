import { useEffect, useState } from 'react';

interface ViewportMetrics {
  height: number;
  offsetBottom: number;
}

function readViewportMetrics(): ViewportMetrics {
  if (typeof window === 'undefined') {
    return { height: 0, offsetBottom: 0 };
  }
  const vv = window.visualViewport;
  const height = vv ? vv.height : window.innerHeight;
  const offsetTop = vv ? vv.offsetTop : 0;
  // iOS Safari shrinks visualViewport without shrinking layout innerHeight when the keyboard opens;
  // anchoring `bottom` to this delta keeps fixed sheets flush against the top of the keyboard with zero gap.
  const offsetBottom = Math.max(0, window.innerHeight - (offsetTop + height));
  return { height, offsetBottom };
}

function applyCssVars(metrics: ViewportMetrics): void {
  if (typeof document === 'undefined') return;
  const rootStyle = document.documentElement.style;
  rootStyle.setProperty('--vvh', `${metrics.height}px`);
  rootStyle.setProperty('--vv-offset-bottom', `${metrics.offsetBottom}px`);
}

function scrollFocusedInputIntoView(): void {
  if (typeof document === 'undefined') return;
  const active = document.activeElement;
  if (
    active instanceof HTMLElement &&
    (active.tagName === 'INPUT' ||
      active.tagName === 'TEXTAREA' ||
      active.tagName === 'SELECT' ||
      active.isContentEditable) &&
    typeof active.scrollIntoView === 'function'
  ) {
    active.scrollIntoView({ block: 'center' });
  }
}

export function useVisualViewportHeight(): number {
  const [height, setHeight] = useState<number>(() => {
    const initial = readViewportMetrics();
    applyCssVars(initial);
    return initial.height;
  });

  useEffect(() => {
    const sync = (isResize: boolean) => {
      const next = readViewportMetrics();
      applyCssVars(next);
      setHeight(next.height);
      if (isResize) {
        scrollFocusedInputIntoView();
      }
    };

    const handleResize = () => sync(true);
    const handleScroll = () => sync(false);

    sync(false);

    const vv = window.visualViewport;
    vv?.addEventListener('resize', handleResize);
    vv?.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', handleResize);

    return () => {
      vv?.removeEventListener('resize', handleResize);
      vv?.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return height;
}
