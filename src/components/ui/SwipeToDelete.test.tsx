import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ListRow } from './ListRow';
import { SwipeToDelete } from './SwipeToDelete';

// jsdom omits PointerEvent, so Testing Library falls back to Event and drops clientX/clientY/pointerType.
class JsdomPointerEvent extends MouseEvent {
  pointerId: number;
  pointerType: string;
  constructor(type: string, params: PointerEventInit = {}) {
    super(type, params);
    this.pointerId = params.pointerId ?? 1;
    this.pointerType = params.pointerType ?? '';
  }
}

beforeEach(() => {
  vi.stubGlobal('PointerEvent', JsdomPointerEvent);
});

function mockMediaQueryMatches(activeQueries: string[]) {
  const set = new Set(activeQueries);
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: set.has(query),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => true,
  }));
}

function getSwipeTrack(container: HTMLElement): HTMLElement {
  return container.querySelector('[data-testid="swipe-track"]') as HTMLElement;
}

function readTranslateX(el: HTMLElement): number {
  const match = /translate3d\((-?\d+(?:\.\d+)?)px/.exec(el.style.transform);
  if (match) return Number(match[1]);
  const matchX = /translateX\((-?\d+(?:\.\d+)?)px\)/.exec(el.style.transform);
  return matchX ? Number(matchX[1]) : 0;
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('<SwipeToDelete>', () => {
  it('tracks horizontal swipe 1:1 after 8px axis lock and reveals red "ลบ" button (>= 72px)', () => {
    const onDelete = vi.fn();
    const { container } = render(
      <SwipeToDelete onDelete={onDelete} label="ชานม">
        <ListRow title="ชานม" amount={85} onClick={() => {}} />
      </SwipeToDelete>,
    );

    const track = getSwipeTrack(container);
    expect(container.firstElementChild?.className).toContain('touch-pan-y');

    // Inside 8px deadzone: does not move yet.
    fireEvent.pointerDown(track, { pointerId: 1, clientX: 250, clientY: 20, pointerType: 'touch' });
    fireEvent.pointerMove(track, { pointerId: 1, clientX: 244, clientY: 20, pointerType: 'touch' });
    expect(readTranslateX(track)).toBe(0);

    // Past 8px horizontal lock: tracks 1:1 from startX (250 -> 200 = -50px).
    fireEvent.pointerMove(track, { pointerId: 1, clientX: 200, clientY: 20, pointerType: 'touch' });
    expect(readTranslateX(track)).toBe(-50);

    // Release past half of 80px tray: snaps open to -80px.
    fireEvent.pointerUp(track, { pointerId: 1, clientX: 200, clientY: 20, pointerType: 'touch' });
    expect(readTranslateX(track)).toBe(-80);
    expect(onDelete).not.toHaveBeenCalled();

    const deleteBtn = screen.getByRole('button', { name: 'ลบ' });
    expect(deleteBtn.className).toContain('w-20'); // 80px >= 72px
    fireEvent.click(deleteBtn);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('snaps back closed on small swipe without high velocity', () => {
    const onDelete = vi.fn();
    const { container } = render(
      <SwipeToDelete onDelete={onDelete}>
        <ListRow title="กาแฟ" amount={65} />
      </SwipeToDelete>,
    );
    const track = getSwipeTrack(container);

    vi.useFakeTimers();
    vi.setSystemTime(1000);
    fireEvent.pointerDown(track, { pointerId: 1, clientX: 200, clientY: 20, pointerType: 'touch' });
    vi.setSystemTime(1500);
    fireEvent.pointerMove(track, { pointerId: 1, clientX: 175, clientY: 20, pointerType: 'touch' });
    expect(readTranslateX(track)).toBe(-25);
    fireEvent.pointerUp(track, { pointerId: 1, clientX: 175, clientY: 20, pointerType: 'touch' });
    vi.useRealTimers();

    expect(readTranslateX(track)).toBe(0);
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('opens on fast leftward flick and closes on fast rightward flick', () => {
    const onDelete = vi.fn();
    const { container } = render(
      <SwipeToDelete onDelete={onDelete}>
        <ListRow title="ข้าวมันไก่" amount={45} />
      </SwipeToDelete>,
    );
    const track = getSwipeTrack(container);

    vi.useFakeTimers();
    vi.setSystemTime(1000);
    fireEvent.pointerDown(track, { pointerId: 1, clientX: 200, clientY: 20, pointerType: 'touch' });
    vi.setSystemTime(1015);
    // Only -20px distance, but fast velocity (-20 / 15 = -1.33 px/ms).
    fireEvent.pointerMove(track, { pointerId: 1, clientX: 180, clientY: 20, pointerType: 'touch' });
    fireEvent.pointerUp(track, { pointerId: 1, clientX: 180, clientY: 20, pointerType: 'touch' });
    expect(readTranslateX(track)).toBe(-80);

    // Now flick right from open state.
    vi.setSystemTime(1100);
    fireEvent.pointerDown(track, { pointerId: 2, clientX: 120, clientY: 20, pointerType: 'touch' });
    vi.setSystemTime(1115);
    fireEvent.pointerMove(track, { pointerId: 2, clientX: 140, clientY: 20, pointerType: 'touch' });
    fireEvent.pointerUp(track, { pointerId: 2, clientX: 140, clientY: 20, pointerType: 'touch' });
    expect(readTranslateX(track)).toBe(0);
    vi.useRealTimers();
  });

  it('triggers onDelete immediately on full swipe past threshold', () => {
    const onDelete = vi.fn();
    const { container } = render(
      <SwipeToDelete onDelete={onDelete}>
        <ListRow title="หนัง" amount={220} />
      </SwipeToDelete>,
    );
    const track = getSwipeTrack(container);

    fireEvent.pointerDown(track, { pointerId: 1, clientX: 300, clientY: 20, pointerType: 'touch' });
    fireEvent.pointerMove(track, { pointerId: 1, clientX: 80, clientY: 20, pointerType: 'touch' });
    expect(readTranslateX(track)).toBeLessThanOrEqual(-176);
    fireEvent.pointerUp(track, { pointerId: 1, clientX: 80, clientY: 20, pointerType: 'touch' });

    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('ignores vertical gestures so page scrolling works unimpeded', () => {
    const onDelete = vi.fn();
    const { container } = render(
      <SwipeToDelete onDelete={onDelete}>
        <ListRow title="รถไฟฟ้า" amount={40} />
      </SwipeToDelete>,
    );
    const track = getSwipeTrack(container);

    fireEvent.pointerDown(track, { pointerId: 1, clientX: 200, clientY: 20, pointerType: 'touch' });
    fireEvent.pointerMove(track, { pointerId: 1, clientX: 196, clientY: 40, pointerType: 'touch' });
    fireEvent.pointerMove(track, { pointerId: 1, clientX: 100, clientY: 60, pointerType: 'touch' });
    fireEvent.pointerUp(track, { pointerId: 1, clientX: 100, clientY: 60, pointerType: 'touch' });

    expect(readTranslateX(track)).toBe(0);
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('applies rubber-band resistance when dragged past the right edge', () => {
    const { container } = render(
      <SwipeToDelete onDelete={() => {}}>
        <ListRow title="เกม" amount={115} />
      </SwipeToDelete>,
    );
    const track = getSwipeTrack(container);

    fireEvent.pointerDown(track, { pointerId: 1, clientX: 100, clientY: 20, pointerType: 'touch' });
    fireEvent.pointerMove(track, { pointerId: 1, clientX: 200, clientY: 20, pointerType: 'touch' });
    const tx = readTranslateX(track);
    expect(tx).toBeGreaterThan(0);
    expect(tx).toBeLessThan(100);
    fireEvent.pointerUp(track, { pointerId: 1, clientX: 200, clientY: 20, pointerType: 'touch' });
    expect(readTranslateX(track)).toBe(0);
  });

  it('allows only one row open at a time and closes on outside tap or tapping the open row', async () => {
    const onRowClick = vi.fn();
    const { container } = render(
      <div>
        <button type="button">ที่อื่น</button>
        <SwipeToDelete onDelete={() => {}}>
          <ListRow title="แถวหนึ่ง" amount={100} onClick={onRowClick} />
        </SwipeToDelete>
        <SwipeToDelete onDelete={() => {}}>
          <ListRow title="แถวสอง" amount={200} />
        </SwipeToDelete>
      </div>,
    );

    const tracks = container.querySelectorAll('[data-testid="swipe-track"]');
    const track1 = tracks[0] as HTMLElement;
    const track2 = tracks[1] as HTMLElement;

    // Open row 1.
    fireEvent.pointerDown(track1, { pointerId: 1, clientX: 200, clientY: 20, pointerType: 'touch' });
    fireEvent.pointerMove(track1, { pointerId: 1, clientX: 140, clientY: 20, pointerType: 'touch' });
    fireEvent.pointerUp(track1, { pointerId: 1, clientX: 140, clientY: 20, pointerType: 'touch' });
    expect(readTranslateX(track1)).toBe(-80);

    // Wait a tick for the post-drag click guard to clear, then tap row 1 while open.
    await new Promise((r) => setTimeout(r, 0));
    fireEvent.click(screen.getByText('แถวหนึ่ง'));
    expect(readTranslateX(track1)).toBe(0);
    expect(onRowClick).not.toHaveBeenCalled();

    // Open row 1 again, then swipe open row 2 -> row 1 closes automatically.
    fireEvent.pointerDown(track1, { pointerId: 2, clientX: 200, clientY: 20, pointerType: 'touch' });
    fireEvent.pointerMove(track1, { pointerId: 2, clientX: 140, clientY: 20, pointerType: 'touch' });
    fireEvent.pointerUp(track1, { pointerId: 2, clientX: 140, clientY: 20, pointerType: 'touch' });
    expect(readTranslateX(track1)).toBe(-80);

    fireEvent.pointerDown(track2, { pointerId: 3, clientX: 200, clientY: 20, pointerType: 'touch' });
    fireEvent.pointerMove(track2, { pointerId: 3, clientX: 140, clientY: 20, pointerType: 'touch' });
    fireEvent.pointerUp(track2, { pointerId: 3, clientX: 140, clientY: 20, pointerType: 'touch' });
    expect(readTranslateX(track1)).toBe(0);
    expect(readTranslateX(track2)).toBe(-80);

    // Tapping elsewhere closes row 2.
    fireEvent.pointerDown(screen.getByRole('button', { name: 'ที่อื่น' }));
    expect(readTranslateX(track2)).toBe(0);
  });

  it('supports keyboard deletion via real "ลบ" button and Delete key on focused row', () => {
    const onDelete = vi.fn();
    render(
      <SwipeToDelete onDelete={onDelete} label="ชานม">
        <ListRow title="ชานม" amount={85} onClick={() => {}} />
      </SwipeToDelete>,
    );

    const rowBtn = screen.getByRole('button', { name: /ชานม/ });
    fireEvent.keyDown(rowBtn, { key: 'Delete' });
    expect(onDelete).toHaveBeenCalledTimes(1);

    const deleteBtn = screen.getByRole('button', { name: 'ลบ', hidden: true });
    fireEvent.focus(deleteBtn);
    expect(screen.getByRole('button', { name: 'ลบ' })).toBeTruthy();
    fireEvent.click(deleteBtn);
    expect(onDelete).toHaveBeenCalledTimes(2);
  });

  it('disables swipe gestures on (pointer: fine) desktop devices', () => {
    mockMediaQueryMatches(['(pointer: fine)']);
    const onDelete = vi.fn();
    const { container } = render(
      <SwipeToDelete onDelete={onDelete}>
        <ListRow title="ชานม" amount={85} onClick={() => {}} />
      </SwipeToDelete>,
    );

    expect(container.querySelector('[data-testid="swipe-track"]')).toBeNull();
    expect(screen.queryByRole('button', { name: 'ลบ' })).toBeNull();
  });

  it('omits CSS transitions when prefers-reduced-motion: reduce is active', () => {
    mockMediaQueryMatches(['(prefers-reduced-motion: reduce)']);
    const { container } = render(
      <SwipeToDelete onDelete={() => {}}>
        <ListRow title="ชานม" amount={85} />
      </SwipeToDelete>,
    );

    const track = getSwipeTrack(container);
    expect(track.className).not.toContain('transition-transform');
  });

  it('snaps back to 0 when onDelete returns false or rejects', async () => {
    const onDelete = vi.fn().mockResolvedValue(false);
    const { container } = render(
      <SwipeToDelete onDelete={onDelete}>
        <ListRow title="บัตรเครดิต" amount={null} />
      </SwipeToDelete>,
    );

    const track = getSwipeTrack(container);
    fireEvent.pointerDown(track, { pointerId: 1, clientX: 300, clientY: 20, pointerType: 'touch' });
    fireEvent.pointerMove(track, { pointerId: 1, clientX: 80, clientY: 20, pointerType: 'touch' });
    await act(async () => {
      fireEvent.pointerUp(track, { pointerId: 1, clientX: 80, clientY: 20, pointerType: 'touch' });
    });

    await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(readTranslateX(track)).toBe(0));
  });
});
