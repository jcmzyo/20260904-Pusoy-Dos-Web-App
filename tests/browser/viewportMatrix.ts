/**
 * Frozen M4-T04 responsive viewport matrix and minimum sizing constraints.
 *
 * These CSS-pixel dimensions and minimums are the shared QA contract reused by
 * later M4 tasks (T05-T14) and by `viewport-matrix.e2e.ts`. See
 * `md files/m4-playable-ui-task-breakdown.md` M4-T04 and `md files/ui-ux.md` §14.
 */

export type ViewportCategory =
  | 'supported'
  | 'unsupported-portrait'
  | 'unsupported-undersized';

export interface ViewportSpec {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly category: ViewportCategory;
}

export const VIEWPORT_MATRIX: readonly ViewportSpec[] = [
  { name: 'large-desktop', width: 1920, height: 1080, category: 'supported' },
  { name: 'laptop', width: 1440, height: 900, category: 'supported' },
  { name: 'windowed-desktop', width: 1280, height: 800, category: 'supported' },
  { name: 'tablet-landscape', width: 1024, height: 768, category: 'supported' },
  { name: 'large-phone-landscape', width: 844, height: 390, category: 'supported' },
  { name: 'small-phone-landscape', width: 667, height: 375, category: 'supported' },
  { name: 'portrait-unsupported', width: 390, height: 844, category: 'unsupported-portrait' },
  { name: 'undersized-landscape', width: 560, height: 320, category: 'unsupported-undersized' },
];

/** Below this width or height, a landscape viewport must show resize/unsupported guidance (M4-T11). */
export const MINIMUM_SUPPORTED_LANDSCAPE_WIDTH_PX = 667;
export const MINIMUM_SUPPORTED_LANDSCAPE_HEIGHT_PX = 375;

/** Minimum core body/control text size for bounded readable typography (ui-ux.md §14). */
export const MINIMUM_READABLE_TEXT_SIZE_PX = 14;

/** Minimum usable critical control/touch target size (ui-ux.md §14). */
export const MINIMUM_TOUCH_TARGET_SIZE_PX = 44;

/** Minimum exposed card width for reliable click/tap targeting in an overlapped hand (ui-ux.md §6). */
export const MINIMUM_EXPOSED_CARD_WIDTH_PX = 28;
