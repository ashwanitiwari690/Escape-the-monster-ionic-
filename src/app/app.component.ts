import { ChangeDetectionStrategy, Component, HostListener, OnDestroy, ViewEncapsulation, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, Subscription } from 'rxjs';

type Screen = 'home' | 'game' | 'shop' | 'result' | 'settings' | 'profile';
type Power = 'shield' | 'magnet' | 'speed';
interface Point { x: number; y: number; }

const APP_VERSION = '2.3.0';
const STORAGE = {
  coins: 'etm-coins',
  high: 'etm-high',
  level: 'etm-level',
  sound: 'etm-sound',
  music: 'etm-music',
  musicVolume: 'etm-music-volume',
  sfxVolume: 'etm-sfx-volume',
  vibration: 'etm-vibration',
  shields: 'etm-shields',
  magnets: 'etm-magnets',
  speedBoosts: 'etm-speed-boosts',
  rewardedAdNext: 'etm-rewarded-ad-next-available',
  withdrawMobile: 'etm-withdraw-mobile'
} as const;

function readStoredNumber(key: string, fallback: number): number {
  try {
    const value = Number(localStorage.getItem(key));
    return Number.isFinite(value) && value >= 0 ? value : fallback;
  } catch {
    return fallback;
  }
}

function readStoredBool(key: string, fallback: boolean): boolean {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value === 'true';
  } catch {
    return fallback;
  }
}

function readStoredString(key: string, fallback: string): string {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value;
  } catch {
    return fallback;
  }
}




@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <main class="app-shell">
      <header class="topbar">
        <button class="brand-button" type="button" (click)="go('home')" aria-label="Home">
          <span class="brand-icon monster-mini"><i></i></span>
          <span class="brand-copy">ESCAPE<br><b>THE MONSTER</b></span>
        </button>
        <div class="top-actions">
          <div class="wallet"><span class="coin-mini"></span> {{ coins() }}</div>
          <button class="icon-button" type="button" (click)="go('profile')" aria-label="Profile">👤</button>
          <button class="icon-button" type="button" (click)="go('settings')" aria-label="Settings">⚙</button>
        </div>
      </header>
      <router-outlet></router-outlet>
      @if (rewardAdOpen()) {
        <div class="reward-ad-backdrop" role="dialog" aria-modal="true" aria-label="Rewarded video">
          <section class="reward-ad-modal">
            <button class="reward-ad-close" type="button" (click)="closeRewardedAd()" aria-label="Close video">×</button>
            <div class="reward-ad-heading"><span class="reward-play-icon">▶</span><div><b>REWARDED VIDEO</b><small>Watch the full video to earn {{ rewardedAdCoins }} coins</small></div></div>
            <video class="reward-video" [src]="rewardedVideoUrl" playsinline preload="metadata" controls (ended)="completeRewardedAd()" (error)="rewardVideoError()"></video>
            @if (rewardAdError()) { <div class="reward-ad-error">Video is not available yet. Add your future rewarded video to <b>src/assets/ads/rewarded-video.mp4</b>.</div> }
            @if (!rewardAdCompleted()) { <p class="reward-ad-note">The reward is credited only after the video reaches the end.</p> }
            @if (rewardAdCompleted()) { <div class="reward-success">🪙 +{{ rewardedAdCoins }} COINS ADDED!</div> }
          </section>
        </div>
      }
    </main>
  `,
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None
})
export class AppComponent implements OnDestroy {
  readonly appVersion = APP_VERSION;
  readonly screen = signal<Screen>('home');
  readonly score = signal(0);
  readonly coins = signal(readStoredNumber(STORAGE.coins, 250));
  readonly high = signal(readStoredNumber(STORAGE.high, 0));
  readonly level = signal(Math.max(1, Math.min(30, Math.floor(readStoredNumber(STORAGE.level, 1)))));
  readonly time = signal(45);
  readonly paused = signal(false);
  readonly lives = signal(3);
  readonly shield = signal(false);
  readonly magnet = signal(false);
  readonly speed = signal(118);
  readonly collectedThisRun = signal(0);
  readonly message = signal('');
  readonly finishReason = signal<'timeout' | 'lives' | null>(null);
  readonly soundEnabled = signal(readStoredBool(STORAGE.sound, true));
  readonly musicEnabled = signal(readStoredBool(STORAGE.music, true));
  readonly musicVolume = signal(readStoredNumber(STORAGE.musicVolume, 100));
  readonly sfxVolume = signal(readStoredNumber(STORAGE.sfxVolume, 92));
  readonly vibrationEnabled = signal(readStoredBool(STORAGE.vibration, true));
  readonly withdrawMobileNumber = signal(readStoredString(STORAGE.withdrawMobile, ''));
  readonly shieldCount = signal(Math.floor(readStoredNumber(STORAGE.shields, 0)));
  readonly magnetCount = signal(Math.floor(readStoredNumber(STORAGE.magnets, 0)));
  readonly speedBoostCount = signal(Math.floor(readStoredNumber(STORAGE.speedBoosts, 0)));
  readonly musicPlaying = signal(false);
  readonly rewardedAdCoins = 100;
  readonly rewardAdOpen = signal(false);
  readonly rewardAdCompleted = signal(false);
  readonly rewardAdError = signal(false);
  readonly rewardedAdNextAvailable = signal(readStoredNumber(STORAGE.rewardedAdNext, 0));
  readonly rewardedAdClock = signal(Date.now());
  readonly rewardedVideoUrl = 'assets/ads/rewarded-video.mp4';

  player: Point = { x: 0.5, y: 0.78 };
  monster: Point = { x: 0.5, y: 0.12 };
  coinsOnMap: Point[] = [];
  keys = new Set<string>();
  readonly decorations = Array.from({ length: 16 }, (_, i) => ({
    x: 6 + ((i * 37) % 88),
    y: 7 + ((i * 53) % 82),
    type: i % 4
  }));

  private animation = 0;
  private gameSessionId = 0;
  private finishing = false;
  private last = 0;
  private timer = 0;
  private runSeconds = 0;
  private touchTimers = new Map<string, number>();
  private audioContext?: AudioContext;
  private musicTimer?: number;
  private musicStep = 0;
  readonly joystickActive = signal(false);
  private joystickDX = 0;
  private joystickDY = 0;
  private joystickPointerId: number | null = null;
  private joystickElement: HTMLElement | null = null;
  private joystickRaf = 0;
  private routeSubscription?: Subscription;
  private rewardedAdClockTimer?: number;
  private coinSaveTimer?: number;
  private playerElement: HTMLElement | null = null;
  private monsterElement: HTMLElement | null = null;
  private boundaryCooldownUntil = 0;
  private damageCooldownUntil = 0;

  constructor(private readonly router: Router) {
    this.resetMap();
    this.rewardedAdClockTimer = window.setInterval(() => this.rewardedAdClock.set(Date.now()), 1000);
    this.routeSubscription = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(event => {
        const path = event.urlAfterRedirects.split('?')[0].replace(/\/$/, '');
        const routeScreen: Record<string, Screen> = {
          '/home': 'home', '/play': 'game', '/shop': 'shop', '/settings': 'settings', '/result': 'result', '/profile': 'profile'
        };
        const next = routeScreen[path] ?? 'home';
        if (next !== 'game' && this.screen() === 'game') this.stopGameLoop();
        this.screen.set(next);
      });
  }

  ngOnDestroy(): void {
    this.persistAll();
    this.routeSubscription?.unsubscribe();
    this.stopGameLoop();
    this.stopMusic();
    this.paused.set(false);
    this.touchTimers.forEach(timer => window.clearTimeout(timer));
    if (this.coinSaveTimer) window.clearTimeout(this.coinSaveTimer);
    if (this.rewardedAdClockTimer) window.clearInterval(this.rewardedAdClockTimer);
    this.audioContext?.close();
  }

  start(): void {
    // Invalidate every previous RAF/interval before creating a fresh game session.
    // This makes PLAY AGAIN safe even when the previous result route is still
    // finishing its navigation transition.
    this.stopGameLoop();
    const sessionId = this.gameSessionId;
    this.finishing = false;
    this.paused.set(false);
    this.screen.set('game');
    void this.router.navigateByUrl('/play');
    this.score.set(0);
    this.finishReason.set(null);
    this.time.set(45);
    this.lives.set(3);
    const hasShield = this.shieldCount() > 0;
    const hasMagnet = this.magnetCount() > 0;
    const hasSpeedBoost = this.speedBoostCount() > 0;
    this.shield.set(hasShield);
    this.magnet.set(hasMagnet);
    this.speed.set(this.levelSpeed() + (hasSpeedBoost ? 18 : 0));
    if (hasShield) this.shieldCount.update(v => Math.max(0, v - 1));
    if (hasMagnet) this.magnetCount.update(v => Math.max(0, v - 1));
    if (hasSpeedBoost) this.speedBoostCount.update(v => Math.max(0, v - 1));
    this.savePowerInventory();
    this.collectedThisRun.set(0);
    this.player = { x: 0.5, y: 0.78 };
    this.monster = { x: 0.5, y: 0.12 };
    this.playerElement = null;
    this.monsterElement = null;
    this.boundaryCooldownUntil = 0;
    this.damageCooldownUntil = 0;
    this.resetMap();
    this.runSeconds = 0;
    this.last = performance.now();
    this.ensureAudio();
    this.playSfx('start');
    if (this.musicEnabled()) this.startMusic();
    this.timer = window.setInterval(() => {
      if (sessionId !== this.gameSessionId || this.screen() !== 'game' || this.finishing) return;
      this.time.update(value => Math.max(0, value - 1));
      this.runSeconds += 1;
      if (this.time() === 0) this.finish('timeout');
    }, 1000);
    this.animation = requestAnimationFrame(now => this.loop(now, sessionId));
  }

  pauseToHome(): void {
    // The HUD button is a true pause/resume control. Keep the current game
    // state in place instead of navigating away, so the same button can resume
    // the exact run without resetting the map, timer, coins or monster position.
    if (this.paused()) {
      this.resumeGame();
      return;
    }

    this.joystickEnd({ pointerId: this.joystickPointerId ?? -1, preventDefault() {} } as PointerEvent);
    this.paused.set(true);
    this.stopGameLoop();
    this.stopMusic();
    this.playSfx('click');
  }

  private resumeGame(): void {
    if (!this.paused() || this.screen() !== 'game' || this.finishing) return;

    this.stopGameLoop();
    this.paused.set(false);
    this.last = performance.now();
    this.ensureAudio();
    if (this.musicEnabled()) this.startMusic();

    const sessionId = this.gameSessionId;
    this.timer = window.setInterval(() => {
      if (sessionId !== this.gameSessionId || this.screen() !== 'game' || this.finishing || this.paused()) return;
      this.time.update(value => Math.max(0, value - 1));
      this.runSeconds += 1;
      if (this.time() === 0) this.finish('timeout');
    }, 1000);
    this.animation = requestAnimationFrame(now => this.loop(now, sessionId));
    this.playSfx('click');
  }

  private resetMap(): void {
    this.coinsOnMap = Array.from({ length: 20 }, () => this.randomPoint());
  }

  private randomPoint(): Point {
    return { x: 0.08 + Math.random() * 0.84, y: 0.1 + Math.random() * 0.82 };
  }

  private loop = (now: number, sessionId: number): void => {
    // Ignore callbacks from a previous run. This prevents stale animation frames
    // from mutating a newly started game after PLAY AGAIN.
    if (sessionId !== this.gameSessionId || this.screen() !== 'game' || this.finishing) return;
    const dt = Math.min((now - this.last) / 1000, 0.035);
    this.last = now;

    let dx = this.joystickDX;
    let dy = this.joystickDY;
    if (this.keys.has('arrowleft') || this.keys.has('a')) dx -= 1;
    if (this.keys.has('arrowright') || this.keys.has('d')) dx += 1;
    if (this.keys.has('arrowup') || this.keys.has('w')) dy -= 1;
    if (this.keys.has('arrowdown') || this.keys.has('s')) dy += 1;

    const inputLength = Math.hypot(dx, dy);
    if (inputLength > 1) { dx /= inputLength; dy /= inputLength; }
    const playerSpeed = this.speed() * (this.shield() ? 1.04 : 1);
    const nextX = this.player.x + dx * playerSpeed * dt / 600;
    const nextY = this.player.y + dy * playerSpeed * dt / 600;
    const minX = 0.055, maxX = 0.945, minY = 0.075, maxY = 0.925;
    const touchingBoundary = nextX < minX || nextX > maxX || nextY < minY || nextY > maxY;
    if (touchingBoundary) {
      this.player.x = this.clamp(nextX, minX, maxX);
      this.player.y = this.clamp(nextY, minY, maxY);
      this.handleBoundaryCollision(now);
    } else {
      this.player.x = nextX;
      this.player.y = nextY;
    }

    const chase = this.monsterSpeed();
    const mx = this.player.x - this.monster.x;
    const my = this.player.y - this.monster.y;
    const monsterLength = Math.hypot(mx, my) || 1;
    this.monster.x += (mx / monsterLength) * chase * dt / 600;
    this.monster.y += (my / monsterLength) * chase * dt / 600;

    this.renderWorldPositions();
    this.collectCoins();
    this.handleMonsterCollision(now);
    while (this.coinsOnMap.length < 9) this.coinsOnMap.push(this.randomPoint());
    this.animation = requestAnimationFrame(nextNow => this.loop(nextNow, sessionId));
  };

  private collectCoins(): void {
    let collected = 0;
    const range = this.magnet() ? 0.15 : 0.055;
    const rangeSquared = range * range;
    for (let index = this.coinsOnMap.length - 1; index >= 0; index--) {
      const coin = this.coinsOnMap[index];
      const dx = coin.x - this.player.x;
      const dy = coin.y - this.player.y;
      if (dx * dx + dy * dy <= rangeSquared) {
        this.coinsOnMap.splice(index, 1);
        collected += 1;
      }
    }
    if (!collected) return;

    // Batch signal/localStorage writes once per frame instead of once per coin.
    // This prevents synchronous storage calls and repeated change detection from
    // causing frame drops when several magnetized coins are collected together.
    this.score.update(value => value + collected * 25);
    this.coins.update(value => value + collected);
    this.collectedThisRun.update(value => value + collected);
    this.scheduleCoinSave();
    this.playSfx('coin');
    this.vibrate(collected > 1 ? [8, 20, 8] : 12);
  }

  private handleMonsterCollision(now: number): void {
    if (this.finishing || now < this.damageCooldownUntil) return;
    const collisionX = this.player.x - this.monster.x;
    const collisionY = this.player.y - this.monster.y;
    if (collisionX * collisionX + collisionY * collisionY >= 0.065 * 0.065) return;
    this.damageCooldownUntil = now + 850;
    if (this.shield()) {
      this.shield.set(false);
      this.monster = { x: 0.15 + Math.random() * 0.7, y: 0.08 };
      this.message.set('SHIELD SAVED YOU!');
      this.playSfx('shield');
      this.vibrate([20, 30, 20]);
      window.setTimeout(() => this.message.set(''), 900);
      return;
    }
    this.lives.update(value => value - 1);
    this.player = { x: 0.5, y: 0.78 };
    this.monster = { x: Math.random(), y: 0.08 };
    this.playSfx('hit');
    this.vibrate(70);
    if (this.lives() <= 0) this.finish('lives');
  }

  private handleBoundaryCollision(now: number): void {
    if (this.finishing || now < this.boundaryCooldownUntil || now < this.damageCooldownUntil) return;
    this.boundaryCooldownUntil = now + 850;
    this.damageCooldownUntil = now + 850;
    if (this.shield()) {
      this.shield.set(false);
      this.message.set('SHIELD BLOCKED THE WALL!');
      this.playSfx('shield');
      this.vibrate([20, 30, 20]);
      window.setTimeout(() => this.message.set(''), 900);
      return;
    }
    this.lives.update(value => Math.max(0, value - 1));
    this.player = { x: 0.5, y: 0.78 };
    this.monster = { x: 0.15 + Math.random() * 0.7, y: 0.08 };
    this.message.set('WALL HIT • LIFE LOST!');
    this.playSfx('hit');
    this.vibrate(70);
    window.setTimeout(() => this.message.set(''), 900);
    if (this.lives() <= 0) this.finish('lives');
  }

  private renderWorldPositions(): void {
    if (!this.playerElement || !this.monsterElement) {
      this.playerElement = document.querySelector('.game .player');
      this.monsterElement = document.querySelector('.game .enemy');
    }
    if (this.playerElement) this.playerElement.style.left = `${this.player.x * 100}%`;
    if (this.monsterElement) this.monsterElement.style.left = `${this.monster.x * 100}%`;
    if (this.playerElement) this.playerElement.style.top = `${this.player.y * 100}%`;
    if (this.monsterElement) this.monsterElement.style.top = `${this.monster.y * 100}%`;
  }

  levelTheme(): string {
    return `level-${Math.min(30, this.level())}`;
  }

  levelMonster(): string {
    return `monster-${((this.level() - 1) % 5) + 1}`;
  }

  levelSpeed(): number {
    return Math.min(128, 112 + (this.level() - 1) * 0.55);
  }

  monsterSpeed(): number {
    // Stronger 30-level progression: Level 1 starts noticeably faster than the
    // old 64 speed, while later levels become genuinely challenging. A small
    // in-run ramp makes the monster accelerate during long escapes without
    // allowing it to become impossible to outrun.
    const level = Math.max(1, Math.min(30, this.level()));
    const base = 86 + (level - 1) * 5.2;
    const ramp = Math.min(22, this.runSeconds * 0.8);
    return Math.min(250, base + ramp);
  }

  levelGoal(): string {
    const goals = ['Collect 12 coins', 'Survive 40 seconds', 'Collect 18 coins', 'Survive 50 seconds', 'Escape the danger zone'];
    return goals[(this.level() - 1) % goals.length];
  }

  finish(reason: 'timeout' | 'lives' = 'timeout'): void {
    // Guard against the timer, animation loop and collision handler finishing
    // the same run more than once. This was the main cause of the stuck result.
    if (this.finishing || this.screen() !== 'game') return;
    this.finishing = true;
    this.finishReason.set(reason);

    // Stop every game source before changing routes so no late animation frame
    // or interval can mutate the next screen.
    this.stopGameLoop();
    this.joystickEnd({ pointerId: this.joystickPointerId ?? -1, preventDefault() {} } as PointerEvent);

    const finalScore = this.score();
    const finalCoins = this.coins();
    const finalRunCoins = this.collectedThisRun();
    const newHigh = Math.max(this.high(), finalScore);
    this.high.set(newHigh);

    // A successful timed escape advances the level. Losing all lives does not
    // silently advance the player to the next level.
    if (reason === 'timeout') {
      this.level.update(value => Math.min(30, value + 1));
    }

    // Persist the wallet/progress BEFORE navigating. The wallet is updated at
    // every collection too, so an app close cannot normally lose a coin.
    this.coins.set(Math.max(0, Math.floor(finalCoins)));
    this.collectedThisRun.set(Math.max(0, Math.floor(finalRunCoins)));
    this.score.set(Math.max(0, Math.floor(finalScore)));
    this.saveCoins();
    this.saveProgress();
    this.playSfx(reason === 'timeout' ? 'finish' : 'hit');

    // Change both the app state and the URL. Previously only screen() changed,
    // leaving PlayPageComponent mounted at /play, which looked like a frozen game.
    this.screen.set('result');
    void this.router.navigateByUrl('/result');
  }

  buy(power: Power): void {
    const cost = power === 'shield' ? 100 : power === 'magnet' ? 120 : 150;
    if (this.coins() < cost) {
      this.message.set('NOT ENOUGH COINS');
      this.playSfx('error');
      window.setTimeout(() => this.message.set(''), 900);
      return;
    }
    this.coins.update(value => value - cost);
    if (power === 'shield') this.shieldCount.update(value => value + 1);
    if (power === 'magnet') this.magnetCount.update(value => value + 1);
    if (power === 'speed') this.speedBoostCount.update(value => value + 1);
    this.saveCoins();
    this.savePowerInventory();
    this.playSfx('power');
    this.message.set('POWER READY!');
    window.setTimeout(() => this.message.set(''), 900);
  }

  joystickStart(event: PointerEvent): void {
    if (this.screen() !== 'game') return;
    event.preventDefault();
    const target = event.currentTarget as HTMLElement | null;
    if (!target) return;
    this.ensureAudio();
    this.joystickPointerId = event.pointerId;
    this.joystickElement = target;
    this.joystickActive.set(true);
    target.setPointerCapture?.(event.pointerId);
    this.updateJoystick(event, target);
  }

  joystickMove(event: PointerEvent): void {
    if (this.joystickPointerId !== event.pointerId || !this.joystickElement) return;
    event.preventDefault();
    this.updateJoystick(event, this.joystickElement);
  }

  joystickEnd(event: PointerEvent): void {
    if (this.joystickPointerId !== null && this.joystickPointerId !== event.pointerId) return;
    event.preventDefault();
    if (this.joystickElement && this.joystickPointerId !== null) {
      try { this.joystickElement.releasePointerCapture?.(this.joystickPointerId); } catch {}
    }
    this.joystickPointerId = null;
    this.joystickDX = 0; this.joystickDY = 0;
    this.joystickActive.set(false);
    this.applyJoystickVisual(0, 0);
    this.joystickElement = null;
  }

  private updateJoystick(event: PointerEvent, target: HTMLElement): void {
    const ring = target.querySelector('.joystick-ring') as HTMLElement | null;
    if (!ring) return;
    const rect = ring.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const maxRadius = Math.max(22, Math.min(rect.width, rect.height) * 0.31);
    let dx = event.clientX - centerX;
    let dy = event.clientY - centerY;
    const distance = Math.hypot(dx, dy);
    if (distance > maxRadius) { const scale = maxRadius / distance; dx *= scale; dy *= scale; }
    if (Math.hypot(dx, dy) < 4) { dx = 0; dy = 0; }
    this.joystickDX = dx / maxRadius;
    this.joystickDY = dy / maxRadius;
    this.applyJoystickVisual(dx, dy);
  }

  private applyJoystickVisual(x: number, y: number): void {
    if (!this.joystickElement) return;
    if (this.joystickRaf) cancelAnimationFrame(this.joystickRaf);
    const element = this.joystickElement;
    this.joystickRaf = requestAnimationFrame(() => {
      const knob = element.querySelector('.joystick-knob') as HTMLElement | null;
      if (knob) knob.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    });
  }

  holdStart(direction: string): void {
    this.ensureAudio();
    this.keys.add(direction);
  }

  holdEnd(direction: string): void {
    this.keys.delete(direction);
  }

  go(screen: Screen): void {
    if (screen !== 'game') this.stopGameLoop();
    this.playSfx('click');
    this.screen.set(screen);
    const route: Record<Screen, string> = {
      home: '/home',
      game: '/play',
      shop: '/shop',
      result: '/result',
      settings: '/settings',
      profile: '/profile'
    };
    void this.router.navigateByUrl(route[screen]);
    if (screen === 'settings' && this.musicEnabled()) this.startMusic();
  }

  toggleSound(): void {
    const next = !this.soundEnabled();
    this.soundEnabled.set(next);
    localStorage.setItem(STORAGE.sound, String(next));
    if (next) this.playSfx('click');
  }

  toggleMusic(): void {
    const next = !this.musicEnabled();
    this.musicEnabled.set(next);
    localStorage.setItem(STORAGE.music, String(next));
    if (next) {
      this.ensureAudio();
      this.startMusic();
      this.musicPlaying.set(true);
    } else {
      this.stopMusic();
    }
  }

  toggleMusicPlayback(): void {
    if (this.musicPlaying()) this.stopMusic();
    else if (this.musicEnabled()) this.startMusic();
  }

  setMusicVolume(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.musicVolume.set(value);
    localStorage.setItem(STORAGE.musicVolume, String(value));
  }

  setSfxVolume(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.sfxVolume.set(value);
    localStorage.setItem(STORAGE.sfxVolume, String(value));
  }

  toggleVibration(): void {
    const next = !this.vibrationEnabled();
    this.vibrationEnabled.set(next);
    localStorage.setItem(STORAGE.vibration, String(next));
    if (next) this.vibrate(35);
  }

  setWithdrawMobileNumber(event: Event): void {
    const input = event.target as HTMLInputElement;
    const next = input.value.replace(/\D/g, '').slice(0, 10);
    this.withdrawMobileNumber.set(next);
    try { localStorage.setItem(STORAGE.withdrawMobile, next); } catch {}
  }

  /**
   * The only place allowed to mutate the coin balance after a withdrawal.
   * Called by ProfilePageComponent only after the Central Redemption API has
   * confirmed the redemption — never before, and never on a failed/uncertain
   * response. The backend only tracks the Earnivo rupee wallet, not this
   * game's local coin count, so the confirmed redeemed amount is subtracted
   * from the local balance here.
   */
  redeemCoinsSuccessfully(coinsRedeemed: number): void {
    this.coins.set(Math.max(0, this.coins() - Math.max(0, Math.floor(coinsRedeemed))));
    this.saveCoins();
  }

  resetProgress(): void {
    if (!window.confirm('Reset your game level to Level 1? Your coins and best score will stay safe.')) return;
    this.level.set(1);
    this.saveProgress();
    this.message.set('LEVEL RESET • COINS KEPT');
    this.playSfx('click');
    window.setTimeout(() => this.message.set(''), 1200);
  }

  rewardedAdAvailable(): boolean {
    return this.rewardedAdClock() >= this.rewardedAdNextAvailable();
  }

  rewardedAdRemainingSeconds(): number {
    return Math.max(0, Math.ceil((this.rewardedAdNextAvailable() - this.rewardedAdClock()) / 1000));
  }

  rewardedAdCountdown(): string {
    const total = this.rewardedAdRemainingSeconds();
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  watchRewardedAd(): void {
    if (!this.rewardedAdAvailable()) {
      this.message.set(`NEXT REWARD IN ${this.rewardedAdCountdown()}`);
      window.setTimeout(() => this.message.set(''), 1400);
      return;
    }
    this.rewardAdOpen.set(true);
    this.rewardAdCompleted.set(false);
    this.rewardAdError.set(false);
    this.ensureAudio();
    this.playSfx('click');
    window.setTimeout(() => {
      const player = document.querySelector('.reward-video') as HTMLVideoElement | null;
      if (!player) return;
      player.currentTime = 0;
      player.play().catch(() => this.rewardAdError.set(true));
    });
  }

  completeRewardedAd(): void {
    if (!this.rewardAdOpen() || this.rewardAdCompleted() || !this.rewardedAdAvailable()) return;
    this.rewardAdCompleted.set(true);
    this.coins.update(value => value + this.rewardedAdCoins);
    this.rewardedAdNextAvailable.set(Date.now() + 2 * 60 * 60 * 1000);
    this.saveCoins();
    this.saveRewardedAdState();
    this.playSfx('coin');
    this.vibrate([20, 40, 20, 40, 80]);
    this.message.set(`+${this.rewardedAdCoins} COINS • NEXT VIDEO IN 2 HOURS`);
    window.setTimeout(() => this.message.set(''), 1800);
  }

  rewardVideoError(): void {
    this.rewardAdError.set(true);
  }

  closeRewardedAd(): void {
    const player = document.querySelector('.reward-video') as HTMLVideoElement | null;
    player?.pause();
    this.rewardAdOpen.set(false);
    this.rewardAdError.set(false);
    this.playSfx('click');
  }

  private saveRewardedAdState(): void {
    try { localStorage.setItem(STORAGE.rewardedAdNext, String(this.rewardedAdNextAvailable())); } catch {}
  }

  private ensureAudio(): void {
    if (!this.audioContext) this.audioContext = new AudioContext();
    if (this.audioContext.state === 'suspended') void this.audioContext.resume();
  }

  private startMusic(): void {
    this.ensureAudio();
    if (this.musicPlaying()) return;
    this.musicPlaying.set(true);
    this.musicStep = 0;
    this.scheduleMusicBar();
  }

  private scheduleMusicBar(): void {
    if (!this.musicPlaying() || !this.audioContext) return;
    const ctx = this.audioContext;
    const master = ctx.createGain();
    const normalizedVolume = Math.max(0, Math.min(this.musicVolume() / 100, 1));
    master.gain.value = Math.min(Math.pow(normalizedVolume, 0.6) * 1.08, 1);
    master.connect(ctx.destination);
    const now = ctx.currentTime;
    const chords = [
      [196, 247, 294], [174, 220, 261], [165, 208, 247], [185, 233, 277]
    ];
    const chord = chords[this.musicStep % chords.length];
    chord.forEach((freq, i) => this.playTone(freq, now + i * 0.025, 1.65, 0.068, 'sine', master));
    const melody = [392, 440, 494, 440, 392, 330, 370, 392];
    melody.forEach((freq, i) => this.playTone(freq, now + i * 0.2, 0.16, 0.082, 'triangle', master));
    this.musicStep += 1;
    this.musicTimer = window.setTimeout(() => {
      master.disconnect();
      this.scheduleMusicBar();
    }, 1900);
  }

  private stopMusic(): void {
    if (this.musicTimer) window.clearTimeout(this.musicTimer);
    this.musicTimer = undefined;
    this.musicPlaying.set(false);
  }

  private playSfx(kind: 'click' | 'coin' | 'hit' | 'shield' | 'power' | 'error' | 'finish' | 'start'): void {
    if (!this.soundEnabled()) return;
    this.ensureAudio();
    const ctx = this.audioContext;
    if (!ctx) return;
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.value = Math.min(this.sfxVolume() / 100, 1);
    gain.connect(ctx.destination);
    const configs: Record<string, [number, number, OscillatorType, number]> = {
      click: [420, 0.06, 'square', 0.08], coin: [880, 0.13, 'sine', 0.12], hit: [90, 0.24, 'sawtooth', 0.18],
      shield: [220, 0.28, 'triangle', 0.16], power: [520, 0.25, 'triangle', 0.15], error: [130, 0.18, 'square', 0.1],
      finish: [660, 0.55, 'triangle', 0.16], start: [330, 0.3, 'sine', 0.12]
    };
    const [freq, duration, type, level] = configs[kind];
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (kind === 'coin') osc.frequency.exponentialRampToValueAtTime(freq * 1.55, now + duration);
    if (kind === 'hit') osc.frequency.exponentialRampToValueAtTime(45, now + duration);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(level, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + duration + 0.02);
    window.setTimeout(() => gain.disconnect(), (duration + 0.1) * 1000);
  }

  private playTone(freq: number, start: number, duration: number, level: number, type: OscillatorType, destination: GainNode): void {
    if (!this.audioContext) return;
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.exponentialRampToValueAtTime(level, start + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.connect(gain).connect(destination);
    osc.start(start);
    osc.stop(start + duration + 0.03);
  }

  private vibrate(pattern: number | number[]): void {
    if (!this.vibrationEnabled()) return;
    navigator.vibrate?.(pattern);
  }

  private stopGameLoop(): void {
    // Increment the session token first so a queued RAF can never continue a
    // previous run after the user presses HOME, finishes, or taps PLAY AGAIN.
    this.gameSessionId += 1;
    cancelAnimationFrame(this.animation);
    window.clearInterval(this.timer);
    this.keys.clear();
    this.joystickPointerId = null;
    this.joystickDX = 0; this.joystickDY = 0;
    this.joystickActive.set(false);
    if (this.joystickRaf) cancelAnimationFrame(this.joystickRaf);
    this.joystickRaf = 0;
    this.joystickElement = null;
    this.animation = 0;
    this.timer = 0;
  }

  private persistAll(): void {
    this.saveCoins();
    this.saveProgress();
    localStorage.setItem(STORAGE.sound, String(this.soundEnabled()));
    localStorage.setItem(STORAGE.music, String(this.musicEnabled()));
    localStorage.setItem(STORAGE.musicVolume, String(this.musicVolume()));
    localStorage.setItem(STORAGE.sfxVolume, String(this.sfxVolume()));
    localStorage.setItem(STORAGE.vibration, String(this.vibrationEnabled()));
    this.savePowerInventory();
  }

  private savePowerInventory(): void {
    try {
      localStorage.setItem(STORAGE.shields, String(this.shieldCount()));
      localStorage.setItem(STORAGE.magnets, String(this.magnetCount()));
      localStorage.setItem(STORAGE.speedBoosts, String(this.speedBoostCount()));
    } catch {}
  }

  private scheduleCoinSave(): void {
    if (this.coinSaveTimer) window.clearTimeout(this.coinSaveTimer);
    this.coinSaveTimer = window.setTimeout(() => {
      this.coinSaveTimer = undefined;
      this.saveCoins();
    }, 180);
  }

  private saveCoins(): void {
    try {
      localStorage.setItem(STORAGE.coins, String(Math.max(0, Math.floor(this.coins()))));
    } catch {}
  }

  private saveProgress(): void {
    localStorage.setItem(STORAGE.high, String(this.high()));
    localStorage.setItem(STORAGE.level, String(this.level()));
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  @HostListener('window:pagehide')
  persistOnPageHide(): void {
    this.persistAll();
  }

  @HostListener('window:beforeunload')
  persistBeforeUnload(): void {
    this.persistAll();
  }

  @HostListener('window:keydown', ['$event'])
  keydown(event: KeyboardEvent): void {
    const key = event.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', ' '].includes(key)) event.preventDefault();
    if (key === ' ') {
      if (this.screen() === 'home') this.start();
      return;
    }
    this.keys.add(key);
  }

  @HostListener('window:keyup', ['$event'])
  keyup(event: KeyboardEvent): void {
    this.keys.delete(event.key.toLowerCase());
  }
}
