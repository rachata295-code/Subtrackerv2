import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';

/** How long the press (or Enter) must be held. Also feeds the CSS fill duration so the two cannot drift. */
export const HOLD_MS = 1200;
/** After a quick Enter tap, the second tap must land within this window to confirm. */
const ARM_MS = 3000;

export interface HoldToDeleteProps {
  onConfirm: () => void;
  label?: string;
}

const ARMED_LABEL = 'กด Enter อีกครั้งเพื่อยืนยัน';

export function HoldToDelete({ onConfirm, label = 'กดค้างเพื่อลบ' }: HoldToDeleteProps) {
  const [holding, setHolding] = useState(false);
  const [armed, setArmed] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout>>();
  const armTimer = useRef<ReturnType<typeof setTimeout>>();
  // True once this press already confirmed, so holding on past 1200ms cannot fire twice.
  const fired = useRef(false);
  // A ref keeps the timer callback calling the latest handler without restarting the hold.
  const confirmRef = useRef(onConfirm);
  confirmRef.current = onConfirm;

  const clearHold = useCallback(() => {
    clearTimeout(holdTimer.current);
    holdTimer.current = undefined;
    setHolding(false);
  }, []);

  const disarm = useCallback(() => {
    clearTimeout(armTimer.current);
    armTimer.current = undefined;
    setArmed(false);
  }, []);

  const confirm = useCallback(() => {
    fired.current = true;
    disarm();
    confirmRef.current();
  }, [disarm]);

  const startHold = useCallback(() => {
    if (holdTimer.current !== undefined || fired.current) return;
    setHolding(true);
    holdTimer.current = setTimeout(() => {
      holdTimer.current = undefined;
      confirm();
    }, HOLD_MS);
  }, [confirm]);

  const endHold = useCallback(() => {
    fired.current = false;
    clearHold();
  }, [clearHold]);

  // Timers outliving the component would call a stale onConfirm (e.g. after the row was already removed).
  useEffect(
    () => () => {
      clearTimeout(holdTimer.current);
      clearTimeout(armTimer.current);
    },
    [],
  );

  const isActivationKey = (e: KeyboardEvent) => e.key === 'Enter' || e.key === ' ';

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!isActivationKey(e)) return;
    // Stops Space scrolling the page and stops the browser synthesising a click from Enter/Space.
    e.preventDefault();
    // OS auto-repeat fires keydown continuously while held; only the first one counts.
    if (e.repeat) return;
    if (armed) {
      // Second press inside the window: the keyboard equivalent of completing the hold, for people who can't hold a key.
      clearHold();
      confirm();
      return;
    }
    startHold();
    clearTimeout(armTimer.current);
    setArmed(true);
    armTimer.current = setTimeout(() => setArmed(false), ARM_MS);
  };

  const onKeyUp = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (isActivationKey(e)) endHold();
  };

  // Only after the key is released: swapping the text under a key that is still held would just flicker.
  const showArmed = armed && !holding;
  const shown = showArmed ? ARMED_LABEL : label;

  return (
    <>
      <button
        type="button"
        onPointerDown={(e) => {
          // Mouse: primary button only. Touch/pen report button 0 too, and synthetic events have no pointerType.
          if (e.pointerType === 'mouse' && e.button !== 0) return;
          startHold();
        }}
        onPointerUp={endHold}
        // Leaving the button cancels: a destructive action should not complete if the finger slid away.
        onPointerLeave={endHold}
        onPointerCancel={endHold}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        // Long-press on iOS opens a callout/context menu, which would cancel the hold.
        onContextMenu={(e) => e.preventDefault()}
        style={{ '--hold-ms': `${HOLD_MS}ms` } as CSSProperties}
        className={[
          'relative h-11 w-full touch-none select-none overflow-hidden rounded-tile border border-negative bg-surface px-4',
          'text-base font-medium text-negative [-webkit-touch-callout:none]',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2',
        ].join(' ')}
      >
        {shown}
        {/* A second copy of the label on the negative fill: clip-path reveals fill and light text together,
            so the text is never negative-on-negative mid-wipe. aria-hidden because the real label is above. */}
        <span
          aria-hidden="true"
          data-testid="hold-fill"
          data-holding={holding}
          className="hold-fill absolute inset-0 flex items-center justify-center bg-negative px-4 text-on-accent"
        >
          {shown}
        </span>
      </button>
      {/* Keyboard users get no wipe to watch, so the armed state is announced. */}
      <span role="status" className="sr-only">
        {showArmed ? 'กด Enter อีกครั้งภายใน 3 วินาทีเพื่อยืนยันการลบ' : ''}
      </span>
    </>
  );
}
