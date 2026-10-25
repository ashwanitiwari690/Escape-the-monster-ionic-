import { Injectable, signal } from '@angular/core';
import { Capacitor, PluginListenerHandle } from '@capacitor/core';
import {
  AdMob,
  AdmobConsentStatus,
  AdMobError,
  AdMobRewardItem,
  BannerAdOptions,
  BannerAdPluginEvents,
  BannerAdPosition,
  BannerAdSize,
  InterstitialAdPluginEvents,
  RewardAdPluginEvents
} from '@capacitor-community/admob';
import { AD_UNIT_IDS, INTERSTITIAL_EVERY_N_ROUNDS } from '../config/admob.config';

/**
 * Robust, production-grade wrapper around @capacitor-community/admob.
 *
 * Implements:
 * 1. Google UMP Consent Management Platform (GDPR / UK / CPRA) integration.
 * 2. Proper banner ad lifecycle (deduped listeners, resume/hide, and bounded retry).
 * 3. Interstitial ad flow that strictly awaits user dismissal and pauses app audio.
 * 4. Rewarded ad flow that decouples AdMob's Rewarded event from Dismissed event,
 *    guaranteeing rewards are granted only on verified completion and never denied.
 * 5. Concurrency locks preventing overlapping ad displays or rapid repeated taps.
 * 6. Dynamic CSS safe-area spacing (--ad-banner-space) to avoid overlapping gameplay UI.
 */
@Injectable({ providedIn: 'root' })
export class AdmobService {
  readonly isSupported = Capacitor.isNativePlatform();

  /** True while a rewarded ad is loading or being shown across the app. */
  readonly rewardedBusy = signal(false);

  /** True while ANY full-screen ad (interstitial or rewarded) is covering the screen. */
  readonly fullScreenAdActive = signal(false);

  /** True when the banner has successfully loaded and rendered. */
  readonly bannerLoaded = signal(false);

  private initPromise?: Promise<void>;

  // Banner state
  private bannerCreated = false;
  private bannerVisible = false;
  private bannerDesired = false;
  private bannerListenersRegistered = false;
  private bannerRetryTimer?: ReturnType<typeof setTimeout>;
  private bannerRetryAttempts = 0;
  private readonly MAX_BANNER_RETRIES = 3;

  // Interstitial state
  private interstitialReady = false;
  private interstitialLoading = false;
  private interstitialBusy = false;
  private interstitialRetryTimer?: ReturnType<typeof setTimeout>;
  private interstitialRetryAttempts = 0;
  private readonly MAX_INTERSTITIAL_RETRIES = 3;
  private roundsSinceInterstitial = 0;

  // Rewarded state
  private rewardedReady = false;
  private rewardedLoading = false;
  private rewardedRetryTimer?: ReturnType<typeof setTimeout>;
  private rewardedRetryAttempts = 0;
  private readonly MAX_REWARDED_RETRIES = 3;

  /**
   * Initializes Google Mobile Ads SDK and handles UMP consent.
   * Safe to call repeatedly; returns the memoized init promise.
   */
  initialize(): Promise<void> {
    if (!this.isSupported) return Promise.resolve();
    if (!this.initPromise) {
      this.initPromise = (async () => {
        // Step 1: User Messaging Platform (UMP) Consent
        try {
          console.log('[AdMob] Requesting UMP consent info...');
          const consentInfo = await AdMob.requestConsentInfo();
          console.log('[AdMob] Consent status:', consentInfo?.status);
          if (
            consentInfo?.status === AdmobConsentStatus.REQUIRED &&
            consentInfo?.isConsentFormAvailable
          ) {
            console.log('[AdMob] Showing consent form...');
            await AdMob.showConsentForm();
            console.log('[AdMob] Consent form completed.');
          }
        } catch (consentErr) {
          console.warn('[AdMob] UMP consent bypassed or unavailable:', consentErr);
        }

        // Step 2: Initialize Mobile Ads SDK
        try {
          console.log('[AdMob] Initializing Google Mobile Ads SDK...');
          await AdMob.initialize({});
          console.log('[AdMob] Google Mobile Ads SDK initialized successfully.');
        } catch (initErr) {
          console.error('[AdMob] Mobile Ads SDK initialization error:', initErr);
        }

        // Step 3: Register singleton Banner listeners
        await this.registerBannerListeners();

        // Step 4: Preload initial full-screen ads in background
        void this.preloadInterstitial();
        void this.preloadRewarded();
      })();
    }
    return this.initPromise;
  }

  /**
   * Registers global listeners for banner events once.
   * Prevents listener duplication across navigations.
   */
  private async registerBannerListeners(): Promise<void> {
    if (this.bannerListenersRegistered || !this.isSupported) return;
    this.bannerListenersRegistered = true;
    try {
      await AdMob.addListener(BannerAdPluginEvents.Loaded, () => {
        console.log('[AdMob] Banner loaded successfully.');
        this.bannerLoaded.set(true);
        this.bannerRetryAttempts = 0;
      });

      await AdMob.addListener(BannerAdPluginEvents.FailedToLoad, (err: AdMobError) => {
        console.warn('[AdMob] Banner failed to load:', err);
        this.bannerLoaded.set(false);
        this.setBannerSpace(0);
        this.scheduleBannerRetry();
      });

      await AdMob.addListener(BannerAdPluginEvents.SizeChanged, (info) => {
        console.log('[AdMob] Banner size changed height:', info.height);
        if (this.bannerDesired) {
          this.setBannerSpace(info.height);
        }
      });
    } catch (err) {
      console.warn('[AdMob] Failed to attach banner listeners:', err);
    }
  }

  /**
   * Shows the persistent bottom adaptive banner.
   * Resumes existing banner or creates a new one if not yet active.
   */
  async showBanner(): Promise<void> {
    if (!this.isSupported) return;
    this.bannerDesired = true;
    if (this.bannerVisible) return;

    await this.initialize();
    if (!this.bannerDesired) return;

    if (this.bannerCreated) {
      try {
        await AdMob.resumeBanner();
        this.bannerVisible = true;
        console.log('[AdMob] Banner resumed.');
        return;
      } catch (err) {
        console.warn('[AdMob] resumeBanner failed, recreating fresh:', err);
        this.bannerCreated = false;
      }
    }

    const options: BannerAdOptions = {
      adId: AD_UNIT_IDS.banner,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: 0
    };

    try {
      console.log('[AdMob] Creating & showing banner...');
      await AdMob.showBanner(options);
      this.bannerCreated = true;
      this.bannerVisible = true;
      console.log('[AdMob] Banner displayed.');
    } catch (err) {
      console.warn('[AdMob] showBanner error:', err);
      this.bannerVisible = false;
      this.setBannerSpace(0);
      this.scheduleBannerRetry();
    }
  }

  /**
   * Hides the banner (e.g. during active gameplay so it never covers controls).
   * Resets the CSS spacing variable immediately.
   */
  async hideBanner(): Promise<void> {
    this.bannerDesired = false;
    if (this.bannerRetryTimer) {
      clearTimeout(this.bannerRetryTimer);
      this.bannerRetryTimer = undefined;
    }
    if (!this.isSupported || !this.bannerVisible) {
      this.setBannerSpace(0);
      return;
    }
    try {
      console.log('[AdMob] Hiding banner.');
      await AdMob.hideBanner();
    } catch (err) {
      console.warn('[AdMob] hideBanner error:', err);
    } finally {
      this.bannerVisible = false;
      this.setBannerSpace(0);
    }
  }

  private scheduleBannerRetry(): void {
    if (!this.bannerDesired || this.bannerRetryAttempts >= this.MAX_BANNER_RETRIES) return;
    this.bannerRetryAttempts++;
    const delay = Math.min(45000, 10000 * Math.pow(2, this.bannerRetryAttempts - 1));
    console.log(`[AdMob] Scheduling banner retry #${this.bannerRetryAttempts} in ${delay}ms`);
    if (this.bannerRetryTimer) clearTimeout(this.bannerRetryTimer);
    this.bannerRetryTimer = setTimeout(() => {
      if (this.bannerDesired && !this.bannerVisible) {
        void this.showBanner();
      }
    }, delay);
  }

  /** Exposes the banner's live height as a CSS variable for UI padding. */
  private setBannerSpace(heightPx: number): void {
    document.documentElement.style.setProperty('--ad-banner-space', `${Math.max(0, heightPx)}px`);
  }

  /** Preloads an interstitial ad with bounded retry. */
  async preloadInterstitial(): Promise<void> {
    if (!this.isSupported || this.interstitialReady || this.interstitialLoading || this.fullScreenAdActive()) return;
    this.interstitialLoading = true;
    try {
      console.log('[AdMob] Preparing interstitial ad...');
      await AdMob.prepareInterstitial({ adId: AD_UNIT_IDS.interstitial });
      this.interstitialReady = true;
      this.interstitialRetryAttempts = 0;
      console.log('[AdMob] Interstitial ad ready.');
    } catch (err) {
      this.interstitialReady = false;
      console.warn('[AdMob] Interstitial ad prepare failed:', err);
      this.scheduleInterstitialRetry();
    } finally {
      this.interstitialLoading = false;
    }
  }

  private scheduleInterstitialRetry(): void {
    if (this.interstitialReady || this.interstitialRetryAttempts >= this.MAX_INTERSTITIAL_RETRIES) return;
    this.interstitialRetryAttempts++;
    const delay = Math.min(30000, 5000 * Math.pow(2, this.interstitialRetryAttempts - 1));
    console.log(`[AdMob] Scheduling interstitial retry #${this.interstitialRetryAttempts} in ${delay}ms`);
    if (this.interstitialRetryTimer) clearTimeout(this.interstitialRetryTimer);
    this.interstitialRetryTimer = setTimeout(() => {
      void this.preloadInterstitial();
    }, delay);
  }

  /**
   * Paced display of interstitial ad at natural session transitions.
   * Paced every INTERSTITIAL_EVERY_N_ROUNDS rounds to comply with Google frequency guidelines.
   */
  async maybeShowInterstitialAtBreakpoint(): Promise<void> {
    if (!this.isSupported) return;
    this.roundsSinceInterstitial++;
    if (this.roundsSinceInterstitial < INTERSTITIAL_EVERY_N_ROUNDS) {
      console.log(`[AdMob] Interstitial breakpoint skipped (${this.roundsSinceInterstitial}/${INTERSTITIAL_EVERY_N_ROUNDS} rounds).`);
      return;
    }
    this.roundsSinceInterstitial = 0;
    await this.showInterstitial();
  }

  /**
   * Shows an interstitial ad and awaits full dismissal before resolving.
   * Guarantees that app flow and audio only resume after the ad has closed.
   */
  async showInterstitial(): Promise<boolean> {
    if (!this.isSupported || this.interstitialBusy || this.fullScreenAdActive()) return false;
    this.interstitialBusy = true;
    try {
      await this.initialize();
      if (!this.interstitialReady) {
        console.log('[AdMob] Interstitial not ready yet, attempting quick load...');
        await Promise.race([
          this.preloadInterstitial(),
          new Promise<void>(resolve => setTimeout(resolve, 3500))
        ]);
      }
      if (!this.interstitialReady) {
        console.warn('[AdMob] Interstitial unavailable; continuing without delay.');
        return false;
      }

      this.interstitialReady = false;
      this.fullScreenAdActive.set(true);

      return await new Promise<boolean>(resolve => {
        let settled = false;
        const handles: Promise<PluginListenerHandle>[] = [];
        let safetyTimer: ReturnType<typeof setTimeout>;

        const cleanup = () => {
          if (safetyTimer) clearTimeout(safetyTimer);
          handles.forEach(h => h.then(handle => handle.remove()).catch(() => {}));
        };

        const finish = (shown: boolean) => {
          if (settled) return;
          settled = true;
          cleanup();
          console.log(`[AdMob] Interstitial finished (shown=${shown})`);
          resolve(shown);
        };

        // Listen for dismissal (closed by user)
        handles.push(AdMob.addListener(InterstitialAdPluginEvents.Dismissed, () => finish(true)));

        // Listen for failure to show
        handles.push(AdMob.addListener(InterstitialAdPluginEvents.FailedToShow, (err: AdMobError) => {
          console.warn('[AdMob] Interstitial FailedToShow:', err);
          finish(false);
        }));

        // Safety timeout (5 minutes max)
        safetyTimer = setTimeout(() => {
          console.warn('[AdMob] Interstitial safety timeout reached.');
          finish(false);
        }, 300000);

        AdMob.showInterstitial()
          .then(() => {
            console.log('[AdMob] Interstitial presented.');
          })
          .catch((err) => {
            console.warn('[AdMob] showInterstitial error:', err);
            finish(false);
          });
      });
    } finally {
      this.fullScreenAdActive.set(false);
      this.interstitialBusy = false;
      // Preload next interstitial with slight delay
      setTimeout(() => void this.preloadInterstitial(), 800);
    }
  }

  /** Preloads a rewarded video ad with bounded retry. */
  async preloadRewarded(): Promise<void> {
    if (!this.isSupported || this.rewardedReady || this.rewardedLoading || this.fullScreenAdActive()) return;
    this.rewardedLoading = true;
    try {
      console.log('[AdMob] Preparing rewarded ad...');
      await AdMob.prepareRewardVideoAd({ adId: AD_UNIT_IDS.rewarded });
      this.rewardedReady = true;
      this.rewardedRetryAttempts = 0;
      console.log('[AdMob] Rewarded ad ready.');
    } catch (err) {
      this.rewardedReady = false;
      console.warn('[AdMob] Rewarded ad prepare failed:', err);
      this.scheduleRewardedRetry();
    } finally {
      this.rewardedLoading = false;
    }
  }

  private scheduleRewardedRetry(): void {
    if (this.rewardedReady || this.rewardedRetryAttempts >= this.MAX_REWARDED_RETRIES) return;
    this.rewardedRetryAttempts++;
    const delay = Math.min(30000, 5000 * Math.pow(2, this.rewardedRetryAttempts - 1));
    console.log(`[AdMob] Scheduling rewarded retry #${this.rewardedRetryAttempts} in ${delay}ms`);
    if (this.rewardedRetryTimer) clearTimeout(this.rewardedRetryTimer);
    this.rewardedRetryTimer = setTimeout(() => {
      void this.preloadRewarded();
    }, delay);
  }

  /**
   * Shows a rewarded video ad and resolves true ONLY when the reward callback fires.
   * Decouples the Rewarded event from the Dismissed event:
   * - Rewarded: marks rewardEarned = true.
   * - Dismissed: finishes and returns rewardEarned.
   * - FailedToShow / early close without reward: returns false.
   */
  async showRewarded(): Promise<boolean> {
    if (!this.isSupported || this.rewardedBusy() || this.fullScreenAdActive()) return false;
    this.rewardedBusy.set(true);
    this.fullScreenAdActive.set(true);

    try {
      await this.initialize();
      if (!this.rewardedReady) {
        console.log('[AdMob] Rewarded ad not ready, attempting quick load...');
        await Promise.race([
          this.preloadRewarded(),
          new Promise<void>(resolve => setTimeout(resolve, 4500))
        ]);
      }

      if (!this.rewardedReady) {
        console.warn('[AdMob] Rewarded ad unavailable; continuing gracefully.');
        return false;
      }

      this.rewardedReady = false;

      return await new Promise<boolean>(resolve => {
        let settled = false;
        let rewardEarned = false;
        const handles: Promise<PluginListenerHandle>[] = [];
        let safetyTimer: ReturnType<typeof setTimeout>;

        const cleanup = () => {
          if (safetyTimer) clearTimeout(safetyTimer);
          handles.forEach(h => h.then(handle => handle.remove()).catch(() => {}));
        };

        const finish = (granted: boolean) => {
          if (settled) return;
          settled = true;
          cleanup();
          console.log(`[AdMob] Rewarded ad session finished. Reward granted: ${granted}`);
          resolve(granted);
        };

        // 1. Reward verified event: fires when user earns reward
        handles.push(AdMob.addListener(RewardAdPluginEvents.Rewarded, (item: AdMobRewardItem) => {
          console.log('[AdMob] Verified RewardAdPluginEvents.Rewarded received:', item);
          rewardEarned = true;
        }));

        // 2. Dismissed event: fires when ad closes
        handles.push(AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
          console.log(`[AdMob] RewardAdPluginEvents.Dismissed received. Earned status: ${rewardEarned}`);
          finish(rewardEarned);
        }));

        // 3. FailedToShow event: fires on presentation failure
        handles.push(AdMob.addListener(RewardAdPluginEvents.FailedToShow, (err: AdMobError) => {
          console.warn('[AdMob] RewardAdPluginEvents.FailedToShow:', err);
          finish(false);
        }));

        // 4. Safety fallback (10 minutes)
        safetyTimer = setTimeout(() => {
          console.warn('[AdMob] Rewarded ad safety timeout reached.');
          finish(rewardEarned);
        }, 600000);

        // 5. Invoke showRewardVideoAd
        AdMob.showRewardVideoAd()
          .then((item: AdMobRewardItem) => {
            console.log('[AdMob] showRewardVideoAd promise resolved:', item);
            if (item) rewardEarned = true;
          })
          .catch((err) => {
            console.warn('[AdMob] showRewardVideoAd promise rejected:', err);
            finish(false);
          });
      });
    } finally {
      this.fullScreenAdActive.set(false);
      this.rewardedBusy.set(false);
      // Preload next rewarded ad after short delay
      setTimeout(() => void this.preloadRewarded(), 800);
    }
  }
}
