import type { ReactNode } from 'react';
import { HUE_TILE, type Hue } from './hue';

export function Pill({ hue, children }: { hue: Hue; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-pill px-2 py-0.5 text-xs font-medium whitespace-nowrap ${HUE_TILE[hue]}`}
    >
      {children}
    </span>
  );
}
