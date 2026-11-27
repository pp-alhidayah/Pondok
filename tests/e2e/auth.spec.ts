import { expect, test, type Page } from '@playwright/test';

async function login(page: Page, username: string) {
  await page.goto('/login');
  await page.locator('#username').fill(username);
  await page.locator('#password').fill('admin123');
  await page.getByRole('button', { name: /^masuk$/i }).click();
  await expect(page, 'login gagal').toHaveURL(/\/dashboard/, { timeout: 15000 });
}

test('admin melihat menu transaksi dan tombol tambah', async ({ page }) => {
  await login(page, 'admin1');
  await expect(page.getByText('Data Santri', { exact: true }).first()).toBeVisible();
  await page.goto('/santri');
  await expect(page.getByRole('button', { name: /tambah santri/i })).toBeVisible();
  await expect(page.getByText('Riwayat Aktivitas')).toBeVisible();
});

test('pemilik bersifat read-only', async ({ page }) => {
  await login(page, 'pengasuh');
  await page.goto('/santri');
  await expect(page.getByRole('button', { name: /tambah santri/i })).toHaveCount(0);
  await expect(page.getByText('Riwayat Aktivitas')).toHaveCount(0);
});
