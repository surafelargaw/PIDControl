// Theme flash-prevention script. Runs before React hydrates to apply the
// user's saved preference before the first paint, preventing a light/dark flash.
// If THEME_STORAGE_KEY or THEME_COLORS change in src/lib/platform/theme.ts,
// update the constants below to match.
(() => {
  try {
    const storageKey = "pid-trainer-theme";
    const themeColors = { light: "#eef3f8", dark: "#0b1118" };
    let storedPreference = null;
    try {
      storedPreference = window.localStorage.getItem(storageKey);
    } catch {
      storedPreference = null;
    }
    const preference =
      storedPreference === "light" || storedPreference === "dark" || storedPreference === "system"
        ? storedPreference
        : "system";
    const prefersDark =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    const resolvedTheme = preference === "system" ? (prefersDark ? "dark" : "light") : preference;
    const root = document.documentElement;
    root.dataset.themePreference = preference;
    root.dataset.theme = resolvedTheme;
    root.style.colorScheme = resolvedTheme;
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta) {
      themeColorMeta.setAttribute("content", themeColors[resolvedTheme]);
    }
  } catch {
    // Ignore boot-time theme failures; default light tokens remain.
  }
})();
