/**
 * The v1 game modes governing round-ending and scoring behavior
 * (requirements.md §2.6; domain-model.md §7).
 *
 * This type only identifies the selected mode. It does not implement
 * mode-specific rules — Basic/Competitive round-ending and scoring
 * behavior is owned by the Game Engine (engine.md §21-23).
 *
 * `competitive` remains valid vocabulary during M1, but Competitive
 * Mode behavior itself is explicitly out of scope for M1 and does not
 * activate any Competitive-specific engine behavior
 * (m1-task-breakdown.md §3, T04 production notes).
 */
export type GameMode =
  | 'basic'
  | 'competitive';
