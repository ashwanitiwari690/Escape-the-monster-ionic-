import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AppComponent } from '../app.component';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  template: `<section class="settings page">
  <div class="section-heading"><span>GAME CONTROL</span><h2>⚙ SETTINGS</h2><p>Audio, controls and app information.</p></div>
  <article class="settings-card"><div class="setting-title"><span class="setting-icon">🔊</span><div><b>Sound Effects</b><small>Coins, hits, buttons and power-ups</small></div><button class="toggle" [class.on]="app.soundEnabled()" (click)="app.toggleSound()" aria-label="Toggle sound"><i></i></button></div><label class="volume-row">SFX VOLUME <input type="range" min="0" max="100" [value]="app.sfxVolume()" (input)="app.setSfxVolume($event)"><b>{{ app.sfxVolume() }}%</b></label></article>
  <article class="settings-card"><div class="setting-title"><span class="setting-icon">🎵</span><div><b>Background Music</b><small>Looping adventure soundtrack</small></div><button class="toggle" [class.on]="app.musicEnabled()" (click)="app.toggleMusic()" aria-label="Toggle music"><i></i></button></div><label class="volume-row">MUSIC VOLUME <input type="range" min="0" max="100" [value]="app.musicVolume()" (input)="app.setMusicVolume($event)"><b>{{ app.musicVolume() }}%</b></label><button class="music-play" type="button" [disabled]="!app.musicEnabled()" (click)="app.toggleMusicPlayback()">{{ app.musicPlaying() ? '⏸ PAUSE MUSIC' : '▶ PLAY MUSIC' }}</button></article>
  <article class="settings-card"><div class="setting-title"><span class="setting-icon">📳</span><div><b>Vibration</b><small>Touch feedback on supported Android devices</small></div><button class="toggle" [class.on]="app.vibrationEnabled()" (click)="app.toggleVibration()" aria-label="Toggle vibration"><i></i></button></div></article>
  @if (app.showCreditForm) {
    <article class="settings-card credit-card">
      <div class="credit-heading">
        <span class="setting-icon">💳</span>
        <div><b>Credit Request</b><small>Available when your wallet reaches 1000 coins</small></div>
      </div>
      <div class="credit-wallet">
        <span>🪙 TOTAL COINS</span>
        <strong>{{ app.coins() }}</strong>
      </div>
      <label class="credit-label" for="credit-number">10-DIGIT NUMBER</label>
      <input
        id="credit-number"
        class="credit-input"
        inputmode="numeric"
        autocomplete="off"
        maxlength="10"
        placeholder="Enter 10-digit number"
        [value]="app.creditNumber()"
        (input)="app.setCreditNumber($event)"
        aria-describedby="credit-help"
      >
      <div id="credit-help" class="credit-help">
        <span>{{ app.creditNumber().length }}/10 digits</span>
        @if (app.creditNumber().length === 10 && app.creditNumberValid()) { <span class="credit-valid">✓ Ready</span> }
      </div>
      <button
        class="credit-button"
        type="button"
        [disabled]="app.creditSubmitting() || !app.creditNumberValid()"
        (click)="app.submitCreditRequest()"
      >
        {{ app.creditSubmitting() ? 'SUBMITTING…' : 'REQUEST TO WITHDRAW' }}
      </button>
      <small class="credit-note">The server/API response will complete the credit request. This screen is API-ready.</small>
    </article>
  }
  @if (app.creditSuccess()) {
    <article class="settings-card credit-success-card">
      <span class="credit-success-icon">✓</span>
      <div><b>CREDIT REQUEST COMPLETED</b><small>The credit form is hidden after a successful API response.</small></div>
    </article>
  }
  <article class="settings-card about"><div><b>ESCAPE THE MONSTER</b></div><strong>v{{ app.appVersion }}</strong></article>
  <button class="danger" type="button" (click)="app.resetProgress()">RESET GAME PROGRESS</button>
  @if (app.message()) { <div class="shop-message">{{ app.message() }}</div> }<button class="secondary" type="button" (click)="app.go('home')">← HOME</button>
</section>`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SettingsPageComponent {
  constructor(public readonly app: AppComponent) {}
}
