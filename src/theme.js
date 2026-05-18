import { MD3LightTheme } from "react-native-paper";

export const colors = {
  primary: "#6750A4",
  onPrimary: "#FFFFFF",
  primaryContainer: "#EADDFF",
  secondary: "#006A6A",
  tertiary: "#9A4600",
  error: "#BA1A1A",
  surface: "#FFFBFE",
  surfaceVariant: "#F3EDF7",
  background: "#FCF8FF",
  outline: "#79747E",
  text: "#1D1B20",
  muted: "#49454F",
  success: "#146C2E"
};

export const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: colors.primary,
    onPrimary: colors.onPrimary,
    primaryContainer: colors.primaryContainer,
    secondary: colors.secondary,
    tertiary: colors.tertiary,
    error: colors.error,
    surface: colors.surface,
    surfaceVariant: colors.surfaceVariant,
    background: colors.background,
    outline: colors.outline
  },
  roundness: 5
};
