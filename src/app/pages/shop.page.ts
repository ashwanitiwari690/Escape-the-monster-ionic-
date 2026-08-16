import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AppComponent } from '../app.component';

@Component({
  selector: 'app-shop-page',
  standalone: true,
  template: `<section class="shop page"><div class="section-heading"><span>POWER LAB</span><h2>🛒 POWER SHOP</h2><p>Spend saved coins before your next escape.</p></div>
  <article class="shop-card"><div class="power-icon shield">🛡️</div><div><b>Shield</b><span>Blocks one monster hit. Owned: {{ app.shieldCount() }}</span></div><button type="button" (click)="app.buy('shield')"><span class="coin-mini tiny"></span> 100</button></article>
  <article class="shop-card"><div class="power-icon magnet">🧲</div><div><b>Coin Magnet</b><span>Pulls coins from a larger radius. Owned: {{ app.magnetCount() }}</span></div><button type="button" (click)="app.buy('magnet')"><span class="coin-mini tiny"></span> 120</button></article>
  <article class="shop-card"><div class="power-icon speed">⚡</div><div><b>Speed Boost</b><span>Move faster during your next run. Owned: {{ app.speedBoostCount() }}</span></div><button type="button" (click)="app.buy('speed')"><span class="coin-mini tiny"></span> 150</button></article>
  @if (app.message()) { <div class="shop-message">{{ app.message() }}</div> }<button class="secondary" type="button" (click)="app.go('home')">← HOME</button>
</section>`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShopPageComponent {
  constructor(public readonly app: AppComponent) {}
}
