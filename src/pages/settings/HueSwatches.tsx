import { HUE_MARK, HUE_TILE, type Hue } from '../../components/ui/hue';
import { orderedHuesForPicker } from './settingsUtils';

export function HueSwatches({
  value,
  usedHues,
  onChange,
}: {
  value: Hue;
  usedHues: Hue[];
  onChange: (hue: Hue) => void;
}) {
  const items = orderedHuesForPicker(usedHues);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-text">สี</span>
      <div className="grid grid-cols-3 gap-2">
        {items.map((item) => {
          const selected = item.hue === value;
          return (
            <button
              key={item.hue}
              type="button"
              data-hue={item.hue}
              aria-pressed={selected}
              onClick={() => onChange(item.hue)}
              className={[
                'pressable flex min-h-tap items-center gap-2 rounded-tile px-3 text-sm font-medium',
                HUE_TILE[item.hue],
                selected ? 'border-2 border-accent' : 'border border-transparent',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2',
              ].join(' ')}
            >
              <span aria-hidden="true" className={`h-2.5 w-2.5 shrink-0 rounded-dot ${HUE_MARK[item.hue]}`} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
