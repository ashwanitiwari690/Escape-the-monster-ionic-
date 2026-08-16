# Rewarded video slot

Place the future rewarded video at `src/assets/ads/rewarded-video.mp4`. The Home page opens it in the rewarded-video modal and credits 100 coins only when the video reaches its `ended` event. The two-hour cooldown is persisted in localStorage under `etm-rewarded-ad-next-available`.

For production Android monetization, use Google Mobile Ads / AdMob rewarded ads rather than Google AdSense. Replace the local video adapter with the AdMob rewarded callback and grant coins only after the SDK confirms the reward.
