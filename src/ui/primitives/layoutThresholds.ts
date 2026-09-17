/**
 * Frozen M4-T04 responsive thresholds (ui-ux.md's viewport/readability/touch-target acceptance
 * gates). This is the single canonical source: production code (`useLayoutSupport.ts`) and the
 * Playwright QA matrix (`tests/browser/viewportMatrix.ts`) both import from here, rather than
 * either depending on the other - the production/`src` -> `tests` direction that used to exist
 * was the wrong way around for code the app actually ships.
 */

/** Below this width, a landscape viewport is too narrow for the M4 table layout (ui-ux.md §14). */
export const MINIMUM_SUPPORTED_LANDSCAPE_WIDTH_PX = 667;

/** Below this height, a landscape viewport is too short for the M4 table layout (ui-ux.md §14). */
export const MINIMUM_SUPPORTED_LANDSCAPE_HEIGHT_PX = 375;

/** Smallest body/label text size the M4 acceptance gate treats as readable. */
export const MINIMUM_READABLE_TEXT_SIZE_PX = 14;

/** Smallest interactive control size the M4 acceptance gate treats as reliably tappable. */
export const MINIMUM_TOUCH_TARGET_SIZE_PX = 44;

/** Smallest exposed (non-overlapped) width an overlapping hand card must keep to stay targetable. */
export const MINIMUM_EXPOSED_CARD_WIDTH_PX = 28;
