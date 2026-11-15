import { useEffect, useMemo, useRef, useState } from 'react';
import { ROW_EXIT_MS } from '../../components/ui/AnimatedRow';

export interface AnimatedItemEntry<T> {
  item: T;
  entering: boolean;
  leaving: boolean;
}

interface LeavingEntry<T> {
  item: T;
  index: number;
}

interface AnimatedListState<T extends { id: string }> {
  prevItems: T[];
  enteringIds: Set<string>;
  leavingById: Map<string, LeavingEntry<T>>;
}

function sameItemsRef<T>(a: T[], b: T[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Tracks post-mount additions and deletions so lists animate only when the user adds/removes rows,
 * never on initial paint or tab switches (SPEC §5).
 */
export function useAnimatedItems<T extends { id: string }>(items: T[]): AnimatedItemEntry<T>[] {
  const [state, setState] = useState<AnimatedListState<T>>(() => ({
    prevItems: items,
    enteringIds: new Set(),
    leavingById: new Map(),
  }));

  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Derive entering/leaving transitions synchronously during render so removed rows keep their slot
  // without a single-frame disappearance before `.row-exit` begins.
  if (!sameItemsRef(state.prevItems, items)) {
    const prevMap = new Map(state.prevItems.map((item, idx) => [item.id, { item, idx }]));
    const nextIds = new Set(items.map((item) => item.id));
    const nextEntering = new Set(state.enteringIds);
    const nextLeaving = new Map(state.leavingById);

    for (const item of items) {
      if (!prevMap.has(item.id)) {
        nextEntering.add(item.id);
        nextLeaving.delete(item.id);
      }
    }

    for (const [id, prev] of prevMap) {
      if (!nextIds.has(id) && !nextLeaving.has(id)) {
        nextLeaving.set(id, { item: prev.item, index: prev.idx });
        nextEntering.delete(id);
      }
    }

    setState({
      prevItems: items,
      enteringIds: nextEntering,
      leavingById: nextLeaving,
    });
  }

  useEffect(() => {
    for (const id of state.leavingById.keys()) {
      if (timersRef.current.has(id)) continue;
      const timer = setTimeout(() => {
        timersRef.current.delete(id);
        setState((curr) => {
          if (!curr.leavingById.has(id)) return curr;
          const nextLeaving = new Map(curr.leavingById);
          nextLeaving.delete(id);
          return { ...curr, leavingById: nextLeaving };
        });
      }, ROW_EXIT_MS);
      timersRef.current.set(id, timer);
    }

    for (const [id, timer] of timersRef.current) {
      if (!state.leavingById.has(id)) {
        clearTimeout(timer);
        timersRef.current.delete(id);
      }
    }
  }, [state.leavingById]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    };
  }, []);

  return useMemo(() => {
    const result: AnimatedItemEntry<T>[] = items.map((item) => ({
      item,
      entering: state.enteringIds.has(item.id),
      leaving: false,
    }));

    if (state.leavingById.size === 0) return result;

    const sortedLeaving = Array.from(state.leavingById.values()).sort((a, b) => a.index - b.index);
    for (const entry of sortedLeaving) {
      const insertAt = Math.min(entry.index, result.length);
      result.splice(insertAt, 0, {
        item: entry.item,
        entering: false,
        leaving: true,
      });
    }
    return result;
  }, [items, state.enteringIds, state.leavingById]);
}
