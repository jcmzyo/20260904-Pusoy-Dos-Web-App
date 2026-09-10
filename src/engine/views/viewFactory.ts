import type { Card, PlayerId } from '../../domain';
import { createDeck } from '../cards/createDeck';
import type { BasicSessionStanding } from '../sessions/basicSessionResult';
import type { BasicSessionState } from '../sessions/resolveBasicSession';
import type { PlayerView, PublicGameView, PublicTrickView } from './PublicGameView';

const copyCard = ({ rank, suit }: Card): Card => ({ rank, suit });
const copyStanding = ({ playerId, totalScore, roundWins, averagePlacement, highestRoundScore }: BasicSessionStanding): BasicSessionStanding =>
  ({ playerId, totalScore, roundWins, averagePlacement, highestRoundScore });

/** Explicit field projection prevents internal metadata from crossing the information boundary. */
export function getPublicView(state: BasicSessionState): PublicGameView {
  const round = state.round;
  let roundView: PublicGameView['round'] = null;
  if (round) {
    const players = round.kind === 'inProgress' ? round.context.players : round.players;
    const held = new Set(players.flatMap((player) => player.hand.map((card) => `${card.rank}-${card.suit}`)));
    let trick: PublicTrickView | null = null;
    if (round.kind === 'inProgress') {
      const currentTrick = round.context.trick;
      trick = currentTrick.kind === 'response'
        ? { kind: 'response', current: { type: currentTrick.current.type, cards: currentTrick.current.cards.map(copyCard) } }
        : { kind: currentTrick.kind };
    }
    roundView = {
      status: round.kind,
      players: players.map(({ playerId, hand }) => ({ playerId, cardCount: hand.length, finished: round.finishOrder.includes(playerId) })),
      currentPlayerId: round.kind === 'inProgress' ? round.context.currentPlayerId : null,
      trick,
      // Basic deals all 52 cards; only public Plays remove cards from hands, including at Round completion.
      playedCards: createDeck().filter((card) => !held.has(`${card.rank}-${card.suit}`)),
      finishOrder: [...round.finishOrder],
    };
  }
  return {
    mode: 'basic', status: state.kind, playerIds: [...state.playerIds], roundNumber: state.roundNumber, round: roundView,
    completedRounds: state.completedRounds.map((roundResult) => ({
      placements: roundResult.placements.map(({ playerId, placement, points }) => ({ playerId, placement, points })),
    })),
    standings: state.standings.map(copyStanding),
    result: state.result === null ? null : {
      standings: state.result.standings.map(copyStanding), winnerIds: [...state.result.winnerIds], decidedBy: state.result.decidedBy,
    },
  };
}

export function getPlayerView(state: BasicSessionState, playerId: PlayerId): PlayerView {
  if (!state.playerIds.includes(playerId)) throw new Error('Player View requires a Session participant.');
  const round = state.round;
  let hand: readonly Card[] = [];
  if (round) {
    const players = round.kind === 'inProgress' ? round.context.players : round.players;
    const player = players.find((entry) => entry.playerId === playerId);
    if (!player) throw new Error('Player View requires the participant in the current Round.');
    hand = player.hand.map(copyCard);
  }
  return { ...getPublicView(state), playerId, hand };
}
