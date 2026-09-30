import { expect, test } from '@playwright/test';

test('mobile statistics explores release years across types and keeps settings accessible', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.addInitScript(() =>
    localStorage.setItem('mediaJournalAnalyticsConsent', 'denied'),
  );
  await page.goto('./');
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
  await page.evaluate(async () => {
    const request = indexedDB.open('MediaJournalDatabase');
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction(
      ['mediaEntries', 'appSettings'],
      'readwrite',
    );
    transaction
      .objectStore('appSettings')
      .put({ key: 'hasCompletedGuidedTour', value: true });
    const entries = transaction.objectStore('mediaEntries');
    const completedYear = new Date().getFullYear();
    for (const [id, title, mediaType, metadata] of [
      ['film-year', 'Example film', 'film', { releaseDate: '2001-04-05' }],
      ['book-year', 'Example book', 'book', { releaseYear: 2001 }],
      ['unknown-year', 'Unknown release', 'film', {}],
    ] as const) {
      entries.put({
        id,
        title,
        mediaType,
        metadata,
        status: 'completed',
        completedDate: `${completedYear}-01-02`,
        completedYear,
        rating: 8,
        repeatConsumption: false,
        tags: [],
        genres: [],
        watchedWith: [],
        recommendedBy: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  });
  await page.reload();
  await page.getByRole('button', { name: 'Statistics', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Media Journal', exact: true }),
  ).toHaveCount(0);
  const score = page.locator('[data-tour-target="stats-subscription-score"]');
  const value = page.locator('[data-tour-target="stats-subscription-value"]');
  await expect(score).toBeVisible();
  await expect(value).toBeVisible();
  const scoreBounds = await score.boundingBox();
  const valueBounds = await value.boundingBox();
  expect(scoreBounds!.y).toBe(valueBounds!.y);
  expect(scoreBounds!.x).toBeLessThan(valueBounds!.x);
  await page.getByRole('button', { name: /^Years/ }).click();
  await page.getByRole('button', { name: '2001 2 entries', exact: true }).click();
  await expect(page.getByRole('button', { name: /Example film/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Example book/ })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Unknown 1 entry', exact: true }),
  ).toBeVisible();
  const overflow = await page.evaluate(() => ({
    width: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    elements: [...document.querySelectorAll('*')]
      .filter((el) => el.getBoundingClientRect().right > window.innerWidth)
      .map((el) => ({
        tag: el.tagName,
        text: el.textContent?.slice(0, 80),
        width: el.getBoundingClientRect().width,
      })),
  }));
  expect(overflow.scrollWidth, JSON.stringify(overflow)).toBeLessThanOrEqual(
    overflow.width,
  );
  await page.screenshot({ path: '/tmp/mj-stats-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Settings', exact: true }),
  ).toBeVisible();
});
