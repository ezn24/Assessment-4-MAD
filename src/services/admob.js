import { Platform } from "react-native";

let AdMobInterstitial, AdMobRewarded, BannerAd, BannerAdSize, TestIds;

if (Platform.OS !== "web") {
  const ads = require("react-native-google-mobile-ads");
  AdMobInterstitial = ads.AdMobInterstitial;
  AdMobRewarded = ads.AdMobRewarded;
  BannerAd = ads.BannerAd;
  BannerAdSize = ads.BannerAdSize;
  TestIds = ads.TestIds;
}

const AD_UNIT_INTERSTITIAL = __DEV__ && TestIds ? TestIds.INTERSTITIAL : "ca-app-pub-xxxxxxxxxxxxxxxxx/xxxxxxxxxx";
const AD_UNIT_REWARDED = __DEV__ && TestIds ? TestIds.REWARDED : "ca-app-pub-xxxxxxxxxxxxxxxxx/xxxxxxxxxx";
const AD_UNIT_BANNER = __DEV__ && TestIds ? TestIds.BANNER : "ca-app-pub-xxxxxxxxxxxxxxxxx/xxxxxxxxxx";

export async function loadInterstitial() {
  if (Platform.OS === "web" || !AdMobInterstitial) {
    return false;
  }
  try {
    await AdMobInterstitial.setAdUnitId(AD_UNIT_INTERSTITIAL);
    await AdMobInterstitial.requestAdAsync();
    return true;
  } catch (error) {
    console.warn("Failed to load interstitial ad:", error);
    return false;
  }
}

export async function showInterstitial() {
  if (Platform.OS === "web" || !AdMobInterstitial) {
    return false;
  }
  try {
    await AdMobInterstitial.showAdAsync();
    return true;
  } catch (error) {
    console.warn("Failed to show interstitial ad:", error);
    return false;
  }
}

export async function loadRewardedAd() {
  if (Platform.OS === "web" || !AdMobRewarded) {
    return false;
  }
  try {
    await AdMobRewarded.setAdUnitId(AD_UNIT_REWARDED);
    await AdMobRewarded.requestAdAsync();
    return true;
  } catch (error) {
    console.warn("Failed to load rewarded ad:", error);
    return false;
  }
}

export async function showRewardedAd() {
  if (Platform.OS === "web" || !AdMobRewarded) {
    return false;
  }
  try {
    await AdMobRewarded.showAdAsync();
    return true;
  } catch (error) {
    console.warn("Failed to show rewarded ad:", error);
    return false;
  }
}

export function BannerAdComponent({ style }) {
  if (Platform.OS === "web" || !BannerAd) {
    return null;
  }
  return (
    <BannerAd
      unitId={AD_UNIT_BANNER}
      size={BannerAdSize.BANNER}
      requestOptions={{
        requestNonPersonalizedAdsOnly: true
      }}
      style={style}
    />
  );
}

export async function preloadInterstitial() {
  await loadInterstitial();
}

export async function preloadRewarded() {
  await loadRewardedAd();
}
