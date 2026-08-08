import type { Config } from 'tailwindcss';

// Utility scale only — visual identity (color/typography/radius) is driven
// by the CSS-variable design tokens in src/styles/global.css, not Tailwind
// theme overrides, so white-label branding can swap tokens at runtime
// without a rebuild. See docs/04-design-system.md.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: { extend: {} },
  plugins: [],
} satisfies Config;
