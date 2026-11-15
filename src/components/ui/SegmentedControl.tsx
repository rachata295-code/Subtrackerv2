import { useRef, type KeyboardEvent } from 'react';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name of the group (the visible labels only name each segment). */
  label: string;
}

export function SegmentedControl<T extends string>({ options, value, onChange, label }: SegmentedControlProps<T>) {
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const count = options.length;
  const selected = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );

  // Arrow keys move selection AND focus (automatic activation): a 2-4 segment filter is cheap to switch,
  // and roving tabindex keeps the whole control a single Tab stop.
  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number;
    switch (e.key) {
      case 'ArrowRight':
        next = (index + 1) % count;
        break;
      case 'ArrowLeft':
        next = (index - 1 + count) % count;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = count - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    onChange(options[next].value);
    tabs.current[next]?.focus();
  };

  return (
    <div role="tablist" aria-label={label} className="relative grid rounded-tile bg-stone-bg p-1" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
      {/* Indicator is one segment wide and slides by whole-segment translateX (percent of its own width),
          so only transform animates. Reduced motion: it jumps instead of sliding. */}
      <span
        aria-hidden="true"
        data-testid="segmented-indicator"
        className="pointer-events-none absolute bottom-1 left-1 top-1 rounded-pill bg-surface transition-transform duration-fast ease-in-out motion-reduce:transition-none"
        style={{ width: `calc((100% - 8px) / ${count})`, transform: `translateX(${selected * 100}%)` }}
      />
      {options.map((opt, i) => {
        const active = i === selected;
        return (
          <button
            key={opt.value}
            ref={(el) => {
              tabs.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            className={[
              'relative z-10 min-h-tap rounded-pill px-3 text-base font-medium',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2',
              active ? 'text-text' : 'text-muted hover-fine:hover:text-text',
            ].join(' ')}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
