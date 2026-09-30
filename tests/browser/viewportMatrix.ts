/**
 * Frozen responsive viewport matrix and minimum sizing constraints: the M4-T04 landscape cases plus the
 * M5-T01 portrait, below-minimum, and guidance cases (M5-T02 carried them in).
 *
 * These CSS-pixel dimensions and minimums are the shared QA contract reused by later tasks and by
 * `viewport-matrix.e2e.ts`. See `md files/m4-playable-ui-task-breakdown.md` M4-T04, `md files/ui-ux.md`
 * §14 and §19.6, and `md files/testing-simulation.md` "Frozen M5 acceptance matrix".
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
  MINIMUM_SUPPORTED_PORTRAIT_HEIGHT_PX,
  MINIMUM_SUPPORTED_PORTRAIT_WIDTH_PX,
  MINIMUM_TABLET_PORTRAIT_WIDTH_PX,
  MINIMUM_TOUCH_TARGET_SIZE_PX,
} from '../../src/ui/primitives/layoutThresholds';
import {
  MINIMUM_SUPPORTED_LANDSCAPE_HEIGHT_PX,
  MINIMUM_SUPPORTED_LANDSCAPE_WIDTH_PX,
  MINIMUM_SUPPORTED_PORTRAIT_HEIGHT_PX,
  MINIMUM_SUPPORTED_PORTRAIT_WIDTH_PX,
  MINIMUM_TABLET_PORTRAIT_WIDTH_PX,
} from '../../src/ui/primitives/layoutThresholds';

/** `supported` cases are playable; `unsupported` cases show below-minimum guidance instead. */
export type ViewportCategory = 'supported' | 'unsupported';

/** Width > height is landscape; otherwise portrait (a square counts as portrait; ui-ux.md §19.6.2). */
export type ViewportOrientation = 'landscape' | 'portrait';

/** `fine` is Playwright's default desktop context; `coarse` is a `hasTouch` context (a phone/tablet). */
export type PointerKind = 'fine' | 'coarse';

export const ROTATE_GUIDANCE = 'Rotate your device to continue';
export const RESIZE_GUIDANCE = 'Resize your window to continue';
export const TOO_SMALL_GUIDANCE = 'This screen is too small to play';
export type GuidanceHeading = typeof ROTATE_GUIDANCE | typeof RESIZE_GUIDANCE | typeof TOO_SMALL_GUIDANCE;

export interface ViewportSpec {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly category: ViewportCategory;
  readonly orientation: ViewportOrientation;
  /** Supported portrait class (ui-ux.md §19.6.2); absent for landscape and unsupported cases. */
  readonly portraitClass?: 'phone' | 'tablet';
  /** Pointer contexts the frozen matrix exercises for this case. */
  readonly pointers: readonly PointerKind[];
  /** Expected guidance heading per exercised pointer; present exactly for `unsupported` cases. */
  readonly guidance?: Readonly<Partial<Record<PointerKind, GuidanceHeading>>>;
}

function supportedLandscape(name: string, width: number, height: number): ViewportSpec {
  return { name, width, height, category: 'supported', orientation: 'landscape', pointers: ['fine'] };
}

function supportedPortrait(name: string, width: number, height: number, pointers: readonly PointerKind[]): ViewportSpec {
  return {
    name, width, height, category: 'supported', orientation: 'portrait',
    portraitClass: width >= MINIMUM_TABLET_PORTRAIT_WIDTH_PX ? 'tablet' : 'phone', pointers,
  };
}

function unsupported(name: string, width: number, height: number, guidance: Readonly<Partial<Record<PointerKind, GuidanceHeading>>>): ViewportSpec {
  return {
    name, width, height, category: 'unsupported', orientation: width > height ? 'landscape' : 'portrait',
    pointers: Object.keys(guidance) as PointerKind[], guidance,
  };
}

export const VIEWPORT_MATRIX: readonly ViewportSpec[] = [
  // Supported landscape (M4-T04/T14, unchanged by M5).
  supportedLandscape('large-desktop', 1920, 1080),
  supportedLandscape('laptop', 1440, 900),
  supportedLandscape('windowed-desktop', 1280, 800),
  supportedLandscape('tablet-landscape', 1024, 768),
  // The minimum supported landscape viewport (M4-T14: raised from 667x375). Below FULL_SCALE_LANDSCAPE_*
  // the play area is scaled down, so the 14px/44px sizing constants are exempt on this phone tier.
  supportedLandscape('large-phone-landscape', 844, 390),

  // Supported portrait (M5-T01).
  supportedPortrait('portrait-phone-minimum', MINIMUM_SUPPORTED_PORTRAIT_WIDTH_PX, MINIMUM_SUPPORTED_PORTRAIT_HEIGHT_PX, ['coarse', 'fine']),
  supportedPortrait('portrait-phone-360', 360, 640, ['coarse']),
  supportedPortrait('portrait-phone-375', 375, 667, ['coarse']),
  supportedPortrait('portrait-phone-ios-toolbar', 390, 664, ['coarse']),
  // Was M4's `portrait-unsupported` entry.
  supportedPortrait('portrait-phone-390', 390, 844, ['coarse', 'fine']),
  supportedPortrait('portrait-phone-412', 412, 915, ['coarse']),
  supportedPortrait('portrait-phone-class-max', MINIMUM_TABLET_PORTRAIT_WIDTH_PX - 1, 960, ['coarse']),
  supportedPortrait('portrait-tablet-minimum', MINIMUM_TABLET_PORTRAIT_WIDTH_PX, 960, ['coarse']),
  supportedPortrait('portrait-tablet-768', 768, 1024, ['coarse', 'fine']),
  supportedPortrait('portrait-tablet-820', 820, 1180, ['coarse']),
  supportedPortrait('portrait-tablet-1024', 1024, 1366, ['coarse']),
  supportedPortrait('portrait-square', 700, 700, ['fine']),

  // Unsupported portrait (M5-T01).
  unsupported('portrait-below-min-width', MINIMUM_SUPPORTED_PORTRAIT_WIDTH_PX - 1, MINIMUM_SUPPORTED_PORTRAIT_HEIGHT_PX, { fine: RESIZE_GUIDANCE, coarse: TOO_SMALL_GUIDANCE }),
  unsupported('portrait-below-min-height', MINIMUM_SUPPORTED_PORTRAIT_WIDTH_PX, MINIMUM_SUPPORTED_PORTRAIT_HEIGHT_PX - 1, { coarse: TOO_SMALL_GUIDANCE }),
  unsupported('portrait-small-phone', 320, 568, { coarse: TOO_SMALL_GUIDANCE }),
  // iPhone SE-class Safari with its toolbars shown; its 553x375 landscape is unsupported too.
  unsupported('portrait-phone-se-toolbar', 375, 553, { coarse: TOO_SMALL_GUIDANCE }),

  // Unsupported landscape (M5-T01). The fine-pointer expectations on the last two are M4's retained
  // regressions (both were exercised in the default desktop context before M5).
  unsupported('landscape-below-min-width', MINIMUM_SUPPORTED_LANDSCAPE_WIDTH_PX - 1, MINIMUM_SUPPORTED_LANDSCAPE_HEIGHT_PX, { coarse: ROTATE_GUIDANCE, fine: RESIZE_GUIDANCE }),
  unsupported('landscape-below-min-height', MINIMUM_SUPPORTED_LANDSCAPE_WIDTH_PX, MINIMUM_SUPPORTED_LANDSCAPE_HEIGHT_PX - 1, { fine: RESIZE_GUIDANCE, coarse: ROTATE_GUIDANCE }),
  // The former minimum supported viewport, unsupported since M4-T14.
  unsupported('small-phone-landscape', 667, 375, { coarse: ROTATE_GUIDANCE, fine: RESIZE_GUIDANCE }),
  unsupported('undersized-landscape', 560, 320, { coarse: TOO_SMALL_GUIDANCE, fine: RESIZE_GUIDANCE }),
];

export const SUPPORTED_LANDSCAPE_VIEWPORTS: readonly ViewportSpec[] = VIEWPORT_MATRIX.filter((entry) => entry.category === 'supported' && entry.orientation === 'landscape');
export const SUPPORTED_PORTRAIT_VIEWPORTS: readonly ViewportSpec[] = VIEWPORT_MATRIX.filter((entry) => entry.category === 'supported' && entry.orientation === 'portrait');
export const UNSUPPORTED_VIEWPORTS: readonly ViewportSpec[] = VIEWPORT_MATRIX.filter((entry) => entry.category === 'unsupported');

export interface GuidanceCase {
  readonly spec: ViewportSpec;
  readonly pointer: PointerKind;
  readonly heading: GuidanceHeading;
}

/** Every (unsupported case, pointer) pair the frozen matrix exercises, with its expected heading. */
export function guidanceCases(pointer: PointerKind): readonly GuidanceCase[] {
  return UNSUPPORTED_VIEWPORTS.flatMap((spec) => {
    const heading = spec.guidance?.[pointer];
    return heading === undefined ? [] : [{ spec, pointer, heading }];
  });
}

export function findViewport(name: string): ViewportSpec {
  const spec = VIEWPORT_MATRIX.find((entry) => entry.name === name);
  if (!spec) throw new Error(`Viewport matrix has no entry named ${name}.`);
  return spec;
}
