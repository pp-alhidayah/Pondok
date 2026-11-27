import { storage } from './storage';
import { ProfilPondok, TarifDefault, ArsipTarif, UserAccount, MasterIuran } from '../types/pengaturan';
import { SEED_DEMO_DATA, DataRusakError, readJsonStrict } from './core';

const KEY_PROFIL = 'al_hidayah_profil';
const KEY_TARIF = 'al_hidayah_tarif';
const KEY_ARSIP_TARIF = 'al_hidayah_arsip_tarif';
const KEY_USERS = 'al_hidayah_users';

export const DEFAULT_PROFIL: ProfilPondok = {
  nama_pondok: 'Pondok Al Hidayah Tertek',
  alamat: 'Jln. Mayor Bismo No 71-73 Tertek Pare Kediri',
  pengasuh: 'KH. Mujtaba Thoifur',
  ketua: 'Muhammad Maghfuri',
  sekretaris: 'Ahmad Dahlan',
  bendahara: 'Shofil Mubarok',
  kontak: '0812-3456-7890',
  email: 'alhidayah.tertek@gmail.com',
  logo: '',
};

const currentYear = new Date().getFullYear();

export const DEFAULT_TARIF: TarifDefault = {
  syahriyah_mukim: 150000,
  syahriyah_nduduk: 100000,
  syahriyah_kilatan: 0, // tidak dipakai — Kilatan tidak bayar bulanan
  event_kilatan: 50000,
  periode_mulai: `${currentYear}-01`,
};

const DEMO_ARSIP_TARIF: ArsipTarif[] = [
  {
    id: `arsip-${currentYear - 1}`,
    periode_mulai: `${currentYear - 1}-01`,
    periode_selesai: `${currentYear - 1}-12`,
    syahriyah_mukim: 125000,
    syahriyah_nduduk: 80000,
    syahriyah_kilatan: 0,
    event_kilatan: 40000,
    status: 'Diarsipkan',
    diarsipkan_pada: `${currentYear}-01-01T00:00:00.000Z`,
  },
  {
    id: `arsip-${currentYear - 2}`,
    periode_mulai: `${currentYear - 2}-01`,
    periode_selesai: `${currentYear - 2}-12`,
    syahriyah_mukim: 100000,
    syahriyah_nduduk: 70000,
    syahriyah_kilatan: 0,
    event_kilatan: 35000,
    status: 'Diarsipkan',
    diarsipkan_pada: `${currentYear - 1}-01-01T00:00:00.000Z`,
  },
];

export const DEFAULT_ARSIP_TARIF: ArsipTarif[] = SEED_DEMO_DATA ? DEMO_ARSIP_TARIF : [];

export const DEFAULT_USERS: UserAccount[] = [
  {
    id: 'user-1',
    nama: 'Muhammad Maghfuri',
    username: 'superadmin',
    password: 'admin123',
    role: 'super_admin',
    status: 'Aktif',
  },
  {
    id: 'user-2',
    nama: 'Shofil Mubarok',
    username: 'admin1',
    password: 'admin123',
    role: 'admin',
    status: 'Aktif',
  },
  {
    id: 'user-3',
    nama: 'KH. Mujtaba Thoifur',
    username: 'pengasuh',
    password: 'admin123',
    role: 'pemilik',
    status: 'Aktif',
  },
];

/** Bandingkan dua string YYYY-MM. Return <0 jika a<b, 0 jika sama, >0 jika a>b */
function compareYearMonth(a: string, b: string): number {
  return a.localeCompare(b);
}

/**
 * Ambil tarif yang berlaku untuk periode tertentu (YYYY-MM).
 *
 * Aturan:
 * - Jika yearMonth >= tarif aktif.periode_mulai → pakai tarif aktif
 * - Jika yearMonth jatuh di salah satu arsip (periode_mulai .. periode_selesai) → pakai arsip itu
 * - Fallback: tarif aktif
 */
export async function getTarifForPeriod(yearMonth: string): Promise<TarifDefault> {
  const active = await pengaturanService.getTarif();
  const activeStart = active.periode_mulai || `${currentYear}-01`;
  const arsipList = await pengaturanService.getArsipTarif();

  // 1. Tarif dijadwalkan (masa depan) yang sudah mulai berlaku untuk yearMonth
  const scheduled = arsipList
    .filter((a) => a.status === 'Dijadwalkan')
    .sort((a, b) => compareYearMonth(b.periode_mulai, a.periode_mulai));

  for (const s of scheduled) {
    if (compareYearMonth(yearMonth, s.periode_mulai) >= 0) {
      return {
        syahriyah_mukim: s.syahriyah_mukim,
        syahriyah_nduduk: s.syahriyah_nduduk,
        syahriyah_kilatan: s.syahriyah_kilatan,
        event_kilatan: s.event_kilatan,
        periode_mulai: s.periode_mulai,
      };
    }
  }

  // 2. Tarif aktif: dari periode_mulai sampai sebelum scheduled terdekat (atau tak terbatas)
  if (compareYearMonth(yearMonth, activeStart) >= 0) {
    return active;
  }

  // 3. Cari di arsip yang sudah selesai
  const sorted = [...arsipList]
    .filter((a) => a.status === 'Diarsipkan')
    .sort((a, b) => compareYearMonth(b.periode_mulai, a.periode_mulai));

  for (const arsip of sorted) {
    const start = arsip.periode_mulai;
    const end = arsip.periode_selesai;
    if (!end) continue;
    if (
      compareYearMonth(yearMonth, start) >= 0 &&
      compareYearMonth(yearMonth, end) <= 0
    ) {
      return {
        syahriyah_mukim: arsip.syahriyah_mukim,
        syahriyah_nduduk: arsip.syahriyah_nduduk,
        syahriyah_kilatan: arsip.syahriyah_kilatan,
        event_kilatan: arsip.event_kilatan,
        periode_mulai: arsip.periode_mulai,
      };
    }
  }

  return active;
}

/**
 * Ambil hanya field profil yang dikenal dan bertipe string.
 * Data rusak/asing tidak boleh menyisipkan field atau nilai non-string.
 */
export function normalizeProfil(value: unknown): ProfilPondok {
  const source =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  const text = (key: keyof ProfilPondok): string => {
    const raw = source[key];
    return typeof raw === 'string' ? raw : DEFAULT_PROFIL[key] ?? '';
  };

  return {
    nama_pondok: text('nama_pondok'),
    alamat: text('alamat'),
    pengasuh: text('pengasuh'),
    ketua: text('ketua'),
    sekretaris: text('sekretaris'),
    bendahara: text('bendahara'),
    kontak: text('kontak'),
    email: text('email'),
    logo: text('logo'),
  };
}

export const pengaturanService = {
  // PROFIL PONDOK
  async getProfil(): Promise<ProfilPondok> {
    // Data rusak TIDAK boleh ditimpa diam-diam dengan default.
    const parsed = readJsonStrict<unknown>(KEY_PROFIL, null);
    return normalizeProfil(parsed);
  },

  async saveProfil(profil: ProfilPondok): Promise<void> {
    storage.setItem(KEY_PROFIL, JSON.stringify(profil));
  },

  // TARIF AKTIF
  async getTarif(): Promise<TarifDefault> {
    const parsed = readJsonStrict<Partial<TarifDefault> | null>(KEY_TARIF, null);
    if (!parsed) return { ...DEFAULT_TARIF };
    return {
      ...DEFAULT_TARIF,
      ...parsed,
      periode_mulai: parsed.periode_mulai || DEFAULT_TARIF.periode_mulai,
    };
  },

  async saveTarif(tarif: TarifDefault): Promise<void> {
    storage.setItem(KEY_TARIF, JSON.stringify(tarif));
  },

  // ARSIP RIWAYAT TARIF
  async getArsipTarif(): Promise<ArsipTarif[]> {
    const list = readJsonStrict<ArsipTarif[]>(KEY_ARSIP_TARIF, DEFAULT_ARSIP_TARIF);
    if (!Array.isArray(list)) throw new DataRusakError(KEY_ARSIP_TARIF);
    // Normalisasi: rentang terbalik pada status Diarsipkan dipotong ke periode_mulai
    return list
      .map((item) => {
        if (
          item.status === 'Diarsipkan' &&
          item.periode_selesai &&
          item.periode_mulai &&
          item.periode_selesai < item.periode_mulai
        ) {
          return { ...item, periode_selesai: item.periode_mulai };
        }
        return item;
      })
      .filter((item) => item && item.periode_mulai);
  },

  async saveArsipTarif(list: ArsipTarif[]): Promise<void> {
    storage.setItem(KEY_ARSIP_TARIF, JSON.stringify(list));
  },

  // MANAJEMEN PENGGUNA
  async getUsers(): Promise<UserAccount[]> {
    const raw = storage.getItem(KEY_USERS);
    if (raw === null) {
      // Akun demo dengan password sementara hanya dibuat di mode development.
      // Build produksi memulai tanpa akun dan meminta pembuatan Super Admin
      // pertama lewat halaman login.
      if (!SEED_DEMO_DATA) return [];
      const seed = DEFAULT_USERS.map((u) => ({ ...u }));
      storage.setItem(KEY_USERS, JSON.stringify(seed));
      return seed;
    }
    return readJsonStrict<UserAccount[]>(KEY_USERS, []);
  },

  async saveUsers(users: UserAccount[]): Promise<void> {
    storage.setItem(KEY_USERS, JSON.stringify(users));
  },

  async addUser(user: Omit<UserAccount, 'id'>): Promise<UserAccount> {
    const users = await this.getUsers();
    const exists = users.some(
      (u) => u.username.toLowerCase() === user.username.toLowerCase()
    );
    if (exists) {
      throw new Error('Username sudah digunakan');
    }
    const newUser: UserAccount = {
      ...user,
      id: `user-${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    };
    users.push(newUser);
    await this.saveUsers(users);
    return newUser;
  },

  async updateUser(id: string, updated: Partial<UserAccount>): Promise<void> {
    const users = await this.getUsers();
    const index = users.findIndex((u) => u.id === id);
    if (index === -1) {
      throw new Error('User tidak ditemukan');
    }
    if (updated.username) {
      const exists = users.some(
        (u) =>
          u.id !== id &&
          u.username.toLowerCase() === updated.username!.toLowerCase()
      );
      if (exists) {
        throw new Error('Username sudah digunakan');
      }
    }
    users[index] = { ...users[index], ...updated };
    await this.saveUsers(users);
  },

  async deleteUser(id: string): Promise<void> {
    const users = await this.getUsers();
    const target = users.find((u) => u.id === id);
    if (!target) return;
    if (target.role === 'super_admin') {
      const otherSuper = users.filter(
        (u) => u.id !== id && u.role === 'super_admin'
      );
      if (otherSuper.length === 0) {
        throw new Error('Tidak bisa menghapus super admin terakhir');
      }
    }
    const filtered = users.filter((u) => u.id !== id);
    await this.saveUsers(filtered);
  },
};


// ─── Master Iuran (program iuran: Haul, dll.) ───────────────────────────────
const KEY_MASTER_IURAN = 'al_hidayah_master_iuran';

export const DEFAULT_MASTER_IURAN: MasterIuran[] = [
  {
    id: 'mi-haul',
    nama: 'Haul Akbar',
    nominal_default: 100000,
    jenis_periode: 'tahunan',
    status: 'Aktif',
    keterangan: 'Iuran haul tahunan pondok',
    created_at: new Date().toISOString(),
  },
];

function readMasterIuran(): MasterIuran[] {
  const raw = storage.getItem(KEY_MASTER_IURAN);
  if (raw === null) {
    const seed = DEFAULT_MASTER_IURAN.map((x) => ({ ...x }));
    storage.setItem(KEY_MASTER_IURAN, JSON.stringify(seed));
    return seed;
  }
  return readJsonStrict<MasterIuran[]>(KEY_MASTER_IURAN, []);
}

export const masterIuranService = {
  async getAll(): Promise<MasterIuran[]> {
    return readMasterIuran();
  },

  async getAktif(): Promise<MasterIuran[]> {
    return (await readMasterIuran()).filter((i) => i.status === 'Aktif');
  },

  async saveAll(list: MasterIuran[]): Promise<void> {
    storage.setItem(KEY_MASTER_IURAN, JSON.stringify(list));
  },

  async create(
    data: Omit<MasterIuran, 'id' | 'created_at' | 'updated_at'>
  ): Promise<MasterIuran> {
    const list = await readMasterIuran();
    const item: MasterIuran = {
      ...data,
      id: 'mi_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      created_at: new Date().toISOString(),
    };
    list.unshift(item);
    await storage.setItem(KEY_MASTER_IURAN, JSON.stringify(list));
    return item;
  },

  async update(id: string, data: Partial<MasterIuran>): Promise<MasterIuran | null> {
    const list = await readMasterIuran();
    const idx = list.findIndex((i) => i.id === id);
    if (idx === -1) return null;
    list[idx] = {
      ...list[idx],
      ...data,
      id: list[idx].id,
      created_at: list[idx].created_at,
      updated_at: new Date().toISOString(),
    };
    await storage.setItem(KEY_MASTER_IURAN, JSON.stringify(list));
    return list[idx];
  },

  async remove(id: string): Promise<boolean> {
    const list = await readMasterIuran();
    const next = list.filter((i) => i.id !== id);
    if (next.length === list.length) return false;
    await storage.setItem(KEY_MASTER_IURAN, JSON.stringify(next));
    return true;
  },
};
