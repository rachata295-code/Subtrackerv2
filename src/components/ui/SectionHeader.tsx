export interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function SectionHeader({ title, actionLabel, onAction }: SectionHeaderProps) {
  // Both are needed: a label with no handler (or the reverse) would render a dead or invisible control.
  const showAction = Boolean(actionLabel && onAction);
  return (
    <div className="flex min-h-tap items-center justify-between gap-3">
      <h2 className="text-base font-semibold text-text">{title}</h2>
      {showAction ? (
        <button
          type="button"
          onClick={onAction}
          className="pressable -mr-2 min-h-tap rounded-tile px-2 text-sm font-medium text-accent hover-fine:hover:bg-stone-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
