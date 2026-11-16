import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { useMediaQuery } from '../../hooks/useMediaQuery';

const ACTION_WIDTH = 80;
const AXIS_LOCK_PX = 8;
const FLICK_VELOCITY = 0.35;
const FALLBACK_ROW_WIDTH = 320;
const POINTER_FINE_QUERY = '(pointer: fine)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

// Module-level coordinator guarantees only one swipe row stays open at a time across the screen.
let activeSwipeId: string | null = null;
const closeListeners = new Map<string, () => void>();

function claimActiveSwipe(id: string) {
  if (activeSwipeId && activeSwipeId !== id) {
    closeListeners.get(activeSwipeId)?.();
  }
  activeSwipeId = id;
}

function releaseActiveSwipe(id: string) {
  if (activeSwipeId === id) {
    activeSwipeId = null;
  }
}

function rubberBand(rawOffset: number, fullThreshold: number): number {
  if (rawOffset > 0) {
    return rawOffset / (1 + rawOffset / 48);
  }
  if (rawOffset < -fullThreshold) {
    const extra = -rawOffset - fullThreshold;
    return -(fullThreshold + extra / (1 + extra / 60));
  }
  return rawOffset;
}

export interface SwipeToDeleteProps {
  /** Called when the user confirms deletion via full swipe, "ลบ" button, or Delete key. Returning false bounces the row back. */
  onDelete: () => void | boolean | Promise<void | boolean>;
  /** Item name used in accessible description. */
  label?: string;
  /** Disables swipe and delete triggers (e.g., while row is already leaving or busy). */
  disabled?: boolean;
  /** Optional classes on the outer wrapper. */
  className?: string;
  /** Opaque background class for the sliding track so the red delete tray stays hidden when closed. */
  surfaceClassName?: string;
  children: ReactNode;
}

interface GestureState {
  active: boolean;
  pointerId: number | null;
  startX: number;
  startY: number;
  startOffset: number;
  lock: 'none' | 'horizontal' | 'vertical';
  lastX: number;
  lastTime: number;
  velocityX: number;
}

export function SwipeToDelete({
  onDelete,
  label,
  disabled = false,
  className,
  surfaceClassName = 'bg-surface',
  children,
}: SwipeToDeleteProps) {
  const id = useId();
  const isFinePointer = useMediaQuery(POINTER_FINE_QUERY);
  const prefersReducedMotion = useMediaQuery(REDUCED_MOTION_QUERY);

  const containerRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);
  const suppressClickRef = useRef(false);
  const onDeleteRef = useRef(onDelete);
  onDeleteRef.current = onDelete;

  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [focusRevealed, setFocusRevealed] = useState(false);
  const [committing, setCommitting] = useState(false);

  const gestureRef = useRef<GestureState>({
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    startOffset: 0,
    lock: 'none',
    lastX: 0,
    lastTime: 0,
    velocityX: 0,
  });

  const applyOffset = useCallback((next: number, openState: boolean) => {
    offsetRef.current = next;
    setOffset(next);
    setIsOpen(openState);
  }, []);

  const closeRow = useCallback(() => {
    setDragging(false);
    setFocusRevealed(false);
    applyOffset(0, false);
    releaseActiveSwipe(id);
  }, [applyOffset, id]);

  useEffect(() => {
    closeListeners.set(id, closeRow);
    return () => {
      closeListeners.delete(id);
      releaseActiveSwipe(id);
    };
  }, [closeRow, id]);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutsidePointerDown = (event: globalThis.PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        closeRow();
      }
    };
    document.addEventListener('pointerdown', handleOutsidePointerDown, { capture: true });
    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointerDown, { capture: true });
    };
  }, [closeRow, isOpen]);

  const measureWidth = () => containerRef.current?.offsetWidth || FALLBACK_ROW_WIDTH;

  const commitDelete = useCallback(async () => {
    if (disabled || committing) return;
    setDragging(false);
    releaseActiveSwipe(id);
    try {
      const maybePromise = onDeleteRef.current();
      if (
        maybePromise !== null &&
        typeof maybePromise === 'object' &&
        'then' in maybePromise &&
        typeof maybePromise.then === 'function'
      ) {
        setCommitting(true);
        const outcome = await maybePromise;
        if (outcome === false) {
          applyOffset(0, false);
          setFocusRevealed(false);
        }
      } else if (maybePromise === false) {
        applyOffset(0, false);
        setFocusRevealed(false);
      }
    } catch {
      // Bounce back so a failed or blocked delete never leaves the row stuck open or off-screen.
      applyOffset(0, false);
      setFocusRevealed(false);
    } finally {
      setCommitting(false);
    }
  }, [applyOffset, committing, disabled, id]);

  // Desktop pointer:fine uses the existing HoldToDelete button inside the edit sheet (SPEC §B).
  if (isFinePointer) {
    return className ? <div className={className}>{children}</div> : <>{children}</>;
  }

  const isUnavailable = disabled || committing;
  const trayVisible = offset < 0 || focusRevealed;

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (isUnavailable) return;
    if (e.pointerType === 'mouse') return;
    if (gestureRef.current.active) return;
    suppressClickRef.current = false;

    gestureRef.current = {
      active: true,
      pointerId: e.pointerId ?? null,
      startX: e.clientX,
      startY: e.clientY,
      startOffset: offsetRef.current,
      lock: 'none',
      lastX: e.clientX,
      lastTime: Date.now(),
      velocityX: 0,
    };
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const g = gestureRef.current;
    if (!g.active || isUnavailable) return;
    if (g.pointerId !== null && e.pointerId !== undefined && e.pointerId !== g.pointerId) return;

    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;

    if (g.lock === 'none') {
      // Wait for >8px movement before locking so normal taps and vertical scrolling stay responsive.
      if (Math.abs(dy) > AXIS_LOCK_PX && Math.abs(dy) >= Math.abs(dx)) {
        g.lock = 'vertical';
        g.active = false;
        return;
      }
      if (Math.abs(dx) > AXIS_LOCK_PX && Math.abs(dx) > Math.abs(dy)) {
        g.lock = 'horizontal';
        claimActiveSwipe(id);
        setDragging(true);
        try {
          e.currentTarget.setPointerCapture?.(e.pointerId);
        } catch {
          // Synthetic test events may omit pointer capture support.
        }
      } else {
        return;
      }
    }

    const now = Date.now();
    const dt = now - g.lastTime;
    if (dt > 0) {
      g.velocityX = (e.clientX - g.lastX) / dt;
      g.lastX = e.clientX;
      g.lastTime = now;
    }

    const width = measureWidth();
    const fullThreshold = Math.max(ACTION_WIDTH * 2, Math.round(width * 0.55));
    const nextOffset = rubberBand(g.startOffset + dx, fullThreshold);
    offsetRef.current = nextOffset;
    setOffset(nextOffset);
  };

  const finishGesture = (e: PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const g = gestureRef.current;
    if (!g.active) return;
    const wasHorizontal = g.lock === 'horizontal';
    g.active = false;
    g.lock = 'none';

    try {
      if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore synthetic pointer release failures.
    }

    if (!wasHorizontal) return;

    setDragging(false);
    suppressClickRef.current = true;
    setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);

    if (cancelled) {
      const keepOpen = g.startOffset <= -ACTION_WIDTH / 2;
      applyOffset(keepOpen ? -ACTION_WIDTH : 0, keepOpen);
      if (!keepOpen) releaseActiveSwipe(id);
      return;
    }

    const width = measureWidth();
    const fullThreshold = Math.max(ACTION_WIDTH * 2, Math.round(width * 0.55));
    const current = offsetRef.current;

    if (current <= -fullThreshold && g.velocityX <= FLICK_VELOCITY) {
      applyOffset(-width, false);
      void commitDelete();
      return;
    }

    const shouldOpen =
      g.velocityX < -FLICK_VELOCITY
        ? true
        : g.velocityX > FLICK_VELOCITY
          ? false
          : current <= -ACTION_WIDTH / 2;

    if (shouldOpen) {
      claimActiveSwipe(id);
      applyOffset(-ACTION_WIDTH, true);
    } else {
      closeRow();
    }
  };

  const handleTrackClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (isOpen) {
      e.preventDefault();
      e.stopPropagation();
      closeRow();
    }
  };

  const handleTrackKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (isUnavailable || e.key !== 'Delete') return;
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
      return;
    }
    e.preventDefault();
    void commitDelete();
  };

  const handleContainerBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (focusRevealed && !e.currentTarget.contains(e.relatedTarget as Node | null)) {
      closeRow();
    }
  };

  const transitionClass =
    dragging || prefersReducedMotion ? '' : 'transition-transform duration-fast ease-out motion-reduce:transition-none';

  return (
    <div
      ref={containerRef}
      onBlur={handleContainerBlur}
      className={['relative touch-pan-y overflow-hidden', className].filter(Boolean).join(' ')}
    >
      <div
        aria-hidden={!trayVisible || undefined}
        className={[
          'absolute inset-y-0 right-0 flex w-20 items-stretch justify-end',
          trayVisible ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
        ].join(' ')}
      >
        <button
          type="button"
          disabled={isUnavailable}
          aria-description={label ? `ลบ ${label}` : undefined}
          onFocus={() => {
            if (isUnavailable) return;
            claimActiveSwipe(id);
            setFocusRevealed(true);
            applyOffset(-ACTION_WIDTH, true);
          }}
          onClick={() => void commitDelete()}
          className="pressable flex h-full w-20 items-center justify-center bg-negative text-sm font-medium text-on-accent focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-on-accent disabled:opacity-50"
        >
          ลบ
        </button>
      </div>

      <div
        data-testid="swipe-track"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={(e) => finishGesture(e, false)}
        onPointerCancel={(e) => finishGesture(e, true)}
        onClickCapture={handleTrackClickCapture}
        onKeyDown={handleTrackKeyDown}
        style={{ transform: `translate3d(${offset}px, 0, 0)` }}
        className={[
          'relative z-10',
          surfaceClassName,
          dragging ? 'select-none' : '',
          transitionClass,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {children}
      </div>
    </div>
  );
}
