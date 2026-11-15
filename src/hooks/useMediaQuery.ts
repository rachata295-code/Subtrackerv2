import { useEffect, useState } from 'react';

export const DESKTOP_QUERY = '(min-width: 1024px)';

function readMatch(query: string): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  try {
    return window.matchMedia(query).matches;
  } catch {
    return false;
  }
}

/**
 * Subscribes to a CSS media query. Reads synchronously on first render to avoid
 * a mobile-to-desktop flash, and safely returns false when matchMedia is absent.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => readMatch(query));

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      setMatches(false);
      return;
    }

    let mql: MediaQueryList;
    try {
      mql = window.matchMedia(query);
    } catch {
      setMatches(false);
      return;
    }

    setMatches(mql.matches);
    const onChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    }

    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, [query]);

  return matches;
}

export function useIsDesktop(): boolean {
  return useMediaQuery(DESKTOP_QUERY);
}
