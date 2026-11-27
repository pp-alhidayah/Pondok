import { expect, test, type Page } from '@playwright/test';

const TAHUN = new Date().getFullYear();
const JUMLAH = 12;

const santri = (i: number) => ({
  id: `k-${i}`,
  nis: `2026${String(i).padStart(3, '0')}`,
  nama: `Santri Keringanan ${String(i).padStart(2, '0')}`,
  nama_wali: 'Wali',
  no_hp_santri: '081234567890',
  no_hp_wali: '081234567891',
  kategori: 'Mukim',
  status: 'Aktif',
  tanggal_masuk: `${TAHUN}-01-01`,
  created_at: '',
  updated_at: '',
});

const waiver = (i: number) => ({
  id: `w-${i}`,
  santri_id: `k-${i}`,
  tahun: TAHUN,
  bulan_mulai: 1,
  bulan_selesai: 3,
  jenis: 'penuh',
  nominal_per_bulan: 0,
  snapshot: {},
  created_at: `${TAHUN}-01-01T00:00:00.000Z`,
});

async function login(page: Page) {
  await page.addInitScript(({ santriList, waivers }) => {
    localStorage.setItem('al_hidayah_storage_version', '2');
    localStorage.setItem('al_hidayah_mode', 'local');
    localStorage.setItem('al_hidayah_santri', JSON.stringify(santriList));
    localStorage.setItem('al_hidayah_syahriyah_waivers', JSON.stringify(waivers));
  }, {
    santriList: Array.from({ length: JUMLAH }, (_, idx) => santri(idx + 1)),
    waivers: Array.from({ length: JUMLAH }, (_, idx) => waiver(idx + 1)),
  });

  await page.goto('/login');
  await page.locator('#username').fill('admin1');
  await page.locator('#password').fill('admin123');
  await page.getByRole('button', { name: /^masuk$/i }).click();
  await expect(page, 'login gagal').toHaveURL(/\/dashboard/, { timeout: 15000 });
  await page.goto('/keringanan');
}

test('halaman keringanan memiliki pagination', async ({ page }) => {
  await login(page);

  const baris = page.locator('table tbody tr');
  await expect(baris).toHaveCount(10);
  await expect(page.getByText(/menampilkan 1-10 dari 12 keringanan/i)).toBeVisible();

  await page.getByRole('button', { name: /keringanan berikutnya/i }).click();
  await expect(baris).toHaveCount(2);
  await expect(page.getByText(/menampilkan 11-12 dari 12 keringanan/i)).toBeVisible();

  await page.getByRole('button', { name: /keringanan sebelumnya/i }).click();
  await expect(baris).toHaveCount(10);

  await page.locator('select').first().selectOption('25');
  await expect(baris).toHaveCount(12);
  await expect(page.getByText(/menampilkan 1-12 dari 12 keringanan/i)).toBeVisible();
});
