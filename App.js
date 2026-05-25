import React, { useEffect, useMemo, useState } from "react";
import { AppState, Appearance, useColorScheme, Platform, NativeModules } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SystemUI from "expo-system-ui";
import { useMaterial3Theme } from "@pchmn/expo-material3-theme";
import { configureFonts, MD3DarkTheme, MD3LightTheme, PaperProvider } from "react-native-paper";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { useFonts, Roboto_400Regular, Roboto_500Medium, Roboto_700Bold } from "@expo-google-fonts/roboto";
import HomeScreen from "./src/screens/HomeScreen";
import { darkTheme, lightTheme } from "./src/theme";

const SETTINGS_STORAGE_KEY = "vizminder-a4-settings";
const DEFAULT_SETTINGS = {
  themeMode: "light",
  followSystemColors: true,
  showReminderDebugButton: false,
  recordDebugPromptStats: false,
  reminderNotifications: true,
  notificationSound: true,
  fullScreenAlerts: true,
  followUpNotifications: true,
  notificationVibration: true
};

export default function App() {
  const [fontsLoaded] = useFonts({
    Roboto_400Regular,
    Roboto_500Medium,
    Roboto_700Bold
  });
  const hookScheme = useColorScheme();
  const [appearanceScheme, setAppearanceScheme] = useState(Appearance.getColorScheme() || hookScheme || "light");
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const activeScheme = settings.themeMode === "dark" ? "dark" : "light";
  const isDark = activeScheme === "dark";
  const { theme: materialTheme } = useMaterial3Theme({ fallbackSourceColor: "#6750A4" });

  useEffect(() => {
    AsyncStorage.getItem(SETTINGS_STORAGE_KEY)
      .then((value) => {
        if (value) {
          const stored = JSON.parse(value);
          const themeMode = stored.themeMode === "dark" ? "dark" : "light";
          setSettings((current) => ({ ...current, ...stored, themeMode }));
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

  useEffect(() => {
    if (hookScheme) {
      setAppearanceScheme(hookScheme);
    }
  }, [hookScheme]);

  useEffect(() => {
    const refreshScheme = () => setAppearanceScheme(Appearance.getColorScheme() || hookScheme || "light");
    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        refreshScheme();
      }
    });
    const interval = setInterval(refreshScheme, 1500);
    return () => {
      appStateSubscription.remove();
      clearInterval(interval);
    };
  }, [hookScheme]);

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
      fonts: configureFonts({
        config: {
          fontFamily: fontsLoaded ? "Roboto_400Regular" : "sans-serif"
        }
      }),
      colors: {
        ...basePaperTheme.colors,
        ...baseTheme.colors,
        ...(settings.followSystemColors ? dynamicColors : {})
      }
    };
  }, [fontsLoaded, isDark, materialTheme, settings.followSystemColors]);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(paperTheme.colors.background).catch(() => {});
  }, [paperTheme.colors.background]);

  useEffect(() => {
    if (Platform.OS === "android" && NativeModules.AlarmScheduler) {
      const colors = paperTheme.colors;
      NativeModules.AlarmScheduler.setTheme(
        isDark,
        colors.primary || (isDark ? "#D0BCFF" : "#4F378B"),
        colors.primaryContainer || (isDark ? "#4F378B" : "#EADDFF"),
        colors.background || (isDark ? "#141218" : "#FEF7FF"),
        colors.onSurface || (isDark ? "#E6E0E9" : "#1D1B20"),
        colors.onSurfaceVariant || (isDark ? "#CAC4D0" : "#49454F")
      ).catch(() => {});
    }
  }, [isDark, paperTheme.colors]);

  return (
    // react-native-gesture-handler needs a native root view before Swipeable rows can work reliably.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider key={`${activeScheme}-${settings.followSystemColors ? "dynamic" : "static"}-${paperTheme.dark ? "dark" : "light"}`} theme={paperTheme}>
        <StatusBar style={isDark ? "light" : "dark"} />
        <HomeScreen settings={settings} onUpdateSettings={updateSettings} isDarkOverride={isDark} themeColors={paperTheme.colors} />
      </PaperProvider>
    </GestureHandlerRootView>
  );
}
