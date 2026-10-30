import { test, expect } from '@playwright/test';

test('account settings save a profile and validate password confirmation on mobile', async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await context.addCookies([
    { name: 'access_token', value: 'fixture-only', domain: 'localhost', path: '/' },
  ]);
  let name = 'Alex Morgan';
  let passwordCalls = 0;
  await page.route('http://localhost:4000/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.includes('socket.io')) return route.abort();
    const headers = {
      'Access-Control-Allow-Origin': 'http://localhost:3000',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers': 'content-type,x-csrf-token',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
    };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (path === '/api/auth/profile') name = route.request().postDataJSON().name.trim();
    if (path === '/api/auth/password') passwordCalls++;
    const json = ['/api/auth/me', '/api/auth/profile'].includes(path)
      ? { id: 'settings-user', name, email: 'alex@example.com', role: 'USER', plan: 'FREE' }
      : path === '/api/auth/csrf'
        ? { token: 'fixture-csrf' }
        : [];
    await route.fulfill({ json, headers });
  });
  await page.goto('/app/settings');
  await expect(page.getByRole('heading', { name: 'Account settings' })).toBeVisible();
  await page.getByLabel('Full name', { exact: true }).fill('Alex Updated');
  await page.getByRole('button', { name: 'Save profile' }).click();
  await expect(page.getByRole('status')).toHaveText('Your profile has been saved.');
  await page.reload();
  await expect(page.getByLabel('Full name', { exact: true })).toHaveValue('Alex Updated');
  await page.screenshot({ path: 'test-results/settings-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByLabel('Current password', { exact: true }).fill('Before123!');
  await page.getByLabel('New password', { exact: true }).fill('After123!');
  await page.getByLabel('Confirm new password', { exact: true }).fill('Different123!');
  await page.getByRole('button', { name: 'Change password', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Change password' }).getByRole('alert')).toHaveText(
    'New passwords do not match.',
  );
  expect(passwordCalls).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await page.screenshot({ path: 'test-results/settings-mobile.png', fullPage: true });
  await page.getByLabel('Confirm new password', { exact: true }).fill('After123!');
  await page.getByRole('button', { name: 'Change password', exact: true }).click();
  await expect(page).toHaveURL(/\/login\?passwordChanged=1/);
  await expect(page.getByRole('status')).toHaveText(
    'Password changed. Sign in with your new password.',
  );
  expect(passwordCalls).toBe(1);
  expect(errors).toEqual([]);
});
