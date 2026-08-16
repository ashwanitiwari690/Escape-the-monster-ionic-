import { Routes } from '@angular/router';
import { HomePageComponent } from './pages/home.page';
import { PlayPageComponent } from './pages/play.page';
import { ShopPageComponent } from './pages/shop.page';
import { SettingsPageComponent } from './pages/settings.page';
import { ResultPageComponent } from './pages/result.page';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'home' },
  { path: 'home', component: HomePageComponent },
  { path: 'play', component: PlayPageComponent },
  { path: 'shop', component: ShopPageComponent },
  { path: 'settings', component: SettingsPageComponent },
  { path: 'result', component: ResultPageComponent },
  { path: '**', redirectTo: 'home' }
];
