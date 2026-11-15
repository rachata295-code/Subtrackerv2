import { vi } from 'vitest';

type ChangeListener = (event: MediaQueryListEvent) => void;
type ListenerLike = EventListenerOrEventListenerObject;

export interface MatchMediaController {
  /** Updates the simulated viewport width and fires 'change' on lists whose match state changed. */
  setWidth: (width: number) => void;
  /** Restores the previous global matchMedia implementation. */
  restore: () => void;
}

const CLAUSE_RE = /\(\s*(min|max)-width\s*:\s*(\d+(?:\.\d+)?)px\s*\)/gi;

/** Evaluates (min-width: Npx) / (max-width: Npx) clauses against `width`; unknown queries return false. */
function evaluateQuery(query: string, width: number): boolean {
  let sawWidthClause = false;
  for (const match of query.matchAll(CLAUSE_RE)) {
    sawWidthClause = true;
    const bound = match[1]!.toLowerCase();
    const limit = Number(match[2]);
    if (bound === 'min' && width < limit) return false;
    if (bound === 'max' && width > limit) return false;
  }
  return sawWidthClause;
}

function invokeListener(listener: ListenerLike, mql: MediaQueryList, event: MediaQueryListEvent): void {
  if (typeof listener === 'function') {
    listener.call(mql, event);
  } else if (typeof listener?.handleEvent === 'function') {
    listener.handleEvent(event);
  }
}

/**
 * Stubs `window.matchMedia` for a fixed viewport `width` (e.g. 375, 768, 1280).
 * Call `vi.unstubAllGlobals()` in `afterEach` or `controller.restore()` to clean up.
 */
export function mockMatchMedia(width: number): MatchMediaController {
  let currentWidth = width;
  const previous = typeof window !== 'undefined' ? window.matchMedia : undefined;

  const tracked = new Map<
    string,
    {
      mql: MediaQueryList;
      lastMatches: boolean;
      listeners: Set<ListenerLike>;
    }
  >();

  const getOrCreate = (query: string) => {
    const existing = tracked.get(query);
    if (existing) return existing;

    const listeners = new Set<ListenerLike>();
    const mql: MediaQueryList = {
      get matches() {
        return evaluateQuery(query, currentWidth);
      },
      media: query,
      onchange: null,
      addEventListener(type: string, listener: ListenerLike | null) {
        if (type === 'change' && listener) listeners.add(listener);
      },
      removeEventListener(type: string, listener: ListenerLike | null) {
        if (type === 'change' && listener) listeners.delete(listener);
      },
      // Legacy aliases kept for third-party libraries that check addListener before addEventListener.
      addListener(listener: ChangeListener | null) {
        if (listener) listeners.add(listener as ListenerLike);
      },
      removeListener(listener: ChangeListener | null) {
        if (listener) listeners.delete(listener as ListenerLike);
      },
      dispatchEvent(event: Event) {
        for (const listener of Array.from(listeners)) {
          invokeListener(listener, mql, event as MediaQueryListEvent);
        }
        return true;
      },
    };

    const entry = {
      mql,
      lastMatches: evaluateQuery(query, currentWidth),
      listeners,
    };
    tracked.set(query, entry);
    return entry;
  };

  vi.stubGlobal('matchMedia', (query: string) => getOrCreate(query).mql);

  return {
    setWidth(nextWidth: number) {
      currentWidth = nextWidth;
      for (const [query, entry] of tracked) {
        const nextMatches = evaluateQuery(query, currentWidth);
        if (nextMatches === entry.lastMatches) continue;
        entry.lastMatches = nextMatches;
        const event = { matches: nextMatches, media: query } as MediaQueryListEvent;
        if (typeof entry.mql.onchange === 'function') {
          entry.mql.onchange.call(entry.mql, event);
        }
        for (const listener of Array.from(entry.listeners)) {
          invokeListener(listener, entry.mql, event);
        }
      }
    },
    restore() {
      vi.stubGlobal('matchMedia', previous);
    },
  };
}
