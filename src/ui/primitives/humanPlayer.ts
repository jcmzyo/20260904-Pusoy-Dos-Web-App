import type { PlayerId } from '../../domain';

/**
 * Fixed Phase 1 human seat (requirements.md §1, ui-ux.md §4: "Human South"). Single shared source of
 * truth for every UI component that needs to identify "the human's own seat" — originally only App.tsx's
 * own local constant, widened here (M4-T13 follow-up) so Session Summary, Round Result, and the Event
 * Log can each mark the human's own name/entries with the same restrained highlight (ui-ux.md §13's own
 * follow-up note) without re-deriving or re-hardcoding `'south'` independently in three more places.
 */
export const HUMAN_PLAYER_ID: PlayerId = 'south';
