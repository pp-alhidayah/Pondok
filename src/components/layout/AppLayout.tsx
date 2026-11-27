import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { MobileDrawer } from './MobileDrawer';
import { authStore, AuthUser } from '../../store/authStore';
import { UndoToastContainer } from '../ui/UndoToast';
import { ToastContainer } from '../ui/Toast';

export const AppLayout: React.FC = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    authStore.getUser().then(setUser);
  }, []);

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden">
      {/* Skip link untuk keyboard/screen reader */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[10000] focus:rounded-lg focus:bg-[#059669] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Lewati ke konten utama
      </a>

      {/* 1. SIDEBAR DESKTOP (Fixed Width) */}
      <div className="hidden lg:block w-[260px] shrink-0 h-full z-40">
        <Sidebar user={user} />
      </div>

      {/* 2. MOBILE DRAWER */}
      <MobileDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} user={user} />

      {/* 3. AREA KANAN (Topbar + Konten) */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* TOPBAR */}
        <Topbar user={user} onMenuClick={() => setDrawerOpen(true)} />

        {/* KONTEN UTAMA (Scrollable) */}
        <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#F8FAFC] outline-none">
          <Outlet />
        </main>
      </div>

      {/* Toast & Undo containers */}
      <ToastContainer />
      <UndoToastContainer />
    </div>
  );
};

export default AppLayout;
