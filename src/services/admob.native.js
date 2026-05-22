import { AdMobInterstitial, AdMobRewarded, BannerAd, BannerAdSize } from "react-native-google-mobile-ads";

export async function loadInterstitial(adUnitId) {
  try {
    await AdMobInterstitial.setAdUnitId(adUnitId);
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

export async function loadRewardedAd(adUnitId) {
  try {
    await AdMobRewarded.setAdUnitId(adUnitId);
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

export function BannerAdComponent(adUnitId, style) {
  return (
    <BannerAd
      unitId={adUnitId}
      size={BannerAdSize.BANNER}
      requestOptions={{
        requestNonPersonalizedAdsOnly: true
      }}
      style={style}
    />
  );
}
