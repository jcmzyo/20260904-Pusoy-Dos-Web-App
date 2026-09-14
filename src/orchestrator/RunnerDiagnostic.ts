import type { Move } from '../domain';
import type { EngineResult } from '../engine';
import type { PlayerTurnRequest } from './requests/PlayerTurnRequest';

/** Developer-only observation, separate from player requests. Payloads are detached before delivery. */
export type RunnerDiagnostic =
  | { readonly kind: 'turnStart'; readonly state: EngineResult['state'] }
  | { readonly kind: 'roundStart'; readonly state: EngineResult['state'] }
  | { readonly kind: 'request'; readonly state: EngineResult['state']; readonly request: PlayerTurnRequest }
  | { readonly kind: 'proposal'; readonly move: Move }
  | { readonly kind: 'transaction'; readonly result: EngineResult };

export type RunnerDiagnosticObserver = (entry: RunnerDiagnostic) => void;
