export async function loadInterstitial() {
  return false;
}

export async function showInterstitial() {
  return false;
}

export async function loadRewardedAd() {
  return false;
}

export async function showRewardedAd() {
  return false;
}

export function BannerAdComponent({ style }) {
  return null;
}

export async function preloadInterstitial() {
  await loadInterstitial();
}

export async function preloadRewarded() {
  await loadRewardedAd();
}
