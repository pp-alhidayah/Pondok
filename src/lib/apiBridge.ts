import { storage } from './storage';
import { apiRequest, isApiMode, setCsrfToken } from './apiClient';
import { syncFromApi } from './apiCache';
import { authStore, type AuthUser } from '../store/authStore';
import { santriService } from './santriService';
import { kasService } from './kasService';
import { syahriyahService } from './syahriyahService';
import { kilatanService } from './kilatanService';
import { iuranPembayaranService } from './iuranPembayaranService';
import { pendaftaranService } from './pendaftaranService';
import { pengaturanService, masterIuranService } from './pengaturanService';
import { activityLogService } from './activityLogService';
import { printLogService } from './printLogService';
import { kopSuratService } from './kopSuratService';

type Row = Record<string, any>;

// Turunkan tipe input dari service asli agar override tetap sinkron bila service berubah.
type SantriCreate = Parameters<typeof santriService.createSantri>[0];
type SantriUpdate = Parameters<typeof santriService.updateSantri>[1];
type KasCreate = Parameters<typeof kasService.createKas>[0];
type KasUpdate = Parameters<typeof kasService.updateKas>[1];
type SyahriyahItems = Parameters<typeof syahriyahService.simpanPembayaranSyahriyah>[1];
type SyahriyahTransaksi = Parameters<typeof syahriyahService.simpanPembayaranSyahriyah>[2];
type SyahriyahRecord = Awaited<ReturnType<typeof syahriyahService.simpanPembayaranSyahriyah>>;
type KilatanItems = Parameters<typeof kilatanService.simpanPembayaranKilatan>[1];
type KilatanTransaksi = Parameters<typeof kilatanService.simpanPembayaranKilatan>[2];
type IuranInput = Parameters<typeof iuranPembayaranService.catatPembayaran>[0];
type IuranTambahanList = Awaited<ReturnType<typeof iuranPembayaranService.getIuranTambahan>>;
type PendaftaranCreate = Parameters<typeof pendaftaranService.createPendaftaran>[0];
type StatusPendaftaran = Parameters<typeof pendaftaranService.updateStatusPendaftaran>[1];
type UserCreate = Parameters<typeof pengaturanService.addUser>[0];
type MasterIuranCreate = Parameters<typeof masterIuranService.create>[0];
type MasterIuranUpdate = Parameters<typeof masterIuranService.update>[1];
type PrintType = Parameters<typeof printLogService.addLog>[1];
type PrintLogEntry = ReturnType<typeof printLogService.addLog>;
type SantriEntity = NonNullable<Awaited<ReturnType<typeof santriService.getSantriById>>>;
type KasEntity = NonNullable<Awaited<ReturnType<typeof kasService.getKasById>>>;
type KilatanRecord = Awaited<ReturnType<typeof kilatanService.simpanPembayaranKilatan>>;
type IuranRecord = Awaited<ReturnType<typeof iuranPembayaranService.catatPembayaran>>;
type PendaftaranEntity = Awaited<ReturnType<typeof pendaftaranService.createPendaftaran>>;
type UserEntity = Awaited<ReturnType<typeof pengaturanService.addUser>>;
type MasterIuranEntity = Awaited<ReturnType<typeof masterIuranService.create>>;

/**
 * Timpa method service dengan implementasi API.
 * `Partial<T>` membuat TypeScript mengecek nama & signature method,
 * menggantikan `Object.assign(x as any, ...)` yang kehilangan type safety.
 */
function patchService<T extends object>(target: T, overrides: Partial<T>): void {
  Object.assign(target, overrides);
}

const post = (path: string, body?: unknown) =>
  apiRequest<any>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });
const put = (path: string, body: unknown) =>
  apiRequest<any>(path, { method: 'PUT', body: JSON.stringify(body) });
const del = (path: string) => apiRequest<any>(path, { method: 'DELETE' });

function localList<T = Row>(key: string): T[] {
  try {
    const parsed = JSON.parse(storage.getItem(key) || '[]');
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function localById<T = Row>(key: string, id: string): T | null {
  return localList<T>(key).find((row) => (row as Row).id === id) || null;
}

function localByIdOrThrow<T>(key: string, id: string): T {
  const row = localById<T>(key, id);
  if (!row) throw new Error(`Data ${id} belum tersinkron setelah aksi API`);
  return row;
}

async function tulisDanSinkron(path: string, body: unknown, method: 'POST' | 'PUT' = 'POST'): Promise<void> {
  if (method === 'POST') await post(path, body);
  else await put(path, body);
  await syncFromApi();
}

/**
 * Mengalihkan jalur TULIS ke API saat VITE_API_MODE=api.
 * Service pembaca tetap membaca storage yang sudah disinkronkan dari
 * /api/backup, sehingga halaman laporan/dashboard tidak perlu diubah.
 */
export async function installApiBridge(): Promise<void> {
  if (!isApiMode()) return;
  // Saat halaman pertama dibuka belum ada sesi — jangan gagalkan pemasangan bridge.
  try {
    await syncFromApi();
  } catch {
    // 401 = belum login; data akan disinkronkan setelah login berhasil.
  }

  /* ---- Auth ---- */
  patchService(authStore, {
    async getUser() {
      try {
        const me = await apiRequest<{ data?: { user?: AuthUser; csrfToken?: string } }>('/api/auth/me');
        if (!me.data?.user) return null;
        setCsrfToken(me.data.csrfToken);
        return me.data.user;
      } catch {
        return null;
      }
    },
    setUser(user: AuthUser) {
      storage.setItem('al_hidayah_auth_user', JSON.stringify(user));
    },
    clearUser() {
      storage.removeItem('al_hidayah_auth_user');
      setCsrfToken(undefined);
    },
    async logout() {
      try {
        await post('/api/auth/logout');
      } catch {
        // abaikan: sesi lokal tetap dihapus
      }
      authStore.clearUser();
      window.location.href = '/login';
    },
  });

  /* ---- Santri ---- */
  patchService(santriService, {
    async getSantriList() {
      return localList('al_hidayah_santri');
    },
    async getSantriById(id: string) {
      return localById<SantriEntity>('al_hidayah_santri', id);
    },
    async checkNisUnik(nis: string, excludeId?: string) {
      const target = nis.trim().toLowerCase();
      return !localList<Row>('al_hidayah_santri').some(
        (s) => String(s.nis).toLowerCase() === target && s.id !== excludeId
      );
    },
    async createSantri(data: SantriCreate) {
      const result = await post('/api/master/santri', data);
      await syncFromApi();
      return localByIdOrThrow<SantriEntity>('al_hidayah_santri', result.data.id);
    },
    async updateSantri(id: string, data: SantriUpdate) {
      await tulisDanSinkron(`/api/master/santri/${id}`, data, 'PUT');
      return localByIdOrThrow<SantriEntity>('al_hidayah_santri', id);
    },
    async deleteSantri(id: string) {
      await del(`/api/master/santri/${id}`);
      await syncFromApi();
    },
    async importSantri(rows: Row[]) {
      const result = await post('/api/master/santri/import', { rows });
      await syncFromApi();
      return result.data;
    },
  });

  /* ---- Kas ---- */
  patchService(kasService, {
    async getKasList() {
      return localList('al_hidayah_kas');
    },
    async getKasById(id: string) {
      return localById<KasEntity>('al_hidayah_kas', id);
    },
    async createKas(data: KasCreate) {
      const result = await post('/api/master/kas', data);
      await syncFromApi();
      return localByIdOrThrow<KasEntity>('al_hidayah_kas', result.data.id);
    },
    async updateKas(id: string, data: KasUpdate) {
      await tulisDanSinkron(`/api/master/kas/${id}`, data, 'PUT');
      return localByIdOrThrow<KasEntity>('al_hidayah_kas', id);
    },
    async deleteKas(id: string) {
      await del(`/api/master/kas/${id}`);
      await syncFromApi();
    },
    async restoreKas(snapshot: Row) {
      await post('/api/master/kas', snapshot);
      await syncFromApi();
    },
    async deleteKasSumber() {
      // Pembatalan pembayaran di API sudah menghapus kas di server.
    },
    async countKasByKategori(kategori: string, jenis: string) {
      return localList<Row>('al_hidayah_kas').filter(
        (k) => k.jenis === (jenis === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran') &&
          String(k.kategori_nama).trim().toLowerCase() === kategori.trim().toLowerCase()
      ).length;
    },
    async renameKasKategori(jenis: string, oldName: string, newName: string) {
      await tulisDanSinkron(
        `/api/master/kategori-kas/${jenis}/${encodeURIComponent(oldName)}`,
        { nama: newName },
        'PUT'
      );
    },
  });

  /* ---- Syahriyah & Kilatan ---- */
  for (const [modul, service, transaksiKey] of [
    ['syahriyah', syahriyahService, 'al_hidayah_syahriyah_transaksi'],
    ['kilatan', kilatanService, 'al_hidayah_kilatan_transaksi'],
  ] as const) {
    patchService(service, {
      async simpanPembayaranSyahriyah(
        santriId: string,
        items: SyahriyahItems,
        data: SyahriyahTransaksi
      ) {
        const result = await post(`/api/pembayaran/${modul}`, {
          santri_id: santriId,
          items,
          tanggal_bayar: data.tanggal_bayar,
          metode: data.metode,
          keterangan: data.keterangan,
          iuran_tambahan: data.iuran_tambahan,
        });
        await syncFromApi();
        return localByIdOrThrow<SyahriyahRecord>(transaksiKey, result.data.id);
      },
      async simpanPembayaranKilatan(
        santriId: string,
        items: KilatanItems,
        data: KilatanTransaksi
      ) {
        const result = await post(`/api/pembayaran/${modul}`, {
          santri_id: santriId,
          items,
          tanggal_bayar: data.tanggal_bayar,
          metode: data.metode,
          keterangan: data.keterangan,
          iuran_tambahan: data.iuran_tambahan,
        });
        await syncFromApi();
        return localByIdOrThrow<KilatanRecord>(transaksiKey, result.data.id);
      },
      async batalkanPembayaran(id: string) {
        await post(`/api/pembayaran/${modul}/${id}/batalkan`);
        await syncFromApi();
      },
    });
  }

  /* ---- Iuran ---- */
  patchService(iuranPembayaranService, {
    async catatPembayaran(input: IuranInput) {
      const result = await post('/api/pembayaran/iuran', input);
      await syncFromApi();
      return localByIdOrThrow<IuranRecord>('al_hidayah_iuran_pembayaran', result.data.id);
    },
    async batalkanPembayaran(id: string) {
      await post(`/api/pembayaran/iuran/${id}/batalkan`);
      await syncFromApi();
    },
    async getIuranTambahan() {
      return localList<IuranTambahanList[number]>('al_hidayah_iuran_tambahan');
    },
    async saveIuranTambahan(list: IuranTambahanList) {
      await tulisDanSinkron('/api/master/iuran-tambahan/replace', { list }, 'PUT');
      return list;
    },
  });

  /* ---- Pendaftaran ---- */
  patchService(pendaftaranService, {
    async getPendaftaranList() {
      return localList('al_hidayah_pendaftaran');
    },
    async createPendaftaran(data: PendaftaranCreate) {
      const result = await post('/api/master/pendaftaran', data);
      await syncFromApi();
      return localByIdOrThrow<PendaftaranEntity>('al_hidayah_pendaftaran', result.data.id);
    },
    async updateStatusPendaftaran(id: string, status: StatusPendaftaran) {
      await tulisDanSinkron(`/api/master/pendaftaran/${id}`, { status }, 'PUT');
      return localByIdOrThrow<PendaftaranEntity>('al_hidayah_pendaftaran', id);
    },
    async konversiKeSantri(id: string, nis: string, tanggalMasuk: string) {
      const result = await post(`/api/master/pendaftaran/${id}/konversi`, {
        nis,
        tanggal_masuk: tanggalMasuk,
      });
      await syncFromApi();
      return result.data;
    },
    async generateAutoNis() {
      const tahun = new Date().getFullYear().toString();
      let max = 0;
      for (const s of localList<Row>('al_hidayah_santri')) {
        if (String(s.nis).startsWith(tahun)) {
          max = Math.max(max, Number(String(s.nis).slice(tahun.length)) || 0);
        }
      }
      return `${tahun}${String(max + 1).padStart(3, '0')}`;
    },
  });

  /* ---- Pengaturan & master iuran ---- */
  patchService(pengaturanService, {
    async getProfil() {
      return JSON.parse(storage.getItem('al_hidayah_profil') || '{}');
    },
    async saveProfil(profil: Row) {
      await tulisDanSinkron('/api/master/pengaturan/profil', { nilai: profil }, 'PUT');
    },
    async getTarif() {
      return JSON.parse(storage.getItem('al_hidayah_tarif') || '{}');
    },
    async saveTarif(tarif: Row) {
      await tulisDanSinkron('/api/master/pengaturan/tarif', { nilai: tarif }, 'PUT');
    },
    async getArsipTarif() {
      return localList('al_hidayah_arsip_tarif');
    },
    async saveArsipTarif(list: Row[]) {
      await tulisDanSinkron('/api/master/arsip-tarif/replace', { list }, 'PUT');
    },
    async getUsers() {
      return localList('al_hidayah_users');
    },
    async addUser(user: UserCreate) {
      const result = await post('/api/master/users', user);
      await syncFromApi();
      return localByIdOrThrow<UserEntity>('al_hidayah_users', result.data.id);
    },
    async updateUser(id: string, updated: Row) {
      await tulisDanSinkron(`/api/master/users/${id}`, updated, 'PUT');
    },
    async deleteUser(id: string) {
      await del(`/api/master/users/${id}`);
      await syncFromApi();
    },
  });

  patchService(masterIuranService, {
    async getAll() {
      return localList<MasterIuranEntity>('al_hidayah_master_iuran');
    },
    async getAktif() {
      return localList<MasterIuranEntity>('al_hidayah_master_iuran').filter((m) => m.status === 'Aktif');
    },
    async create(data: MasterIuranCreate) {
      const result = await post('/api/master/master-iuran', data);
      await syncFromApi();
      return localByIdOrThrow<MasterIuranEntity>('al_hidayah_master_iuran', result.data.id);
    },
    async update(id: string, data: MasterIuranUpdate) {
      await tulisDanSinkron(`/api/master/master-iuran/${id}`, data, 'PUT');
      return localById<MasterIuranEntity>('al_hidayah_master_iuran', id);
    },
    async remove(id: string) {
      await del(`/api/master/master-iuran/${id}`);
      await syncFromApi();
      return true;
    },
  });

  /* ---- Kop surat & kwitansi ---- */
  patchService(kopSuratService, {
    save(config: Row, image: string | null) {
      const nilai = {
        version: 1,
        config: { ...config, updatedAt: new Date().toISOString() },
        image,
        updatedAt: new Date().toISOString(),
      };
      void put('/api/master/pengaturan/kop_surat', { nilai })
        .then(() => syncFromApi())
        .catch(() => undefined);
    },
  });

  /* ---- Audit & log cetak ---- */
  patchService(activityLogService, {
    catat(input: Row) {
      // catat() sinkron di mode lokal → fire-and-forget saat API mode.
      void post('/api/aktivitas', { ...input }).then(() => syncFromApi()).catch(() => undefined);
    },
    getAll() {
      return localList('al_hidayah_activity_log');
    },
    clear() {
      // Riwayat server sengaja tidak dihapus dari klien.
    },
  });

  patchService(printLogService, {
    addLog(transaksiId: string, type: PrintType, printedBy?: string): PrintLogEntry {
      void post('/api/print-log', { transaksi_id: transaksiId, type, printed_by: printedBy })
        .then(() => syncFromApi())
        .catch(() => undefined);
      return {
        id: `log_${Date.now()}`,
        transaksi_id: transaksiId,
        type,
        printed_at: new Date().toISOString(),
        printed_by: printedBy,
      };
    },
  });

  // Segarkan cache tiap 30 detik untuk perubahan dari tab lain.
  window.setInterval(() => {
    void syncFromApi().catch(() => undefined);
  }, 30000);
}
