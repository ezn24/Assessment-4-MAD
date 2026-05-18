import React from "react";
import { PaperProvider } from "react-native-paper";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import HomeScreen from "./src/screens/HomeScreen";
import { theme } from "./src/theme";

export default function App() {
  return (
    // react-native-gesture-handler needs a native root view before Swipeable rows can work reliably.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider theme={theme}>
        <StatusBar style="dark" />
        <HomeScreen />
      </PaperProvider>
    </GestureHandlerRootView>
  );
}
