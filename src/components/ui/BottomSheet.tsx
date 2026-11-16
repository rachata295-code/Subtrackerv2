import { useRef, type ReactNode } from 'react';
import { Drawer } from 'vaul';
import { X } from 'lucide-react';
import { useIsDesktop } from '../../hooks/useMediaQuery';
import { useVisualViewportHeight } from '../../hooks/useVisualViewportHeight';
import { IconButton } from './IconButton';

export interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
}

// Enter/exit timing is overridden in motion.css (Vaul's own 500ms is replaced by --dur-sheet in, 240ms out).
export function BottomSheet({ open, onOpenChange, title, children }: BottomSheetProps) {
  const isDesktop = useIsDesktop();
  useVisualViewportHeight();
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);

  // Capture the opener element when `open` turns true: callers control `open` via state instead of
  // <Drawer.Trigger>, so Radix has no triggerRef and overlay clicks would otherwise drop focus to <body>.
  if (open && !wasOpenRef.current && typeof document !== 'undefined') {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }
  wasOpenRef.current = open;

  return (
    <Drawer.Root
      open={open}
      onOpenChange={onOpenChange}
      direction={isDesktop ? 'right' : 'bottom'}
      // On mobile, restrict Vaul drag-to-close to the top handle so vertical scrolling inside forms never dismisses
      // the sheet by accident, and disable Vaul's input repositioning so --vvh + --vv-offset-bottom govern height/bottom.
      handleOnly={!isDesktop}
      repositionInputs={false}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-scrim/40" />
        <Drawer.Content
          // No Drawer.Description: the visible title is the sheet's name. Explicit undefined stops Radix warning about it.
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const target = returnFocusRef.current;
            returnFocusRef.current = null;
            if (target && target.isConnected) {
              target.focus();
            }
          }}
          style={
            isDesktop
              ? undefined
              : {
                  maxHeight: 'calc(var(--vvh) * 0.9)',
                  bottom: 'var(--vv-offset-bottom, 0px)',
                }
          }
          className={
            isDesktop
              ? 'fixed inset-y-0 right-0 z-50 flex w-panel max-w-full flex-col rounded-l-card bg-surface shadow-float outline-none'
              : 'fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-card bg-surface shadow-float outline-none'
          }
        >
          {!isDesktop && (
            <Drawer.Handle
              preventCycle
              className="mx-auto mt-2 h-1 w-8 shrink-0 rounded-pill bg-control"
            />
          )}
          <div
            className={
              isDesktop
                ? 'flex shrink-0 items-center justify-between gap-3 py-3 pl-screen pr-2'
                : 'flex shrink-0 items-center justify-between gap-3 py-1 pl-screen pr-2'
            }
          >
            <Drawer.Title className="text-lg font-semibold text-text">{title}</Drawer.Title>
            <Drawer.Close asChild>
              <IconButton label="ปิด" icon={<X size={20} strokeWidth={1.6} aria-hidden="true" />} />
            </Drawer.Close>
          </div>
          {/* Scrolls on its own so a long form never pushes the title off screen; touch-pan-y overrides Vaul's touch-action:none on the drawer. */}
          <div
            className={
              isDesktop
                ? 'flex-1 min-h-0 overflow-y-auto px-screen pt-2'
                : 'min-h-0 flex-1 overflow-y-auto overscroll-contain touch-pan-y px-screen pt-2'
            }
            style={{ paddingBottom: isDesktop ? '16px' : 'max(16px, env(safe-area-inset-bottom))' }}
          >
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
