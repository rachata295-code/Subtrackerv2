import { SegmentedControl } from './ui/SegmentedControl';
import { useTheme } from './ThemeProvider';
import type { ThemePref } from '../lib/theme';

const OPTIONS: { value: ThemePref; label: string }[] = [
  { value: 'system', label: 'ระบบ' },
  { value: 'light', label: 'สว่าง' },
  { value: 'dark', label: 'มืด' },
];

// Binds the segmented control to the stored preference (not the resolved theme), so "ระบบ" stays selectable
// and keeps following the OS after the user picks it.
export function ThemeSwitch() {
  const { pref, setPref } = useTheme();
  return <SegmentedControl label="ธีม" options={OPTIONS} value={pref} onChange={setPref} />;
}
