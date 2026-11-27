import React, { useLayoutEffect, useRef, useState, useEffect } from 'react';
import {
  Save,
  FileSignature,
  ReceiptText,
  Printer,
  Layout,
  UserRound,
  Loader2,
  Info,
  TriangleAlert,
  ChevronDown,
} from 'lucide-react';
import { getKwitansiConfig, KwitansiConfig, DEFAULT_KWITANSI_CONFIG } from '../../lib/pdfHelper';
import { kopSuratService } from '../../lib/kopSuratService';
import { pengaturanService } from '../../lib/pengaturanService';
import { ProfilPondok } from '../../types/pengaturan';
import { showToast } from '../../components/ui/Toast';
import { simpanKwitansiConfig } from '../../lib/kwitansiConfig';

/* ================= util kecil ala tab lain ================= */

const labelCls = 'block text-xs font-semibold text-slate-700 mb-1';
const inputCls =
  'w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#059669] focus:border-transparent outline-none text-slate-800 text-xs';
const selectCls = inputCls + ' bg-white cursor-pointer';

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  suffix = 'px',
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <div>
      <div className="flex justify-between text-[11px] text-slate-500 mb-0.5">
        <span className="font-semibold text-slate-700">{label}</span>
        <span className="font-semibold text-[#059669]">
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-emerald-600 cursor-pointer"
      />
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="flex items-start gap-2 text-xs text-slate-600 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 accent-[#059669] cursor-pointer mt-0.5 shrink-0"
      />
      <span className="font-medium">
        {label}
        {hint && <span className="block text-[11px] text-slate-400 font-normal">{hint}</span>}
      </span>
    </label>
  );
}

function PillGroup<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex-1 py-2 rounded-xl border text-[11px] font-semibold transition-colors cursor-pointer ${
            value === o.value
              ? 'border-[#059669] bg-[#059669] text-white shadow-sm'
              : 'border-slate-300 text-slate-600 hover:bg-slate-50'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Kartu accordion dengan header ala aplikasi */
function SectionCard({
  icon,
  title,
  desc,
  action,
  defaultOpen = true,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  action?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 border-b border-slate-100 cursor-pointer select-none hover:bg-slate-50/60 transition-colors outline-none"
        aria-expanded={open}
      >
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <span className="text-emerald-600 mt-0.5">{icon}</span>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">{title}</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">{desc}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          {action && (
            <span onClick={(e) => e.stopPropagation()} className="inline-flex">
              {action}
            </span>
          )}
          <span
            className={`p-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 transition-transform duration-200 ${
              open ? 'rotate-180' : ''
            }`}
            title={open ? 'Lipat' : 'Bentangkan'}
          >
            <ChevronDown className="w-4 h-4" />
          </span>
        </div>
      </div>
      {open && <div className="p-4 sm:p-5 space-y-3">{children}</div>}
    </div>
  );
}

/* ================= pratinjau mini ================= */

type ModePratinjau = 'hvs' | 'thermal';

/** Kwitansi HVS — replika layout generateKwitansiPdf pada kertas landscape */
function HvsPreview({ c, profil }: { c: KwitansiConfig; profil: ProfilPondok | null }) {
  const theme = c.hvs.warna_tema || '#059669';
  const kopDesain = c.gunakan_kop_desain ? kopSuratService.getImage() : null;
  const kopLines = (c.kop_surat || '').split('\n').filter((l) => l.trim());
  const slotGaris: React.CSSProperties = {
    borderBottom: '1px solid #64748b',
    margin: '0 4px',
  };
  return (
    <div
      style={{
        width: 560,
        minHeight: 380,
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 6,
        padding: 22,
        boxSizing: 'border-box',
        fontFamily: 'Arial, sans-serif',
        position: 'relative',
      }}
    >
      {kopDesain ? (
        <img src={kopDesain} alt="Kop" style={{ width: '100%', display: 'block', marginBottom: 6 }} />
      ) : (
        <div style={{ borderBottom: `2.5px double ${theme}`, paddingBottom: 8 }}>
          {kopLines.map((l, i) => (
            <div
              key={i}
              style={{
                fontSize: i === 0 ? 15 : 9,
                fontWeight: i === 0 ? 700 : 400,
                color: i === 0 ? theme : '#475569',
                lineHeight: 1.4,
                whiteSpace: 'pre-line',
              }}
            >
              {l}
            </div>
          ))}
          {c.hvs.tampilkan_pengasuh && (
            <div style={{ fontSize: 8, color: '#94a3b8', marginTop: 2 }}>
              Pengasuh: {(profil?.pengasuh || '-')}
            </div>
          )}
        </div>
      )}

      <div style={{ textAlign: 'center', marginTop: kopDesain ? 4 : 9 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', textTransform: 'uppercase' }}>
          {c.judul_kwitansi || 'KWITANSI PEMBAYARAN'}
        </div>
        <div style={{ fontSize: 8, color: '#94a3b8' }}>No: KWT-0001/DEMO</div>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 8,
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: 4,
          padding: '6px 8px',
          fontSize: 8,
          color: '#1e293b',
        }}
      >
        <div>
          <div>
            <b>Telah Terima Dari</b>: Santri Demo
          </div>
          <div>
            <b>NIS / Kategori</b>: 0001 (Syahriyah)
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div>
            <b>Tanggal Bayar</b>: 08 November 2026
          </div>
          <div>
            <b>Metode</b>: Tunai
          </div>
        </div>
      </div>

      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          marginTop: 7,
          fontSize: c.hvs.ukuran_font,
        }}
      >
        <thead>
          <tr>
            <th
              style={{
                background: theme,
                color: '#fff',
                border: '1px solid #cbd5e1',
                padding: '2px 6px',
                fontSize: (c.hvs.ukuran_font || 8) + 0.5,
                width: 24,
              }}
            >
              No
            </th>
            <th
              style={{
                background: theme,
                color: '#fff',
                border: '1px solid #cbd5e1',
                padding: '2px 6px',
                fontSize: (c.hvs.ukuran_font || 8) + 0.5,
                textAlign: 'left',
              }}
            >
              Rincian Pembayaran
            </th>
            <th
              style={{
                background: theme,
                color: '#fff',
                border: '1px solid #cbd5e1',
                padding: '2px 6px',
                fontSize: (c.hvs.ukuran_font || 8) + 0.5,
                width: 70,
              }}
            >
              Nominal
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ border: '1px solid #cbd5e1', padding: '2px 6px', textAlign: 'center' }}>1</td>
            <td style={{ border: '1px solid #cbd5e1', padding: '2px 6px' }}>Syahriyah Bulan November</td>
            <td style={{ border: '1px solid #cbd5e1', padding: '2px 6px', textAlign: 'right' }}>
              Rp150.000
            </td>
          </tr>
          <tr style={{ background: '#f1f5f9', fontWeight: 700 }}>
            <td colSpan={2} style={{ border: '1px solid #cbd5e1', padding: '2px 6px' }}>
              TOTAL PEMBAYARAN
            </td>
            <td style={{ border: '1px solid #cbd5e1', padding: '2px 6px', textAlign: 'right' }}>
              Rp150.000
            </td>
          </tr>
        </tbody>
      </table>

      <div style={{ fontSize: 7.5, color: '#334155', marginTop: 7 }}>
        {c.tampilkan_terbilang && (
          <div>
            <b>Terbilang :</b> <i># Seratus Lima Puluh Ribu Rupiah #</i>
          </div>
        )}
        <div style={{ color: '#94a3b8', marginTop: 2 }}>
          Catatan: {c.footer_kwitansi || '-'}
        </div>
      </div>

      {c.hvs.tampilkan_tanda_tangan && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 18, fontSize: 8 }}>
          <div style={{ width: '30%', textAlign: 'center' }}>
            <div>Penyetor,</div>
            <div style={{ height: 26 }} />
            <div style={slotGaris} />
          </div>
          <div style={{ width: '34%', textAlign: 'center' }}>
            <div>
              {c.kota_kuitansi || 'Pare'}, 08 November 2026
            </div>
            <div>{c.gelar_penandatangan || 'Bendahara Pondok'},</div>
            <div style={{ height: 26 }} />
            <div style={slotGaris} />
            <div style={{ fontWeight: 700, marginTop: 2 }}>
              {c.nama_penandatangan || '-'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Struk thermal — replika layout printKwitansiHtml pada kertas 58/80mm (hitam-putih) */
function ThermalPreview({ c, profil }: { c: KwitansiConfig; profil: ProfilPondok | null }) {
  const ink = '#1a1a1a';
  const kopDesain = c.gunakan_kop_desain ? kopSuratService.getImage() : null;
  const kopLines = (c.kop_surat || '').split('\n').filter((l) => l.trim());
  const lebar = c.thermal.lebar === '58' ? 232 : 320; // px ~ mm*4
  return (
    <div
      style={{
        width: lebar,
        minHeight: 200,
        background: '#fff',
        boxShadow: '0 1px 4px rgba(0,0,0,.15)',
        padding: 12,
        boxSizing: 'border-box',
        fontFamily: "'Courier New', monospace",
        fontSize: c.thermal.ukuran_font + 2,
        lineHeight: 1.45,
        color: ink,
      }}
    >
      {kopDesain ? (
        <img src={kopDesain} alt="Kop" style={{ width: '100%', display: 'block', marginBottom: 6 }} />
      ) : (
        <div style={{ borderBottom: `2px ${c.thermal.garis} ${ink}`, paddingBottom: 7, marginBottom: 8 }}>
          {kopLines.map((l, i) => (
            <div
              key={i}
              style={{
                fontSize: i === 0 ? 14 : 10,
                fontWeight: i === 0 ? 700 : 400,
                color: i === 0 ? ink : '#4a4a4a',
                textAlign: 'center',
              }}
            >
              {l}
            </div>
          ))}
          {c.thermal.tampilkan_pengasuh && (
            <div style={{ fontSize: 9, color: '#8a8a8a', textAlign: 'center' }}>
              Pengasuh: {profil?.pengasuh || '-'}
            </div>
          )}
        </div>
      )}

      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <div style={{ fontWeight: 700, textTransform: 'uppercase' }}>
          {c.judul_kwitansi || 'KWITANSI PEMBAYARAN'}
        </div>
        <div style={{ fontSize: 9, color: '#4a4a4a' }}>No: KWT-0001/DEMO</div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: c.thermal.ukuran_font }}>
        <thead>
          <tr>
            <th
              style={{
                background: ink,
                color: '#fff',
                border: '1px solid #b3b3b3',
                padding: '2px 4px',
                width: 22,
              }}
            >
              No
            </th>
            <th
              style={{
                background: ink,
                color: '#fff',
                border: '1px solid #b3b3b3',
                padding: '2px 4px',
                textAlign: 'left',
              }}
            >
              Rincian
            </th>
            <th
              style={{
                background: ink,
                color: '#fff',
                border: '1px solid #b3b3b3',
                padding: '2px 4px',
                width: 62,
              }}
            >
              Nominal
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ border: '1px solid #b3b3b3', padding: '2px 4px', textAlign: 'center' }}>1</td>
            <td style={{ border: '1px solid #b3b3b3', padding: '2px 4px' }}>Syahriyah Nov</td>
            <td style={{ border: '1px solid #b3b3b3', padding: '2px 4px', textAlign: 'right' }}>
              150.000
            </td>
          </tr>
          <tr style={{ background: '#ececec', fontWeight: 700 }}>
            <td colSpan={2} style={{ border: '1px solid #b3b3b3', padding: '2px 4px', textAlign: 'right' }}>
              TOTAL
            </td>
            <td style={{ border: '1px solid #b3b3b3', padding: '2px 4px', textAlign: 'right' }}>
              150.000
            </td>
          </tr>
        </tbody>
      </table>

      {c.tampilkan_terbilang && (
        <div
          style={{
            background: '#f5f5f5',
            border: '1px solid #bbbbbb',
            borderRadius: 4,
            padding: '4px 6px',
            marginTop: 7,
            fontSize: c.thermal.ukuran_font,
            fontStyle: 'italic',
            color: ink,
          }}
        >
          Terbilang: # Seratus Lima Puluh Ribu #
        </div>
      )}

      <div style={{ fontSize: c.thermal.ukuran_font - 1, color: '#4a4a4a', marginTop: 5 }}>
        {c.footer_kwitansi || ''}
      </div>

      {c.thermal.tampilkan_tanda_tangan && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
          <div style={{ width: '46%' }}>
            <div>Penyetor,</div>
            <div style={{ height: 26 }} />
            <div style={{ borderBottom: '1px solid #333333', margin: '0 2px' }} />
          </div>
          <div style={{ width: '46%', textAlign: 'center' }}>
            <div>{c.kota_kuitansi || 'Pare'}, 08 Nov 2026</div>
            <div style={{ fontWeight: 700 }}>{c.gelar_penandatangan || 'Bendahara Pondok'},</div>
            <div style={{ height: 26 }} />
            <div style={{ borderBottom: '1px solid #333333', margin: '0 2px' }} />
            <div style={{ fontWeight: 700 }}>{c.nama_penandatangan || '-'}</div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= halaman utama ================= */

const STORAGE_KEY_KWITANSI = 'al_hidayah_kwitansi_config';

export const KwitansiTab: React.FC = () => {
  const [config, setConfig] = useState<KwitansiConfig>(DEFAULT_KWITANSI_CONFIG);
  const [profil, setProfil] = useState<ProfilPondok | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [modePratinjau, setModePratinjau] = useState<ModePratinjau>('hvs');

  useEffect(() => {
    let mounted = true;
    getKwitansiConfig().then((c) => { if (mounted) setConfig(c); });
    pengaturanService.getProfil().then((p) => { if (mounted) setProfil(p); });
    return () => { mounted = false; };
  }, []);

  const previewAreaRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(1);

  const patch = (p: Partial<KwitansiConfig>) => setConfig((c) => ({ ...c, ...p }));
  const patchThermal = (p: Partial<KwitansiConfig['thermal']>) =>
    setConfig((c) => ({ ...c, thermal: { ...c.thermal, ...p } }));
  const patchHvs = (p: Partial<KwitansiConfig['hvs']>) =>
    setConfig((c) => ({ ...c, hvs: { ...c.hvs, ...p } }));

  /* Responsif: skala pratinjau kertas mengikuti lebar kolom */
  useLayoutEffect(() => {
    const measure = () => {
      const el = previewAreaRef.current;
      if (!el) return;
      const available = el.clientWidth - 32;
      if (available <= 0) return;
      const paperWidth = modePratinjau === 'hvs' ? 560 : config.thermal.lebar === '58' ? 232 : 320;
      setPreviewScale(Math.min(1, available / paperWidth));
    };
    measure();
    const obs = new ResizeObserver(measure);
    if (previewAreaRef.current) obs.observe(previewAreaRef.current);
    window.addEventListener('resize', measure);
    return () => {
      obs.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [modePratinjau, config.thermal.lebar]);

  const kopDesainTersedia = kopSuratService.isAktif();

  const isiPenandatanganDariProfil = async () => {
    const p = await pengaturanService.getProfil();
    if (!p.bendahara && !p.ketua && !p.pengasuh) {
      showToast('Profil Pondok belum memiliki nama pengurus.', 'error');
      return;
    }
    patch({
      nama_penandatangan: p.bendahara || p.ketua || p.pengasuh,
      gelar_penandatangan: p.bendahara ? 'Bendahara Pondok' : 'Pimpinan Pondok',
    });
    showToast('Nama penandatangan diisi dari Profil Pondok.', 'success');
  };

  const simpan = async () => {
    if (!(config.kop_surat || '').trim() && !(config.gunakan_kop_desain && kopDesainTersedia)) {
      showToast('Kop kwitansi masih kosong — isi terlebih dahulu.', 'error');
      return;
    }
    if (config.gunakan_kop_desain && !kopDesainTersedia) {
      showToast(
        'Desain Kop Surat belum aktif — kwitansi akan memakai kop teks. Aktifkan kop di tab Desain Kop Surat agar dipakai.',
        'info'
      );
    }
    setIsSaving(true);
    try {
      await simpanKwitansiConfig(config);
      showToast('Desain Kwitansi berhasil disimpan!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Gagal menyimpan desain kwitansi.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const paperWidth =
    modePratinjau === 'hvs' ? 560 : config.thermal.lebar === '58' ? 232 : 320;

  return (
    <div className="space-y-5">
      {/* Kartu header */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 border-b border-slate-100">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <FileSignature className="w-5 h-5 text-emerald-600" />
              Desain Kwitansi
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Atur kop, konten, dan tanda tangan yang tercetak pada PDF kuitansi (HVS) dan struk
              thermal — berlaku otomatis saat pembayaran disimpan.
            </p>
          </div>
          <button
            type="button"
            onClick={simpan}
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm cursor-pointer disabled:opacity-60 shrink-0"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{isSaving ? 'Menyimpan…' : 'Simpan Desain Kwitansi'}</span>
          </button>
        </div>

        <div className="p-4 bg-emerald-50/60 border-b border-emerald-100 flex items-start gap-2 text-xs text-emerald-800">
          <Info className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
          <span>
            Tab ini khusus <b>kuitansi/struk pembayaran</b>. Untuk kop yang dipakai di
            <b> laporan &amp; rekap PDF</b>, gunakan tab <b>Desain Kop Surat</b>. Keduanya bisa
            dihubungkan — aktifkan opsi <b>Gunakan kop Desain Kop Surat</b> di bawah.
          </span>
        </div>
      </div>

      {/* Grid utama: editor kiri, preview kanan */}
      <div className="flex flex-col xl:flex-row items-start gap-5">
        {/* Kolom editor */}
        <div className="space-y-5 w-full xl:w-[420px] shrink-0">
          <SectionCard
            icon={<ReceiptText className="w-5 h-5" />}
            title="Konten Kwitansi"
            desc="Judul, kop, catatan/footer, dan terbilang."
          >
            <div>
              <label className={labelCls}>Judul Kwitansi</label>
              <input
                type="text"
                value={config.judul_kwitansi}
                onChange={(e) => patch({ judul_kwitansi: e.target.value })}
                className={inputCls}
                placeholder="KWITANSI PEMBAYARAN"
              />
            </div>
            <div>
              <label className={labelCls}>Kop Surat (per baris)</label>
              <textarea
                rows={3}
                value={config.kop_surat}
                onChange={(e) => patch({ kop_surat: e.target.value })}
                className={inputCls}
                placeholder={'PONDOK AL HIDAYAH TERTEK\nJln. Mayor Bismo No 71-73 Tertek Pare Kediri'}
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Baris 1 tampil tebal berwarna tema; baris berikutnya tampil kecil di bawahnya.
              </p>
            </div>
            <div>
              <label className={labelCls}>Footer / Catatan</label>
              <input
                type="text"
                value={config.footer_kwitansi}
                onChange={(e) => patch({ footer_kwitansi: e.target.value })}
                className={inputCls}
              />
            </div>
            <div className="space-y-2 pt-1 border-t border-slate-100">
              <Toggle
                checked={config.tampilkan_terbilang}
                onChange={(v) => patch({ tampilkan_terbilang: v })}
                label="Tampilkan terbilang"
                hint={'Baris "Terbilang: # … #" tercetak di bawah tabel'}
              />
              <Toggle
                checked={config.gunakan_kop_desain}
                onChange={(v) => patch({ gunakan_kop_desain: v })}
                label="Gunakan gambar kop dari tab Desain Kop Surat"
                hint={
                  kopDesainTersedia
                    ? 'Kop aktif ✓ — digunakan pada kwitansi & struk'
                    : 'Kop belum aktif — aktifkan dulu di tab Desain Kop Surat'
                }
              />
            </div>
          </SectionCard>

          <SectionCard
            icon={<Printer className="w-5 h-5 text-emerald-600" />}
            title="Cetak Otomatis (Auto-Print)"
            desc="Opsi untuk langsung membuka jendela cetak struk begitu pembayaran berhasil."
            defaultOpen={true}
          >
            <Toggle
              checked={config.auto_print}
              onChange={(v) => patch({ auto_print: v })}
              label="Aktifkan Auto-Print saat Pembayaran Berhasil"
              hint="Jendela dialog cetak akan langsung terbuka otomatis tanpa klik manual."
            />
            {config.auto_print && (
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <label className={labelCls}>Mode Cetak Otomatis</label>
                <PillGroup
                  value={config.auto_print_mode}
                  options={[
                    { value: 'thermal', label: 'Cetak Thermal (Struk POS)' },
                    { value: 'hvs', label: 'Cetak HVS (Format Kwitansi)' },
                  ]}
                  onChange={(v) => patch({ auto_print_mode: v })}
                />
              </div>
            )}
          </SectionCard>

          <SectionCard
            icon={<Layout className="w-5 h-5" />}
            title="Kuitansi PDF (HVS)"
            desc="Ukuran kertas, font, warna tema, dan pengasuh pada PDF yang diunduh."
            defaultOpen={false}
          >
            <div>
              <label className={labelCls}>Ukuran Kertas</label>
              <PillGroup
                value={config.hvs.ukuran_kertas}
                options={[
                  { value: 'A5', label: 'A5 Landscape' },
                  { value: 'A4', label: 'A4 Landscape' },
                ]}
                onChange={(v) => patchHvs({ ukuran_kertas: v })}
              />
            </div>
            <div>
              <label className={labelCls}>Ukuran Font Tabel</label>
              <PillGroup
                value={String(config.hvs.ukuran_font) as '8' | '9' | '10'}
                options={[
                  { value: '8', label: 'Kecil (8)' },
                  { value: '9', label: 'Sedang (9)' },
                  { value: '10', label: 'Besar (10)' },
                ]}
                onChange={(v) => patchHvs({ ukuran_font: Number(v) as 8 | 9 | 10 })}
              />
            </div>
            <div>
              <label className={labelCls}>
                Warna Tema{' '}
                <span className="font-normal text-slate-400">
                  (khusus Kuitansi PDF — struk thermal selalu hitam-putih)
                </span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={config.hvs.warna_tema}
                  onChange={(e) => patchHvs({ warna_tema: e.target.value })}
                  className="w-12 h-9 rounded-xl border border-slate-300 bg-white p-1 cursor-pointer"
                />
                <span className="text-[11px] text-slate-500 font-mono" style={{ color: config.hvs.warna_tema }}>
                  {config.hvs.warna_tema}
                </span>
              </div>
            </div>
            <div className="space-y-2 pt-1 border-t border-slate-100">
              <Toggle
                checked={config.hvs.tampilkan_pengasuh}
                onChange={(v) => patchHvs({ tampilkan_pengasuh: v })}
                label="Tampilkan pengasuh pada kop"
              />
              <Toggle
                checked={config.hvs.tampilkan_tanda_tangan}
                onChange={(v) => patchHvs({ tampilkan_tanda_tangan: v })}
                label="Tampilkan blok tanda tangan"
              />
            </div>
          </SectionCard>

          <SectionCard
            icon={<Printer className="w-5 h-5" />}
            title="Struk Thermal"
            desc="Pengaturan struk 58/80 mm untuk jendela cetak langsung — selalu hitam-putih."
            defaultOpen={false}
          >
            <div>
              <label className={labelCls}>Lebar Kertas</label>
              <PillGroup
                value={config.thermal.lebar}
                options={[
                  { value: '58', label: '58 mm' },
                  { value: '80', label: '80 mm' },
                ]}
                onChange={(v) => patchThermal({ lebar: v })}
              />
            </div>
            <div>
              <label className={labelCls}>Ukuran Font</label>
              <PillGroup
                value={String(config.thermal.ukuran_font) as '9' | '10' | '11'}
                options={[
                  { value: '9', label: 'Kecil (9)' },
                  { value: '10', label: 'Sedang (10)' },
                  { value: '11', label: 'Besar (11)' },
                ]}
                onChange={(v) => patchThermal({ ukuran_font: Number(v) as 9 | 10 | 11 })}
              />
            </div>
            <div>
              <label className={labelCls}>Jenis Garis Separator</label>
              <PillGroup
                value={config.thermal.garis}
                options={[
                  { value: 'solid', label: '───── Solid' },
                  { value: 'dashed', label: '╌╌╌╌╌ Dashed' },
                ]}
                onChange={(v) => patchThermal({ garis: v })}
              />
            </div>
            <div className="space-y-2 pt-1 border-t border-slate-100">
              <Toggle
                checked={config.thermal.tampilkan_pengasuh}
                onChange={(v) => patchThermal({ tampilkan_pengasuh: v })}
                label="Tampilkan pengasuh pada kop"
              />
              <Toggle
                checked={config.thermal.tampilkan_tanda_tangan}
                onChange={(v) => patchThermal({ tampilkan_tanda_tangan: v })}
                label="Tampilkan blok tanda tangan"
              />
            </div>
          </SectionCard>

          <SectionCard
            icon={<UserRound className="w-5 h-5" />}
            title="Penandatangan"
            desc="Nama, jabatan, dan kota pada blok tanda tangan."
          >
            <div>
              <label className={labelCls}>Nama Penandatangan</label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={config.nama_penandatangan}
                  onChange={(e) => patch({ nama_penandatangan: e.target.value })}
                  className={inputCls}
                  placeholder="Nama pengurus…"
                />
                <button
                  type="button"
                  onClick={isiPenandatanganDariProfil}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shrink-0"
                >
                  Isi dari Profil
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>Jabatan</label>
                <input
                  type="text"
                  value={config.gelar_penandatangan}
                  onChange={(e) => patch({ gelar_penandatangan: e.target.value })}
                  className={inputCls}
                  placeholder="Bendahara Pondok"
                />
              </div>
              <div>
                <label className={labelCls}>Kota</label>
                <input
                  type="text"
                  value={config.kota_kuitansi}
                  onChange={(e) => patch({ kota_kuitansi: e.target.value })}
                  className={inputCls}
                  placeholder="Pare"
                />
              </div>
            </div>
          </SectionCard>
        </div>

        {/* Kolom pratinjau */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex-1 w-full">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <span className="text-emerald-600">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </span>
                Pratinjau Langsung
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Contoh aktif (bukan data asli) — ikut berubah setiap opsi diatur.
              </p>
            </div>
            <div className="flex gap-2 shrink-0 self-start">
              <button
                type="button"
                onClick={() => setModePratinjau('hvs')}
                className={`px-3 py-1.5 rounded-xl border text-[11px] font-semibold transition-colors cursor-pointer ${
                  modePratinjau === 'hvs'
                    ? 'border-[#059669] bg-[#059669] text-white'
                    : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                }`}
              >
                📄 Kuitansi PDF
              </button>
              <button
                type="button"
                onClick={() => setModePratinjau('thermal')}
                className={`px-3 py-1.5 rounded-xl border text-[11px] font-semibold transition-colors cursor-pointer ${
                  modePratinjau === 'thermal'
                    ? 'border-[#059669] bg-[#059669] text-white'
                    : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                }`}
              >
                🖨️ Struk Thermal
              </button>
            </div>
          </div>

          {!config.gunakan_kop_desain && !(config.kop_surat || '').trim() && (
            <div className="p-3 bg-amber-50 border-b border-amber-100 flex items-start gap-2 text-[11px] text-amber-800">
              <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
              Kop masih kosong — kwitansi akan tercetak tanpa kop. Isi kop atau aktifkan kop Desain
              Kop Surat.
            </div>
          )}

          <div
            ref={previewAreaRef}
            className="bg-slate-100/80 p-4 sm:p-8 flex justify-center overflow-hidden"
          >
            <div style={{ width: paperWidth * previewScale, height: 'auto' }}>
              <div
                style={{
                  transform: `scale(${previewScale})`,
                  transformOrigin: 'top left',
                  width: paperWidth,
                }}
              >
                <div ref={paperRef}>
                  {modePratinjau === 'hvs' ? (
                    <HvsPreview c={config} profil={profil} />
                  ) : (
                    <ThermalPreview c={config} profil={profil} />
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-white border-t border-slate-100 flex items-start gap-2 text-[11px] text-slate-500">
            <Info className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
            <span>
              Desain disimpan setelah tombol <b>Simpan Desain Kwitansi</b> ditekan, lalu otomatis
              dipakai kwitansi yang dihasilkan modal pembayaran Syahriyah &amp; Kilatan.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KwitansiTab;
