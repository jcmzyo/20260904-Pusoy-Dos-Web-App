/**
 * Frozen M4-T04 responsive viewport matrix and minimum sizing constraints.
 *
 * These CSS-pixel dimensions and minimums are the shared QA contract reused by
 * later M4 tasks (T05-T14) and by `viewport-matrix.e2e.ts`. See
 * `md files/m4-playable-ui-task-breakdown.md` M4-T04 and `md files/ui-ux.md` §14.
 *
 * The minimum-sizing constants themselves live in `src/ui/primitives/layoutThresholds.ts` (M4-T11
 * follow-up) — production's `useLayoutSupport.ts` needs them too, and a `src` module importing from
 * `tests/` is the wrong direction for code that ships. This file re-exports them so every existing
 * `tests/browser/viewportMatrix` import keeps working unchanged.
 */
export {
  FULL_SCALE_LANDSCAPE_HEIGHT_PX,
  FULL_SCALE_LANDSCAPE_WIDTH_PX,
  MINIMUM_EXPOSED_CARD_WIDTH_PX,
  MINIMUM_READABLE_TEXT_SIZE_PX,
  MINIMUM_SUPPORTED_LANDSCAPE_HEIGHT_PX,
  MINIMUM_SUPPORTED_LANDSCAPE_WIDTH_PX,
  MINIMUM_TOUCH_TARGET_SIZE_PX,
} from '../../src/ui/primitives/layoutThresholds';

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
  // The minimum supported landscape viewport (M4-T14: raised from 667x375). Below FULL_SCALE_LANDSCAPE_*
  // the play area is scaled down, so the 14px/44px sizing constants are exempt on this phone tier.
  { name: 'large-phone-landscape', width: 844, height: 390, category: 'supported' },
  { name: 'portrait-unsupported', width: 390, height: 844, category: 'unsupported-portrait' },
  { name: 'undersized-landscape', width: 560, height: 320, category: 'unsupported-undersized' },
  // The former minimum supported viewport, unsupported since M4-T14 (kept so it is still checked).
  { name: 'small-phone-landscape', width: 667, height: 375, category: 'unsupported-undersized' },
];
