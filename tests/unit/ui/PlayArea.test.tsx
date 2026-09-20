// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PlayArea } from '../../../src/ui/primitives/PlayArea';
import {
  PLAY_AREA_DESIGN_HEIGHT_PX,
  PLAY_AREA_DESIGN_WIDTH_PX,
  computePlayAreaLayout,
  computePlayAreaScale,
} from '../../../src/ui/primitives/playAreaScale';

const originalWidth = window.innerWidth;
const originalHeight = window.innerHeight;

function resizeViewport(width: number, height: number, eventName: 'resize' | 'orientationchange' = 'resize') {
  window.innerWidth = width;
  window.innerHeight = height;
  act(() => {
    window.dispatchEvent(new Event(eventName));
  });
}

function playAreaElement(): HTMLElement {
  return screen.getByText('table').closest('[data-play-area-scale]') as HTMLElement;
}

beforeEach(() => {
  window.innerWidth = 1280;
  window.innerHeight = 800;
});

afterEach(() => {
  cleanup();
  window.innerWidth = originalWidth;
  window.innerHeight = originalHeight;
});

describe('PlayArea (M4-T14; ui-ux.md §14)', () => {
  it('lays its children out at natural size in the whole window when the window is comfortably large', () => {
    render(<PlayArea><p>table</p></PlayArea>);
    const area = playAreaElement();
    expect(Number(area.dataset.playAreaScale)).toBe(1);
    expect(area.style.width).toBe('1280px');
    expect(area.style.height).toBe('800px');
    expect(area.style.transform).toBe('scale(1)');
  });

  it('lays its children out in a design-size-or-larger area and scales it uniformly from the top-left on a small window', () => {
    window.innerWidth = 844;
    window.innerHeight = 390;
    render(<PlayArea><p>table</p></PlayArea>);
    const area = playAreaElement();
    const layout = computePlayAreaLayout(844, 390);
    expect(layout.scale).toBeLessThan(1);
    expect(Number(area.dataset.playAreaScale)).toBeCloseTo(layout.scale, 10);
    expect(parseFloat(area.style.width)).toBeCloseTo(layout.width, 6);
    expect(parseFloat(area.style.height)).toBeCloseTo(layout.height, 6);
    expect(parseFloat(area.style.width)).toBeGreaterThanOrEqual(PLAY_AREA_DESIGN_WIDTH_PX);
    expect(parseFloat(area.style.height)).toBeGreaterThanOrEqual(PLAY_AREA_DESIGN_HEIGHT_PX);
    expect(area.style.transform).toBe(`scale(${layout.scale})`);
  });

  it('exposes its scale to CSS as --play-area-scale', () => {
    window.innerWidth = 844;
    window.innerHeight = 390;
    render(<PlayArea><p>table</p></PlayArea>);
    expect(Number(playAreaElement().style.getPropertyValue('--play-area-scale'))).toBeCloseTo(computePlayAreaScale(844, 390), 10);
  });

  it('sizes its outer frame to the scaled footprint, so page layout sees the real (scaled) extent', () => {
    window.innerWidth = 844;
    window.innerHeight = 390;
    render(<PlayArea><p>table</p></PlayArea>);
    const frame = playAreaElement().parentElement as HTMLElement;
    expect(parseFloat(frame.style.width)).toBeCloseTo(844, 6);
    expect(parseFloat(frame.style.height)).toBeCloseTo(390, 6);
  });

  it('re-fits when the window resizes or the device rotates, without remounting its children', () => {
    render(<PlayArea><p>table</p></PlayArea>);
    const child = screen.getByText('table');
    resizeViewport(667, 375);
    expect(Number(playAreaElement().dataset.playAreaScale)).toBeCloseTo(computePlayAreaScale(667, 375), 10);
    resizeViewport(1920, 375, 'orientationchange');
    expect(Number(playAreaElement().dataset.playAreaScale)).toBeCloseTo(computePlayAreaScale(1920, 375), 10);
    expect(screen.getByText('table')).toBe(child);
  });

  it('stops listening once unmounted', () => {
    const { unmount } = render(<PlayArea><p>table</p></PlayArea>);
    unmount();
    expect(() => resizeViewport(667, 375)).not.toThrow();
  });
});
