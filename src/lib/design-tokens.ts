/**
 * Single source of truth for Servino brand colors.
 * Mirrors the CSS custom properties in src/app/globals.css.
 * Use this file when a color value is needed outside Tailwind classes
 * (e.g. theme-color meta tags, canvas/SVG generation, email templates).
 */
export const brandColors = {
  purple: "#5B4CF0",
  purpleDark: "#4636C9",
  purpleLight: "#EDEBFE",
  coral: "#FF6B57",
  coralLight: "#FFE4E0",
  teal: "#16A085",
  tealLight: "#DFF5F0",
  offWhite: "#FAF9F6",
  ink: "#161722",
  inkMuted: "#5B5C6B",
  border: "#E7E5E0",
} as const;

export type BrandColor = keyof typeof brandColors;
