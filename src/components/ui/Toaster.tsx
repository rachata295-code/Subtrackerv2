import { Toaster, toast } from 'sonner';
import { useTheme } from '../ThemeProvider';

// Sits above the TabBar (--tabbar-h + its safe-area padding) plus a 12px gap, so a toast never covers navigation.
const TOAST_BOTTOM = 'calc(var(--tabbar-h) + max(8px, env(safe-area-inset-bottom)) + 12px)';

export function AppToaster() {
  const { resolved } = useTheme();
  return (
    <Toaster
      position="bottom-center"
      theme={resolved}
      offset={{ bottom: TOAST_BOTTOM }}
      mobileOffset={{ bottom: TOAST_BOTTOM, left: 16, right: 16 }}
      // Sonner reads its palette from these variables, so pointing them at our tokens re-themes it with no
      // specificity fight (Sonner injects its stylesheet after ours, so plain utility classes would lose).
      style={
        {
          '--normal-bg': 'rgb(var(--surface))',
          '--normal-text': 'rgb(var(--text))',
          '--normal-border': 'rgb(var(--border))',
          '--border-radius': 'var(--radius-tile)',
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          // `!` is needed for the two properties Sonner hard-codes (shadow, font) rather than reading from a variable.
          toast: '!shadow-float !font-sans !text-sm',
          actionButton: '!h-11 !bg-transparent !px-3 !text-sm !font-medium !text-accent',
        },
      }}
    />
  );
}

/** Shows a short confirmation; with `undo` it carries a เลิกทำ action and stays a little longer so it can be reached. */
export function notify(message: string, opts?: { undo?: () => void }) {
  const { undo } = opts ?? {};
  return toast(message, {
    duration: undo ? 6000 : 4000,
    action: undo ? { label: 'เลิกทำ', onClick: () => undo() } : undefined,
  });
}
