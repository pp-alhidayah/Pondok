import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Menu, Search, ChevronDown, LogOut } from 'lucide-react';
import { MENU_CONFIG } from './menuConfig';
import { authStore, AuthUser } from '../../store/authStore';
import { SearchModal } from '../ui/SearchModal';
import { NotificationsPanel } from '../ui/NotificationsPanel';

interface TopbarProps {
  user: AuthUser | null;
  onMenuClick: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ user, onMenuClick }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Global keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isEditable = target?.isContentEditable;
      const isInput =
        tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || isEditable;

      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'k' || e.key === '/')) {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }

      if (isInput) return;

      const key = e.key.toLowerCase();
      if (key === 'n') {
        e.preventDefault();
        navigate('/syahriyah');
      } else if (key === 'f') {
        e.preventDefault();
        setSearchOpen(true);
      } else if (key === 'p') {
        e.preventDefault();
        navigate('/laporan');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  // Dynamic page title based on active route
  const currentMenuItem = MENU_CONFIG.find((item) => item.path === location.pathname);
  const pageTitle = currentMenuItem ? currentMenuItem.label : 'Dashboard';

  // Handle clicking outside user dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    authStore.logout();
  };

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'super_admin':
        return 'Super Admin';
      case 'admin':
        return 'Administrator';
      case 'pemilik':
        return 'Pengasuh';
      default:
        return 'Pengurus';
    }
  };

  const getInitial = (name?: string) => {
    if (!name) return 'A';
    return name.trim().charAt(0).toUpperCase();
  };

  return (
    <header className="w-full h-16 bg-white border-b border-[#E2E8F0] flex items-center justify-between px-4 md:px-6 shrink-0 z-30">
      {/* Left side: Mobile menu toggle + Page Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          aria-label="Buka menu"
          className="lg:hidden w-10 h-10 rounded-lg hover:bg-slate-100 flex items-center justify-center text-[#0F172A] transition-colors duration-150 outline-none focus:ring-2 focus:ring-[#059669]"
        >
          <Menu className="w-5 h-5" />
        </button>

        <h1 className="text-lg font-semibold text-[#0F172A] tracking-tight truncate">
          {pageTitle}
        </h1>
      </div>

      {/* Center: Search trigger button (Desktop only) */}
      <div className="hidden lg:flex flex-1 max-w-md mx-6">
        <button
          onClick={() => setSearchOpen(true)}
          className="w-full px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-left flex items-center gap-2.5 text-sm text-slate-500 transition-colors duration-150 outline-none focus:ring-2 focus:ring-[#059669]"
        >
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <span>Cari...</span>
          <kbd className="ml-auto text-[11px] font-sans font-medium bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-400">
            Ctrl+K
          </kbd>
        </button>
      </div>

      {/* Right side: Notifications & User profile dropdown */}
      <div className="flex items-center gap-2">
        {/* Notification Panel */}
        <NotificationsPanel />

        {/* User Profile Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((prev) => !prev)}
            aria-haspopup="true"
            aria-expanded={dropdownOpen}
            aria-label="User menu"
            className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors duration-150 outline-none focus:ring-2 focus:ring-[#059669]"
          >
            <div className="w-8 h-8 rounded-full bg-[#047857] text-white text-xs font-bold flex items-center justify-center shrink-0 border border-emerald-600">
              {getInitial(user?.nama)}
            </div>
            <span className="hidden md:block text-sm font-medium text-[#0F172A] max-w-[140px] truncate">
              {user?.nama || 'Pengurus'}
            </span>
            <ChevronDown className="hidden md:block w-3.5 h-3.5 text-slate-400 shrink-0" />
          </button>

          {/* Dropdown Menu */}
          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white border border-[#E2E8F0] rounded-xl shadow-lg p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-3 py-2 border-b border-slate-100 mb-1">
                <p className="text-sm font-semibold text-[#0F172A] truncate">
                  {user?.nama || 'Pengurus Pondok'}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {getRoleBadge(user?.role)}
                </p>
              </div>

              <button
                onClick={handleLogout}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-red-50 text-red-600 text-sm font-medium flex items-center gap-2 transition-colors duration-150 outline-none"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {searchOpen && <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />}
    </header>
  );
};

export default Topbar;
