"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_THEME_PREFERENCE,
  applyThemePreference,
  readResolvedTheme,
  readThemePreference,
  type ResolvedTheme,
  type ThemePreference
} from "@/lib/platform/theme";

const THEME_OPTIONS = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "system", label: "System" }
] as const satisfies ReadonlyArray<{ id: ThemePreference; label: string }>;

function ThemeGlyph({ theme }: { theme: ThemePreference }) {
  const commonProps = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.7
  };

  if (theme === "light") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="4.2" {...commonProps} />
        <path d="M12 2.8v2.4" {...commonProps} />
        <path d="M12 18.8v2.4" {...commonProps} />
        <path d="m5.4 5.4 1.7 1.7" {...commonProps} />
        <path d="m16.9 16.9 1.7 1.7" {...commonProps} />
        <path d="M2.8 12h2.4" {...commonProps} />
        <path d="M18.8 12h2.4" {...commonProps} />
        <path d="m5.4 18.6 1.7-1.7" {...commonProps} />
        <path d="m16.9 7.1 1.7-1.7" {...commonProps} />
      </svg>
    );
  }

  if (theme === "dark") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M19 15.2A7.2 7.2 0 0 1 8.8 5a7.8 7.8 0 1 0 10.2 10.2Z" {...commonProps} />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4.5" y="5.5" width="15" height="13" rx="2.6" {...commonProps} />
      <path d="M12 5.5v13" {...commonProps} />
      <path d="M7.5 15.8c.8.8 2 1.2 3.1 1.2V7.1a5 5 0 0 0-3.1 8.7Z" {...commonProps} />
    </svg>
  );
}

export function ThemeControls() {
  const [preference, setPreference] = useState<ThemePreference>(DEFAULT_THEME_PREFERENCE);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");

  useEffect(() => {
    const syncThemeState = () => {
      setPreference(readThemePreference());
      setResolvedTheme(readResolvedTheme());
    };

    syncThemeState();

    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemThemeChange = () => {
      if (readThemePreference() !== "system") {
        return;
      }

      applyThemePreference("system");
      syncThemeState();
    };

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleSystemThemeChange);
      return () => mediaQuery.removeEventListener("change", handleSystemThemeChange);
    }

    mediaQuery.addListener(handleSystemThemeChange);
    return () => mediaQuery.removeListener(handleSystemThemeChange);
  }, []);

  const handleThemeSelection = (nextPreference: ThemePreference) => {
    applyThemePreference(nextPreference);
    setPreference(nextPreference);
    setResolvedTheme(readResolvedTheme());
  };

  return (
    <section className="theme-card" aria-labelledby="appearance-heading">
      <div className="theme-card-header">
        <div>
          <p className="eyebrow">Appearance</p>
          <h2 id="appearance-heading">Theme</h2>
        </div>
        <span className="pill info">{resolvedTheme === "dark" ? "Dark active" : "Light active"}</span>
      </div>

      <div className="theme-switcher" role="group" aria-label="Theme preference">
        {THEME_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            className="theme-option"
            data-active={preference === option.id}
            aria-pressed={preference === option.id}
            onClick={() => handleThemeSelection(option.id)}
            title={option.id === "system" ? `Follow device appearance. Currently ${resolvedTheme}.` : option.label}
          >
            <ThemeGlyph theme={option.id} />
            <span>{option.label}</span>
          </button>
        ))}
      </div>

      <p className="theme-note">Switch between light and dark UI. System follows your device appearance.</p>
    </section>
  );
}
