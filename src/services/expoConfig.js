import Constants from "expo-constants";

export function getExpoExtra() {
  return (
    Constants.expoConfig?.extra ||
    Constants.manifest?.extra ||
    Constants.manifest2?.extra?.expoClient?.extra ||
    Constants.manifest2?.expoClient?.extra ||
    Constants.manifest2?.extra ||
    {}
  );
}
