export type ThemePref = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

// Shared with the inline script in index.html, which must read the same key before React mounts.
export const THEME_STORAGE_KEY = 'subtracker-theme';

// Hex mirror of --ground per theme. jsdom cannot read CSS variables and <meta name="theme-color">
// needs a literal colour, so this is duplicated on purpose; a test guards it against tokens.css.
export const THEME_COLOR: Record<ResolvedTheme, string> = {
  light: '#f3f5f7',
  dark: '#111214',
};

const PREFS: readonly ThemePref[] = ['system', 'light', 'dark'];

export function resolveTheme(pref: ThemePref, systemDark: boolean): ResolvedTheme {
  if (pref === 'system') return systemDark ? 'dark' : 'light';
  return pref;
}

function defaultStorage(): Storage | undefined {
  // Merely touching window.localStorage can throw (blocked cookies, private mode).
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function readThemePref(storage: Storage | undefined = defaultStorage()): ThemePref {
  try {
    const raw = storage?.getItem(THEME_STORAGE_KEY);
    return PREFS.includes(raw as ThemePref) ? (raw as ThemePref) : 'system';
  } catch {
    // Storage is a convenience, never a requirement: fall back to following the system.
    return 'system';
  }
}

export function writeThemePref(pref: ThemePref, storage: Storage | undefined = defaultStorage()): void {
  try {
    storage?.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    // Ignored on purpose: failing to persist must not break switching the theme for this session.
  }
}
