import type { CSSProperties, ReactNode } from 'react';
import { usePlayAreaLayout } from './playAreaScale';
import styles from './PlayArea.module.css';

/**
 * Scales the whole play area (table plus bottom action bar) as one proportional unit so it always fits
 * inside the viewport without a scrollbar (ui-ux.md §14; M4-T14). Children are laid out in a fluid area
 * in design units (`playAreaScale.ts`: never smaller than the design size, otherwise as large as the
 * viewport allows) and the whole area is then uniformly scaled onto the viewport; the outer frame is
 * sized to the scaled result so the page's own layout (and its scroll extent) sees the real,
 * already-scaled footprint rather than the unscaled one.
 *
 * Full-viewport overlays must not be rendered inside this component: a `transform` makes its element the
 * containing block for `position: fixed` descendants, which would pin them to the scaled area instead of
 * the viewport.
 */
export function PlayArea({ children }: { readonly children: ReactNode }) {
  const { scale, width, height } = usePlayAreaLayout();
  return (
    <div
      className={styles.frame}
      style={{ width: width * scale, height: height * scale }}
    >
      <div
        className={styles.playArea}
        data-play-area-scale={scale}
        style={{ width, height, transform: `scale(${scale})`, '--play-area-scale': scale } as CSSProperties}
      >
        {children}
      </div>
    </div>
  );
}
