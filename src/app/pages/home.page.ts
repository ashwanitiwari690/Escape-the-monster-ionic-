import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AppComponent } from '../app.component';

@Component({
  selector: 'app-home-page',
  standalone: true,
  template: `<section class="home page">
  <div class="hero">
    <div class="moon"></div><div class="mist mist-one"></div><div class="mist mist-two"></div>
    <div class="mountain mountain-one"></div><div class="mountain mountain-two"></div>
    <div class="tree-line"><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div>
    <div class="monster-hero"><i class="eye left"></i><i class="eye right"></i><i class="mouth"></i></div>
    <div class="runner-hero"><i class="head"></i><i class="body"></i><i class="leg l"></i><i class="leg r"></i></div>
    <div class="title-badge">2D SURVIVAL RUN</div>
    <h1>ESCAPE<br><span>THE MONSTER</span></h1>
    <p>Run fast. Grab coins. Survive longer.</p>
  </div>
  <button class="primary" type="button" (click)="app.start()">PLAY NOW <span>▶</span></button>
  <button class="reward-ad-button" type="button" [class.cooldown]="!app.rewardedAdAvailable()" [disabled]="!app.rewardedAdAvailable()" (click)="app.watchRewardedAd()" aria-label="Watch rewarded video for 100 coins">
    <span class="reward-video-icon">▶</span>
    <span class="reward-copy"><b>{{ app.rewardedAdAvailable() ? 'WATCH VIDEO' : 'VIDEO REWARD COOLDOWN' }}</b><small>{{ app.rewardedAdAvailable() ? 'Watch once • earn +100 coins' : 'Available again in ' + app.rewardedAdCountdown() }}</small></span>
    <span class="reward-coins"><span class="coin-mini"></span> +100</span>
  </button>
  <div class="home-actions"><button class="secondary" type="button" (click)="app.go('shop')">🛒 POWER SHOP</button><button class="secondary purple" type="button" (click)="app.go('settings')">⚙ SETTINGS</button></div>
  <div class="stats">
    <div><span>🏆</span><b>{{ app.high() }}</b><small>BEST SCORE</small></div>
    <div class="stat-card"><span class="stat-icon coin-mini large" aria-hidden="true"></span><b>{{ app.coins() }}</b><small>COINS SAVED</small></div>
    <div><span>⭐</span><b>{{ app.level() }}</b><small>LEVEL</small></div>
  </div>
  <div class="tip"><strong>HOW TO PLAY</strong><br>Drag the virtual joystick. Collect coins, use power-ups and keep the monster away.</div>
</section>`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomePageComponent {
  constructor(public readonly app: AppComponent) {}
}
