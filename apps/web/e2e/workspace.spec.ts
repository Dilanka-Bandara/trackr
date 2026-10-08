import { test, expect } from '@playwright/test';
function resumePdf() {
  const stream =
    'BT /F1 12 Tf 50 740 Td (Test Candidate - Software Engineer) Tj 0 -20 Td (Experience: React, TypeScript, PostgreSQL and accessible web applications.) Tj ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const [i, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${object}\nendobj\n`;
  }
  const start = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((o) => `${String(o).padStart(10, '0')} 00000 n \n`)
    .join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
  return Buffer.from(pdf);
}
test('public pages work on desktop and a 375px screen', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Your next chapter/, level: 1 })).toBeVisible();
  await page.screenshot({ path: 'test-results/landing-desktop.png', fullPage: true });
  await page.getByRole('link', { name: 'Start your next chapter' }).click();
  await expect(page.getByRole('heading', { name: 'A fresh start starts here.' })).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/login-mobile.png', fullPage: true });
});
test('register, save a job, change stage, and revisit dashboard', async ({ page }) => {
  test.skip(
    !process.env.E2E_LIVE,
    'Requires a running API, PostgreSQL, Redis, and migrated database',
  );
  await page.goto('/register');
  await page.getByLabel('Full name').fill('Test Candidate');
  await page.getByLabel('Email address').fill(`e2e-${Date.now()}@example.com`);
  await page.getByLabel('Password', { exact: true }).fill('SecurePassword123!');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page).toHaveURL('/app');
  await page.getByRole('link', { name: 'Add application', exact: true }).click();
  await page.getByLabel('Company *', { exact: true }).fill('Test Company');
  await page.getByLabel('Job title *', { exact: true }).fill('Software Engineer');
  await page.getByRole('button', { name: 'Save opportunity', exact: true }).click();
  await page.getByRole('link', { name: 'Application board', exact: true }).click();
  await page.getByRole('button', { name: 'Software Engineer', exact: true }).click();
  await page.getByLabel('Application stage', { exact: true }).selectOption('INTERVIEW');
  await page.getByLabel('Your notes').fill('Follow up next week');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.reload();
  await expect(
    page
      .locator('.kanban-column')
      .filter({ has: page.getByRole('heading', { name: 'Interview', exact: true }) })
      .getByRole('button', { name: 'Software Engineer' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'My CVs', exact: true }).click();
  await page
    .getByLabel('Upload CV', { exact: true })
    .setInputFiles({ name: 'resume.pdf', mimeType: 'application/pdf', buffer: resumePdf() });
  await expect(page.getByText('Ready to use', { exact: true })).toBeVisible({ timeout: 45000 });
  await page.getByRole('link', { name: 'Application board', exact: true }).click();
  await page.getByRole('button', { name: 'Software Engineer', exact: true }).click();
  await page.getByLabel('Your CV', { exact: true }).selectOption({ label: 'resume.pdf' });
  await page.getByRole('button', { name: 'AI match', exact: true }).click();
  await page.getByRole('button', { name: 'Analyze my match' }).click();
  await expect(page.getByText('Your strengths', { exact: true })).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: 'Cover letter', exact: true }).click();
  await page.getByRole('button', { name: 'Draft cover letter' }).click();
  await expect(page.getByRole('button', { name: 'Copy letter' })).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('link', { name: 'Overview', exact: true }).click();
  await expect(
    page.locator('.stat-card').filter({ hasText: 'In interviews' }).locator('.stat-value'),
  ).toHaveText('1');
});
