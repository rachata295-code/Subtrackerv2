import type { ReactNode } from 'react';
import { Drawer } from 'vaul';
import { X } from 'lucide-react';
import { useIsDesktop } from '../../hooks/useMediaQuery';
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

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} direction={isDesktop ? 'right' : 'bottom'}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-scrim/40" />
        <Drawer.Content
          // No Drawer.Description: the visible title is the sheet's name. Explicit undefined stops Radix warning about it.
          aria-describedby={undefined}
          className={
            isDesktop
              ? 'fixed inset-y-0 right-0 z-50 flex w-panel max-w-full flex-col rounded-l-card bg-surface shadow-float outline-none'
              : 'fixed inset-x-0 bottom-0 z-50 flex max-h-[90dvh] flex-col rounded-t-card bg-surface shadow-float outline-none'
          }
        >
          {!isDesktop && <div aria-hidden="true" className="mx-auto mt-2 h-1 w-8 shrink-0 rounded-pill bg-control" />}
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
          {/* Scrolls on its own so a long form never pushes the title off screen; the inset keeps content clear of the home indicator. */}
          <div
            className={isDesktop ? 'flex-1 overflow-y-auto px-screen pt-2' : 'overflow-y-auto px-screen pt-2'}
            style={{ paddingBottom: isDesktop ? '16px' : 'max(16px, env(safe-area-inset-bottom))' }}
          >
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
