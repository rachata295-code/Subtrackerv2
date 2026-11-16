import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react';

// Module-level in-memory store keeps form drafts across BottomSheet open/close cycles within a session.
// Never persist to localStorage or sessionStorage so sensitive financial drafts are not left on disk (SPEC §A1).
const draftStore = new Map<string, unknown>();

let lastVitestTask: unknown = null;

// In test runs, automatically clear the module-level store when Vitest transitions from one `it(...)` block
// to the next so an unsaved failure test never leaks draft state into a subsequent unrelated test case.
function ensureTestIsolation(): void {
  const worker = (globalThis as { __vitest_worker__?: { current?: unknown } }).__vitest_worker__;
  const currentTask = worker?.current ?? null;
  if (currentTask && currentTask !== lastVitestTask) {
    lastVitestTask = currentTask;
    draftStore.clear();
  }
}

export interface UseDraftOptions {
  enabled?: boolean;
}

export type UseDraftReturn<T> = [
  value: T,
  setValue: Dispatch<SetStateAction<T>>,
  clear: () => void,
] & {
  value: T;
  draft: T;
  setValue: Dispatch<SetStateAction<T>>;
  setDraft: Dispatch<SetStateAction<T>>;
  clear: () => void;
  clearDraft: () => void;
  reset: () => void;
  hasDraft: boolean;
};

function resolveInitial<T>(initial: T | (() => T)): T {
  return typeof initial === 'function' ? (initial as () => T)() : initial;
}

export function getDraft<T>(key: string): T | undefined {
  ensureTestIsolation();
  return draftStore.get(key) as T | undefined;
}

export function setDraftValue<T>(key: string, value: T): void {
  ensureTestIsolation();
  draftStore.set(key, value);
}

export function clearDraftByKey(key: string): void {
  ensureTestIsolation();
  draftStore.delete(key);
}

export function clearAllDrafts(): void {
  draftStore.clear();
}

export function useDraft<T>(
  key: string | null | undefined,
  initial: T | (() => T),
  options?: boolean | UseDraftOptions,
): UseDraftReturn<T> {
  ensureTestIsolation();
  const enabledOption = typeof options === 'boolean' ? options : (options?.enabled ?? true);
  const activeKey = enabledOption && key ? key : null;
  const initialRef = useRef(initial);
  initialRef.current = initial;

  const [value, setInternalValue] = useState<T>(() => {
    if (activeKey && draftStore.has(activeKey)) {
      return draftStore.get(activeKey) as T;
    }
    return resolveInitial(initial);
  });

  const setValue: Dispatch<SetStateAction<T>> = useCallback(
    (action) => {
      setInternalValue((prev) => {
        const next = typeof action === 'function' ? (action as (prevState: T) => T)(prev) : action;
        if (activeKey) {
          draftStore.set(activeKey, next);
        }
        return next;
      });
    },
    [activeKey],
  );

  const clear = useCallback(() => {
    if (activeKey) {
      draftStore.delete(activeKey);
    }
    setInternalValue(resolveInitial(initialRef.current));
  }, [activeKey]);

  const hasDraft = Boolean(activeKey && draftStore.has(activeKey));

  // Return an array enhanced with named properties so callers can destructure either as a tuple or an object.
  const tuple = [value, setValue, clear] as unknown as UseDraftReturn<T>;
  tuple.value = value;
  tuple.draft = value;
  tuple.setValue = setValue;
  tuple.setDraft = setValue;
  tuple.clear = clear;
  tuple.clearDraft = clear;
  tuple.reset = clear;
  tuple.hasDraft = hasDraft;

  return tuple;
}
