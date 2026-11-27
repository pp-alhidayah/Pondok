import { expect, test, type Page } from '@playwright/test';

const SANTRI_UJI = [
  {
    id: 'uji-1',
    nis: '9000001',
    nama: 'Santri Uji Satu',
    nama_wali: 'Wali Satu',
    no_hp_santri: '081234567801',
    no_hp_wali: '081234567802',
    kategori: 'Mukim',
    status: 'Aktif',
    tanggal_masuk: '2026-01-05',
    created_at: '2026-01-05T00:00:00.000Z',
    updated_at: '2026-01-05T00:00:00.000Z',
  },
  {
    id: 'uji-2',
    nis: '9000002',
    nama: 'Santri Uji Dua',
    nama_wali: 'Wali Dua',
    no_hp_santri: '081234567803',
    no_hp_wali: '081234567804',
    kategori: 'Nduduk',
    status: 'Aktif',
    tanggal_masuk: '2026-01-06',
    created_at: '2026-01-06T00:00:00.000Z',
    updated_at: '2026-01-06T00:00:00.000Z',
  },
  {
    id: 'uji-3',
    nis: '9000003',
    nama: 'Santri Uji Tiga',
    nama_wali: 'Wali Tiga',
    no_hp_santri: '081234567805',
    no_hp_wali: '081234567806',
    kategori: 'Mukim',
    status: 'Tidak Aktif',
    tanggal_masuk: '2026-01-07',
    created_at: '2026-01-07T00:00:00.000Z',
    updated_at: '2026-01-07T00:00:00.000Z',
  },
];

async function siapkan(page: Page, username: string) {
  await page.addInitScript(({ santri }) => {
    localStorage.setItem('al_hidayah_storage_version', '2');
    localStorage.setItem('al_hidayah_mode', 'local');
    localStorage.setItem('al_hidayah_santri', JSON.stringify(santri));
  }, { santri: SANTRI_UJI });

  await page.goto('/login');
  await page.locator('#username').fill(username);
  await page.locator('#password').fill('admin123');
  await page.getByRole('button', { name: /^masuk$/i }).click();
  await expect(page, 'login gagal').toHaveURL(/\/dashboard/, { timeout: 15000 });

  await page.goto('/laporan');
  await page.getByRole('navigation').getByRole('button', { name: 'Data Santri' }).click();
  await expect(page.getByRole('checkbox', { name: 'Pilih Santri Uji Satu' })).toBeVisible();
}

test('bulk action: pilih sebagian/semua, ekspor, dan hapus massal', async ({ page }) => {
  await siapkan(page, 'admin1');

  const barisPertama = page.getByRole('checkbox', { name: 'Pilih Santri Uji Satu' });
  await barisPertama.check();
  await expect(page.getByText('1 santri dipilih')).toBeVisible();

  await page.getByRole('button', { name: /^pilih semua$/i }).click();
  await expect(page.getByText('3 santri dipilih')).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Pilih Santri Uji Dua' })).toBeChecked();

  await page.getByRole('button', { name: /^batalkan semua$/i }).click();
  await expect(page.getByText('Belum ada santri dipilih')).toBeVisible();
  await expect(barisPertama).not.toBeChecked();

  await barisPertama.check();

  const unduhanFoto = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Foto + Data', exact: true }).click();
  expect((await unduhanFoto).suggestedFilename()).toMatch(/^Data-Santri-Terpilih-.*-Foto\.zip$/);

  const unduhanExcel = page.waitForEvent('download');
  await page.getByRole('button', { name: /^excel$/i }).click();
  expect((await unduhanExcel).suggestedFilename()).toMatch(/^Data-Santri-Terpilih-.*\.xlsx$/);

  await expect(page.getByRole('button', { name: /cetak kartu/i })).toHaveCount(0);

  await page.getByRole('button', { name: /hapus terpilih/i }).click();
  await expect(page.getByText(/yakin hapus 1 santri terpilih/i)).toBeVisible();
  await page.getByRole('button', { name: /^batal$/i }).click();
  await expect(page.getByText('1 santri dipilih')).toBeVisible();

  await page.getByRole('button', { name: /hapus terpilih/i }).click();
  await page.getByRole('button', { name: /ya, hapus/i }).click();
  await expect(page.getByRole('checkbox', { name: 'Pilih Santri Uji Satu' })).toHaveCount(0);
  await expect(page.getByText('2 santri tersisa').or(page.getByText('TOTAL (2 Santri)'))).toBeVisible();
});

test('pemilik tidak melihat tombol hapus massal', async ({ page }) => {
  await siapkan(page, 'pengasuh');

  await page.getByRole('checkbox', { name: 'Pilih Santri Uji Satu' }).check();
  await expect(page.getByText('1 santri dipilih')).toBeVisible();
  await expect(page.getByRole('button', { name: /hapus terpilih/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /cetak kartu/i })).toHaveCount(0);
});
