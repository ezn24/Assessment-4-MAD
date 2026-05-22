import * as Network from "expo-network";

export async function getNetworkState() {
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
  try {
    const ip = await Network.getIpAddressAsync();
    return ip;
  } catch (error) {
    console.warn("Failed to get IP address:", error);
    return null;
  }
}

export function subscribeToNetworkState(callback) {
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
