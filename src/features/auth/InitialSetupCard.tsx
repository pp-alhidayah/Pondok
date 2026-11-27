import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { InputField } from '../../components/ui/InputField';
import { Button } from '../../components/ui/Button';
import { ErrorAlert } from '../../components/ui/ErrorAlert';
import { pengaturanService } from '../../lib/pengaturanService';
import { authStore } from '../../store/authStore';
import { apiSetup, isApiMode } from '../../lib/apiClient';
import { syncFromApi } from '../../lib/apiCache';

/**
 * Setup pertama kali untuk build produksi yang belum memiliki akun.
 * Password awal dibuat sendiri oleh pengguna, bukan hardcoded di aplikasi.
 */
export const InitialSetupCard: React.FC = () => {
  const navigate = useNavigate();
  const [nama, setNama] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanNama = nama.trim();
    const cleanUsername = username.trim().toLowerCase();

    if (!cleanNama || !cleanUsername) {
      setErrorMessage('Nama dan username wajib diisi');
      return;
    }
    if (password.length < 8) {
      setErrorMessage('Password minimal 8 karakter');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Konfirmasi password tidak cocok');
      return;
    }

    setIsLoading(true);
    try {
      if (isApiMode()) {
        await apiSetup(cleanNama, cleanUsername, password);
        await syncFromApi().catch(() => undefined);
        authStore.setUser({
          username: cleanUsername,
          role: 'super_admin',
          nama: cleanNama,
        });
        navigate('/dashboard', { replace: true });
        return;
      }

      await pengaturanService.addUser({
        nama: cleanNama,
        username: cleanUsername,
        password,
        role: 'super_admin',
        status: 'Aktif',
      });
      authStore.setUser({
        username: cleanUsername,
        role: 'super_admin',
        nama: cleanNama,
      });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Gagal membuat akun');
    } finally {
      setIsLoading(false);
    }
  };

  const isError = Boolean(errorMessage);

  return (
    <div className="max-w-[400px] w-full bg-white border border-[#E2E8F0] rounded-2xl shadow-card p-6 sm:p-8">
      <h2 className="text-xl font-semibold text-[#0F172A] text-center">
        Buat Akun Super Admin
      </h2>
      <p className="text-sm text-[#64748B] mt-1 mb-6 text-center">
        Belum ada akun di perangkat ini. Buat akun pertama untuk mulai menggunakan
        aplikasi.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <InputField
          id="setup-nama"
          label="Nama Lengkap"
          type="text"
          value={nama}
          onChange={(e) => setNama(e.target.value)}
          placeholder="Contoh: Muhammad Maghfuri"
          icon="user"
          error={isError}
          disabled={isLoading}
          required
        />

        <InputField
          id="setup-username"
          label="Username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Contoh: superadmin"
          icon="user"
          error={isError}
          disabled={isLoading}
          required
        />

        <InputField
          id="setup-password"
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Minimal 8 karakter"
          icon="lock"
          error={isError}
          disabled={isLoading}
          hint="Gunakan password yang kuat dan tidak dipakai di layanan lain."
          required
        />

        <InputField
          id="setup-confirm-password"
          label="Konfirmasi Password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Ulangi password"
          icon="lock"
          error={isError}
          disabled={isLoading}
          required
        />

        <ErrorAlert message={errorMessage} visible={isError} />

        <div className="pt-2">
          <Button type="submit" fullWidth isLoading={isLoading}>
            Buat Akun & Masuk
          </Button>
        </div>
      </form>
    </div>
  );
};

export default InitialSetupCard;
