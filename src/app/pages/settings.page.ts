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
  <article class="settings-card about"><div><b>ESCAPE THE MONSTER</b></div><strong>v{{ app.appVersion }}</strong></article>
  <button class="danger" type="button" (click)="app.resetProgress()">RESET GAME PROGRESS</button>
  @if (app.message()) { <div class="shop-message">{{ app.message() }}</div> }<button class="secondary" type="button" (click)="app.go('home')">← HOME</button>
</section>`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SettingsPageComponent {
  constructor(public readonly app: AppComponent) {}
}
