import { describe, expect, it } from 'vitest';
import {
  PLAY_AREA_COMFORT_HEIGHT_PX,
  PLAY_AREA_COMFORT_WIDTH_PX,
  PLAY_AREA_DESIGN_HEIGHT_PX,
  PLAY_AREA_DESIGN_WIDTH_PX,
  PLAY_AREA_MAX_SCALE,
  computePlayAreaLayout,
  computePlayAreaScale,
} from '../../../src/ui/primitives/playAreaScale';
import {
  FULL_SCALE_LANDSCAPE_HEIGHT_PX,
  FULL_SCALE_LANDSCAPE_WIDTH_PX,
  MINIMUM_EXPOSED_CARD_WIDTH_PX,
  MINIMUM_SUPPORTED_LANDSCAPE_HEIGHT_PX,
  MINIMUM_SUPPORTED_LANDSCAPE_WIDTH_PX,
} from '../../../src/ui/primitives/layoutThresholds';

describe('computePlayAreaScale (M4-T14; ui-ux.md §14)', () => {
  it('is exactly 1 when the viewport equals the design size', () => {
    expect(computePlayAreaScale(PLAY_AREA_DESIGN_WIDTH_PX, PLAY_AREA_DESIGN_HEIGHT_PX)).toBe(1);
  });

  it('is exactly 1 anywhere between the design size and the comfort size (the layout stretches instead of scaling)', () => {
    for (const [width, height] of [[1024, 768], [1280, 800], [PLAY_AREA_COMFORT_WIDTH_PX, PLAY_AREA_COMFORT_HEIGHT_PX], [PLAY_AREA_COMFORT_WIDTH_PX, PLAY_AREA_DESIGN_HEIGHT_PX]] as const) {
      expect(computePlayAreaScale(width, height), `${width}x${height}`).toBe(1);
    }
  });

  it('scales up only once the viewport is larger than the comfort size, keeping the laid-out area at that size', () => {
    expect(computePlayAreaScale(1920, 1080)).toBeCloseTo(1920 / PLAY_AREA_COMFORT_WIDTH_PX, 10);
    expect(computePlayAreaScale(1600, 1200)).toBeCloseTo(1200 / PLAY_AREA_COMFORT_HEIGHT_PX, 10);
  });

  it('is height-bound when the viewport is unusually short for its width', () => {
    // 1920x375: width alone would allow a much larger scale; height allows only 375 / design height.
    expect(computePlayAreaScale(1920, 375)).toBeCloseTo(375 / PLAY_AREA_DESIGN_HEIGHT_PX, 10);
  });

  it('is width-bound when the viewport is narrow for its height', () => {
    expect(computePlayAreaScale(700, 2000)).toBeCloseTo(700 / PLAY_AREA_DESIGN_WIDTH_PX, 10);
  });

  it('never scales up past the bounded-typography cap, however large the viewport', () => {
    expect(computePlayAreaScale(10_000, 10_000)).toBe(PLAY_AREA_MAX_SCALE);
    expect(computePlayAreaScale(PLAY_AREA_COMFORT_WIDTH_PX * PLAY_AREA_MAX_SCALE, PLAY_AREA_COMFORT_HEIGHT_PX * PLAY_AREA_MAX_SCALE)).toBe(PLAY_AREA_MAX_SCALE);
  });

  it('scaled design size never exceeds the viewport on either axis (no scrollbar) across a range of viewports', () => {
    for (const [width, height] of [[667, 375], [844, 390], [1024, 768], [1280, 800], [1440, 900], [1920, 1080], [700, 600], [1920, 375], [3840, 2160]] as const) {
      const scale = computePlayAreaScale(width, height);
      expect(PLAY_AREA_DESIGN_WIDTH_PX * scale, `${width}x${height} width`).toBeLessThanOrEqual(width + 1e-9);
      expect(PLAY_AREA_DESIGN_HEIGHT_PX * scale, `${width}x${height} height`).toBeLessThanOrEqual(height + 1e-9);
    }
  });

  it('is monotonic: a taller or wider viewport never yields a smaller scale', () => {
    let previous = 0;
    for (let height = 375; height <= 1200; height += 25) {
      const scale = computePlayAreaScale(1280, height);
      expect(scale).toBeGreaterThanOrEqual(previous);
      previous = scale;
    }
    previous = 0;
    for (let width = 667; width <= 2000; width += 25) {
      const scale = computePlayAreaScale(width, 800);
      expect(scale).toBeGreaterThanOrEqual(previous);
      previous = scale;
    }
  });

  it('renders at exactly scale 1 at the full-scale thresholds, which are the design size of the play area itself (M4-T14 two tiers)', () => {
    expect(FULL_SCALE_LANDSCAPE_WIDTH_PX).toBe(PLAY_AREA_DESIGN_WIDTH_PX);
    expect(FULL_SCALE_LANDSCAPE_HEIGHT_PX).toBe(PLAY_AREA_DESIGN_HEIGHT_PX);
    expect(computePlayAreaScale(FULL_SCALE_LANDSCAPE_WIDTH_PX, FULL_SCALE_LANDSCAPE_HEIGHT_PX)).toBe(1);
    // One pixel short on either axis drops below 1: that is the phone tier, exempt from the 14px/44px checks.
    expect(computePlayAreaScale(FULL_SCALE_LANDSCAPE_WIDTH_PX - 1, FULL_SCALE_LANDSCAPE_HEIGHT_PX)).toBeLessThan(1);
    expect(computePlayAreaScale(FULL_SCALE_LANDSCAPE_WIDTH_PX, FULL_SCALE_LANDSCAPE_HEIGHT_PX - 1)).toBeLessThan(1);
  });

  it('keeps the supported minimum at or below the full-scale tier, so the phone tier is a real (scaled-down) range', () => {
    expect(MINIMUM_SUPPORTED_LANDSCAPE_WIDTH_PX).toBeLessThanOrEqual(FULL_SCALE_LANDSCAPE_WIDTH_PX);
    expect(MINIMUM_SUPPORTED_LANDSCAPE_HEIGHT_PX).toBeLessThan(FULL_SCALE_LANDSCAPE_HEIGHT_PX);
  });

  it('keeps the play area positive-scaled at the frozen minimum supported landscape viewport', () => {
    const scale = computePlayAreaScale(MINIMUM_SUPPORTED_LANDSCAPE_WIDTH_PX, MINIMUM_SUPPORTED_LANDSCAPE_HEIGHT_PX);
    expect(scale).toBeGreaterThan(0);
    expect(scale).toBeLessThan(1);
    // HumanHand.module.css widens each card's exposed strip to MINIMUM_EXPOSED_CARD_WIDTH_PX / scale design
    // px whenever the area is scaled down that far (70% of the 60 design px card is otherwise the default).
    // That only works while the strip stays within one card's own width.
    expect(MINIMUM_EXPOSED_CARD_WIDTH_PX / scale).toBeLessThanOrEqual(60);
  });
});

describe('computePlayAreaLayout (M4-T14; ui-ux.md §14)', () => {
  const VIEWPORTS = [[844, 390], [896, 656], [1024, 768], [1280, 800], [1440, 900], [1920, 1080], [1920, 375], [900, 1200], [3840, 2160]] as const;

  it('lays the area out in design units that map exactly onto the viewport at the chosen scale', () => {
    for (const [width, height] of VIEWPORTS) {
      const layout = computePlayAreaLayout(width, height);
      expect(layout.scale, `${width}x${height}`).toBe(computePlayAreaScale(width, height));
      expect(layout.width * layout.scale, `${width}x${height} width`).toBeCloseTo(width, 6);
      expect(layout.height * layout.scale, `${width}x${height} height`).toBeCloseTo(height, 6);
    }
  });

  it('never lays the area out smaller than the design size, so the authored content always has room', () => {
    for (const [width, height] of VIEWPORTS) {
      const layout = computePlayAreaLayout(width, height);
      expect(layout.width, `${width}x${height} width`).toBeGreaterThanOrEqual(PLAY_AREA_DESIGN_WIDTH_PX - 1e-9);
      expect(layout.height, `${width}x${height} height`).toBeGreaterThanOrEqual(PLAY_AREA_DESIGN_HEIGHT_PX - 1e-9);
    }
  });

  it('stretches the area to the viewport at scale 1 (a desktop window gets more room, not bigger parts)', () => {
    expect(computePlayAreaLayout(1280, 800)).toEqual({ scale: 1, width: 1280, height: 800 });
  });
});
