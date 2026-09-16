import { expect, test } from '@playwright/test';

test('production build exposes an installable offline PWA shell', async ({ page }) => {
  await page.goto('./');
  await expect(page).toHaveTitle(/Media Journal/i);

  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(manifestHref).toBeTruthy();

  const manifestResponse = await page.request.get(manifestHref!);
  expect(manifestResponse.ok()).toBe(true);
  const manifest = (await manifestResponse.json()) as {
    name?: string;
    display?: string;
    icons?: unknown[];
  };
  expect(manifest.name).toBe('Media Journal');
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons?.length).toBeGreaterThanOrEqual(2);

  await expect
    .poll(() =>
      page.evaluate(async () => {
        if (!('serviceWorker' in navigator)) return false;
        const registration = await navigator.serviceWorker.ready;
        return Boolean(registration.active);
      }),
    )
    .toBe(true);

  await page.context().setOffline(true);
  await page.reload();
  await expect(page.getByText('Media Journal', { exact: true }).first()).toBeVisible();
});
