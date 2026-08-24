import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, shareReplay, throwError, TimeoutError } from 'rxjs';
import { catchError, map, timeout } from 'rxjs/operators';
import { environment } from '../../environments/environment';

interface ApiSuccess<T> { success: true; data: T; }
interface ApiFailure { success: false; error: { code: string; message: string } }

export interface GameConfig {
  gameCode: string;
  gameName: string;
  minimumCoins: number;
  coinsPerConversion: number;
  rupeesPerConversion: number;
}

export interface RedemptionRequest {
  gameCode: string;
  mobileNumber: string;
  coins: number;
  idempotencyKey: string;
}

export interface RedemptionResponse {
  gameCode: string;
  gameName: string;
  coinsSubmitted: number;
  coinsRedeemed: number;
  amountCredited: string;
  transactionId: string;
  status: string;
  newWalletBalance: string;
}

/** Error codes actually returned by nodejs/src/modules/games (see AppError.Errors), plus client-side transport codes. */
export type RedemptionErrorCode =
  | 'VALIDATION_ERROR'
  | 'INVALID_PHONE'
  | 'USER_SUSPENDED'
  | 'DUPLICATE_CONVERSION'
  | 'RATE_LIMITED'
  | 'NOT_FOUND'
  | 'INTERNAL_ERROR'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'NOT_CONFIGURED'
  | 'UNKNOWN';

export interface RedemptionError {
  code: RedemptionErrorCode;
  message: string;
}

function isApiFailure(value: unknown): value is ApiFailure {
  return typeof value === 'object' && value !== null && (value as ApiFailure).success === false;
}

/**
 * Single reusable client for the Earnivo Central Redemption API
 * (nodejs/src/modules/games). ProfilePage and any future caller go through
 * this service instead of calling HttpClient directly, so there is exactly
 * one place that knows the request/response contract, this game's identity,
 * and the idempotency rules — the same backend the other Earnivo game apps use.
 */
@Injectable({ providedIn: 'root' })
export class GameRedemptionService {
  private readonly gameCode = environment.gameCode;
  private readonly baseUrl = environment.centralApiBaseUrl;

  /** Fetched once per app session and shared — GET /api/games must not be re-hit on every change-detection cycle. */
  private games$?: Observable<GameConfig[]>;

  constructor(private readonly http: HttpClient) {}

  /** GET /api/games — every registered game's live minimumCoins/conversion rate. */
  getGames(): Observable<GameConfig[]> {
    if (!this.baseUrl) return of([]);
    if (!this.games$) {
      this.games$ = this.http.get<ApiSuccess<{ code: string; name: string; minimumCoins: number; coinsPerConversion: number; rupeesPerConversion: number }[]>>(`${this.baseUrl}/games`).pipe(
        timeout(10000),
        map(res => res.data.map(game => ({
          gameCode: game.code,
          gameName: game.name,
          minimumCoins: game.minimumCoins,
          coinsPerConversion: game.coinsPerConversion,
          rupeesPerConversion: game.rupeesPerConversion
        }))),
        catchError(() => of([])),
        shareReplay({ bufferSize: 1, refCount: false })
      );
    }
    return this.games$;
  }

  /** This game's own live configuration (minimumCoins etc.) from the cached GET /api/games response. */
  getGameConfiguration(): Observable<GameConfig | null> {
    return this.getGames().pipe(map(games => games.find(game => game.gameCode === this.gameCode) ?? null));
  }

  /** POST /api/game-rewards/redeem — the one endpoint every game app hands coins off to for ₹ conversion. */
  redeemCoins(mobileNumber: string, coins: number, idempotencyKey: string): Observable<RedemptionResponse> {
    if (!this.baseUrl) {
      return throwError(() => ({
        code: 'NOT_CONFIGURED',
        message: 'The withdrawal service is not connected yet.'
      } satisfies RedemptionError));
    }

    const body: RedemptionRequest = { gameCode: this.gameCode, mobileNumber, coins, idempotencyKey };

    return this.http.post<ApiSuccess<RedemptionResponse>>(`${this.baseUrl}/game-rewards/redeem`, body).pipe(
      timeout(20000),
      map(res => res.data),
      catchError(error => throwError(() => this.mapError(error)))
    );
  }

  private mapError(error: unknown): RedemptionError {
    if (error instanceof TimeoutError) {
      return { code: 'TIMEOUT', message: 'The request took too long. Your coins are safe — please try again.' };
    }
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        return { code: 'NETWORK_ERROR', message: 'Could not reach the withdrawal service. Your coins are safe — please try again.' };
      }
      if (isApiFailure(error.error)) {
        const code = error.error.error.code as RedemptionErrorCode;
        return { code, message: error.error.error.message };
      }
      if (error.status >= 500) {
        return { code: 'INTERNAL_ERROR', message: 'The withdrawal service is temporarily unavailable. Your coins are safe.' };
      }
    }
    return { code: 'UNKNOWN', message: 'Something went wrong. Your coins are safe.' };
  }
}
