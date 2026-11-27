import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Building2,
  Image as ImageIcon,
  Type,
  Layout,
  Minus,
  Save,
  RefreshCw,
  CheckCircle2,
  TriangleAlert,
  Download,
  XCircle,
  Loader2,
  ChevronDown,
} from 'lucide-react';
import { getKopPaperSize, KopPreview } from './KopPreview';
import {
  isiDariProfilPondok,
  kopSuratService,
} from '../../lib/kopSuratService';
import {
  KopLineConfig,
  KopLogoConfig,
  KopSuratConfig,
  KopTextRow,
} from '../../types/kopSurat';
import { showToast } from '../../components/ui/Toast';

/* ================= sel kecil ala komponen aplikasi ================= */

const labelCls = 'block text-xs font-semibold text-slate-700 mb-1';
const inputCls =
  'w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#059669] focus:border-transparent outline-none text-slate-800 text-xs';
const selectCls = inputCls + ' bg-white cursor-pointer';
const fileCls =
  'block w-full text-[11px] text-slate-500 file:mr-2 file:px-3 file:py-1.5 file:rounded-xl file:border-0 file:bg-emerald-50 file:text-emerald-700 file:text-[11px] file:font-semibold';

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
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: React.ReactNode;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 accent-[#059669] cursor-pointer"
      />
      <span className="font-medium">{label}</span>
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

/** Kartu dengan header ala aplikasi — bisa collapse (accordion) */
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
            <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
              {title}
            </h3>
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

/* ================= editor baris teks ================= */

/** Font yang tersedia (senada situs referensi, plus beberapa) */
const FONT_OPTIONS: Array<{ value: KopTextRow['font']; label: string }> = [
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: "'Times New Roman', serif", label: 'Times New Roman' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: 'Verdana, sans-serif', label: 'Verdana' },
  { value: "'Segoe UI', sans-serif", label: 'Segoe UI' },
  { value: 'Helvetica, sans-serif', label: 'Helvetica' },
  { value: 'Calibri, sans-serif', label: 'Calibri' },
  { value: "'Trebuchet MS', sans-serif", label: 'Trebuchet MS' },
  { value: 'Impact, sans-serif', label: 'Impact' },
];

function BarisEditor({
  name,
  row,
  onChange,
  editableText = false,
  hint,
  defaultOpen = false,
}: {
  name: string;
  row: KopTextRow;
  onChange: (patch: Partial<KopTextRow>) => void;
  editableText?: boolean;
  hint?: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const fontLabel =
    FONT_OPTIONS.find((f) => f.value === row.font)?.label ?? row.font;
  const ringkas: string[] = [
    fontLabel,
    `${row.size}px`,
    row.bold ? 'Bold' : '',
    row.italic ? 'Italic' : '',
    row.uppercase ? 'Kapital' : '',
    `${row.opacity}%`,
  ].filter(Boolean);

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      {/* Header baris — klik utk buka/lipat */}
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
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 cursor-pointer select-none hover:bg-slate-50/60 transition-colors outline-none bg-white"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-xs font-bold text-slate-700 min-w-0">
          <input
            type="checkbox"
            checked={row.visible}
            onChange={(e) => onChange({ visible: e.target.checked })}
            onClick={(e) => e.stopPropagation()}
            className="w-4 h-4 accent-[#059669] cursor-pointer shrink-0"
          />
          <span className="truncate">{name}</span>
        </span>
        <span className="flex items-center gap-2 shrink-0">
          {!open && (
            <span className="text-[10px] text-slate-400 truncate max-w-[140px] hidden sm:inline">
              {ringkas.join(' · ')}
            </span>
          )}
          <span
            className={`p-1 rounded-lg border border-slate-200 text-slate-500 transition-transform duration-200 ${
              open ? 'rotate-180' : ''
            }`}
            title={open ? 'Lipat' : 'Bentangkan'}
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </span>
        </span>
      </div>

      {open && (
        <div className="px-3 pb-3 pt-1 space-y-2 bg-white border-t border-slate-100">
          {hint && <span className="text-[11px] text-slate-400">{hint}</span>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] text-slate-500 mb-0.5">Font</label>
              <select
                value={row.font}
                onChange={(e) => onChange({ font: e.target.value as KopTextRow['font'] })}
                className={selectCls}
              >
                {FONT_OPTIONS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
            <Slider
              label="Ukuran"
              value={row.size}
              min={8}
              max={48}
              onChange={(v) => onChange({ size: v })}
            />
          </div>

          {editableText && (
            <div>
              <label className="block text-[11px] text-slate-500 mb-0.5">Isi teks baris</label>
              <input
                type="text"
                value={row.text ?? ''}
                onChange={(e) => onChange({ text: e.target.value })}
                className={inputCls}
                placeholder="Tulis teks baris…"
              />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-slate-600">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={row.bold}
                onChange={(e) => onChange({ bold: e.target.checked })}
                className="w-3.5 h-3.5 accent-[#059669]"
              />
              Bold
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={row.italic}
                onChange={(e) => onChange({ italic: e.target.checked })}
                className="w-3.5 h-3.5 accent-[#059669]"
              />
              Italic
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={row.uppercase}
                onChange={(e) => onChange({ uppercase: e.target.checked })}
                className="w-3.5 h-3.5 accent-[#059669]"
              />
              Kapital
            </label>
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-slate-500">Warna</span>
              <input
                type="color"
                value={row.color}
                onChange={(e) => onChange({ color: e.target.value })}
                className="w-8 h-7 rounded-lg border border-slate-300 bg-white p-0.5 cursor-pointer"
              />
            </div>
            <Slider
              label="Opasitas"
              value={row.opacity}
              min={30}
              max={100}
              onChange={(v) => onChange({ opacity: v })}
              suffix="%"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Slider
              label="Line-height"
              value={row.lineHeight}
              min={0.8}
              max={3}
              step={0.05}
              onChange={(v) => onChange({ lineHeight: v })}
              suffix=""
            />
            <Slider
              label="Letter-spacing"
              value={row.letterSpacing}
              min={-2}
              max={12}
              step={0.1}
              onChange={(v) => onChange({ letterSpacing: v })}
            />
            <Slider
              label="Margin bawah"
              value={row.marginBottom}
              min={0}
              max={20}
              onChange={(v) => onChange({ marginBottom: v })}
            />
          </div>

          <div className="grid grid-cols-2 items-end gap-2">
            <div>
              <label className="block text-[11px] text-slate-500 mb-0.5">Align</label>
              <select
                value={row.align}
                onChange={(e) => onChange({ align: e.target.value as KopTextRow['align'] })}
                className={selectCls}
              >
                <option value="global">Mengikuti posisi global</option>
                <option value="left">Kiri</option>
                <option value="center">Tengah</option>
                <option value="right">Kanan</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= editor logo ================= */

function LogoEditor({
  title,
  desc,
  config,
  onChange,
  defaultOpen = true,
}: {
  title: string;
  desc: string;
  config: KopLogoConfig;
  onChange: (patch: Partial<KopLogoConfig>) => void;
  defaultOpen?: boolean;
}) {
  const handleFile = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Harap pilih file gambar.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      onChange({ dataUrl: String(e.target?.result || ''), visible: true });
      showToast('Logo berhasil dimuat.', 'success');
    };
    reader.readAsDataURL(file);
  };

  return (
    <SectionCard
      icon={<ImageIcon className="w-5 h-5" />}
      title={title}
      desc={desc}
      defaultOpen={defaultOpen}
      action={
        <Toggle checked={config.visible} onChange={(v) => onChange({ visible: v })} label="Tampilkan" />
      }
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-16 h-16 rounded-2xl border border-slate-200 bg-white flex items-center justify-center overflow-hidden shrink-0 ${
            config.shape === 'bulat' ? 'rounded-full' : config.shape === 'membulat' ? 'rounded-2xl' : 'rounded-2xl'
          }`}
        >
          {config.dataUrl ? (
            <img src={config.dataUrl} alt="Logo" className="w-full h-full object-contain" />
          ) : (
            <span className="text-[10px] text-slate-400 font-medium text-center leading-tight">
              Logo
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <label className={labelCls}>Pilih file gambar</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            className={fileCls}
          />
          {config.dataUrl && (
            <button
              type="button"
              onClick={() => onChange({ dataUrl: null })}
              className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-red-600 hover:text-red-700 cursor-pointer"
            >
              <XCircle className="w-3.5 h-3.5" /> Hapus logo
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
        <div>
          <label className="block text-[11px] text-slate-500 mb-0.5">Bentuk</label>
          <select
            value={config.shape}
            onChange={(e) => onChange({ shape: e.target.value as KopLogoConfig['shape'] })}
            className={selectCls}
          >
            <option value="asli">Asli</option>
            <option value="bulat">Bulat</option>
            <option value="membulat">Sudut Membulat</option>
          </select>
        </div>
        <div>
          <label className="block text-[11px] text-slate-500 mb-0.5">Latar</label>
          <select
            value={config.bg}
            onChange={(e) => onChange({ bg: e.target.value as KopLogoConfig['bg'] })}
            className={selectCls}
          >
            <option value="transparan">Transparan</option>
            <option value="putih">Putih</option>
            <option value="warna">Warna</option>
          </select>
        </div>
        {config.bg === 'warna' && (
          <div>
            <label className="block text-[11px] text-slate-500 mb-0.5">Warna latar</label>
            <input
              type="color"
              value={config.bgColor}
              onChange={(e) => onChange({ bgColor: e.target.value })}
              className="w-full h-[38px] rounded-xl border border-slate-300 bg-white p-1 cursor-pointer"
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Slider label="Ukuran" value={config.size} min={30} max={200} onChange={(v) => onChange({ size: v })} />
        <Slider label="Margin samping" value={config.marginX} min={0} max={60} onChange={(v) => onChange({ marginX: v })} />
        <Slider label="Margin atas" value={config.marginTop} min={0} max={60} onChange={(v) => onChange({ marginTop: v })} />
      </div>
    </SectionCard>
  );
}

/* ================= editor garis ================= */

function GarisEditor({
  nama,
  garis,
  onChange,
  withJarakGaris = false,
  jarakLabel,
}: {
  nama: string;
  garis: KopLineConfig;
  onChange: (patch: Partial<KopLineConfig>) => void;
  withJarakGaris?: boolean;
  jarakLabel?: string;
}) {
  return (
    <div className="border border-slate-200 rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <Toggle checked={garis.visible} onChange={(v) => onChange({ visible: v })} label={nama} />
        {withJarakGaris && (
          <span className="text-[11px] text-slate-400">jarak dari garis 1: {garis.jarakGaris}px</span>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label className="block text-[11px] text-slate-500 mb-0.5">Jenis</label>
          <select
            value={garis.jenis}
            onChange={(e) => onChange({ jenis: e.target.value as KopLineConfig['jenis'] })}
            className={selectCls}
          >
            <option value="solid">Solid</option>
            <option value="double">Double</option>
            <option value="dashed">Dashed</option>
            <option value="dotted">Dotted</option>
          </select>
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="block text-[11px] text-slate-500 mb-0.5">Warna</label>
            <input
              type="color"
              value={garis.warna}
              onChange={(e) => onChange({ warna: e.target.value })}
              className="w-full h-[38px] rounded-xl border border-slate-300 bg-white p-1 cursor-pointer"
            />
          </div>
          {withJarakGaris && (
            <div className="w-2/5">
              <Slider
                label={jarakLabel ?? 'Jarak ↓'}
                value={garis.jarakGaris}
                min={1}
                max={20}
                onChange={(v) => onChange({ jarakGaris: v })}
              />
            </div>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Slider label="Tebal" value={garis.tebal} min={1} max={12} onChange={(v) => onChange({ tebal: v })} />
        <Slider label="Jarak dari teks" value={garis.jarakTeks} min={0} max={40} onChange={(v) => onChange({ jarakTeks: v })} />
        <Slider label="Lebar" value={garis.lebar} min={10} max={100} onChange={(v) => onChange({ lebar: v })} suffix="%" />
      </div>
    </div>
  );
}

/* ================= halaman ================= */

type RowHandler = (patch: Partial<KopTextRow>) => void;

export const KopSuratTab: React.FC = () => {
  const [config, setConfig] = useState<KopSuratConfig>(() => kopSuratService.getConfig());
  const [sudahAktif, setSudahAktif] = useState<boolean>(() => kopSuratService.isAktif());
  const [updatedAt, setUpdatedAt] = useState<string>(() => kopSuratService.get()?.updatedAt ?? '');
  const [isSaving, setIsSaving] = useState(false);

  const paperRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(1);

  const patch = (p: Partial<KopSuratConfig>) => setConfig((c) => ({ ...c, ...p }));
  const patchLogo = (side: 'logoKiri' | 'logoKanan') => (p: Partial<KopLogoConfig>) =>
    setConfig((c) => ({ ...c, [side]: { ...c[side], ...p } }));
  const patchGaris = (key: 'garis1' | 'garis2') => (p: Partial<KopLineConfig>) =>
    setConfig((c) => ({ ...c, [key]: { ...c[key], ...p } }));
  const patchRow = (key: keyof KopSuratConfig): RowHandler => (p: Partial<KopTextRow>) =>
    setConfig((c) => ({ ...c, [key]: { ...(c[key] as KopTextRow), ...p } }));

  /* responsif: ukur lebar kontainer pratinjau, skala kertas utk muat */
  useLayoutEffect(() => {
    const measure = () => {
      const el = gridRef.current;
      if (!el) return;
      const available = el.clientWidth - 32; // padding kartu
      if (available <= 0) return;
      setPreviewScale(Math.min(1, available / getKopPaperSize(config.tinggiHalaman).width));
    };
    measure();
    const obs = new ResizeObserver(measure);
    if (gridRef.current) obs.observe(gridRef.current);
    window.addEventListener('resize', measure);
    return () => {
      obs.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [config.tinggiHalaman]);

  const isiProfil = async () => {
    const updated = await isiDariProfilPondok(config);
    setConfig(updated);
    showToast('Baris identitas diisi dari Profil Pondok.', 'success');
  };

  const simpanDanAktifkan = async () => {
    if (!paperRef.current) return;
    if (!config.namaPondok.trim()) {
      showToast('Nama Pondok wajib diisi.', 'error');
      return;
    }
    setIsSaving(true);
    try {
      const html2canvas = (await import('html2canvas')).default;

      // Matikan skala pratinjau sejenak agar hasil render 1:1 & tajam
      const wrapper = paperRef.current?.parentElement;
      const oldTransform = wrapper?.style.transform ?? '';
      if (wrapper) wrapper.style.transform = 'none';
      await new Promise((r) => requestAnimationFrame(r));

      const canvas = await html2canvas(paperRef.current, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      if (wrapper && oldTransform) wrapper.style.transform = oldTransform;

      const dataUrl = canvas.toDataURL('image/png');
      kopSuratService.save(config, dataUrl);
      setSudahAktif(true);
      setUpdatedAt(new Date().toISOString());
      showToast('Desain kop disimpan & aktif untuk PDF laporan.', 'success');
    } catch (err) {
      console.error(err);
      showToast('Gagal merender desain kop.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const muatTersimpan = () => {
    const stored = kopSuratService.get();
    if (!stored) {
      showToast('Belum ada desain tersimpan.', 'error');
      return;
    }
    setConfig(stored.config);
    setUpdatedAt(stored.updatedAt);
    setSudahAktif(Boolean(stored.image));
    showToast('Desain tersimpan dimuat ke editor.', 'success');
  };

  const reset = () => {
    setConfig(kopSuratService.getDefault());
    setSudahAktif(false);
    setUpdatedAt('');
    showToast('Editor direset ke desain default.', 'success');
  };

  const kopPaper = getKopPaperSize(config.tinggiHalaman);

  const barisRows: Array<{
    key: keyof KopSuratConfig;
    name: string;
    row: KopTextRow;
    editable?: boolean;
    hint?: string;
  }> = useMemo(
    () => [
      {
        key: 'barisYayasan',
        name: 'Baris 1 · Yayasan / Induk',
        row: config.barisYayasan,
        hint: 'opsional',
      },
      { key: 'barisPondok', name: 'Baris 2 · Nama Pondok', row: config.barisPondok, hint: 'utama' },
      {
        key: 'barisSubUnit',
        name: 'Baris 3 · Sub-unit',
        row: config.barisSubUnit,
        hint: 'opsional',
      },
      { key: 'barisKontak', name: 'Baris 4 · Kontak', row: config.barisKontak, hint: 'otomatis' },
      {
        key: 'barisRegistrasi',
        name: 'Baris 5 · Registrasi / NPWP',
        row: config.barisRegistrasi,
        editable: true,
      },
      { key: 'barisKustom', name: 'Baris 6 · Teks kustom', row: config.barisKustom, editable: true },
    ],
    [config]
  );

  const updatedAtLabel = useMemo(() => {
    if (!updatedAt) return '';
    try {
      return new Date(updatedAt).toLocaleString('id-ID');
    } catch {
      return updatedAt;
    }
  }, [updatedAt]);

  return (
    <div className="space-y-5">
      {/* Kartu header: status + aksi utama + preset */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 border-b border-slate-100">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <svg
                className="w-5 h-5 text-emerald-600"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 19l7-7 3 3-7 7-3-3z" />
                <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
              </svg>
              Desain Kop Surat
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Rancang kop surat pondok; ketika diaktifkan akan otomatis dipakai di PDF
              laporan/rekap pembukuan.
            </p>
          </div>
          <button
            type="button"
            onClick={simpanDanAktifkan}
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm cursor-pointer disabled:opacity-60 shrink-0"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{isSaving ? 'Memproses…' : 'Simpan & Aktifkan'}</span>
          </button>
        </div>

        <div
          className={`p-4 border-b ${
            sudahAktif
              ? 'bg-emerald-50/60 border-emerald-100 text-emerald-800'
              : 'bg-amber-50/60 border-amber-100 text-amber-800'
          } flex items-start gap-2 text-xs`}
        >
          {sudahAktif ? (
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
          ) : (
            <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
          )}
          <span>
            {sudahAktif ? (
              <>
                <b>Status Aktif</b> — kop tersimpan dipakai di semua PDF laporan/rekap.
                {updatedAtLabel && <> Terakhir disimpan: {updatedAtLabel}.</>}
              </>
            ) : (
              <>
                <b>Belum Aktif</b> — laporan masih memakai kop teks sederhana. Tekan{' '}
                <b>Simpan &amp; Aktifkan</b> agar desain ini dipakai.
              </>
            )}
          </span>
        </div>
      </div>

      {/* Grid utama: editor kiri, preview kanan */}
      <div className="flex flex-col xl:flex-row items-start gap-5">
        {/* Kolom editor */}
        <div className="space-y-5 w-full xl:w-[420px] shrink-0">
          {/* Informasi Instansi */}
          <SectionCard
            icon={<Building2 className="w-5 h-5" />}
            title="Informasi Instansi"
            desc="Teks identitas kop. Baris 4 (kontak) menyusun sendiri dari alamat, telepon, email, website, dan kode pos."
            action={
              <button
                type="button"
                onClick={isiProfil}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm cursor-pointer shrink-0"
              >
                <Download className="w-4 h-4" />
                Isi dari Profil Pondok
              </button>
            }
          >
            <div>
              <label className={labelCls}>Baris Yayasan / Induk (opsional)</label>
              <input
                type="text"
                value={config.namaYayasan}
                onChange={(e) => patch({ namaYayasan: e.target.value })}
                className={inputCls}
                placeholder="contoh: YAYASAN AL HIDAYAH TERTEK — kosongkan bila tidak dipakai"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Bila diisi, baris 1 otomatis menampilkan teks ini.
              </p>
            </div>
            <div>
              <label className={labelCls}>
                Nama Pondok <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={config.namaPondok}
                onChange={(e) => patch({ namaPondok: e.target.value })}
                className={inputCls}
                required
                placeholder="PONDOK PESANTREN …"
              />
            </div>
            <div>
              <label className={labelCls}>Sub-unit / Lembaga (opsional)</label>
              <input
                type="text"
                value={config.subUnit}
                onChange={(e) => patch({ subUnit: e.target.value })}
                className={inputCls}
                placeholder="Madrasah Diniyah / MTs / …"
              />
            </div>
            <div>
              <label className={labelCls}>Alamat</label>
              <textarea
                rows={2}
                value={config.alamat}
                onChange={(e) => patch({ alamat: e.target.value })}
                className={inputCls}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>Telepon</label>
                <input
                  type="text"
                  value={config.telepon}
                  onChange={(e) => patch({ telepon: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Email</label>
                <input
                  type="text"
                  value={config.email}
                  onChange={(e) => patch({ email: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Website</label>
                <input
                  type="text"
                  value={config.website}
                  onChange={(e) => patch({ website: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Kode Pos</label>
                <input
                  type="text"
                  value={config.kodePos}
                  onChange={(e) => patch({ kodePos: e.target.value })}
                  className={inputCls}
                />
              </div>
            </div>
          </SectionCard>

          <LogoEditor
            title="Logo Kiri"
            desc="Biasanya logo pondok/yayasan"
            config={config.logoKiri}
            onChange={patchLogo('logoKiri')}
          />

          <LogoEditor
            title="Logo Kanan"
            desc="Biasanya logo lembaga di bawah yayasan"
            config={config.logoKanan}
            onChange={patchLogo('logoKanan')}
            defaultOpen={false}
          />

          {/* Baris teks & tipografi */}
          <SectionCard
            icon={<Type className="w-5 h-5" />}
            title="Baris Teks & Tipografi"
            desc="Kontrol penuh per-baris: font, ukuran, gaya, jarak, warna, opasitas, align."
          >
            {barisRows.map((r) => (
              <BarisEditor
                key={r.key}
                name={r.name}
                row={r.row}
                onChange={patchRow(r.key)}
                editableText={r.editable}
                hint={r.hint}
                defaultOpen={r.key === 'barisPondok'}
              />
            ))}
          </SectionCard>

          {/* Layout & Kertas */}
          <SectionCard
            icon={<Layout className="w-5 h-5" />}
            title="Layout & Kertas"
            desc="Padding, posisi teks global, tinggi halaman, latar kertas, sudut membulat."
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Slider label="Padding Atas" value={config.padAtas} min={0} max={80} onChange={(v) => patch({ padAtas: v })} />
              <Slider label="Padding Bawah" value={config.padBawah} min={0} max={80} onChange={(v) => patch({ padBawah: v })} />
              <Slider label="Padding Kiri" value={config.padKiri} min={0} max={80} onChange={(v) => patch({ padKiri: v })} />
              <Slider label="Padding Kanan" value={config.padKanan} min={0} max={80} onChange={(v) => patch({ padKanan: v })} />
            </div>
            <Slider
              label="Jarak Logo ke Teks"
              value={config.jarakLogoTeks}
              min={5}
              max={60}
              onChange={(v) => patch({ jarakLogoTeks: v })}
            />
            <div>
              <label className={labelCls}>Posisi Teks (global)</label>
              <PillGroup
                value={config.posisiTeks}
                options={[
                  { value: 'kiri', label: '⬅ Kiri' },
                  { value: 'tengah', label: '⬤ Tengah' },
                  { value: 'kanan', label: '➡ Kanan' },
                ]}
                onChange={(v) => patch({ posisiTeks: v })}
              />
            </div>
            <div>
              <label className={labelCls}>Tinggi Halaman</label>
              <PillGroup
                value={config.tinggiHalaman}
                options={[
                  { value: 'kop', label: '📄 Kop Saja' },
                  { value: 'A4', label: '📜 A4' },
                  { value: 'F4', label: '📜 F4' },
                ]}
                onChange={(v) => patch({ tinggiHalaman: v })}
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Kop ini dipakai utuh di PDF laporan; pilih A4/F4 bila ingin pratinjau
                memperlihatkan ukuran kertas penuh.
              </p>
            </div>
            <div>
              <label className={labelCls}>Latar Kertas</label>
              <div className="flex gap-2 items-center">
                <div className="flex-1 grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => patch({ background: 'putih' })}
                    className={`py-2 rounded-xl border text-[11px] font-semibold cursor-pointer ${
                      config.background === 'putih'
                        ? 'border-[#059669] bg-[#059669] text-white'
                        : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    ⬜ Putih
                  </button>
                  <button
                    type="button"
                    onClick={() => patch({ background: 'abu' })}
                    className={`py-2 rounded-xl border text-[11px] font-semibold cursor-pointer ${
                      config.background === 'abu'
                        ? 'border-[#059669] bg-[#059669] text-white'
                        : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    🔲 Abu-abu
                  </button>
                  <button
                    type="button"
                    onClick={() => patch({ background: 'custom' })}
                    className={`py-2 rounded-xl border text-[11px] font-semibold cursor-pointer ${
                      config.background === 'custom'
                        ? 'border-[#059669] bg-[#059669] text-white'
                        : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    🎨 Custom
                  </button>
                </div>
                {config.background === 'custom' && (
                  <input
                    type="color"
                    value={config.customBg}
                    onChange={(e) => patch({ customBg: e.target.value })}
                    className="w-10 h-9 rounded-xl border border-slate-300 bg-white p-1 cursor-pointer shrink-0"
                  />
                )}
              </div>
            </div>
            <Slider
              label="Sudut Membulat Kertas"
              value={config.radius}
              min={0}
              max={20}
              onChange={(v) => patch({ radius: v })}
            />
          </SectionCard>

          {/* Garis */}
          <SectionCard
            icon={<Minus className="w-5 h-5" />}
            title="Garis Horizontal"
            desc="2 garis; masing-masing bisa dimatikan. Ada jenis, tebal, lebar, dan jarak."
          >
            <GarisEditor
              nama="Garis 1"
              garis={config.garis1}
              onChange={patchGaris('garis1')}
            />
            <GarisEditor
              nama="Garis 2"
              garis={config.garis2}
              onChange={patchGaris('garis2')}
              withJarakGaris
              jarakLabel="Jarak ↓ dari Garis 1"
            />
          </SectionCard>

          {/* Muat / reset */}
          <SectionCard
            icon={<RefreshCw className="w-5 h-5" />}
            title="Pengelolaan Desain"
            desc="Muat desain tersimpan atau kembalikan ke pengaturan awal."
            defaultOpen={false}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={muatTersimpan}
                className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
              >
                📂 Muat Tersimpan
              </button>
              <button
                type="button"
                onClick={reset}
                className="px-4 py-2 bg-[#DC2626] hover:bg-red-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                🔄 Reset ke Default
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Desain yang diaktifkan ikut tersimpan dalam Backup &amp; Restore.
            </p>
          </SectionCard>
        </div>

        {/* Kolom preview */}
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
                Pratinjau Kertas
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Skala otomatis mengikuti lebar layar; hasil yang disimpan identik dengan pratinjau ini.
              </p>
            </div>
            <span className="text-[11px] text-slate-500 bg-slate-100 rounded-full px-3 py-1 shrink-0 self-start">
              {config.tinggiHalaman === 'kop' ? 'Kop Saja' : config.tinggiHalaman} · {kopPaper.width} ×{' '}
              {config.tinggiHalaman === 'kop' ? 'auto' : kopPaper.minHeight} px
            </span>
          </div>

          <div
            ref={gridRef}
            className="bg-slate-100/80 p-4 sm:p-8 flex justify-center overflow-hidden"
          >
            {/* Wrapper hanya untuk skala; kertas asli tetap berukuran penuh */}
            <div
              style={{
                width: kopPaper.width * previewScale,
                height: 'auto',
              }}
            >
              <div
                style={{
                  transform: `scale(${previewScale})`,
                  transformOrigin: 'top left',
                  width: kopPaper.width,
                }}
              >
                <div ref={paperRef}>
                  <KopPreview config={config} />
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-white border-t border-slate-100 flex items-start gap-2 text-[11px] text-slate-500">
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
            <span>
              Saat <b>Simpan &amp; Aktifkan</b> ditekan, kertas ini dirender sekali jadi gambar
              (dataURL) dan disimpan; PDF laporan kemudian menempelkannya sebagai kop di setiap
              halaman.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KopSuratTab;
