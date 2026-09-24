import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Card } from '../../domain';
import { PlayingCard } from './Card';
import { cardKey, moveKey, reconcileOrder, sortKeysByRank, sortKeysBySuit } from './handOrdering';
import styles from './HumanHand.module.css';

export interface HumanHandProps {
  /** The human player's authoritative cards (SessionPresentationSnapshot.humanHand). Unordered set;
   *  this component owns display order, selection, and manual arrangement as presentation-only state
   *  (ui-ux.md §2, §6) — it never decides legality. */
  readonly cards: readonly Card[];
  /** The most cards the active Trick could ever accept: the current hand-to-beat's own card count while
   *  responding, or up to 5 for a free Play (opening/free lead) (M4-T08). A selection convenience only —
   *  it narrows what can be *selected*, not a legality replica; the Engine still authoritatively decides
   *  whether an at-or-under-cap selection actually beats/opens legally. Selecting a card beyond the cap
   *  is a no-op, and an existing over-cap selection (the cap can shrink between the player's own Turns as
   *  other players act) is trimmed down to the cap, keeping this hand's own display order. */
  readonly maxSelectable: number;
  /** Reports the current selection as authoritative Card values, in this hand's own display order,
   *  whenever it changes (M4-T08's Play/Pass control inspects this; T07 itself never decides legality). */
  readonly onSelectionChange?: (cards: readonly Card[]) => void;
}

/** Pointer movement (px) beyond which a gesture counts as a drag rather than a tap (ui-ux.md §6:
 *  "Reordering changes only display order; it does not select/deselect cards"). */
const DRAG_THRESHOLD_PX = 4;

interface DragState {
  readonly key: string;
  readonly pointerId: number;
  readonly startClientX: number;
  readonly cardRect: DOMRect;
  readonly containerRect: DOMRect;
  /** On-screen size of the card relative to its own layout size (`PlayArea`'s uniform scale, M4-T14):
   *  pointer deltas and rects are in screen pixels, while `translateX` below is in the card's own
   *  (pre-scale) layout pixels, so the two must be converted or the card would track the pointer at
   *  the wrong speed. `1` wherever there is no layout (jsdom). */
  readonly scale: number;
  dragged: boolean;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * The interactive human hand: one baseline of overlapping cards supporting
 * click/tap selection, always-visible Sort Rank/Sort Suit, and a bounded
 * mouse/touch drag reorder (M4-T07; ui-ux.md §6).
 *
 * Selection only ever changes from a per-card click handler — there is no
 * container-level click-away handler — so clicking empty table space never
 * clears selection (ui-ux.md §6).
 */
export function HumanHand({ cards, maxSelectable, onSelectionChange }: HumanHandProps) {
  const cardsByKey = useMemo(() => new Map(cards.map((card) => [cardKey(card), card])), [cards]);
  const [order, setOrder] = useState<readonly string[]>(() => cards.map(cardKey));
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [dragKey, setDragKey] = useState<string | null>(null);

  const handRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef(new Map<string, HTMLDivElement>());
  const dragStateRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);

  // Reconciles display order/selection against the authoritative card set. `cards` is a fresh array
  // every SessionPresentation snapshot even when its contents are unchanged (bot Turns re-render the
  // whole snapshot), so this only actually updates state when the set of cards genuinely changed
  // (e.g. a future Play removes cards from the hand) — see reconcileOrder/setSelected below.
  useEffect(() => {
    const currentKeys = new Set(cardsByKey.keys());
    setOrder((prev) => reconcileOrder(prev, currentKeys));
    setSelected((prev) => {
      const next = new Set([...prev].filter((key) => currentKeys.has(key)));
      return next.size === prev.size ? prev : next;
    });
  }, [cardsByKey]);

  function toggleSelected(key: string) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        // Selecting beyond the active Trick's cap is a no-op rather than an error/replacement — the
        // player can still deselect something else first (M4-T08).
        if (next.size >= maxSelectable) return prev;
        next.add(key);
      }
      return next;
    });
  }

  // The cap can shrink between the human's own Turns as other players act (e.g. a response Trick
  // narrows from a free Play's up-to-5 cap to the current hand's exact size); trim any now-over-cap
  // selection down to the cap, keeping this hand's own display order (M4-T08).
  useEffect(() => {
    setSelected((prev) => {
      if (prev.size <= maxSelectable) return prev;
      return new Set(order.filter((key) => prev.has(key)).slice(0, maxSelectable));
    });
  }, [maxSelectable, order]);

  // Reports the current selection, as authoritative Card values in display order, to the caller (T08's
  // Play/Pass control) whenever selection or the authoritative card set itself changes.
  useEffect(() => {
    onSelectionChange?.(order.filter((key) => selected.has(key)).map((key) => cardsByKey.get(key)!));
  }, [order, selected, cardsByKey, onSelectionChange]);

  function computeDropIndex(draggedKey: string, clientX: number): number {
    const others = order.filter((key) => key !== draggedKey);
    for (let index = 0; index < others.length; index++) {
      const el = cardRefs.current.get(others[index]!);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (clientX < rect.left + rect.width / 2) return index;
    }
    return others.length;
  }

  function handlePointerDown(key: string, event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const cardEl = cardRefs.current.get(key);
    const containerEl = handRef.current;
    if (!cardEl || !containerEl) return;
    // Pointer Capture is unsupported in jsdom (Vitest/RTL) even though every real target browser
    // supports it; feature-detect rather than branching on environment.
    if (typeof cardEl.setPointerCapture === 'function') cardEl.setPointerCapture(event.pointerId);
    const cardRect = cardEl.getBoundingClientRect();
    dragStateRef.current = {
      key, pointerId: event.pointerId, startClientX: event.clientX,
      cardRect, containerRect: containerEl.getBoundingClientRect(),
      scale: cardEl.offsetWidth > 0 ? cardRect.width / cardEl.offsetWidth : 1,
      dragged: false,
    };
    setDragKey(key);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const state = dragStateRef.current;
    if (!state || event.pointerId !== state.pointerId) return;
    const deltaX = event.clientX - state.startClientX;
    if (Math.abs(deltaX) > DRAG_THRESHOLD_PX) state.dragged = true;
    const cardEl = cardRefs.current.get(state.key);
    if (!cardEl) return;
    if (!state.dragged) return;
    // Bounded drag (ui-ux.md §6: "Cards cannot be dragged indefinitely around the table"): clamp the
    // dragged card's visual offset so it never leaves the hand container's own bounding box.
    const minDelta = state.containerRect.left - state.cardRect.left;
    const maxDelta = state.containerRect.right - state.cardRect.right;
    cardEl.style.transform = `translateX(${clamp(deltaX, minDelta, maxDelta) / state.scale}px)`;
  }

  /** Tears down an in-progress drag: visual offset, pointer capture, and drag state. Shared by a completed
   *  drop (`endDrag`) and a cancelled gesture (`cancelDrag`), neither of which may leave any of it behind. */
  function releaseDrag(state: DragState, pointerId: number) {
    const cardEl = cardRefs.current.get(state.key);
    if (cardEl) {
      cardEl.style.transform = '';
      if (typeof cardEl.hasPointerCapture === 'function' && cardEl.hasPointerCapture(pointerId)) {
        cardEl.releasePointerCapture(pointerId);
      }
    }
    dragStateRef.current = null;
    setDragKey(null);
  }

  /** `pointercancel` (the browser took the gesture over, e.g. a touch scroll/system gesture, or capture was
   *  lost): nothing was dropped, so the hand order stays as it was and, since a cancelled gesture never
   *  produces the click that would normally clear `suppressClickRef`, it must not be set at all - otherwise
   *  the person's next, unrelated card click would be silently swallowed. */
  function cancelDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const state = dragStateRef.current;
    if (!state || event.pointerId !== state.pointerId) return;
    releaseDrag(state, event.pointerId);
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const state = dragStateRef.current;
    if (!state || event.pointerId !== state.pointerId) return;
    const dropIndex = state.dragged ? computeDropIndex(state.key, event.clientX) : null;
    releaseDrag(state, event.pointerId);
    if (dropIndex !== null) {
      setOrder((prev) => moveKey(prev, state.key, dropIndex));
      suppressClickRef.current = true;
    }
  }

  return (
    <div className={styles.handArea}>
      <div className={styles.handRow} ref={handRef} role="group" aria-label="Your hand">
        {order.map((key) => {
          const card = cardsByKey.get(key);
          if (!card) return null;
          const isSelected = selected.has(key);
          return (
            <div
              key={key}
              ref={(el) => {
                if (el) cardRefs.current.set(key, el); else cardRefs.current.delete(key);
              }}
              className={`${styles.cardSlot} ${dragKey === key ? styles.dragging : ''}`}
              data-card-key={key}
              data-selected={isSelected}
              onPointerDown={(event) => handlePointerDown(key, event)}
              onPointerMove={handlePointerMove}
              onPointerUp={endDrag}
              onPointerCancel={cancelDrag}
              onClick={() => toggleSelected(key)}
            >
              <div className={`${styles.lift} ${isSelected ? styles.selected : ''}`}>
                {/* The player's own held cards draw the center suit pip too (round-4 follow-up: without
                 *  it, larger/less-crowded held cards read as visually "barren"), unlike the smaller,
                 *  more-crowded center hand-to-beat which stays corner-only (Card.tsx). */}
                <PlayingCard card={card} showCenterPip />
              </div>
            </div>
          );
        })}
      </div>
      <div className={styles.sortControls}>
        <button type="button" className={styles.sortButton} onClick={() => setOrder(sortKeysByRank([...cardsByKey.values()]))}>
          Sort Rank
        </button>
        <button type="button" className={styles.sortButton} onClick={() => setOrder(sortKeysBySuit([...cardsByKey.values()]))}>
          Sort Suit
        </button>
      </div>
    </div>
  );
}
