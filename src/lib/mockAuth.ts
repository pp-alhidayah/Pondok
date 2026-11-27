import { pengaturanService } from './pengaturanService';

export interface AuthResult {
  success: boolean;
  role?: 'super_admin' | 'admin' | 'pemilik';
  nama?: string;
  message?: string;
}

/**
 * Authentikasi pengguna terhadap akun yang tersimpan di al_hidayah_users.
 * Tidak ada password default publik; akun harus dibuat melalui menu Pengaturan → Pengguna
 * (atau setup awal pada build produksi).
 */
export async function mockAuth(usernameInput: string, passwordInput: string): Promise<AuthResult> {
  await new Promise((resolve) => setTimeout(resolve, 400));

  const cleanUsername = usernameInput.trim().toLowerCase();
  const users = await pengaturanService.getUsers();

  const user = users.find((u) => u.username.toLowerCase() === cleanUsername);

  if (user) {
    if (!user.password || user.password !== passwordInput) {
      return { success: false, message: 'Password yang Anda masukkan salah' };
    }
    if (user.status === 'Nonaktif') {
      return { success: false, message: 'Akun Anda sedang dinonaktifkan oleh Administrator' };
    }
    return {
      success: true,
      role: user.role,
      nama: user.nama,
    };
  }

  return { success: false, message: 'Username atau password salah' };
}
