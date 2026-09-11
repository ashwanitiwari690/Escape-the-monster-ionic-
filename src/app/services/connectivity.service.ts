import { Injectable, signal } from '@angular/core';

/**
 * Tracks whether the device currently has a network connection. Gameplay is
 * blocked while offline (see AppComponent) rather than letting the player
 * earn rewards with no ad ever having been requested or shown.
 *
 * Exposed as a signal rather than a plain property: this app runs with
 * `provideZonelessChangeDetection()`, so a plain property mutated from a
 * window event listener would never schedule a re-render — only a signal
 * write does.
 */
@Injectable({ providedIn: 'root' })
export class ConnectivityService {
  readonly online = signal(typeof navigator === 'undefined' ? true : navigator.onLine);

  constructor() {
    if (typeof window === 'undefined') return;
    window.addEventListener('online', () => this.online.set(true));
    window.addEventListener('offline', () => this.online.set(false));
  }

  /** Re-reads the browser's connectivity flag directly, for a manual "Try again" action. */
  recheck(): void {
    if (typeof navigator !== 'undefined') this.online.set(navigator.onLine);
  }
}
