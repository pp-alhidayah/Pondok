import React, { useState, useEffect } from 'react';
import { LoginCard } from './LoginCard';
import { InitialSetupCard } from './InitialSetupCard';
import { pengaturanService } from '../../lib/pengaturanService';
import { apiNeedsSetup, isApiMode } from '../../lib/apiClient';

export const LoginPage: React.FC = () => {
  // Build produksi dimulai tanpa akun. Tampilkan pembuatan Super Admin
  // pertama agar tidak ada password default yang diketahui publik.
  const [needsInitialSetup, setNeedsInitialSetup] = useState(false);

  useEffect(() => {
    let mounted = true;
    const cek = isApiMode()
      ? apiNeedsSetup()
      : pengaturanService.getUsers().then((users) => users.length === 0);
    cek.then((needsSetup) => {
        if (mounted) setNeedsInitialSetup(needsSetup);
      })
      .catch(() => {
        if (mounted) setNeedsInitialSetup(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4">
      {/* Header section above card */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#ECFDF5] border-2 border-[#059669] mb-4 shadow-xs">
          <span className="text-2xl font-bold text-[#059669] tracking-tight">AH</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A] tracking-tight">
          Sistem Informasi
        </h1>
        <p className="text-lg font-semibold text-[#059669] mt-0.5">
          Pondok Al Hidayah Tertek
        </p>
        <p className="text-xs text-[#64748B] mt-1 max-w-xs mx-auto hidden sm:block">
          Jln. Mayor Bismo No 71-73 Tertek Pare Kediri
        </p>
      </div>

      {/* Login Card / Setup Awal */}
      {needsInitialSetup ? <InitialSetupCard /> : <LoginCard />}

      {/* Footer section below card */}
      <div className="text-center mt-6 space-y-1">
        <p className="text-xs text-[#94A3B8]">© 2025 Pondok Al Hidayah Tertek</p>
        <p className="text-xs text-[#94A3B8]">
          Sistem internal — hanya untuk pengurus pondok
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
