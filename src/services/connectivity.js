import { Platform } from "react-native";

let Network = null;

if (Platform.OS !== "web") {
  try {
    Network = require("expo-network");
  } catch (e) {
    console.warn("Network not available:", e);
  }
}

export async function getNetworkState() {
  if (!Network) {
    return { isConnected: true, type: "web", isInternetReachable: true };
  }
  try {
    const networkState = await Network.getNetworkStateAsync();
    return {
      isConnected: networkState.isConnected,
      type: networkState.type,
      isInternetReachable: networkState.isInternetReachable
    };
  } catch (error) {
    console.warn("Failed to get network state:", error);
    return { isConnected: false, type: Network.NetworkStateType.NONE, isInternetReachable: false };
  }
}

export async function isNetworkAvailable() {
  const state = await getNetworkState();
  return state.isConnected && state.isInternetReachable;
}

export async function getIpAddress() {
  if (!Network) {
    return null;
  }
  try {
    const ip = await Network.getIpAddressAsync();
    return ip;
  } catch (error) {
    console.warn("Failed to get IP address:", error);
    return null;
  }
}

export function subscribeToNetworkState(callback) {
  if (!Network) {
    return { remove: () => {} };
  }
  const subscription = Network.addNetworkStateListener((state) => {
    callback({
      isConnected: state.isConnected,
      type: state.type,
      isInternetReachable: state.isInternetReachable
    });
  });
  return subscription;
}

export async function getNetworkTypeLabel() {
  const state = await getNetworkState();
  if (!state.isConnected) {
    return "Offline";
  }
  if (Platform.OS === "web") {
    return "Web";
  }
  switch (state.type) {
    case Network.NetworkStateType.CELLULAR:
      return "Cellular";
    case Network.NetworkStateType.WIFI:
      return "WiFi";
    case Network.NetworkStateType.ETHERNET:
      return "Ethernet";
    case Network.NetworkStateType.NONE:
    default:
      return "Unknown";
  }
}
