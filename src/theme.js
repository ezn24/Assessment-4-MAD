import { MD3DarkTheme, MD3LightTheme } from "react-native-paper";

// Apple-inspired color palette
export const lightTheme = {
  ...MD3LightTheme,
  roundness: 12,
  colors: {
    ...MD3LightTheme.colors,
    primary: "#007AFF",
    onPrimary: "#FFFFFF",
    primaryContainer: "#E5F1FF",
    onPrimaryContainer: "#0048A8",
    secondary: "#5856D6",
    tertiary: "#FF2D55",
    background: "#F5F5F7",
    onBackground: "#1D1D1F",
    surface: "#FFFFFF",
    onSurface: "#1D1D1F",
    surfaceVariant: "#F2F2F7",
    onSurfaceVariant: "#86868B",
    outline: "#E5E5EA",
    error: "#FF3B30",
    onError: "#FFFFFF",
    errorContainer: "#FFDAD6",
    onErrorContainer: "#410002",
    success: "#34C759",
    warning: "#FF9500"
  }
};

export const darkTheme = {
  ...MD3DarkTheme,
  roundness: 12,
  colors: {
    ...MD3DarkTheme.colors,
    primary: "#0A84FF",
    onPrimary: "#FFFFFF",
    primaryContainer: "#1C3A5E",
    onPrimaryContainer: "#E5F1FF",
    secondary: "#5E5CE6",
    tertiary: "#FF453A",
    background: "#000000",
    onBackground: "#F5F5F7",
    surface: "#1C1C1E",
    onSurface: "#F5F5F7",
    surfaceVariant: "#2C2C2E",
    onSurfaceVariant: "#98989D",
    outline: "#38383A",
    error: "#FF453A",
    onError: "#FFFFFF",
    errorContainer: "#52201C",
    onErrorContainer: "#FFDAD6",
    success: "#30D158",
    warning: "#FF9F0A"
  }
};

export const highContrastTheme = {
  ...MD3LightTheme,
  roundness: 12,
  colors: {
    ...MD3LightTheme.colors,
    primary: "#000000",
    onPrimary: "#FFFFFF",
    primaryContainer: "#E0E0E0",
    onPrimaryContainer: "#000000",
    secondary: "#000000",
    tertiary: "#000000",
    background: "#FFFFFF",
    onBackground: "#000000",
    surface: "#FFFFFF",
    onSurface: "#000000",
    surfaceVariant: "#E0E0E0",
    onSurfaceVariant: "#000000",
    outline: "#000000",
    error: "#FF0000",
    onError: "#FFFFFF",
    errorContainer: "#FFCCCC",
    onErrorContainer: "#000000",
    success: "#008000",
    warning: "#FF8C00"
  }
};

export const theme = lightTheme;
