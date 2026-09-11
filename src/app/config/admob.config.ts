/**
 * Centralized AdMob configuration. Every ad placement in the app reads its
 * ad unit ID and reward amounts from here — nothing else in the codebase
 * hardcodes an ad unit ID. Swapping to production is a matter of replacing
 * the three IDs below once real ad units exist in the AdMob console.
 *
 * These are Google's official sample ad unit IDs — they always serve a
 * clearly labeled "Test Ad" and are safe to ship during development (real ad
 * unit IDs used with unapproved apps/test devices can get an AdMob account
 * flagged for invalid traffic). See
 * https://developers.google.com/admob/android/test-ads
 *
 * Before releasing to production:
 *  1. Create real ad units in the AdMob console for this app's App ID
 *     (android/app/src/main/res/values/strings.xml -> admob_app_id, and the
 *     matching <meta-data> in AndroidManifest.xml).
 *  2. Replace every value below with the real ad unit IDs.
 *  3. Remove `initializeForTesting: true` in AdmobService.initialize().
 */
export const AD_UNIT_IDS = {
  banner: 'ca-app-pub-3940256099942544/6300978111',
  interstitial: 'ca-app-pub-3940256099942544/1033173712',
  rewarded: 'ca-app-pub-3940256099942544/5224354917'
} as const;

/** Show interstitials at most once every N finished runs (policy-safe pacing). */
export const INTERSTITIAL_EVERY_N_ROUNDS = 2;

/**
 * Coin/reward amounts granted by each rewarded-ad placement. This file only
 * ever deals in in-game coins — the coins-to-rupees conversion rate is never
 * hardcoded here, it is read live from the Earnivo backend via
 * GameRedemptionService.getGameConfiguration().
 */
export const REWARD_AMOUNTS = {
  /** Home screen "watch video" button — coins granted, on a cooldown. */
  homeVideoCoins: 100,
  /** Cooldown between home-screen rewarded video watches, in ms. */
  homeVideoCooldownMs: 2 * 60 * 60 * 1000,
  /** Result screen "double your coins" — coins granted = collectedThisRun * this multiplier. */
  doubleCoinsMultiplier: 1,
  /** Extra lives granted by the "continue" rewarded ad after a run-ending hit. */
  continueExtraLives: 1
} as const;
