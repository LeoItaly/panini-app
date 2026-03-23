/**
 * Netto Panino Maker — Digital Gastronome Design System
 * Brand tokens from the Netto-panino Stitch project.
 */

export const BrandColors = {
  background: '#fefee5', // surface
  surfaceLow: '#fbfbe0',
  surfaceLowest: '#ffffff',
  surfaceHigh: '#eff0d1',
  surfaceHighest: '#e9eaca',
  primary: '#736400',
  primaryContainer: '#fedf00',
  onPrimary: '#ffffff',
  onPrimaryContainer: '#5c5000',
  onSurface: '#373928',
  secondaryContainer: '#e5e2e1',
  error: '#be2d06',
  tertiary: '#456e39',
  outlineVariant: '#babba4',
};

export const Colors = {
  light: {
    text: BrandColors.onSurface,
    background: BrandColors.background,
    tint: BrandColors.primaryContainer,
    icon: BrandColors.onSurface,
    tabIconDefault: BrandColors.onSurface,
    tabIconSelected: BrandColors.primaryContainer,
  },
  dark: {
    text: BrandColors.surfaceLowest,
    background: BrandColors.onSurface,
    tint: BrandColors.primaryContainer,
    icon: BrandColors.outlineVariant,
    tabIconDefault: BrandColors.outlineVariant,
    tabIconSelected: BrandColors.primaryContainer,
  },
};

/**
 * Typography font families.
 * Install: npx expo install @expo-google-fonts/plus-jakarta-sans @expo-google-fonts/be-vietnam-pro
 * Until installed, React Native falls back to the system font.
 */
export const FontFamily = {
  headlineExtraBold: 'PlusJakartaSans-ExtraBold',
  headlineBold: 'PlusJakartaSans-Bold',
  headlineMedium: 'PlusJakartaSans-Medium',
  bodyRegular: 'BeVietnamPro-Regular',
  bodySemiBold: 'BeVietnamPro-SemiBold',
  bodyBold: 'BeVietnamPro-Bold',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

/**
 * Legacy Fonts export — kept for backwards compatibility with explore.tsx.
 * New screens should use FontFamily instead.
 */
import { Platform } from 'react-native';
export const Fonts = Platform.select({
  ios: { sans: 'system-ui', serif: 'ui-serif', rounded: 'ui-rounded', mono: 'ui-monospace' },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Courier New', monospace",
  },
  default: { sans: 'normal', serif: 'serif', rounded: 'normal', mono: 'monospace' },
});

export const Radius = {
  sm: 8,
  md: 12,
  lg: 32, // Gourmet card radius
  xl: 48,
  pill: 9999, // 'full' corner radius
};
