# Escape the Monster v1.7.0

Angular 20 + Ionic 8 + Capacitor 7 2D mobile game.

## Pages
- `/home` — home/dashboard
- `/play` — gameplay + virtual joystick
- `/shop` — power shop
- `/settings` — audio, vibration, app info and level reset
- `/result` — run summary

## Persistence
Wallet coins, best score, level and settings are stored in browser/Capacitor WebView `localStorage`. Coins are persisted immediately after each pickup and purchase, and again on `pagehide`/`beforeunload`.

**Reset Game Progress resets only the level to 1. Coins and best score are preserved. Power-up inventory is also preserved.**

Each collected coin adds exactly **1 saved coin** to the wallet. The pickup is written to localStorage immediately, so closing the app does not lose already collected coins.

## Gameplay tuning
Monster speed was reduced substantially:
- Level 1 starts around 70 speed units.
- Level progression adds only a small amount.
- In-run acceleration is gentle and capped at 110.

Player movement remains responsive and the existing touch joystick is retained.

## Run
```bash
npm ci
ng build
ionic serve
```

Android:
```bash
npx cap sync android
npx cap open android
```
## Background music volume update
The default background-music volume is now 100%. The Web Audio music master uses a gentle boost curve and stronger music tones so the soundtrack is more audible on mobile while keeping the master gain capped at 1.0.



## Credit request UI (v2.1.0)
- The Settings page shows a 10-digit number field and CREDIT button only when wallet coins are >= 1000.
- Input is restricted to digits and a maximum of 10 characters.
- The submit handler is API-ready but intentionally does not call an external API yet.
- After your future API returns success, call `completeCreditRequestSuccess()` to hide the form.


## Credit Request Update (v2.2)
When the credit form is visible (wallet >= 1000 coins), the Settings page also shows the current TOTAL COINS balance immediately above the 10-digit input and CREDIT button. The value is read from the same persisted coin signal used by the app, so it stays synchronized with the wallet.
