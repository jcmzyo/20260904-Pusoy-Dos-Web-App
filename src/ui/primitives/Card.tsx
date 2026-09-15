import type { CSSProperties } from 'react';
import type { Card as CardValue } from '../../domain';
import styles from './Card.module.css';

interface SuitVisual {
  readonly symbol: string;
  readonly label: string;
  /** Typed `string | undefined` only because the ambient `*.module.css` declaration (vite/client)
   *  types class lookups as an index signature under `noUncheckedIndexedAccess`; every suit class
   *  is always defined in Card.module.css. Used solely in a className template, so this is safe. */
  readonly colorClass: string | undefined;
}

/** Four-color suit visuals per ui-ux.md §15: Hearts red, Diamonds orange, Clubs blue, Spades black. */
const SUIT_VISUALS: Record<CardValue['suit'], SuitVisual> = {
  clubs: { symbol: '♣', label: 'Clubs', colorClass: styles.clubs },
  spades: { symbol: '♠', label: 'Spades', colorClass: styles.spades },
  hearts: { symbol: '♥', label: 'Hearts', colorClass: styles.hearts },
  diamonds: { symbol: '♦', label: 'Diamonds', colorClass: styles.diamonds },
};

function widthStyle(widthPx: number | undefined): CSSProperties | undefined {
  return widthPx !== undefined ? { width: widthPx } : undefined;
}

export interface PlayingCardProps {
  readonly card: CardValue;
  /** Overrides the default responsive width. Height follows automatically via the fixed aspect ratio. */
  readonly widthPx?: number;
  /**
   * Also draws a large center suit symbol, in addition to the two corner indices. Round 3 removed the
   * center pip everywhere because it collided with the corners at the smaller/more-crowded widths used
   * around the table (the center hand-to-beat); the person's own round-4 follow-up reported the human's
   * own held hand — larger, less crowded cards — now looks "barren" without it, so this restores it
   * there specifically. Defaults to `false` so every other existing caller (center hand-to-beat) keeps
   * the corner-only look that fixed its own readability bug.
   */
  readonly showCenterPip?: boolean;
}

/**
 * A face-up card: off-white face, four-color suit, constant aspect ratio.
 * Rendered entirely from CSS/text; no raster 52-card image asset is required.
 *
 * Always draws the two corner indices; `showCenterPip` additionally draws a large center suit symbol
 * for contexts with room to spare (ui-ux.md §5.2 amendment, round 4).
 */
export function PlayingCard({ card, widthPx, showCenterPip = false }: PlayingCardProps) {
  const visual = SUIT_VISUALS[card.suit];
  return (
    <div
      className={`${styles.card} ${styles.face} ${visual.colorClass}`}
      style={widthStyle(widthPx)}
      role="img"
      aria-label={`${card.rank} of ${visual.label}`}
    >
      <span className={styles.corner} aria-hidden="true">
        <span>{card.rank}</span>
        <span className={styles.cornerSuit}>{visual.symbol}</span>
      </span>
      {showCenterPip && <span className={styles.pip} aria-hidden="true">{visual.symbol}</span>}
      <span className={`${styles.corner} ${styles.cornerBottom}`} aria-hidden="true">
        <span>{card.rank}</span>
        <span className={styles.cornerSuit}>{visual.symbol}</span>
      </span>
    </div>
  );
}

export interface CardIndexProps {
  readonly card: CardValue;
}

/**
 * A compact "corner index" badge: just rank + suit (no full card face/border/pip), reusing the same
 * four-color suit convention as `PlayingCard`. A full-size `PlayingCard` scaled down to fit a seat's
 * own Play trail (ui-ux.md §5.4) reads as illegibly "shrunk"; this is sized for that compact context
 * instead, mirroring the corner index already drawn on `PlayingCard` itself.
 */
export function CardIndex({ card }: CardIndexProps) {
  const visual = SUIT_VISUALS[card.suit];
  return (
    <span className={`${styles.index} ${visual.colorClass}`} role="img" aria-label={`${card.rank} of ${visual.label}`}>
      <span>{card.rank}</span>
      <span className={styles.indexSuit}>{visual.symbol}</span>
    </span>
  );
}

export interface CardBackProps {
  /** Overrides the default responsive width. Height follows automatically via the fixed aspect ratio. */
  readonly widthPx?: number;
}

/**
 * A face-down card. Exposes no rank/suit information, per ui-ux.md §4
 * ("The UI never reveals bot card faces during active play"). CSS/SVG
 * pattern only; no raster 52-card image asset is required.
 */
export function CardBack({ widthPx }: CardBackProps) {
  return (
    <div
      className={`${styles.card} ${styles.back}`}
      style={widthStyle(widthPx)}
      role="img"
      aria-label="Face-down card"
    >
      <svg className={styles.backPattern} viewBox="0 0 40 56" preserveAspectRatio="none" aria-hidden="true">
        <path d="M20 4 L36 28 L20 52 L4 28 Z" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M20 14 L28 28 L20 42 L12 28 Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </div>
  );
}
