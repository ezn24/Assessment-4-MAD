import React, { useMemo } from "react";
import { useColorScheme } from "react-native";
import { useMaterial3Theme } from "@pchmn/expo-material3-theme";
import { MD3DarkTheme, MD3LightTheme, PaperProvider } from "react-native-paper";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import HomeScreen from "./src/screens/HomeScreen";
import { darkTheme, lightTheme } from "./src/theme";

export default function App() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const { theme: materialTheme } = useMaterial3Theme({ fallbackSourceColor: "#6750A4" });
  const paperTheme = useMemo(() => {
    const baseTheme = isDark ? darkTheme : lightTheme;
    const basePaperTheme = isDark ? MD3DarkTheme : MD3LightTheme;
    const dynamicColors = isDark ? materialTheme.dark : materialTheme.light;
    return {
      ...basePaperTheme,
      ...baseTheme,
      colors: {
        ...basePaperTheme.colors,
        ...baseTheme.colors,
        ...dynamicColors
      }
    };
  }, [isDark, materialTheme]);

  return (
    // react-native-gesture-handler needs a native root view before Swipeable rows can work reliably.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider theme={paperTheme}>
        <StatusBar style={isDark ? "light" : "dark"} />
        <HomeScreen />
      </PaperProvider>
    </GestureHandlerRootView>
  );
}
