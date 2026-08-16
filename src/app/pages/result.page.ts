import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AppComponent } from '../app.component';

@Component({
  selector: 'app-result-page',
  standalone: true,
  template: `<section class="result page"><div class="trophy">🏆</div><div class="title-badge">{{ app.finishReason() === 'lives' ? 'RUN OVER' : 'RUN FINISHED' }}</div><h1>{{ app.finishReason() === 'lives' ? 'THE MONSTER GOT YOU!' : 'ESCAPE COMPLETE!' }}</h1><div class="stars">{{ app.finishReason() === 'lives' ? '💥 ❤️ 0 LIVES' : '⭐ ⭐ ⭐' }}</div><div class="result-card"><span class="result-stat"><span class="result-label">SCORE</span><b>{{ app.score() }}</b></span><span class="result-stat"><span class="result-label">COINS EARNED</span><b><span class="result-coin coin-mini large" aria-hidden="true"></span>{{ app.collectedThisRun() }}</b></span><span class="result-stat"><span class="result-label">TOTAL COINS</span><b><span class="result-coin coin-mini large" aria-hidden="true"></span>{{ app.coins() }}</b></span></div><div class="best">🏆 BEST SCORE: {{ app.high() }}</div><button class="primary" type="button" (click)="app.start()">PLAY AGAIN 🔥</button><button class="secondary" type="button" (click)="app.go('home')">HOME</button></section>`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ResultPageComponent {
  constructor(public readonly app: AppComponent) {}
}
