import { expect, test, type Page } from '@playwright/test';

async function login(page: Page) {
  await page.goto('/login');
  await page.locator('#username').fill('admin1');
  await page.locator('#password').fill('admin123');
  await page.getByRole('button', { name: /^masuk$/i }).click();
  await expect(page, 'login gagal').toHaveURL(/\/dashboard/, { timeout: 15000 });
}

test('validasi form santri menampilkan error dan fokus ke field pertama', async ({ page }) => {
  await login(page);
  await page.goto('/santri');
  await page.getByRole('button', { name: /tambah santri/i }).click();

  // Isi semua field wajib kecuali nama agar error pertama jelas di #nama.
  await page.locator('#nis').fill('9990001');
  await page.locator('#namaWali').fill('Wali Uji');
  await page.locator('#noHpSantri').fill('081234567890');
  await page.locator('#noHpWali').fill('081234567891');
  await page.locator('#nama').fill('');

  await page.getByRole('button', { name: /simpan/i }).click();

  await expect(page.getByText(/nama santri wajib diisi/i)).toBeVisible();
  await expect(page.locator('#nama')).toBeFocused();
});
