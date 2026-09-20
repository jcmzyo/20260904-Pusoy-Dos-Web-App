/**
 * Frozen M4-T04 responsive thresholds (ui-ux.md's viewport/readability/touch-target acceptance
 * gates). This is the single canonical source: production code (`useLayoutSupport.ts`) and the
 * Playwright QA matrix (`tests/browser/viewportMatrix.ts`) both import from here, rather than
 * either depending on the other - the production/`src` -> `tests` direction that used to exist
 * was the wrong way around for code the app actually ships.
 */

/** Below this width, a landscape viewport is too narrow for the M4 table layout (ui-ux.md §14). Raised
 *  from 667 (M4-T14 decision): the 667x375 phone cannot be shown at any usable scale. */
export const MINIMUM_SUPPORTED_LANDSCAPE_WIDTH_PX = 844;

/** Below this height, a landscape viewport is too short for the M4 table layout (ui-ux.md §14). Raised
 *  from 375 with the width above (M4-T14 decision). */
export const MINIMUM_SUPPORTED_LANDSCAPE_HEIGHT_PX = 390;

/** The smallest viewport at which the play area renders at scale 1 or larger (its own design size,
 *  `playAreaScale.ts`; a Vitest check pins the two together). From here up (M4-T14 "two tiers"),
 *  `MINIMUM_READABLE_TEXT_SIZE_PX` and `MINIMUM_TOUCH_TARGET_SIZE_PX` below hold literally for everything
 *  rendered. Below it - the phone tier, down to the supported minimum above - the play area is scaled
 *  down to fit, so those two constants are exempt there (the exposed-card constant still applies). */
export const FULL_SCALE_LANDSCAPE_WIDTH_PX = 896;
export const FULL_SCALE_LANDSCAPE_HEIGHT_PX = 656;

/** Smallest body/label text size the M4 acceptance gate treats as readable. */
export const MINIMUM_READABLE_TEXT_SIZE_PX = 14;

/** Smallest interactive control size the M4 acceptance gate treats as reliably tappable. */
export const MINIMUM_TOUCH_TARGET_SIZE_PX = 44;

/** Smallest exposed (non-overlapped) width an overlapping hand card must keep to stay targetable. */
export const MINIMUM_EXPOSED_CARD_WIDTH_PX = 28;
