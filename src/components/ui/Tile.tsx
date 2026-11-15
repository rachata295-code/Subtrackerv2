import { HUE_TILE, type Hue } from './hue';
import { Money } from './Money';

export interface TileProps {
  hue: Hue;
  label: string;
  value: number | null;
  onClick?: () => void;
}

const BASE = 'block w-full rounded-tile p-3 text-left';

export function Tile({ hue, label, value, onClick }: TileProps) {
  const body = (
    <>
      <span className="block text-sm font-medium">{label}</span>
      <span className="mt-1 block">
        <Money value={value} size="md" tone="inherit" />
      </span>
    </>
  );

  // A real <button> only when it does something: a non-interactive tile with a button role would
  // mislead screen readers and add a pointless tab stop.
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${BASE} ${HUE_TILE[hue]} pressable min-h-tap hover-fine:hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2`}
      >
        {body}
      </button>
    );
  }
  return <div className={`${BASE} ${HUE_TILE[hue]}`}>{body}</div>;
}
