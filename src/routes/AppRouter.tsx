import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from '../features/auth/LoginPage';
import AppLayout from '../components/layout/AppLayout';
import ProtectedRoute from './ProtectedRoute';
import DashboardPage from '../features/dashboard/DashboardPage';
import SantriListPage from '../features/santri/SantriListPage';
import SantriDetailPage from '../features/santri/SantriDetailPage';
import PendaftaranListPage from '../features/pendaftaran/PendaftaranListPage';
import SyahriyahListPage from '../features/syahriyah/SyahriyahListPage';
import KeringananSantriListPage from '../features/keringanan/KeringananSantriListPage';
import KilatanListPage from '../features/kilatan/KilatanListPage';
import KasListPage from '../features/kas/KasListPage';
import LaporanPage from '../features/laporan/LaporanPage';
import AktivitasPage from '../features/aktivitas/AktivitasPage';
import PengaturanPage from '../features/pengaturan/PengaturanPage';
import IuranListPage from '../features/iuran/IuranListPage';

export const AppRouter: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/santri" element={<SantriListPage />} />
          <Route path="/santri/:id" element={<SantriDetailPage />} />
          <Route path="/pendaftaran" element={<PendaftaranListPage />} />
          <Route path="/syahriyah" element={<SyahriyahListPage />} />
          <Route path="/keringanan" element={<KeringananSantriListPage />} />
          <Route path="/kilatan" element={<KilatanListPage />} />
          <Route path="/iuran" element={<IuranListPage />} />
          <Route path="/kas" element={<KasListPage />} />
          <Route path="/laporan" element={<LaporanPage />} />
          <Route path="/aktivitas" element={<AktivitasPage />} />
          <Route path="/pengaturan" element={<PengaturanPage />} />
        </Route>
      </Route>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};

export default AppRouter;
