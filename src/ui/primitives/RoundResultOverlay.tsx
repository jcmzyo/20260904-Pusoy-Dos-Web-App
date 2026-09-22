import { useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import type { PlayerId } from '../../domain';
import { HUMAN_PLAYER_ID } from './humanPlayer';
import { useBodyScrollLock } from './useBodyScrollLock';
import styles from './RoundResultOverlay.module.css';

export interface RoundResultSeatInput {
  readonly playerId: PlayerId;
  readonly name: string;
  /** Cumulative Session total AFTER this Round's own score has already been added
   *  (SessionPresentation's `PresentedSeat.totalScore`, Engine-authoritative). This overlay derives the
   *  pre-Round total by subtracting `placements`' own points below rather than being handed a second,
   *  separately-sourced "previous" figure — there is exactly one authoritative total per seat. */
  readonly totalScore: number;
}

export interface RoundResultPlacement {
  readonly playerId: PlayerId;
  readonly placement: 1 | 2 | 3 | 4;
  readonly points: 5 | 3 | 2 | 0;
}

export interface RoundResultOverlayProps {
  readonly roundNumber: number;
  readonly seats: readonly RoundResultSeatInput[];
  /** This Round's own authoritative placements/points (SessionPresentation's `roundCheckpoint.placements`,
   *  `resolveBasicRound`'s Engine-owned scoring) — never recomputed here. */
  readonly placements: readonly RoundResultPlacement[];
  /** Every EARLIER Round's own placements, oldest first (SessionPresentation's `completedRounds` minus this
   *  Round's own checkpoint). Used only to reproduce the standings order the person was already shown
   *  after each of those Rounds, so ties keep their previous relative order (ui-ux.md §12) instead of
   *  falling back to seat order every time - never for scoring. Omitted (e.g. Round 1, or a caller with
   *  no history) means seat order is the starting basis. */
  readonly priorPlacements?: readonly (readonly RoundResultPlacement[])[];
  /** Round 5's checkpoint (SessionPresentation's `sessionResult !== null`): no continuation button at
   *  all — once the scoring animation settles, `onContinue` fires automatically after `autoAdvanceDelayMs`
   *  (ui-ux.md §12 follow-up, M4-T13 UI refinement — this replaces the earlier explicit "View Session
   *  Results" button). Every other Round still shows the explicit **Next Round** button. */
  readonly isFinalRound: boolean;
  readonly onContinue: () => void;
  /** Delay between each scoring-animation stage below (ui-ux.md §12's "short" animation). Tests pass 0
   *  for a deterministic/instant sequence, mirroring `SessionPresentation.startAutoPlay`'s own convention
   *  ("Callers needing a fast/deterministic loop (tests) should pass 0"). */
  readonly stageDelayMs?: number;
  /** How long the settled Round 5 overlay waits before automatically calling `onContinue` (ui-ux.md §12
   *  follow-up). Only relevant when `isFinalRound`; ignored otherwise, since every other Round waits for
   *  its own explicit **Next Round** click instead. Tests pass 0, same convention as `stageDelayMs`. */
  readonly autoAdvanceDelayMs?: number;
  /** Freezes the scoring-animation and auto-advance timers while true (App.tsx: unsupported-layout guidance
   *  is hiding this still-mounted overlay), so the interrupted stage resumes - with its full delay - once
   *  it clears rather than finishing where nobody can see it. */
  readonly paused?: boolean;
}

/**
 * The four-step scoring-reveal sequence ui-ux.md §12 specifies, in order (person's own follow-up request
 * refined the exact column shape - see the table's own render below):
 *   1. `before`  — rows appear arranged by standings before this Round's score; Previous shows each
 *      seat's own pre-Round total, Round and Total have nothing to show yet.
 *   2. `points`  — this Round's own points (+5/+3/+2/+0) appear in the Round column, still in the
 *      pre-Round order; Total still has nothing to show.
 *   3. `totals`  — the Total column reveals the new cumulative value (Previous + Round), still in the
 *      pre-Round order.
 *   4. `settled` — rows reorder by the new cumulative total; the now-served-their-purpose Previous and
 *      Round columns become hidden (kept in place, not removed - the person's own explicit follow-up:
 *      "nothing will shorten or size adjustment" - so settling never visibly resizes/reflows the table),
 *      leaving Player/Total as the only columns actually read.
 * `settled` is also the skip target: skipping "completes the visual state" (ui-ux.md §12) without
 * calling `onContinue` — the animation and the explicit continuation action are deliberately separate.
 */
const STAGES = ['before', 'points', 'totals', 'settled'] as const;
type Stage = typeof STAGES[number];
const FINAL_STAGE_INDEX = STAGES.length - 1;

interface RoundResultRow extends RoundResultSeatInput {
  readonly points: RoundResultPlacement['points'];
  readonly previousTotal: number;
}

/** Stable descending sort: ties keep `rows`' own relative order (its index) rather than an arbitrary
 *  re-ranking (ui-ux.md §12: "Ties ... retain stable previous relative order rather than inventing a
 *  final ranking"). The after-Round sort is always applied to the before-Round order rather than to seat
 *  order, so a tie keeps exactly the relative order the person was just looking at. */
function stableDescendingOrder(rows: readonly RoundResultRow[], score: (row: RoundResultRow) => number): RoundResultRow[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => score(b.row) - score(a.row) || a.index - b.index)
    .map((entry) => entry.row);
}

/**
 * Round Result overlay (M4-T12; ui-ux.md §12): a non-dismissible modal over the dimmed completed table
 * (App.tsx's own dimming wrapper renders the "dimmed completed table" part; this component is only the
 * modal itself). Unlike the shared `Overlay` primitive (Discard Pile/Event Log, M4-T10; Leave
 * confirmation, M4-T11), there is no Close/Escape/backdrop-dismiss here at all — `Overlay`'s own
 * docstring already calls this out as a different, not-a-variant contract, so this is a bespoke modal
 * rather than a reused/extended `Overlay`. Progression out of this Round only ever happens through the
 * explicit continuation button; clicking anywhere else in the modal only skips the scoring animation
 * to its settled state (ui-ux.md §12: "skipping completes the visual state but must not trigger Next
 * Round").
 */
export function RoundResultOverlay({ roundNumber, seats, placements, priorPlacements = [], isFinalRound, onContinue, stageDelayMs = 650, autoAdvanceDelayMs = 900, paused = false }: RoundResultOverlayProps) {
  useBodyScrollLock();

  const [stageIndex, setStageIndex] = useState(0);

  // Always the latest `onContinue` without resetting the auto-advance timer below on every parent
  // re-render (a fresh `onContinue` function identity from the parent, e.g. SessionTable's own
  // `handleContinue`, is not itself a reason to restart the wait) — the effect's own dependency array
  // intentionally excludes `onContinue` itself, only ever reading it through this ref at fire time.
  const onContinueRef = useRef(onContinue);
  onContinueRef.current = onContinue;

  // A freshly mounted overlay always starts its own animation from the first stage. App.tsx mounts a new
  // instance per Round Result (it is only rendered while `roundCheckpoint` is set), so `roundNumber`
  // itself never actually changes under one mounted instance in practice — this is a correctness
  // safety net rather than behavior the app currently exercises.
  useEffect(() => {
    setStageIndex(0);
  }, [roundNumber]);

  useEffect(() => {
    if (paused || stageIndex >= FINAL_STAGE_INDEX) return;
    const timer = setTimeout(() => setStageIndex((index) => Math.min(index + 1, FINAL_STAGE_INDEX)), stageDelayMs);
    return () => clearTimeout(timer);
  }, [stageIndex, stageDelayMs, paused]);

  // Round 5 has no continuation button (ui-ux.md §12 follow-up, M4-T13 UI refinement): once the
  // animation reaches its own settled stage, wait `autoAdvanceDelayMs` and call `onContinue` on this
  // overlay's own behalf. Re-armed only when `isFinalRound`/`stage`/`autoAdvanceDelayMs` actually change —
  // reaching 'settled' via the backdrop's own skip (`handleSkip` below) still sets `stageIndex` the same
  // way, so this fires identically whether the animation ran its full course or was skipped.
  useEffect(() => {
    if (paused || !isFinalRound || STAGES[stageIndex] !== 'settled') return;
    const timer = setTimeout(() => onContinueRef.current(), autoAdvanceDelayMs);
    return () => clearTimeout(timer);
  }, [isFinalRound, stageIndex, autoAdvanceDelayMs, paused]);

  const stage: Stage = STAGES[stageIndex]!;
  const pointsByPlayer = new Map(placements.map((entry) => [entry.playerId, entry] as const));
  const rows: RoundResultRow[] = seats.map((seat) => {
    const placement = pointsByPlayer.get(seat.playerId);
    if (!placement) throw new Error(`Round Result is missing a placement for ${seat.playerId}.`);
    return { ...seat, points: placement.points, previousTotal: seat.totalScore - placement.points };
  });

  const showRoundPoints = stage !== 'before';
  const showTotal = stage === 'totals' || stage === 'settled';
  const settled = stage === 'settled';
  // The order shown before this Round's own score is applied: replays each earlier Round's own
  // stable re-sort (ties keep their previous relative order, starting from seat order), so this Round's
  // opening arrangement matches what the previous Round's own overlay settled on. The final sort then
  // starts from that same order rather than from seat order, so a tie in the new totals does not
  // suddenly rearrange the rows (ui-ux.md §12).
  const priorOrder = priorPlacements.reduce<{ order: RoundResultRow[]; totals: Map<PlayerId, number> }>(
    (state, roundPlacements) => {
      const totals = new Map(state.totals);
      for (const entry of roundPlacements) totals.set(entry.playerId, (totals.get(entry.playerId) ?? 0) + entry.points);
      return { order: stableDescendingOrder(state.order, (row) => totals.get(row.playerId) ?? 0), totals };
    },
    { order: rows, totals: new Map() },
  ).order;
  const beforeOrder = stableDescendingOrder(priorOrder, (row) => row.previousTotal);
  const displayOrder = settled ? stableDescendingOrder(beforeOrder, (row) => row.totalScore) : beforeOrder;

  function handleSkip() {
    setStageIndex(FINAL_STAGE_INDEX);
  }

  function handleContinueClick(event: ReactMouseEvent) {
    // Stops the click from also bubbling to the backdrop's own skip handler above — harmless either way
    // (skip only jumps to the already-settled stage), but keeps the two actions cleanly separate.
    event.stopPropagation();
    onContinue();
  }

  return (
    <div className={styles.backdrop} onClick={handleSkip}>
      <section className={styles.panel} role="dialog" aria-modal="true" aria-label={`Round ${roundNumber} Result`}>
        <h2 className={styles.title}>Round {roundNumber} Result</h2>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Player</th>
              {/* Previous/Round are only ever meaningful while the scoring reveal is still in progress -
               *  once settled (rows already reordered by the new cumulative Total), both become hidden
               *  (`visibility: hidden`, not removed) rather than dropping out of the table's own layout:
               *  removing them outright would narrow/reflow the table the instant it settles, which the
               *  person's own follow-up request explicitly ruled out ("nothing will shorten or size
               *  adjustment"). `visibility: hidden` keeps each column's own reserved width exactly as it
               *  was throughout, and - in a real browser - drops it from the accessibility tree the same
               *  way removing it would (round-result.e2e.ts covers this real-rendering concern; CSS Module
               *  rules are never actually applied in jsdom, so RoundResultOverlay.test.tsx instead checks
               *  for this class directly, the same way other jsdom tests here check CSS-driven state). */}
              <th scope="col" className={settled ? styles.settledHidden : undefined}>Previous</th>
              <th scope="col" className={settled ? styles.settledHidden : undefined}>Round</th>
              <th scope="col">Total</th>
            </tr>
          </thead>
          <tbody>
            {displayOrder.map((row) => (
              // Restrained highlight for the human's own seat (ui-ux.md §13 follow-up, M4-T13 UI
              // refinement, extended here to Round Result too) - `row.name` is already literally "You"
              // (SessionPresentation's own seat naming), so this is purely an additional glance-able cue,
              // not what carries the meaning (§15's label-plus-color rule).
              <tr key={row.playerId} className={row.playerId === HUMAN_PLAYER_ID ? styles.you : undefined}>
                <td>{row.name}</td>
                <td className={settled ? styles.settledHidden : undefined}>{row.previousTotal}</td>
                <td className={settled ? styles.settledHidden : undefined}>{showRoundPoints ? `+${row.points}` : '—'}</td>
                <td>{showTotal ? row.totalScore : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {/* Round 5 has no continuation button at all (ui-ux.md §12 follow-up, M4-T13 UI refinement) - the
         *  settled-stage effect above calls `onContinue` on its own after a short additional delay. */}
        {!isFinalRound && (
          <button type="button" className={styles.continueButton} onClick={handleContinueClick}>Next Round</button>
        )}
      </section>
    </div>
  );
}
