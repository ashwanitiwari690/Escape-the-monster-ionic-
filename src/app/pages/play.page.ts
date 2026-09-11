import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AppComponent } from '../app.component';

@Component({
  selector: 'app-play-page',
  standalone: true,
  template: `<section class="game page" [class]="'game page ' + app.levelTheme()">
  <div class="hud">
    <button class="hud-button" type="button" (click)="app.pauseToHome()" [attr.aria-label]="app.paused() ? 'Resume game' : 'Pause game'">{{ app.paused() ? '▶' : 'Ⅱ' }}</button>
    <div class="level-chip"><small>LEVEL</small><strong>{{ app.level() }}</strong></div><div class="timer"><small>TIME</small><strong>00:{{ app.time().toString().padStart(2, '0') }}</strong></div>
    <div class="run-coins"><span class="coin-mini"></span><strong>{{ app.collectedThisRun() }}</strong></div>
    <div class="hearts">{{ '❤'.repeat(app.lives()) }}</div>
  </div>
  <div class="level-banner"><span>LEVEL {{ app.level() }}</span><b>{{ app.levelGoal() }}</b><em>MONSTER SPEED {{ app.monsterSpeed().toFixed(0) }}</em></div><div class="world" aria-label="Game area">
    <div class="sky-glow"></div><div class="ground-grid"></div>
    <div class="road road-one"></div><div class="road road-two"></div>
    @for (d of app.decorations; track $index) { <span class="decor decor-{{ d.type }}" [style.left.%]="d.x" [style.top.%]="d.y"></span> }
    @for (coin of app.coinsOnMap; track $index) { <span class="coin" [style.left.%]="coin.x * 100" [style.top.%]="coin.y * 100"><i></i></span> }
    <span class="crate crate-one"></span><span class="rock rock-one"></span><span class="crate crate-two"></span><span class="rock rock-two"></span>
    <div class="player" [style.left.%]="app.player.x * 100" [style.top.%]="app.player.y * 100"><i class="p-head"></i><i class="p-body"></i><i class="p-leg p-l"></i><i class="p-leg p-r"></i></div>
    <div class="enemy" [class]="'enemy ' + app.levelMonster()" [style.left.%]="app.monster.x * 100" [style.top.%]="app.monster.y * 100"><i class="e-eye e-left"></i><i class="e-eye e-right"></i><i class="e-mouth"></i></div>
    @if (app.shield()) { <div class="shield-ring" [style.left.%]="app.player.x * 100" [style.top.%]="app.player.y * 100"></div> }
    @if (app.message()) { <div class="toast">{{ app.message() }}</div> }
    @if (app.paused() && !app.continueOfferOpen()) {
      <div class="pause-overlay" role="status" aria-live="polite">
        <div class="pause-card">
          <strong>GAME PAUSED</strong>
          <span>Press ▶ above to continue</span>
        </div>
      </div>
    }
    @if (app.continueOfferOpen()) {
      <div class="pause-overlay continue-overlay" role="dialog" aria-modal="true" aria-label="Continue with an extra life">
        <div class="continue-card">
          <span class="continue-icon">💔</span>
          <strong>OUT OF LIVES!</strong>
          <span>Watch a short video for +1 life and keep this run going</span>
          @if (app.continueAdError()) { <div class="reward-ad-error">{{ app.continueAdError() }}</div> }
          <button class="reward-ad-button continue-watch-button" type="button" [disabled]="app.rewardAdBusy()" (click)="app.watchContinueAd()">
            <span class="reward-video-icon">▶</span>
            <span class="reward-copy"><b>{{ app.rewardAdBusy() ? 'LOADING AD…' : 'WATCH AD • +1 LIFE' }}</b><small>{{ app.rewardAdBusy() ? 'Please wait' : 'Free — one per run' }}</small></span>
          </button>
          <button class="secondary continue-decline-button" type="button" [disabled]="app.rewardAdBusy()" (click)="app.declineContinue()">NO THANKS, END RUN</button>
        </div>
      </div>
    }
  </div>
  <div class="run-info"><span>COINS THIS RUN <b><span class="coin-mini tiny"></span> {{ app.collectedThisRun() }}</b></span><span>STAY ALIVE <b>⚡ {{ app.level() }}</b></span><span>WALLET <b><span class="coin-mini tiny"></span> {{ app.coins() }}</b></span></div>
  <div class="control-dock" aria-label="Touch movement control"><div class="joystick-center-hint">TOUCH &amp; DRAG TO MOVE</div>
    <div
      class="virtual-joystick"
      role="application"
      aria-label="Virtual joystick. Drag the control to move."
      (pointerdown)="app.joystickStart($event)"
      (pointermove)="app.joystickMove($event)"
      (pointerup)="app.joystickEnd($event)"
      (pointercancel)="app.joystickEnd($event)"
    >
      <div class="joystick-ring">
        <div
          class="joystick-knob"
          style="transform:translate3d(0,0,0)"
        >
          <span></span>
        </div>
      </div>
      <span class="joystick-label">{{ app.joystickActive() ? 'MOVE' : 'DRAG TO MOVE' }}</span>
    </div>
    <div class="control-hint"><span>◉</span> TOUCH &amp; DRAG <b>•</b> WASD / ARROWS</div>
  </div>
</section>`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlayPageComponent {
  constructor(public readonly app: AppComponent) {}
}
