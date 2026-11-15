import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { toast } from 'sonner';
import { BottomSheet } from './BottomSheet';
import { AppToaster, notify } from './Toaster';
import { HoldToDelete } from './HoldToDelete';
import { mockMatchMedia } from '../../test/mockMatchMedia';

// The real provider reads localStorage, which makes Node print an experimental-feature warning under jsdom.
// The toaster only needs the resolved theme, so a controllable stub keeps output clean and lets us test both themes.
let mockResolved: 'light' | 'dark' = 'light';
vi.mock('../ThemeProvider', () => ({
  useTheme: () => ({ pref: mockResolved, resolved: mockResolved, setPref: () => {} }),
}));

afterEach(() => {
  mockResolved = 'light';
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('<BottomSheet>', () => {
  it('shows its title inside a dialog', () => {
    render(
      <BottomSheet open onOpenChange={() => {}} title="เพิ่มรายการ">
        <p>เนื้อหา</p>
      </BottomSheet>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain('เพิ่มรายการ');
    expect(dialog.textContent).toContain('เนื้อหา');
  });

  it('renders nothing while closed', () => {
    render(
      <BottomSheet open={false} onOpenChange={() => {}} title="เพิ่มรายการ">
        <p>เนื้อหา</p>
      </BottomSheet>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes via the ปิด button', () => {
    const onOpenChange = vi.fn();
    render(
      <BottomSheet open onOpenChange={onOpenChange} title="เพิ่มรายการ">
        <p>เนื้อหา</p>
      </BottomSheet>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'ปิด' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('at 375px renders a bottom sheet with handle bar', () => {
    mockMatchMedia(375);
    render(
      <BottomSheet open onOpenChange={() => {}} title="เพิ่มรายการ">
        <p>เนื้อหา</p>
      </BottomSheet>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('data-vaul-drawer-direction')).toBe('bottom');
    expect(dialog.className).toContain('rounded-t-card');
    expect(dialog.querySelector('.h-1.w-8')).not.toBeNull();
  });

  it('at 1280px renders a full-height right panel without handle bar and closes on Escape', () => {
    mockMatchMedia(1280);
    const onOpenChange = vi.fn();
    render(
      <BottomSheet open onOpenChange={onOpenChange} title="เพิ่มรายการ">
        <p>เนื้อหา</p>
      </BottomSheet>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('data-vaul-drawer-direction')).toBe('right');
    expect(dialog.className).toContain('w-panel');
    expect(dialog.className).toContain('rounded-l-card');
    expect(dialog.className).toContain('inset-y-0');
    expect(dialog.querySelector('.h-1.w-8')).toBeNull();

    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('restores focus to the trigger button when closed via close button or Escape', async () => {
    mockMatchMedia(375);
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            เปิดฟอร์ม
          </button>
          <BottomSheet open={open} onOpenChange={setOpen} title="เพิ่มรายการ">
            <p>เนื้อหา</p>
          </BottomSheet>
        </>
      );
    }

    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'เปิดฟอร์ม' });

    // Simulate real browser behavior: opening moves focus inside the dialog before closing via button/overlay.
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog')).toBeTruthy();
    const closeBtn = screen.getByRole('button', { name: 'ปิด' });
    closeBtn.focus();
    expect(document.activeElement).toBe(closeBtn);

    fireEvent.click(closeBtn);
    expect(screen.queryByRole('dialog')).toBeNull();
    // Radix FocusScope triggers onCloseAutoFocus inside setTimeout(..., 0) on unmount.
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(document.activeElement).toBe(trigger);
  });
});

describe('notify / <AppToaster>', () => {
  beforeEach(() => {
    toast.dismiss();
  });

  it('renders the message with an undo action that calls undo', async () => {
    const undo = vi.fn();
    render(
      <AppToaster />,
    );
    act(() => {
      notify('บันทึกแล้ว', { undo });
    });
    expect(await screen.findByText('บันทึกแล้ว')).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: 'เลิกทำ' }));
    expect(undo).toHaveBeenCalledTimes(1);
  });

  it('follows the resolved app theme', async () => {
    mockResolved = 'dark';
    render(<AppToaster />);
    act(() => {
      notify('x');
    });
    await screen.findByText('x');
    expect(document.querySelector('[data-sonner-toaster]')!.getAttribute('data-sonner-theme')).toBe('dark');
  });

  it('shows no undo button when no undo is given', async () => {
    render(
      <AppToaster />,
    );
    act(() => {
      notify('ลบแล้ว');
    });
    expect(await screen.findByText('ลบแล้ว')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'เลิกทำ' })).toBeNull();
  });

  it('offsets above TabBar on mobile/tablet and skips --tabbar-h offset on desktop (1280px)', async () => {
    mockMatchMedia(375);
    render(<AppToaster />);
    act(() => {
      notify('m');
    });
    await screen.findByText('m');
    const mobileToaster = document.querySelector('[data-sonner-toaster]') as HTMLElement;
    expect(mobileToaster.style.getPropertyValue('--offset-bottom')).toContain('--tabbar-h');

    cleanup();
    mockMatchMedia(768);
    render(<AppToaster />);
    act(() => {
      notify('t');
    });
    await screen.findByText('t');
    const tabletToaster = document.querySelector('[data-sonner-toaster]') as HTMLElement;
    expect(tabletToaster.style.getPropertyValue('--offset-bottom')).toContain('--tabbar-h');

    cleanup();
    mockMatchMedia(1280);
    render(<AppToaster />);
    act(() => {
      notify('d');
    });
    await screen.findByText('d');
    const desktopToaster = document.querySelector('[data-sonner-toaster]') as HTMLElement;
    expect(desktopToaster.style.getPropertyValue('--offset-bottom')).not.toContain('--tabbar-h');
  });
});

describe('<HoldToDelete>', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  const button = () => screen.getByRole('button');

  it('does not confirm at 1199ms and confirms exactly once at 1200ms', () => {
    const onConfirm = vi.fn();
    render(<HoldToDelete onConfirm={onConfirm} />);
    fireEvent.pointerDown(button());
    act(() => {
      vi.advanceTimersByTime(1199);
    });
    expect(onConfirm).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
    // Holding on must not fire again.
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('does not confirm when released early', () => {
    const onConfirm = vi.fn();
    render(<HoldToDelete onConfirm={onConfirm} />);
    fireEvent.pointerDown(button());
    act(() => {
      vi.advanceTimersByTime(600);
    });
    fireEvent.pointerUp(button());
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('cancels when the pointer leaves or the gesture is cancelled', () => {
    const onConfirm = vi.fn();
    render(<HoldToDelete onConfirm={onConfirm} />);
    fireEvent.pointerDown(button());
    act(() => {
      vi.advanceTimersByTime(600);
    });
    fireEvent.pointerLeave(button());
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    fireEvent.pointerDown(button());
    act(() => {
      vi.advanceTimersByTime(600);
    });
    fireEvent.pointerCancel(button());
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('cancels a pointer hold on blur, like a release', () => {
    const onConfirm = vi.fn();
    render(<HoldToDelete onConfirm={onConfirm} />);
    fireEvent.pointerDown(button());
    act(() => {
      vi.advanceTimersByTime(600);
    });
    fireEvent.blur(button());
    expect(screen.getByTestId('hold-fill').getAttribute('data-holding')).toBe('false');
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('cancels a keyboard hold on blur, like a release', () => {
    const onConfirm = vi.fn();
    render(<HoldToDelete onConfirm={onConfirm} />);
    fireEvent.keyDown(button(), { key: 'Enter' });
    act(() => {
      vi.advanceTimersByTime(600);
    });
    fireEvent.blur(button());
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('can be held again after a release', () => {
    const onConfirm = vi.fn();
    render(<HoldToDelete onConfirm={onConfirm} />);
    fireEvent.pointerDown(button());
    act(() => {
      vi.advanceTimersByTime(1200);
    });
    fireEvent.pointerUp(button());
    fireEvent.pointerDown(button());
    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(onConfirm).toHaveBeenCalledTimes(2);
  });

  it('drives the fill from its holding state', () => {
    render(<HoldToDelete onConfirm={() => {}} />);
    const fill = screen.getByTestId('hold-fill');
    expect(fill.getAttribute('data-holding')).toBe('false');
    fireEvent.pointerDown(button());
    expect(fill.getAttribute('data-holding')).toBe('true');
    fireEvent.pointerUp(button());
    expect(fill.getAttribute('data-holding')).toBe('false');
  });

  it('keyboard: holding Enter for 1200ms confirms once', () => {
    const onConfirm = vi.fn();
    render(<HoldToDelete onConfirm={onConfirm} />);
    fireEvent.keyDown(button(), { key: 'Enter' });
    // Auto-repeat keydowns while held must not restart the timer.
    act(() => {
      vi.advanceTimersByTime(600);
    });
    fireEvent.keyDown(button(), { key: 'Enter', repeat: true });
    act(() => {
      vi.advanceTimersByTime(599);
    });
    expect(onConfirm).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('keyboard: a second Enter press within 3s confirms', () => {
    const onConfirm = vi.fn();
    render(<HoldToDelete onConfirm={onConfirm} />);
    fireEvent.keyDown(button(), { key: 'Enter' });
    fireEvent.keyUp(button(), { key: 'Enter' });
    expect(onConfirm).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(2900);
    });
    fireEvent.keyDown(button(), { key: 'Enter' });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('keyboard: a second Enter after 3s does not confirm, it starts over', () => {
    const onConfirm = vi.fn();
    render(<HoldToDelete onConfirm={onConfirm} />);
    fireEvent.keyDown(button(), { key: 'Enter' });
    fireEvent.keyUp(button(), { key: 'Enter' });
    act(() => {
      vi.advanceTimersByTime(3001);
    });
    fireEvent.keyDown(button(), { key: 'Enter' });
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('announces the armed state to assistive tech', () => {
    render(<HoldToDelete onConfirm={() => {}} />);
    fireEvent.keyDown(button(), { key: 'Enter' });
    fireEvent.keyUp(button(), { key: 'Enter' });
    expect(screen.getByRole('status').textContent).toContain('Enter');
  });

  it('does nothing after unmount', () => {
    const onConfirm = vi.fn();
    const { unmount } = render(<HoldToDelete onConfirm={onConfirm} />);
    fireEvent.pointerDown(button());
    unmount();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
