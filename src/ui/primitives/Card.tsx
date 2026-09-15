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
}

/**
 * A face-up card: off-white face, four-color suit, constant aspect ratio.
 * Rendered entirely from CSS/text; no raster 52-card image asset is required.
 */
export function PlayingCard({ card, widthPx }: PlayingCardProps) {
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
      <span className={styles.pip} aria-hidden="true">{visual.symbol}</span>
      <span className={`${styles.corner} ${styles.cornerBottom}`} aria-hidden="true">
        <span>{card.rank}</span>
        <span className={styles.cornerSuit}>{visual.symbol}</span>
      </span>
    </div>
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
