import React, { useEffect, useMemo, useState } from "react";
import { Appearance, useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMaterial3Theme } from "@pchmn/expo-material3-theme";
import { MD3DarkTheme, MD3LightTheme, PaperProvider } from "react-native-paper";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import HomeScreen from "./src/screens/HomeScreen";
import { darkTheme, lightTheme } from "./src/theme";

const SETTINGS_STORAGE_KEY = "vizminder-a4-settings";
const DEFAULT_SETTINGS = {
  themeMode: "system",
  followSystemColors: true,
  showReminderDebugButton: false
};

export default function App() {
  const hookScheme = useColorScheme();
  const [appearanceScheme, setAppearanceScheme] = useState(Appearance.getColorScheme() || "light");
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const systemScheme = hookScheme || appearanceScheme || "light";
  const activeScheme = settings.themeMode === "system" ? systemScheme : settings.themeMode;
  const isDark = activeScheme === "dark";
  const { theme: materialTheme } = useMaterial3Theme({ fallbackSourceColor: "#6750A4" });

  useEffect(() => {
    AsyncStorage.getItem(SETTINGS_STORAGE_KEY)
      .then((value) => {
        if (value) {
          setSettings((current) => ({ ...current, ...JSON.parse(value) }));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setAppearanceScheme(colorScheme || "light");
    });
    return () => subscription.remove();
  }, []);

  const updateSettings = (patch) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

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
        ...(settings.followSystemColors ? dynamicColors : {})
      }
    };
  }, [isDark, materialTheme, settings.followSystemColors]);

  return (
    // react-native-gesture-handler needs a native root view before Swipeable rows can work reliably.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider key={`${activeScheme}-${settings.followSystemColors ? "dynamic" : "static"}`} theme={paperTheme}>
        <StatusBar style={isDark ? "light" : "dark"} />
        <HomeScreen settings={settings} onUpdateSettings={updateSettings} isDarkOverride={isDark} themeColors={paperTheme.colors} />
      </PaperProvider>
    </GestureHandlerRootView>
  );
}
