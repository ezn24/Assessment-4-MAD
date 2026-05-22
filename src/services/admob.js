import { AdMobInterstitial, AdMobRewarded, BannerAd, BannerAdSize, TestIds } from "react-native-google-mobile-ads";

const AD_UNIT_INTERSTITIAL = __DEV__ ? TestIds.INTERSTITIAL : "ca-app-pub-xxxxxxxxxxxxxxxxx/xxxxxxxxxx";
const AD_UNIT_REWARDED = __DEV__ ? TestIds.REWARDED : "ca-app-pub-xxxxxxxxxxxxxxxxx/xxxxxxxxxx";
const AD_UNIT_BANNER = __DEV__ ? TestIds.BANNER : "ca-app-pub-xxxxxxxxxxxxxxxxx/xxxxxxxxxx";

export async function loadInterstitial() {
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
  try {
    await AdMobInterstitial.showAdAsync();
    return true;
  } catch (error) {
    console.warn("Failed to show interstitial ad:", error);
    return false;
  }
}

export async function loadRewardedAd() {
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
  try {
    await AdMobRewarded.showAdAsync();
    return true;
  } catch (error) {
    console.warn("Failed to show rewarded ad:", error);
    return false;
  }
}

export function BannerAdComponent({ style }) {
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
