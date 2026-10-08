import { test, expect } from '@playwright/test';
// These are explicit UI fixtures. Backend correctness is tested by Supertest against PostgreSQL.
const date = new Date().toISOString();
const apps = ['Linear', 'Notion', 'Figma', 'Stripe', 'Vercel', 'Airbnb'].map((company, i) => ({
  id: `00000000-0000-4000-8000-00000000000${i}`,
  jobId: `10000000-0000-4000-8000-00000000000${i}`,
  resumeId: null,
  status: ['INTERVIEW', 'APPLIED', 'WISHLIST', 'OFFER', 'APPLIED', 'REJECTED'][i],
  position: i,
  notes: '',
  appliedAt: i === 2 ? null : date,
  createdAt: date,
  updatedAt: date,
  score: null,
  job: {
    id: `10000000-0000-4000-8000-00000000000${i}`,
    company,
    title: [
      'Product Designer',
      'Frontend Engineer',
      'Design Engineer',
      'Software Engineer',
      'Developer Experience Engineer',
      'Senior Product Designer',
    ][i],
    location: 'Remote',
    description: 'A sample role for UI testing.',
    salaryText: '$140k – $180k',
    url: '',
    createdAt: date,
  },
}));
test('dashboard, board, dialogs, and mobile layout', async ({ page, context }) => {
  const browserErrors: string[] = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
  await context.addCookies([
    { name: 'access_token', value: 'ui-test-only', domain: 'localhost', path: '/' },
  ]);
  await page.route('http://localhost:4000/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.includes('socket.io')) return route.abort();
    const payload =
      path === '/api/auth/me'
        ? {
            id: 'test-user',
            name: 'Alex Morgan',
            email: 'alex@example.com',
            role: 'USER',
            plan: 'FREE',
          }
        : path === '/api/applications'
          ? apps
          : path === '/api/stats/me'
            ? {
                total: 6,
                counts: { WISHLIST: 1, APPLIED: 2, INTERVIEW: 1, OFFER: 1, REJECTED: 1 },
                responseRate: 60,
                weeks: Array.from({ length: 8 }, (_, i) => ({
                  week: new Date(Date.now() - (7 - i) * 7 * 86400000).toISOString().slice(0, 10),
                  applications: [2, 1, 3, 2, 5, 3, 4, 6][i],
                })),
              }
            : path === '/api/jobs'
              ? { items: apps.map((a) => a.job), total: 6, pageSize: 20 }
              : path === '/api/billing'
                ? { plan: 'FREE', used: 0, limit: 10, configured: false }
                : [];
    await route.fulfill({
      json: payload,
      headers: {
        'Access-Control-Allow-Origin': 'http://localhost:3000',
        'Access-Control-Allow-Credentials': 'true',
      },
    });
  });
  await page.goto('/app');
  await expect(page.getByRole('heading', { name: 'Let’s make moves, Alex.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Recent applications' })).toBeVisible();
  await page.screenshot({ path: 'test-results/dashboard-desktop.png', fullPage: true });
  await page.getByRole('link', { name: 'Application board', exact: true }).click();
  await page.getByRole('button', { name: 'Product Designer', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'AI match', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Analyze my match' })).toBeDisabled();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/app');
  await expect(page.getByRole('heading', { name: 'Let’s make moves, Alex.' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await page.screenshot({ path: 'test-results/dashboard-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('link', { name: 'My CVs', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your CV collection' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  expect(browserErrors).toEqual([]);
});
