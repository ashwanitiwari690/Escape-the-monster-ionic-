import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, of, timeout } from 'rxjs';
import { Capacitor } from '@capacitor/core';
import { AdvertisingId } from '@capacitor-community/advertising-id';
import { environment } from '../../environments/environment';

/** Android/iOS sentinel returned when the user has opted out of ad tracking — never a real device match. */
const ZEROED_ADVERTISING_ID = '00000000-0000-0000-0000-000000000000';

interface ConfirmSuccess {
  success: true;
  data: { status: string; rewardAmount: string };
}

/**
 * Confirms this device to Earnivo's App Promotion task so a reward the user
 * started inside the Earnivo app gets credited (see
 * APP_PROMOTION_VERIFICATION_INTEGRATION.md). There is no UI for this: the
 * confirm call is fire-and-forget on every app launch, a 422 "no pending
 * verification" response is the normal steady state rather than an error,
 * and the call is safe to repeat since Earnivo treats it as idempotent.
 */
@Injectable({ providedIn: 'root' })
export class AppVerificationService {
  private readonly baseUrl = environment.centralApiBaseUrl;
  private readonly apiKey = environment.appVerificationApiKey;

  constructor(private readonly http: HttpClient) {}

  /** Call once on app startup. Never throws and never blocks the caller. */
  confirmInstall(): void {
    if (!this.baseUrl || !this.apiKey) return;
    if (!Capacitor.isNativePlatform()) return;

    void this.readAdvertisingIdAndConfirm();
  }

  private async readAdvertisingIdAndConfirm(): Promise<void> {
    let advertisingId: string;
    try {
      if (Capacitor.getPlatform() === 'ios') {
        await AdvertisingId.requestTracking();
      }
      advertisingId = (await AdvertisingId.getAdvertisingId()).id;
    } catch (error) {
      console.warn('[Earnivo] Unable to read this device\'s advertising ID', error);
      return;
    }

    if (!advertisingId || advertisingId === ZEROED_ADVERTISING_ID) return;

    this.http.post<ConfirmSuccess>(`${this.baseUrl}/app-verification/confirm`, {
      apiKey: this.apiKey,
      advertisingId
    }).pipe(
      timeout(15000),
      catchError((error: unknown) => {
        this.logFailure(error);
        return of(null);
      })
    ).subscribe(response => {
      if (response?.success) {
        console.info('[Earnivo] App promotion reward confirmed', response.data);
      }
    });
  }

  private logFailure(error: unknown): void {
    if (error instanceof HttpErrorResponse) {
      // Normal outcome whenever there's nothing pending to verify yet — not an error to surface.
      if (error.status === 422) return;
      if (error.status === 403) {
        console.error('[Earnivo] App verification API key was rejected — check environment.appVerificationApiKey');
        return;
      }
    }
    console.warn('[Earnivo] App verification confirm call failed', error);
  }
}
