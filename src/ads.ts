import { Capacitor } from '@capacitor/core';
import { AdMob } from '@capacitor-community/admob';

let initialized = false;

export async function initializeAds() {
  if (!Capacitor.isNativePlatform() || initialized) return;
  try {
    await AdMob.initialize({ initializeForTesting: import.meta.env.DEV });
    initialized = true;
  } catch (error) {
    console.warn('AdMob init failed', error);
  }
}

export async function showRewardedHint(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    // Browser/PWA preview: no monetized inventory. Grant the reward so the flow stays testable.
    return true;
  }

  const adId = import.meta.env.VITE_ADMOB_REWARDED_ANDROID;
  if (!adId) return false;

  try {
    await initializeAds();
    await AdMob.prepareRewardVideoAd({ adId, isTesting: import.meta.env.DEV });
    const reward = await AdMob.showRewardVideoAd();
    return Boolean(reward);
  } catch (error) {
    console.warn('Rewarded ad unavailable', error);
    return false;
  }
}
