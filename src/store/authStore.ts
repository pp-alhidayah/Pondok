import { storage } from '../lib/storage';
import { pengaturanService } from '../lib/pengaturanService';

export type UserRole = 'super_admin' | 'admin' | 'pemilik';

export interface AuthUser {
  username: string;
  role: UserRole;
  nama: string;
}

const STORAGE_KEY = 'al_hidayah_auth_user';
const LEGACY_STORAGE_KEY = 'hidayah_auth_user';
const LEGACY_USER_KEY = 'user';

export const USER_PROFILES: Record<string, { username: string; role: UserRole; nama: string }> = {
  superadmin: {
    username: 'superadmin',
    role: 'super_admin',
    nama: 'Muhammad Maghfuri',
  },
  admin1: {
    username: 'admin1',
    role: 'admin',
    nama: 'Shofil Mubarok',
  },
  pengasuh: {
    username: 'pengasuh',
    role: 'pemilik',
    nama: 'KH. Mujtaba Thoifur',
  },
};

export const authStore = {
  async getUser(): Promise<AuthUser | null> {
    try {
      const data =
        storage.getItem(STORAGE_KEY) ||
        storage.getItem(LEGACY_STORAGE_KEY) ||
        storage.getItem(LEGACY_USER_KEY);
      if (!data) return null;

      const parsed = JSON.parse(data) as Partial<AuthUser> | null;
      if (!parsed || typeof parsed.username !== 'string' || !parsed.username.trim()) {
        return null;
      }

      // Jangan percaya role/nama di storage. Cocokkan dengan data akun
      // yang tersimpan agar perubahan role atau penonaktifan akun langsung
      // berlaku, dan session palsu tidak bisa menaikkan hak akses.
      const username = parsed.username.trim().toLowerCase();
      const users = await pengaturanService.getUsers();
      const account = users.find((u) => u.username.trim().toLowerCase() === username);

      if (!account || account.status !== 'Aktif') return null;

      return {
        username: account.username,
        role: account.role,
        nama: account.nama,
      };
    } catch {
      return null;
    }
  },

  setUser(user: AuthUser) {
    storage.setItem(STORAGE_KEY, JSON.stringify(user));
  },

  clearUser() {
    // Hanya hapus session auth. JANGAN clear seluruh storage
    // agar data santri, syahriyah, kas, dll tetap aman.
    storage.removeItem(STORAGE_KEY);
    storage.removeItem(LEGACY_STORAGE_KEY);
    storage.removeItem(LEGACY_USER_KEY);
  },

  logout(): void | Promise<void> {
    this.clearUser();
    window.location.href = '/login';
  },
};
