/**
 * Stable identifier for a Pusoy Dos game participant.
 *
 * `PlayerId` identifies a game participant only. It must not encode
 * whether the participant is human, AI-controlled, or network-controlled
 * — controller type is not part of fundamental player identity
 * (domain-model.md §5.1). Controller assignment/lifecycle belongs to the
 * Game Orchestrator (orchestrator.md), not to this shared domain type.
 *
 * A branded string may be introduced later if stronger compile-time
 * distinction proves useful; that remains an implementation choice
 * (domain-model.md §5.1) and is not required for M1.
 */
export type PlayerId = string;
