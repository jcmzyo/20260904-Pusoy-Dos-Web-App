import { expect, test } from '@playwright/test';

test('Start Game opens the production Session table', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  const response = await page.goto('/');
  expect(response?.ok()).toBe(true);
  await expect(page).toHaveTitle('Pusoy Dos');
  await expect(page.getByRole('heading', { name: 'Pusoy Dos', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Start Game', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Game Table' })).toBeVisible();
  await expect(page.getByText('Basic · Round 1 of 5', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'You panel' })).toBeVisible();
  await expect(page.getByRole('region', { name: /^(West|North|East) panel$/ })).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Check Discard Pile', exact: true })).toBeVisible();
  await expect(page.getByText('OPENING · 3♣ required', { exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(errors).toEqual([]);
});
