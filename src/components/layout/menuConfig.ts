export interface MenuItem {
  key: string;
  label: string;
  path: string;
  icon: 'LayoutDashboard' | 'Users' | 'UserPlus' | 'Wallet' | 'CalendarDays' | 'HandCoins' | 'Banknote' | 'FileBarChart' | 'History' | 'Settings' | 'BadgeDollarSign';
  roles: Array<'super_admin' | 'admin' | 'pemilik'>;
}

export const MENU_CONFIG: MenuItem[] = [
  { key: 'dashboard',   label: 'Dashboard',   path: '/dashboard',      icon: 'LayoutDashboard', roles: ['super_admin', 'admin', 'pemilik'] },
  { key: 'santri',      label: 'Data Santri', path: '/santri',          icon: 'Users',           roles: ['super_admin', 'admin', 'pemilik'] },
  { key: 'pendaftaran', label: 'Pendaftaran', path: '/pendaftaran',     icon: 'UserPlus',        roles: ['super_admin', 'admin', 'pemilik'] },
  { key: 'syahriyah',   label: 'Syahriyah',   path: '/syahriyah',       icon: 'Wallet',          roles: ['super_admin', 'admin', 'pemilik'] },
  { key: 'keringanan',  label: 'Keringanan',  path: '/keringanan',    icon: 'BadgeDollarSign',  roles: ['super_admin', 'admin', 'pemilik'] },
  { key: 'kilatan',     label: 'Kilatan',     path: '/kilatan',         icon: 'CalendarDays',    roles: ['super_admin', 'admin', 'pemilik'] },
  { key: 'iuran',       label: 'Iuran',       path: '/iuran',           icon: 'HandCoins',      roles: ['super_admin', 'admin', 'pemilik'] },
  { key: 'kas',         label: 'Kas',         path: '/kas',             icon: 'Banknote',        roles: ['super_admin', 'admin', 'pemilik'] },
  { key: 'laporan',     label: 'Laporan',     path: '/laporan',         icon: 'FileBarChart',    roles: ['super_admin', 'admin', 'pemilik'] },
  { key: 'aktivitas',   label: 'Riwayat Aktivitas', path: '/aktivitas', icon: 'History',        roles: ['super_admin', 'admin'] },
  { key: 'pengaturan',  label: 'Pengaturan',  path: '/pengaturan',      icon: 'Settings',        roles: ['super_admin'] },
];
