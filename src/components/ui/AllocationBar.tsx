import { computeAllocation, type Segment } from '../../lib/allocation';
import { formatTHB } from '../../lib/money';
import { HUE_MARK } from './hue';

export interface AllocationBarProps {
  total: number;
  parts: Segment[];
}

function fillClass(hue: Segment['hue']): string {
  return hue === 'remaining' ? 'bg-teal-mark' : HUE_MARK[hue];
}

export function AllocationBar({ total, parts }: AllocationBarProps) {
  const { segments, remaining, over, remainingFraction } = computeAllocation(total, parts);

  // Every slot spans the whole track and is cut down with scaleX from the left edge, then moved with
  // translateX. Only transform animates, so resizing a segment never triggers layout.
  let offset = 0;
  const slots = segments.map((s) => {
    const slot = { key: s.id, hue: s.hue, paid: s.state === 'paid', left: offset, fraction: s.fraction };
    offset += s.fraction;
    return slot;
  });
  if (remainingFraction > 0) {
    slots.push({ key: '__remaining', hue: 'remaining', paid: false, left: offset, fraction: remainingFraction });
  }

  // 2px gaps (mockup) sit on every boundary except after the last slot. Each gap is a full-track-width
  // wrapper moved by translateX (so it animates with the segments, transform only) holding a 2px strip
  // pulled back 1px; the strip uses the card surface colour, which is what the bar sits on.
  const gaps = slots.slice(0, -1).map((s) => ({ key: s.key, at: s.left + s.fraction }));

  // The bar is a graphic, so its meaning has to be in the label; over budget is stated in words, not colour alone.
  const label = over ? `เกินงบ ${formatTHB(Math.abs(remaining))}` : `เหลือ ${formatTHB(remaining)}`;

  return (
    <div
      role="img"
      aria-label={label}
      className={`relative h-3 w-full overflow-hidden rounded-pill bg-stone-bg ${over ? 'outline outline-2 outline-negative' : ''}`.trim()}
    >
      {slots.map((s) => (
        <span
          key={s.key}
          data-segment={s.key}
          className={`absolute inset-y-0 left-0 w-full origin-left transition-transform duration-base ease-in-out motion-reduce:transition-none ${fillClass(s.hue)} ${s.paid ? 'opacity-50' : ''}`.trim()}
          style={{ transform: `translateX(${s.left * 100}%) scaleX(${s.fraction})` }}
        />
      ))}
      {gaps.map((g) => (
        <span
          key={g.key}
          data-gap={g.key}
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-full transition-transform duration-base ease-in-out motion-reduce:transition-none"
          style={{ transform: `translateX(${g.at * 100}%)` }}
        >
          <span className="absolute inset-y-0 -left-px w-0.5 bg-surface" />
        </span>
      ))}
    </div>
  );
}
