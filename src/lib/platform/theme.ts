export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "pid-trainer-theme";
export const DEFAULT_THEME_PREFERENCE: ThemePreference = "system";
export const THEME_COLORS: Record<ResolvedTheme, string> = {
  light: "#eef3f8",
  dark: "#0b1118"
};

export function isThemePreference(value: string | null | undefined): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

export function resolveTheme(preference: ThemePreference, prefersDark: boolean): ResolvedTheme {
  return preference === "system" ? (prefersDark ? "dark" : "light") : preference;
}

function systemPrefersDark() {
  return typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function readThemePreference(): ThemePreference {
  if (typeof document !== "undefined") {
    const datasetPreference = document.documentElement.dataset.themePreference;
    if (isThemePreference(datasetPreference)) {
      return datasetPreference;
    }
  }

  if (typeof window !== "undefined") {
    try {
      const storedPreference = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (isThemePreference(storedPreference)) {
        return storedPreference;
      }
    } catch {
      // Storage can be unavailable in private or locked-down browser modes.
    }
  }

  return DEFAULT_THEME_PREFERENCE;
}

export function readResolvedTheme(): ResolvedTheme {
  if (typeof document !== "undefined") {
    const datasetTheme = document.documentElement.dataset.theme;
    if (datasetTheme === "light" || datasetTheme === "dark") {
      return datasetTheme;
    }
  }

  return resolveTheme(readThemePreference(), systemPrefersDark());
}

export function applyThemePreference(preference: ThemePreference) {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return;
  }

  const resolvedTheme = resolveTheme(preference, systemPrefersDark());
  const root = document.documentElement;

  root.dataset.themePreference = preference;
  root.dataset.theme = resolvedTheme;
  root.style.colorScheme = resolvedTheme;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // The active document still receives the theme even if persistence is blocked.
  }

  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta) {
    themeColorMeta.setAttribute("content", THEME_COLORS[resolvedTheme]);
  }
}
