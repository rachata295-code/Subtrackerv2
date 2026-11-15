export interface SwitchProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function Switch({ label, checked, onChange, disabled }: SwitchProps) {
  return (
    // The whole row is the button so the tap target is the row (min 44px), not just the small track.
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex min-h-tap w-full items-center justify-between gap-3 text-left text-base text-text disabled:opacity-50"
    >
      <span>{label}</span>
      {/* Track colour swaps instantly; only the thumb moves (transform), keeping the animation compositor-only. */}
      <span
        aria-hidden="true"
        className={['relative h-7 w-12 shrink-0 rounded-full', checked ? 'bg-accent' : 'bg-control'].join(' ')}
      >
        <span
          data-testid="switch-thumb"
          className={[
            'absolute left-0.5 top-0.5 h-6 w-6 rounded-full transition-transform duration-fast ease-out motion-reduce:transition-none',
            checked ? 'bg-on-accent' : 'bg-surface',
          ].join(' ')}
          // 48 (track) - 24 (thumb) - 2*2 (inset) = 20px of travel.
          style={{ transform: checked ? 'translateX(20px)' : 'translateX(0)' }}
        />
      </span>
    </button>
  );
}
