import type { DecisionTrace } from '../ai/evaluation/evaluateCandidates';
import type { Move, PlayerId } from '../domain';
import { EngineInvariantError } from '../engine';
import type { EngineResult, GameEvent, MoveResult, PlayerView } from '../engine';
import type { PlayerTurnRequest } from '../orchestrator';
import type { RunnerDiagnostic } from '../orchestrator/RunnerDiagnostic';
import type { SimulationConfig } from './SimulationConfig';

export interface SimulationTraceEntry {
  readonly index: number;
  readonly roundNumber: number;
  readonly actionIndex: number;
  readonly kind: 'transaction' | 'request' | 'proposal' | 'decision';
  readonly events?: readonly GameEvent[];
  readonly request?: PlayerTurnRequest;
  readonly move?: Move;
  readonly decision?: DecisionTrace;
}

export interface SimulationException {
  readonly name: string;
  readonly message: string;
  readonly stack?: string;
  readonly cause?: SimulationException;
}

/** This entire artifact is developer-only, including safe views of different players. */
export interface SimulationFailure {
  readonly failureType: 'invariant' | 'controller' | 'rejectedMove' | 'exception';
  readonly config: SimulationConfig;
  readonly batchIndex?: number;
  readonly roundNumber: number;
  /** One-based attempted action across the Session; zero before the first request. */
  readonly actionIndex: number;
  readonly currentPlayer?: PlayerId;
  readonly proposedMove?: Move;
  readonly legalMoves?: readonly Move[];
  readonly playerView?: PlayerView;
  readonly decisionTrace?: DecisionTrace;
  readonly trace: readonly SimulationTraceEntry[];
  readonly message: string;
  readonly invariantCode?: string;
  readonly rejection?: Extract<MoveResult, { accepted: false }>['error'];
  readonly exception?: SimulationException;
  readonly developerSnapshots: { readonly before?: EngineResult['state']; readonly after?: EngineResult['state'] };
}

function exceptionDetails(error: unknown, seen = new Set<unknown>()): SimulationException {
  if (!(error instanceof Error)) return { name: 'ThrownValue', message: String(error) };
  seen.add(error);
  return { name: error.name, message: error.message, ...(error.stack === undefined ? {} : { stack: error.stack }),
    ...(error.cause === undefined || seen.has(error.cause) ? {} : { cause: exceptionDetails(error.cause, seen) }) };
}

/** Retains ordered evidence and only the latest transition snapshots; never supplies controller inputs. */
export class SimulationDiagnostics {
  private actionIndex = 0;
  private roundNumber = 0;
  private before: EngineResult['state'] | undefined;
  private after: EngineResult['state'] | undefined;
  private request: PlayerTurnRequest | undefined;
  private move: Move | undefined;
  private decision: DecisionTrace | undefined;
  private stage: 'engine' | 'controller' = 'engine';
  private readonly trace: SimulationTraceEntry[] = [];

  constructor(private readonly config: SimulationConfig, private readonly batchIndex?: number) {}

  readonly observe = (entry: RunnerDiagnostic): void => {
    if (entry.kind === 'turnStart' || entry.kind === 'roundStart') {
      if (entry.kind === 'turnStart') this.actionIndex++;
      this.before = entry.state;
      this.after = undefined;
      this.roundNumber = entry.state.roundNumber;
      this.request = undefined;
      this.move = undefined;
      this.decision = undefined;
      this.stage = 'engine';
    } else if (entry.kind === 'request') {
      // Production tokens are process-wide; diagnostic identities are local to this seeded run.
      this.request = { ...entry.request, requestId: `action-${this.actionIndex}` };
      this.stage = 'controller';
      this.append({ kind: 'request', request: this.request });
    } else if (entry.kind === 'proposal') {
      this.move = entry.move;
      this.stage = 'engine';
      this.append({ kind: 'proposal', move: entry.move });
    } else {
      this.after = entry.result.state;
      this.roundNumber = entry.result.state.roundNumber;
      this.append({ kind: 'transaction', events: entry.result.events });
    }
  };

  readonly onDecision = (decision: DecisionTrace): void => {
    this.decision = { ...decision, requestId: `action-${this.actionIndex}` };
    this.append({ kind: 'decision', decision: this.decision });
  };

  private append(entry: Omit<SimulationTraceEntry, 'index' | 'roundNumber' | 'actionIndex'>): void {
    this.trace.push({ ...entry, index: this.trace.length, roundNumber: this.roundNumber, actionIndex: this.actionIndex });
  }

  failure(error: unknown, rejection?: Extract<MoveResult, { accepted: false }>['error']): SimulationFailure {
    const exception = exceptionDetails(error);
    const round = (this.after ?? this.before)?.round;
    return { failureType: rejection ? 'rejectedMove' : error instanceof EngineInvariantError ? 'invariant' : this.stage === 'controller' ? 'controller' : 'exception',
      config: JSON.parse(JSON.stringify(this.config)) as SimulationConfig, ...(this.batchIndex === undefined ? {} : { batchIndex: this.batchIndex }),
      roundNumber: error instanceof EngineInvariantError ? error.roundNumber : this.roundNumber, actionIndex: this.actionIndex,
      ...(this.request ? { currentPlayer: this.request.playerId, legalMoves: this.request.legalMoves, playerView: this.request.view } :
        round?.kind === 'inProgress' ? { currentPlayer: round.context.currentPlayerId } : {}),
      ...(this.move === undefined ? {} : { proposedMove: this.move }),
      ...(this.decision === undefined ? {} : { decisionTrace: this.decision }),
      trace: this.trace, message: exception.message,
      ...(error instanceof EngineInvariantError ? { invariantCode: error.code } : {}),
      ...(rejection ? { rejection } : { exception }),
      developerSnapshots: { ...(this.before === undefined ? {} : { before: this.before }), ...(this.after === undefined ? {} : { after: this.after }) } };
  }
}
