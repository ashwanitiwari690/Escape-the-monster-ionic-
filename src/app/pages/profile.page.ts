import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { AppComponent } from '../app.component';
import { GameConfig, GameRedemptionService, RedemptionError } from '../services/game-redemption.service';

/** Used only until GET /api/games responds (or if it's unreachable) — the backend's own minimumCoins is authoritative once loaded. */
const FALLBACK_MIN_WITHDRAW_COINS = 1000;
const PENDING_KEY_STORAGE = 'etm-withdraw-pending';

const ERROR_MESSAGES: Partial<Record<RedemptionError['code'], string>> = {
  RATE_LIMITED: 'Too many withdrawal attempts. Please wait a while and try again.',
  NETWORK_ERROR: 'Could not reach the withdrawal service. Your coins are safe — please try again.',
  TIMEOUT: 'The request took too long. Your coins are safe — please try again.',
  NOT_CONFIGURED: 'Withdrawals are not connected to the payout server yet. Please try again later.',
  INTERNAL_ERROR: 'The withdrawal service is temporarily unavailable. Your coins are safe.',
  UNKNOWN: 'Something went wrong. Your coins are safe.'
};

/** Errors where the outcome is uncertain — safe to retry with the SAME idempotency key. */
const RETRYABLE_WITH_SAME_KEY = new Set(['NETWORK_ERROR', 'TIMEOUT', 'INTERNAL_ERROR', 'UNKNOWN']);

interface PendingWithdrawal { key: string; coins: number; mobile: string; }
interface SuccessInfo { coins: number; amount: string; }

@Component({
  selector: 'app-profile-page',
  standalone: true,
  template: `<section class="profile page">
  <div class="section-heading"><span>PLAYER</span><h2>👤 PROFILE</h2><p>Your wallet and coin withdrawal.</p></div>

  <article class="settings-card">
    <div class="credit-wallet">
      <span>🪙 CURRENT COINS</span>
      <strong>{{ app.coins() }}</strong>
    </div>
  </article>

  @if (canWithdraw()) {
    <article class="settings-card credit-card">
      <div class="credit-heading">
        <span class="setting-icon">💸</span>
        <div><b>Coin Withdrawal</b><small>Redeem coins for real cash</small></div>
      </div>
      <div class="credit-wallet">
        <span>AVAILABLE COINS</span>
        <strong>{{ app.coins() }}</strong>
      </div>

      @if (!withdrawOpen()) {
        <button class="credit-button" type="button" (click)="openWithdraw()">WITHDRAW COINS</button>
      } @else {
        <label class="credit-label" for="withdraw-mobile">REGISTERED MOBILE NUMBER</label>
        <input
          id="withdraw-mobile"
          class="credit-input"
          inputmode="numeric"
          autocomplete="off"
          maxlength="10"
          placeholder="Enter 10-digit number"
          [value]="app.withdrawMobileNumber()"
          (input)="app.setWithdrawMobileNumber($event)"
          aria-describedby="withdraw-help"
        >
        <div id="withdraw-help" class="credit-help">
          <span>{{ app.withdrawMobileNumber().length }}/10 digits</span>
          @if (mobileValid()) { <span class="credit-valid">✓ Ready</span> }
        </div>

        <div class="withdraw-summary">
          <div><span>Coins to redeem</span><b>{{ app.coins() }}</b></div>
        </div>

        @if (errorMessage()) { <div class="withdraw-error">{{ errorMessage() }}</div> }

        <small class="credit-note">This number must already have a registered Earnivo account — the ₹ amount is confirmed by the withdrawal server after you submit.</small>

        <div class="withdraw-actions">
          <button class="secondary" type="button" [disabled]="submitting()" (click)="closeWithdraw()">CANCEL</button>
          <button class="credit-button" type="button" [disabled]="submitting() || !mobileValid()" (click)="confirmWithdraw()">
            {{ submitting() ? 'SUBMITTING…' : 'CONFIRM WITHDRAWAL' }}
          </button>
        </div>
      }
    </article>
  }

  @if (successInfo(); as success) {
    <article class="settings-card credit-success-card">
      <span class="credit-success-icon">✓</span>
      <div>
        <b>WITHDRAWAL SUCCESSFUL</b>
        <small>{{ success.coins }} coins redeemed • ₹{{ success.amount }} credited</small>
      </div>
    </article>
  }

  @if (history().length) {
    <article class="settings-card">
      <div class="credit-heading">
        <span class="setting-icon">🧾</span>
        <div><b>Withdrawal History</b><small>Past redemptions for this game</small></div>
      </div>
      @for (item of history(); track item.date + '-' + item.coins) {
        <div class="history-row">
          <div><b>{{ item.date }}</b><small>{{ item.game }}</small></div>
          <div><b>{{ item.coins }} coins</b><small>₹{{ item.amount }}</small></div>
          <span class="history-status" [class.completed]="item.status === 'Completed'">{{ item.status }}</span>
        </div>
      }
    </article>
  }

  <button class="secondary" type="button" (click)="app.go('home')">← HOME</button>
</section>`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfilePageComponent {
  readonly withdrawOpen = signal(false);
  readonly submitting = signal(false);
  readonly errorMessage = signal('');
  readonly successInfo = signal<SuccessInfo | null>(null);
  readonly gameConfig = signal<GameConfig | null>(null);

  /**
   * Kept for a future history endpoint (see games.service.ts
   * getMyGameEarnings) — that method requires an authenticated Earnivo
   * session (`req.user`) which this unauthenticated game client does not
   * have, so it is never called here. The section above only renders when
   * this is non-empty, so today it stays hidden rather than showing fake data.
   */
  readonly history = signal<{ date: string; coins: number; amount: number; status: string; game: string }[]>([]);

  readonly minWithdrawCoins = computed(() => this.gameConfig()?.minimumCoins ?? FALLBACK_MIN_WITHDRAW_COINS);
  readonly canWithdraw = computed(() => this.app.coins() >= this.minWithdrawCoins());
  readonly mobileValid = computed(() => /^\d{10}$/.test(this.app.withdrawMobileNumber()));

  constructor(public readonly app: AppComponent, private readonly redemption: GameRedemptionService) {
    this.redemption.getGameConfiguration().subscribe(config => this.gameConfig.set(config));
  }

  openWithdraw(): void {
    this.errorMessage.set('');
    this.withdrawOpen.set(true);
  }

  closeWithdraw(): void {
    if (this.submitting()) return;
    this.withdrawOpen.set(false);
    this.errorMessage.set('');
  }

  confirmWithdraw(): void {
    if (this.submitting() || !this.canWithdraw() || !this.mobileValid()) return;

    const coinsToRedeem = this.app.coins();
    const mobile = this.app.withdrawMobileNumber();
    const idempotencyKey = this.getOrCreateIdempotencyKey(coinsToRedeem, mobile);

    this.submitting.set(true);
    this.errorMessage.set('');

    this.redemption.redeemCoins(mobile, coinsToRedeem, idempotencyKey).subscribe({
      next: result => {
        this.submitting.set(false);
        this.clearPendingWithdrawal();
        this.app.redeemCoinsSuccessfully(result.coinsRedeemed);
        this.successInfo.set({ coins: result.coinsRedeemed, amount: result.amountCredited });
        this.withdrawOpen.set(false);
      },
      error: (error: RedemptionError) => {
        this.submitting.set(false);
        this.errorMessage.set(ERROR_MESSAGES[error.code] ?? error.message ?? 'Withdrawal failed. Please try again.');
        if (!RETRYABLE_WITH_SAME_KEY.has(error.code)) this.clearPendingWithdrawal();
      }
    });
  }

  /** Reuses the same idempotency key for a retry of the same logical request (same coins + mobile). */
  private getOrCreateIdempotencyKey(coins: number, mobile: string): string {
    try {
      const raw = localStorage.getItem(PENDING_KEY_STORAGE);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PendingWithdrawal>;
        if (parsed && parsed.coins === coins && parsed.mobile === mobile && typeof parsed.key === 'string') {
          return parsed.key;
        }
      }
    } catch {}

    const key = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `wd-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      localStorage.setItem(PENDING_KEY_STORAGE, JSON.stringify({ key, coins, mobile } satisfies PendingWithdrawal));
    } catch {}
    return key;
  }

  private clearPendingWithdrawal(): void {
    try { localStorage.removeItem(PENDING_KEY_STORAGE); } catch {}
  }
}
