import React from "react";

// Import the AdMob SDK defensively. If the native module is unavailable for any
// reason (e.g. dev client without it linked), we fall back to no-op stubs so
// the rest of the app keeps working instead of crashing on startup.
let BannerAd = null;
let BannerAdSize = null;
let TestIds = null;
let InterstitialAd = null;
let RewardedAd = null;
let AdEventType = null;
let RewardedAdEventType = null;
try {
  const ads = require("react-native-google-mobile-ads");
  BannerAd = ads.BannerAd;
  BannerAdSize = ads.BannerAdSize;
  TestIds = ads.TestIds;
  InterstitialAd = ads.InterstitialAd;
  RewardedAd = ads.RewardedAd;
  AdEventType = ads.AdEventType;
  RewardedAdEventType = ads.RewardedAdEventType;
} catch (error) {
  console.warn("react-native-google-mobile-ads not available:", error);
}

const DEFAULT_BANNER_ID = TestIds?.BANNER || "ca-app-pub-3940256099942544/6300978111";
const DEFAULT_INTERSTITIAL_ID = TestIds?.INTERSTITIAL || "ca-app-pub-3940256099942544/1033173712";
const DEFAULT_REWARDED_ID = TestIds?.REWARDED || "ca-app-pub-3940256099942544/5224354917";

let interstitial = null;
let interstitialLoaded = false;

function ensureInterstitial(adUnitId) {
  if (!InterstitialAd || !AdEventType) {
    return null;
  }
  if (interstitial) {
    return interstitial;
  }
  try {
    interstitial = InterstitialAd.createForAdRequest(adUnitId || DEFAULT_INTERSTITIAL_ID, {
      requestNonPersonalizedAdsOnly: true
    });
    interstitial.addAdEventListener(AdEventType.LOADED, () => {
      interstitialLoaded = true;
    });
    interstitial.addAdEventListener(AdEventType.CLOSED, () => {
      interstitialLoaded = false;
      try {
        interstitial.load();
      } catch (e) {
        // ignore
      }
    });
    interstitial.addAdEventListener(AdEventType.ERROR, (err) => {
      interstitialLoaded = false;
      console.warn("Interstitial ad error:", err);
    });
  } catch (error) {
    console.warn("Failed to create interstitial ad:", error);
    interstitial = null;
  }
  return interstitial;
}

export async function loadInterstitial(adUnitId) {
  const ad = ensureInterstitial(adUnitId);
  if (!ad) return false;
  try {
    ad.load();
    return true;
  } catch (error) {
    console.warn("Failed to load interstitial ad:", error);
    return false;
  }
}

export async function preloadInterstitial(adUnitId) {
  return loadInterstitial(adUnitId);
}

export async function showInterstitial() {
  if (!interstitial || !interstitialLoaded) {
    return false;
  }
  try {
    interstitial.show();
    return true;
  } catch (error) {
    console.warn("Failed to show interstitial ad:", error);
    return false;
  }
}

let rewarded = null;
let rewardedLoaded = false;

function ensureRewarded(adUnitId) {
  if (!RewardedAd || !RewardedAdEventType || !AdEventType) {
    return null;
  }
  if (rewarded) {
    return rewarded;
  }
  try {
    rewarded = RewardedAd.createForAdRequest(adUnitId || DEFAULT_REWARDED_ID, {
      requestNonPersonalizedAdsOnly: true
    });
    rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
      rewardedLoaded = true;
    });
    rewarded.addAdEventListener(AdEventType.CLOSED, () => {
      rewardedLoaded = false;
      try {
        rewarded.load();
      } catch (e) {
        // ignore
      }
    });
    rewarded.addAdEventListener(AdEventType.ERROR, (err) => {
      rewardedLoaded = false;
      console.warn("Rewarded ad error:", err);
    });
  } catch (error) {
    console.warn("Failed to create rewarded ad:", error);
    rewarded = null;
  }
  return rewarded;
}

export async function loadRewardedAd(adUnitId) {
  const ad = ensureRewarded(adUnitId);
  if (!ad) return false;
  try {
    ad.load();
    return true;
  } catch (error) {
    console.warn("Failed to load rewarded ad:", error);
    return false;
  }
}

export async function preloadRewarded(adUnitId) {
  return loadRewardedAd(adUnitId);
}

export async function showRewardedAd() {
  if (!rewarded || !rewardedLoaded) {
    return false;
  }
  try {
    rewarded.show();
    return true;
  } catch (error) {
    console.warn("Failed to show rewarded ad:", error);
    return false;
  }
}

export function BannerAdComponent(props) {
  if (!BannerAd || !BannerAdSize) {
    return null;
  }
  // Support both call styles:
  //   <BannerAdComponent style={...} />            -> props = { style }
  //   <BannerAdComponent adUnitId="..." style={...} />
  const { adUnitId, style } = props && typeof props === "object" ? props : {};
  const unitId = adUnitId || DEFAULT_BANNER_ID;
  return (
    <BannerAd
      unitId={unitId}
      size={BannerAdSize.BANNER}
      requestOptions={{
        requestNonPersonalizedAdsOnly: true
      }}
      onAdFailedToLoad={(err) => console.warn("Banner ad failed:", err)}
      style={style}
    />
  );
}
