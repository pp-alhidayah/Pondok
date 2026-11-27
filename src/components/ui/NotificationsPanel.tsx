import React, { useEffect, useState } from 'react';
import { Bell, AlertTriangle, Users, Wallet, UserPlus, CheckCircle2, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { syahriyahService } from '../../lib/syahriyahService';
import { kilatanService } from '../../lib/kilatanService';
import { kasService } from '../../lib/kasService';
import { pendaftaranService } from '../../lib/pendaftaranService';
import { formatRupiah } from '../../lib/formatter';

interface NotificationItem {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  path: string;
  tone: 'warning' | 'info' | 'danger' | 'success';
}

export const NotificationsPanel: React.FC = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);

  const currentYear = new Date().getFullYear();

  const load = async () => {
    setLoading(true);
    const items: NotificationItem[] = [];

    try {
      const [syahMatrix, kilMatrix, kas, pendaft] = await Promise.all([
        syahriyahService.getSyahriyahMatrix(currentYear),
        kilatanService.getKilatanMatrix(currentYear),
        kasService.getKasList(),
        pendaftaranService.getPendaftaranList(),
      ]);

      const tunggakSyahriyah = syahMatrix.filter(
        ({ records }) => records.some((r) => (r.nominal_tagihan > 0) && r.status !== 'Lunas'),
      ).length;

      const tunggakKilatan = kilMatrix.filter(
        ({ records }) => records.some((r) => (r.nominal_tagihan > 0) && r.status !== 'Lunas'),
      ).length;

      const saldo = kas.reduce((sum, k) => (k.jenis === 'Pemasukan' ? sum + k.nominal : sum - k.nominal), 0);

      const baru = pendaft.filter((p) => p.status === 'Baru').length;

      if (tunggakSyahriyah > 0) {
        items.push({
          id: 'syah-tunggak',
          icon: <AlertTriangle className="w-4 h-4 text-amber-600" />,
          title: `${tunggakSyahriyah} santri belum lunas syahriyah`,
          description: `Tahun ${currentYear}. Segera tindak lanjuti penagihan.`,
          path: '/syahriyah',
          tone: 'warning',
        });
      }

      if (tunggakKilatan > 0) {
        items.push({
          id: 'kil-tunggak',
          icon: <AlertTriangle className="w-4 h-4 text-amber-600" />,
          title: `${tunggakKilatan} santri belum lunas kilatan`,
          description: `Event tahun ${currentYear} belum dibayar lunas.`,
          path: '/kilatan',
          tone: 'warning',
        });
      }

      if (saldo < 0) {
        items.push({
          id: 'kas-negatif',
          icon: <Wallet className="w-4 h-4 text-red-600" />,
          title: `Saldo kas defisit ${formatRupiah(Math.abs(saldo))}`,
          description: 'Pengeluaran kas lebih besar dari pemasukan.',
          path: '/kas',
          tone: 'danger',
        });
      }

      if (baru > 0) {
        items.push({
          id: 'pend-baru',
          icon: <UserPlus className="w-4 h-4 text-blue-600" />,
          title: `${baru} pendaftaran baru menunggu verifikasi`,
          description: 'Silakan periksa dan terima/tolak calon santri.',
          path: '/pendaftaran',
          tone: 'info',
        });
      }

      if (items.length === 0) {
        items.push({
          id: 'all-clear',
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
          title: 'Semua beres',
          description: 'Tidak ada tunggakan atau tugas tersisa saat ini.',
          path: '/dashboard',
          tone: 'success',
        });
      }

      setNotifications(items);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const unreadCount = notifications.filter((n) => n.id !== 'all-clear').length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-10 h-10 rounded-lg hover:bg-slate-100 flex items-center justify-center relative text-[#0F172A] transition-colors duration-150 outline-none focus:ring-2 focus:ring-[#059669]"
        aria-label="Notifikasi"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="w-4 h-4 bg-red-500 rounded-full absolute top-2 right-2 flex items-center justify-center text-[9px] font-bold text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white border border-[#E2E8F0] rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50">
            <span className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
              Notifikasi
            </span>
            <button
              onClick={load}
              className="text-[11px] font-semibold text-[#059669] hover:underline"
            >
              Muat Ulang
            </button>
          </div>

          {loading ? (
            <div className="px-4 py-6 text-center text-xs text-slate-400">
              Memuat...
            </div>
          ) : notifications.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-slate-400">
              Tidak ada notifikasi
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    setOpen(false);
                    navigate(n.path);
                  }}
                  className="w-full flex items-start gap-3 px-4 py-3 hover:bg-slate-50 text-left border-b border-slate-100 last:border-b-0"
                >
                  <div className="mt-0.5 shrink-0">{n.icon}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-[#0F172A] leading-snug">
                      {n.title}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                      {n.description}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 shrink-0 mt-0.5" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationsPanel;
