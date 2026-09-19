// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Combination } from '../../../src/domain';
import type { GameEvent } from '../../../src/engine';
import { describeEvent, describeEvents, EventLogOverlay } from '../../../src/ui/primitives/EventLogOverlay';

afterEach(cleanup);

const NAMES = { south: 'You', west: 'Ana', north: 'Bo', east: 'Cy' };

describe('describeEvent / describeEvents (M4-T10; ui-ux.md §9.2)', () => {
  it('describes every public gameplay event ui-ux.md §9.2 asks for: Round start/opener, exact Play + combination type, Pass, Trick reset/free lead, and finish/placement - each entry ending in a period, consistently, like every other (the person\'s own follow-up request)', () => {
    // No rank/suit text embedded in the CARDS_PLAYED description itself (unlike M4-T08's own Play/Pass
    // reason text, `describeCombination`) - the entry's own `cards` field, asserted below, is the rank/
    // suit source once card visuals are shown alongside it (the person's own follow-up request).
    const single: Combination = { type: 'single', cards: [{ rank: '3', suit: 'clubs' }] };
    expect(describeEvent({ type: 'ROUND_STARTED', roundNumber: 2 }, NAMES)).toEqual({ text: 'Round 2 started.', cards: null, playerId: null });
    expect(describeEvent({ type: 'CARDS_PLAYED', roundNumber: 2, playerId: 'west', combination: single }, NAMES))
      .toEqual({ text: 'Ana played Single.', cards: single.cards, playerId: 'west' });
    expect(describeEvent({ type: 'PLAYER_PASSED', roundNumber: 2, playerId: 'north' }, NAMES)).toEqual({ text: 'Bo passed.', cards: null, playerId: 'north' });
    // Past tense ("won", not "wins") - consistent with every other entry's own past tense (the person's
    // own follow-up report of "You wins the Trick" reading as a grammar mistake).
    expect(describeEvent({ type: 'TRICK_ENDED', roundNumber: 2, lastSuccessfulPlayerId: 'east' }, NAMES)).toEqual({ text: 'Cy won the Trick.', cards: null, playerId: 'east' });
    expect(describeEvent({ type: 'PLAYER_FINISHED', roundNumber: 2, playerId: 'south', placement: 1 }, NAMES)).toEqual({ text: 'You finished 1st.', cards: null, playerId: 'south' });
    expect(describeEvent({
      type: 'ROUND_ENDED', roundNumber: 2,
      result: { placements: [
        { playerId: 'south', placement: 1, points: 5 }, { playerId: 'west', placement: 2, points: 3 },
        { playerId: 'north', placement: 3, points: 2 }, { playerId: 'east', placement: 4, points: 0 },
      ] },
    }, NAMES)).toEqual({ text: 'Cy finished 4th — Round 2 complete.', cards: null, playerId: 'east' });
  });

  it("a CARDS_PLAYED entry's cards use the same canonical Straight/Straight Flush sequence as the center table and seat trails, not submission order", () => {
    // Deliberately submitted out of sequence (3,4,5,A,2 - the exact "most visibly" example
    // combinationLabels.ts's own `getDisplayCards` documents) to prove this is an actual reorder.
    const combination: Combination = {
      type: 'straight',
      cards: [
        { rank: '3', suit: 'clubs' }, { rank: '4', suit: 'diamonds' }, { rank: '5', suit: 'hearts' },
        { rank: 'A', suit: 'spades' }, { rank: '2', suit: 'clubs' },
      ],
    };
    const described = describeEvent({ type: 'CARDS_PLAYED', roundNumber: 1, playerId: 'west', combination }, NAMES);
    expect(described?.text).toBe('Ana played Straight.');
    expect(described?.cards?.map((card) => `${card.rank}-${card.suit}`)).toEqual([
      'A-spades', '2-clubs', '3-clubs', '4-diamonds', '5-hearts',
    ]);
  });

  it('describeEvents appends "Free lead!" to a TRICK_ENDED that genuinely continues the Round, but not to one that is also the Round\'s own completion', () => {
    const continuesIntoFreeLead: readonly GameEvent[] = [
      { type: 'TRICK_ENDED', roundNumber: 1, lastSuccessfulPlayerId: 'south' },
      { type: 'TURN_CHANGED', roundNumber: 1, playerId: 'south' },
    ];
    expect(describeEvents(continuesIntoFreeLead, NAMES).map((entry) => entry.text)).toEqual(['You won the Trick. Free lead!']);

    // South wins the final Trick with their own last card, which simultaneously ends the Round (east is
    // left as the unplaced 4th) - there is no next Turn to lead into, so no "Free lead!" here.
    const endsRoundOnTheSameTrick: readonly GameEvent[] = [
      { type: 'TRICK_ENDED', roundNumber: 1, lastSuccessfulPlayerId: 'south' },
      {
        type: 'ROUND_ENDED', roundNumber: 1,
        result: { placements: [
          { playerId: 'west', placement: 1, points: 5 }, { playerId: 'north', placement: 2, points: 3 },
          { playerId: 'south', placement: 3, points: 2 }, { playerId: 'east', placement: 4, points: 0 },
        ] },
      },
    ];
    expect(describeEvents(endsRoundOnTheSameTrick, NAMES).map((entry) => entry.text)).toEqual([
      'You won the Trick.', 'Cy finished 4th — Round 1 complete.',
    ]);
  });

  it("does not append \"Free lead!\" when the Trick's own winner had already emptied their hand on that Play and so cannot take the next lead themselves (requirements.md §2.5.1: the next active player becomes the new leader instead) - a real reported bug where an already-finished player's Trick win read as if they had somehow taken the table back", () => {
    // East's Pair stood unbeaten (a genuine Trick win) on the very Play that emptied East's own hand;
    // North/South/West all then declined to lead in East's place, so the free lead actually passes to
    // South - not back to East, who has already left the active rotation.
    const events: readonly GameEvent[] = [
      { type: 'CARDS_PLAYED', roundNumber: 2, playerId: 'east', combination: { type: 'pair', cards: [{ rank: '8', suit: 'clubs' }, { rank: '8', suit: 'diamonds' }] } },
      { type: 'PLAYER_FINISHED', roundNumber: 2, playerId: 'east', placement: 1 },
      { type: 'PLAYER_PASSED', roundNumber: 2, playerId: 'north' },
      { type: 'PLAYER_PASSED', roundNumber: 2, playerId: 'south' },
      { type: 'PLAYER_PASSED', roundNumber: 2, playerId: 'west' },
      { type: 'TRICK_ENDED', roundNumber: 2, lastSuccessfulPlayerId: 'east' },
      { type: 'TURN_CHANGED', roundNumber: 2, playerId: 'south' },
    ];
    expect(describeEvents(events, NAMES).map((entry) => entry.text)).toEqual([
      'Cy played Pair.', 'Cy finished 1st.', 'Bo passed.', 'You passed.', 'Ana passed.',
      // No "Free lead!" here - East (Cy) does not lead next; the following Turn is South's (You), not East's.
      'Cy won the Trick.',
    ]);
  });

  it('excludes engine-internal/non-Round-history events (CARDS_DEALT, TURN_CHANGED, SCORE_CALCULATED, SESSION_STARTED, SESSION_ENDED)', () => {
    expect(describeEvent({ type: 'CARDS_DEALT', roundNumber: 1, players: [] }, NAMES)).toBeNull();
    expect(describeEvent({ type: 'TURN_CHANGED', roundNumber: 1, playerId: 'south' }, NAMES)).toBeNull();
    expect(describeEvent({
      type: 'SCORE_CALCULATED', roundNumber: 1,
      result: { placements: [] }, standings: [],
    }, NAMES)).toBeNull();
    expect(describeEvent({ type: 'SESSION_STARTED', mode: 'basic', playerIds: ['south', 'west', 'north', 'east'] }, NAMES)).toBeNull();
    expect(describeEvent({
      type: 'SESSION_ENDED', roundNumber: 5,
      result: { standings: [], winnerIds: [], decidedBy: 'totalScore', placements: [] },
    }, NAMES)).toBeNull();
  });

  it('describeEvents preserves chronological order and drops excluded events, keeping original event indices as keys', () => {
    const events: readonly GameEvent[] = [
      { type: 'ROUND_STARTED', roundNumber: 1 },
      { type: 'CARDS_DEALT', roundNumber: 1, players: [] },
      { type: 'TURN_CHANGED', roundNumber: 1, playerId: 'south' },
      { type: 'PLAYER_PASSED', roundNumber: 1, playerId: 'south' },
    ];
    const entries = describeEvents(events, NAMES);
    expect(entries.map((entry) => entry.text)).toEqual(['Round 1 started.', 'You passed.']);
    expect(entries.map((entry) => entry.key)).toEqual([0, 3]);
  });
});

describe('EventLogOverlay (M4-T10)', () => {
  it('renders entries oldest-first, top to bottom, so the very first event is literally at the top', () => {
    const events: readonly GameEvent[] = [
      { type: 'ROUND_STARTED', roundNumber: 1 },
      { type: 'PLAYER_PASSED', roundNumber: 1, playerId: 'west' },
      { type: 'PLAYER_PASSED', roundNumber: 1, playerId: 'north' },
    ];
    render(<EventLogOverlay events={events} names={NAMES} onClose={() => {}} />);
    const items = screen.getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual(['Round 1 started.', 'Ana passed.', 'Bo passed.']);
  });

  it('gives a Round-boundary marker ("Round 1 started.") its own more prominent, distinct treatment from an ordinary entry (the person\'s own follow-up request: "i think its better if the round 1 started is more highlighted")', () => {
    const events: readonly GameEvent[] = [
      { type: 'ROUND_STARTED', roundNumber: 1 },
      { type: 'PLAYER_PASSED', roundNumber: 1, playerId: 'west' },
    ];
    render(<EventLogOverlay events={events} names={NAMES} onClose={() => {}} />);
    const [roundEntry, passEntry] = screen.getAllByRole('listitem');
    expect(roundEntry!.className).toContain('roundMarker');
    expect(passEntry!.className).not.toContain('roundMarker');
  });

  it('shows a placeholder message for an empty Session history', () => {
    render(<EventLogOverlay events={[]} names={NAMES} onClose={() => {}} />);
    expect(screen.getByText('No events yet this Session.')).toBeTruthy();
  });

  it("renders a CARDS_PLAYED entry's exact cards as visual badges at the end of its line, mirroring the seat's own Play trail (the person's own follow-up request)", () => {
    const combination: Combination = { type: 'pair', cards: [{ rank: '9', suit: 'hearts' }, { rank: '9', suit: 'diamonds' }] };
    const events: readonly GameEvent[] = [{ type: 'CARDS_PLAYED', roundNumber: 1, playerId: 'west', combination }];
    render(<EventLogOverlay events={events} names={NAMES} onClose={() => {}} />);
    const entry = screen.getByRole('listitem');
    expect(entry.textContent).toContain('Ana played Pair.');
    const badges = within(entry).getAllByRole('img');
    expect(badges.map((badge) => badge.getAttribute('aria-label'))).toEqual(['9 of Hearts', '9 of Diamonds']);
  });

  it('shows no card badges for an event with no cards of its own, e.g. a Pass', () => {
    const events: readonly GameEvent[] = [{ type: 'PLAYER_PASSED', roundNumber: 1, playerId: 'west' }];
    render(<EventLogOverlay events={events} names={NAMES} onClose={() => {}} />);
    expect(within(screen.getByRole('listitem')).queryAllByRole('img')).toHaveLength(0);
  });

  it('highlights only the human player\'s own NAME within an entry, not the whole entry (the person\'s own follow-up report: "I only meant to highlight the name, not the whole event")', () => {
    const events: readonly GameEvent[] = [
      { type: 'PLAYER_PASSED', roundNumber: 1, playerId: 'south' },
      { type: 'PLAYER_PASSED', roundNumber: 1, playerId: 'west' },
    ];
    render(<EventLogOverlay events={events} names={NAMES} onClose={() => {}} />);
    const [southEntry, westEntry] = screen.getAllByRole('listitem');
    // The human's own entry: exactly the "You" text is wrapped in its own highlighted span, not the
    // whole <li> (no `you` class on the entry itself), and the rest of the sentence stays plain text.
    expect(southEntry!.className).not.toContain('you');
    const southName = within(southEntry!).getByText('You');
    expect(southName.tagName).toBe('SPAN');
    expect(southName.className).toContain('you');
    expect(southEntry!.textContent).toBe('You passed.');
    // An ordinary (non-human) entry gets no highlighted span at all.
    expect(westEntry!.className).not.toContain('you');
    expect(within(westEntry!).queryByText('Ana')?.className ?? '').not.toContain('you');
  });
});
