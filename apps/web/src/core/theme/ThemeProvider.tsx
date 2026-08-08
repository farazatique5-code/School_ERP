// core/theme/ThemeProvider.tsx
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  mode: ThemeMode;
  resolvedMode: 'light' | 'dark';
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);
const THEME_STORAGE_KEY = 'erp.themeMode';

function hexToHsl(hex: string): string | null {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!match) return null;
  const r = parseInt(match[1], 16) / 255;
  const g = parseInt(match[2], 16) / 255;
  const b = parseInt(match[3], 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r:
        h = ((g - b) / d) % 6;
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return `${h.toFixed(0)} ${(s * 100).toFixed(0)}% ${(l * 100).toFixed(0)}%`;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { organization, profile } = useAuth();
  const [mode, setModeState] = useState<ThemeMode>(
    () => (localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode) ?? 'system',
  );

  // Once we know the signed-in user's saved preference, prefer it over
  // whatever was in localStorage from a previous session/device.
  useEffect(() => {
    if (profile?.theme_preference) setModeState(profile.theme_preference);
  }, [profile?.theme_preference]);

  const resolvedMode = useMemo<'light' | 'dark'>(() => {
    if (mode !== 'system') return mode;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }, [mode]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedMode);
  }, [resolvedMode]);

  // White-label: inject the organization's brand colors as CSS variable
  // overrides, on top of the light/dark token base — this is the entire
  // mechanism by which every tenant gets its own look with zero rebuilds.
  useEffect(() => {
    const styleId = 'org-brand-overrides';
    let styleTag = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = styleId;
      document.head.appendChild(styleTag);
    }
    if (organization) {
      const primaryHsl = hexToHsl(organization.primary_color) ?? '243 75% 59%';
      const secondaryHsl = hexToHsl(organization.secondary_color) ?? '199 89% 48%';
      styleTag.textContent = `:root { --brand-primary: ${primaryHsl}; --brand-secondary: ${secondaryHsl}; }`;
      if (organization.favicon_url) {
        const favicon = document.querySelector<HTMLLinkElement>("link[rel='icon']");
        if (favicon) favicon.href = organization.favicon_url;
      }
      document.title = organization.name ? `${organization.name} · School ERP` : 'School ERP';
    }
  }, [organization]);

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    localStorage.setItem(THEME_STORAGE_KEY, next);
  };

  return <ThemeContext.Provider value={{ mode, resolvedMode, setMode }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
