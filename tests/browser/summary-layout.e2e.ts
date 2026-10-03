import { expect, test } from '@playwright/test';
import { VIEWPORT_MATRIX } from './viewportMatrix';

for (const spec of VIEWPORT_MATRIX.filter((entry) => entry.category === 'supported')) {
  test(`Summary columns, caption, and actions fit at ${spec.name}`, async ({ page }) => {
    await page.setViewportSize({ width: spec.width, height: spec.height });
    await page.goto('/tests/browser/fixtures/portrait-dialogs.html?summary');
    const dialog = page.getByRole('dialog', { name: 'Session Summary', exact: true });
    await expect(dialog).toBeVisible();
    const geometry = await dialog.evaluate((element) => {
      const panel = element.getBoundingClientRect();
      const table = element.querySelectorAll('table')[1]!;
      const card = table.parentElement!.getBoundingClientRect();
      const caption = table.querySelector('caption')!.getBoundingClientRect();
      const columns = Array.from(table.querySelectorAll('th')).map((cell) => cell.getBoundingClientRect());
      const buttons = Array.from(element.querySelectorAll('button')).map((button) => {
        const box = button.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(button);
        const text = range.getBoundingClientRect();
        return { width: box.width, height: box.height, top: box.top, center: box.x + box.width / 2, textOffset: Math.abs(text.x + text.width / 2 - box.x - box.width / 2) };
      });
      return {
        fits: panel.top >= 0 && panel.bottom <= innerHeight && panel.left >= 0 && panel.right <= innerWidth,
        overflow: Array.from(element.querySelectorAll<HTMLElement>('*')).filter((node) => node.scrollWidth > node.clientWidth + 1).map((node) => node.className),
        captionOffset: Math.abs(caption.x + caption.width / 2 - card.x - card.width / 2),
        roundWidths: columns.slice(1, 6).map((box) => box.width),
        totalVisible: columns[6]!.right <= card.right,
        buttons,
        panelCenter: panel.x + panel.width / 2,
      };
    });
    expect(geometry.fits).toBe(true);
    expect(geometry.overflow).toEqual([]);
    expect(geometry.captionOffset).toBeLessThan(1);
    expect(geometry.totalVisible).toBe(true);
    for (const button of geometry.buttons) {
      expect(button.width).toBeGreaterThanOrEqual(44);
      expect(button.height).toBeGreaterThanOrEqual(44);
      expect(button.textOffset).toBeLessThan(1);
    }
    if (spec.orientation === 'portrait') {
      expect(Math.max(...geometry.roundWidths) - Math.min(...geometry.roundWidths)).toBeLessThan(1);
      expect(Math.min(...geometry.roundWidths)).toBeGreaterThanOrEqual(28);
      expect(Math.max(...geometry.buttons.map((button) => button.top)) - Math.min(...geometry.buttons.map((button) => button.top))).toBeLessThan(1);
      expect(Math.abs(geometry.buttons[1]!.center - geometry.panelCenter)).toBeLessThan(1);
      expect(Math.max(...geometry.buttons.map((button) => button.width)) - Math.min(...geometry.buttons.map((button) => button.width))).toBeLessThan(1);
    }
    if (spec.name === 'portrait-phone-minimum' || spec.name === 'portrait-phone-390') await page.screenshot({ path: test.info().outputPath('summary.png') });
  });
}
