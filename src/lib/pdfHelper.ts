import { storage } from './storage';
import { todayLocal, escapeHtml } from './core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { pengaturanService } from './pengaturanService';
import { kopSuratService } from './kopSuratService';
import { formatRupiah } from './formatter';
import { ProfilPondok } from '../types/pengaturan';
import { Santri } from '../types/santri';
import { showToast } from '../components/ui/Toast';

export interface KwitansiItem {
  deskripsi: string;
  nominal: number;
}

export interface KwitansiPdfInput {
  idTransaksi: string;
  tipe: 'Syahriyah' | 'Kilatan' | 'Lainnya';
  santri: Santri;
  tanggalBayar: string;
  metode: string;
  items: KwitansiItem[];
  iuranTambahan?: KwitansiItem[];
  totalPembayaran: number;
  keterangan?: string;
  profilPondok?: ProfilPondok;
}

export interface KwitansiConfig {
  kop_surat: string;
  footer_kwitansi: string;
  nama_penandatangan: string;
  /** Judul kwitansi yang tercetak (backward-compatible: field baru) */
  judul_kwitansi: string;
  /** Jabatan penandatangan, mis. "Bendahara Pondok" */
  gelar_penandatangan: string;
  /** Kota yang tercetak pada baris tanggal, mis. "Pare" */
  kota_kuitansi: string;
  /** Tampilkan baris "Terbilang: …" */
  tampilkan_terbilang: boolean;
  /** Gunakan gambar kop hasil tab "Desain Kop Surat" pada kwitansi HVS/struk */
  gunakan_kop_desain: boolean;
  /** Cetak otomatis setelah pembayaran berhasil dicatat */
  auto_print: boolean;
  /** Mode cetak otomatis: 'thermal' | 'hvs' */
  auto_print_mode: 'thermal' | 'hvs';
  thermal: {
    lebar: '58' | '80';
    ukuran_font: 9 | 10 | 11;
    tampilkan_pengasuh: boolean;
    tampilkan_tanda_tangan: boolean;
    garis: 'solid' | 'dashed';
  };
  hvs: {
    ukuran_kertas: 'A5' | 'A4';
    ukuran_font: 8 | 9 | 10;
    warna_tema: string;
    tampilkan_pengasuh: boolean;
    tampilkan_tanda_tangan: boolean;
  };
}

export const DEFAULT_KWITANSI_CONFIG: KwitansiConfig = {
  kop_surat: "PONDOK AL HIDAYAH TERTEK\nJln. Mayor Bismo No 71-73 Tertek Pare Kediri",
  footer_kwitansi: "Terima kasih atas pembayaran Anda",
  nama_penandatangan: "Shofil Mubarok",
  judul_kwitansi: "KWITANSI PEMBAYARAN",
  gelar_penandatangan: "Bendahara Pondok",
  kota_kuitansi: "Pare",
  tampilkan_terbilang: true,
  gunakan_kop_desain: false,
  auto_print: false,
  auto_print_mode: 'thermal',
  thermal: {
    lebar: "58",
    ukuran_font: 9,
    tampilkan_pengasuh: true,
    tampilkan_tanda_tangan: true,
    garis: "solid",
  },
  hvs: {
    ukuran_kertas: "A5",
    ukuran_font: 8,
    warna_tema: "#059669",
    tampilkan_pengasuh: true,
    tampilkan_tanda_tangan: true,
  },
};

export async function getKwitansiConfig(): Promise<KwitansiConfig> {
  const profil = await pengaturanService.getProfil();
  const defaultConfig: KwitansiConfig = { ...DEFAULT_KWITANSI_CONFIG, nama_penandatangan: profil.bendahara || "Shofil Mubarok" };
  try {
    const raw = storage.getItem('al_hidayah_kwitansi_config');
    if (!raw) return defaultConfig;
    const parsed = JSON.parse(raw);
    return {
      ...defaultConfig,
      ...parsed,
      judul_kwitansi: parsed.judul_kwitansi || defaultConfig.judul_kwitansi,
      gelar_penandatangan: parsed.gelar_penandatangan ?? defaultConfig.gelar_penandatangan,
      kota_kuitansi: parsed.kota_kuitansi ?? defaultConfig.kota_kuitansi,
      tampilkan_terbilang: parsed.tampilkan_terbilang ?? defaultConfig.tampilkan_terbilang,
      gunakan_kop_desain: parsed.gunakan_kop_desain ?? defaultConfig.gunakan_kop_desain,
      auto_print: parsed.auto_print ?? defaultConfig.auto_print,
      auto_print_mode: parsed.auto_print_mode || defaultConfig.auto_print_mode,
      thermal: { ...defaultConfig.thermal, ...parsed.thermal },
      hvs: { ...defaultConfig.hvs, ...parsed.hvs },
      nama_penandatangan: parsed.nama_penandatangan || profil.bendahara || "Shofil Mubarok",
    };
  } catch {
    return defaultConfig;
  }
}

// Terbilang Rupiah Helper
function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '');
  const value = normalized.length === 3
    ? normalized.split('').map((char) => char + char).join('')
    : normalized;
  const parsed = Number.parseInt(value, 16);
  return Number.isNaN(parsed)
    ? [5, 150, 105]
    : [(parsed >> 16) & 255, (parsed >> 8) & 255, parsed & 255];
}

export function terbilang(nominal: number): string {
  const angka = [
    '',
    'Satu',
    'Dua',
    'Tiga',
    'Empat',
    'Lima',
    'Enam',
    'Tujuh',
    'Delapan',
    'Sembilan',
    'Sepuluh',
    'Sebelas',
  ];
  const num = Math.floor(Math.abs(nominal));
  if (num === 0) return 'Nol Rupiah';

  function bilang(n: number): string {
    if (n < 12) return angka[n];
    if (n < 20) return bilang(n - 10) + ' Belas';
    if (n < 100) return bilang(Math.floor(n / 10)) + ' Puluh ' + bilang(n % 10);
    if (n < 200) return 'Seratus ' + bilang(n - 100);
    if (n < 1000) return bilang(Math.floor(n / 100)) + ' Ratus ' + bilang(n % 100);
    if (n < 2000) return 'Seribu ' + bilang(n - 1000);
    if (n < 1000000) return bilang(Math.floor(n / 1000)) + ' Ribu ' + bilang(n % 1000);
    if (n < 1000000000)
      return bilang(Math.floor(n / 1000000)) + ' Juta ' + bilang(n % 1000000);
    return n.toString();
  }

  return (bilang(num) + ' Rupiah').replace(/\s+/g, ' ').trim();
}

const MONTH_NAMES_IND = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

function formatDateIndo(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const year = parts[0];
    const monthIndex = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    if (monthIndex >= 0 && monthIndex < 12) {
      return `${day} ${MONTH_NAMES_IND[monthIndex]} ${year}`;
    }
  }
  return dateStr;
}

async function parseInputData(
  inputOrTransaksi: any,
  dataSantriOrProfil?: any,
  dataProfilParam?: any
): Promise<{ input: KwitansiPdfInput; profil: ProfilPondok; config: KwitansiConfig }> {
  let input: KwitansiPdfInput;

  if (
    inputOrTransaksi &&
    typeof inputOrTransaksi === 'object' &&
    'santri' in inputOrTransaksi
  ) {
    input = inputOrTransaksi as KwitansiPdfInput;
  } else {
    const tx = inputOrTransaksi || {};
    const santri = dataSantriOrProfil || tx.santri || {};
    const profilParam = dataProfilParam || tx.profilPondok;

    const items: KwitansiItem[] = [];

    if (Array.isArray(tx.items)) {
      tx.items.forEach((it: any) => {
        if (it.bulan) {
          const mName = MONTH_NAMES_IND[it.bulan - 1] || `Bulan ${it.bulan}`;
          items.push({
            deskripsi: `Syahriyah ${mName} ${it.tahun} (${it.jenis || 'Penuh'})`,
            nominal: it.nominal,
          });
        } else if (it.event) {
          items.push({
            deskripsi: `Iuran Kilatan ${it.event} ${it.tahun} (${it.jenis || 'Penuh'})`,
            nominal: it.nominal,
          });
        } else {
          items.push({
            deskripsi: it.deskripsi || it.nama || 'Iuran',
            nominal: it.nominal || 0,
          });
        }
      });
    }

    const iuranTambahan: KwitansiItem[] = [];
    if (
      tx.transaksi_data?.iuran_tambahan &&
      Array.isArray(tx.transaksi_data.iuran_tambahan)
    ) {
      tx.transaksi_data.iuran_tambahan.forEach((it: any) => {
        iuranTambahan.push({
          deskripsi: it.nama || 'Iuran Tambahan',
          nominal: it.nominal || 0,
        });
      });
    }

    input = {
      idTransaksi: tx.nomor_kuitansi || tx.id || `KWT-${Date.now()}`,
      tipe: tx.items?.[0]?.event ? 'Kilatan' : 'Syahriyah',
      santri: santri,
      tanggalBayar:
        tx.transaksi_data?.tanggal_bayar ||
        tx.tanggal ||
        todayLocal(),
      metode: tx.transaksi_data?.metode || tx.metode || 'Tunai',
      items,
      iuranTambahan,
      totalPembayaran: tx.total_pembayaran || tx.total || 0,
      keterangan: tx.transaksi_data?.keterangan || tx.keterangan || '',
      profilPondok: profilParam,
    };
  }

  const profil = input.profilPondok || await pengaturanService.getProfil();
  const config = await getKwitansiConfig();
  return { input, profil, config };
}

/**
 * Generates and downloads a Kwitansi PDF receipt for payments.
 */
export async function generateKwitansiPdf(
  inputOrTransaksi: any,
  dataSantriOrProfil?: any,
  dataProfilParam?: any
): Promise<void> {
  const { input, profil, config } = await parseInputData(
    inputOrTransaksi,
    dataSantriOrProfil,
    dataProfilParam
  );

  // Create A5 Landscape PDF
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: config.hvs.ukuran_kertas.toLowerCase(),
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const margin = 12;
  const themeRgb = hexToRgb(config.hvs.warna_tema || '#059669');
  const hvsFont = config.hvs.ukuran_font;

  // 1. KOP SURAT — gambar hasil "Desain Kop Surat" bila diaktifkan
  let kopHeightMm = 0;
  const kopDesainAktif = config.gunakan_kop_desain && kopSuratService.isAktif();
  if (kopDesainAktif) {
    const kopImage = kopSuratService.getImage();
    if (kopImage) {
      try {
        const kopWidth = pageWidth - 2 * margin;
        const kopProps = doc.getImageProperties(kopImage);
        kopHeightMm = Math.min(30, (kopProps.height / kopProps.width) * kopWidth);
        doc.addImage(kopImage, 'PNG', margin, 6, kopWidth, kopHeightMm);
      } catch {
        kopHeightMm = 0;
      }
    }
  }

  if (!kopDesainAktif || kopHeightMm === 0) {
    const kopLines = (config.kop_surat || '').split('\n').filter((l) => l.trim());
    const first = kopLines[0] || 'PONDOK AL HIDAYAH TERTEK';
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...themeRgb);
    doc.text(first, margin, 14);

    // Baris alamat/kontak dirender baris demi baris (bukan digabung koma)
    if (kopLines.length > 1) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105); // Slate 600
      kopLines.slice(1).forEach((line, i) => {
        doc.text(line, margin, 19 + i * 4);
      });
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    if (config.hvs.tampilkan_pengasuh) {
      const lastKopY = kopLines.length > 1 ? 19 + (kopLines.length - 2) * 4 : 14;
      doc.text(`Pengasuh: ${profil.pengasuh || '-'}`, margin, lastKopY + 5);
    }
  }

  const kopBottomY =
    kopDesainAktif && kopHeightMm > 0 ? 6 + kopHeightMm + 2 : 25;

  // Line separator below Kop
  doc.setDrawColor(...themeRgb);
  doc.setLineWidth(0.8);
  doc.line(margin, kopBottomY, pageWidth - margin, kopBottomY);

  doc.setDrawColor(203, 213, 225); // Slate 300
  doc.setLineWidth(0.2);
  doc.line(margin, kopBottomY + 1, pageWidth - margin, kopBottomY + 1);

  // 2. JUDUL KWITANSI & NOMOR
  let y = kopBottomY + 7;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42); // Slate 900
  doc.text((config.judul_kwitansi || 'KWITANSI PEMBAYARAN').toUpperCase(), pageWidth / 2, y, {
    align: 'center',
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`No: ${input.idTransaksi}`, pageWidth / 2, y + 4, { align: 'center' });

  // 3. INFORMASI SANTRI & TRANSAKSI
  const infoStartY = y + 10;
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);

  // Left Info
  doc.setFont('helvetica', 'bold');
  doc.text('Telah Terima Dari :', margin, infoStartY);
  doc.setFont('helvetica', 'normal');
  doc.text(input.santri.nama || '-', margin + 32, infoStartY);

  doc.setFont('helvetica', 'bold');
  doc.text('NIS / Kategori     :', margin, infoStartY + 5);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `${input.santri.nis || '-'} (${input.santri.kategori || 'Santri'})`,
    margin + 32,
    infoStartY + 5
  );

  // Right Info
  const rightX = 135;
  doc.setFont('helvetica', 'bold');
  doc.text('Tanggal Bayar :', rightX, infoStartY);
  doc.setFont('helvetica', 'normal');
  doc.text(formatDateIndo(input.tanggalBayar), rightX + 25, infoStartY);

  doc.setFont('helvetica', 'bold');
  doc.text('Metode            :', rightX, infoStartY + 5);
  doc.setFont('helvetica', 'normal');
  doc.text(input.metode || 'Tunai', rightX + 25, infoStartY + 5);

  // 4. TABEL RINCIAN
  const allItems = [...input.items, ...(input.iuranTambahan || [])];
  const tableRows = allItems.map((item, index) => [
    (index + 1).toString(),
    item.deskripsi,
    formatRupiah(item.nominal),
  ]);

  autoTable(doc, {
    startY: infoStartY + 9,
    margin: { left: margin, right: margin },
    head: [['No', 'Rincian Pembayaran', 'Nominal']],
    body: tableRows,
    foot: [['', 'TOTAL PEMBAYARAN', formatRupiah(input.totalPembayaran)]],
    theme: 'grid',
    headStyles: {
      fillColor: themeRgb,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: hvsFont + 0.5,
      cellPadding: 2,
    },
    bodyStyles: {
      fontSize: hvsFont,
      textColor: [30, 41, 59],
      cellPadding: 2,
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: hvsFont + 0.5,
      cellPadding: 2,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 40, halign: 'right' },
    },
  });

  // @ts-ignore
  const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY : infoStartY + 35;

  // 5. TERBILANG (opsional) & CATATAN
  let currentY = finalY + 5;
  if (config.tampilkan_terbilang) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.text('Terbilang :', margin, currentY);

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    const terbilangStr = `# ${terbilang(input.totalPembayaran)} #`;
    doc.text(terbilangStr, margin + 17, currentY);
    currentY += 4;
  }

  const catatanParts = [input.keterangan, config.footer_kwitansi].filter(Boolean);
  if (catatanParts.length > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Catatan: ${catatanParts.join(' | ')}`, margin, currentY);
  }

  // 6. AREA TANDA TANGAN
  const sigY = Math.max(currentY + 8, 110);

  if (config.hvs.tampilkan_tanda_tangan) {
    const gelarKiri = 'Penyetor,';
    const gelarKanan = (config.gelar_penandatangan || 'Bendahara Pondok') + ',';
    const kota = (config.kota_kuitansi || 'Pare').trim();
    const namaKanan =
      config.nama_penandatangan || profil.bendahara || 'Shofil Mubarok';
    const sigFont = 8;
    const sigGapName = 15; // jarak vertikal utk area tanda tangan

    // — Kolom kiri: Penyetor —
    const leftCenter = margin + 22;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(sigFont);
    doc.setTextColor(30, 41, 59);
    doc.text(gelarKiri, leftCenter, sigY, { align: 'center' });

    // — Kolom kanan: kota + tanggal, gelar, area ttd, nama —
    const rightCenter = pageWidth - margin - 28;
    doc.text(
      kota ? `${kota}, ${formatDateIndo(input.tanggalBayar)}` : formatDateIndo(input.tanggalBayar),
      rightCenter,
      sigY,
      { align: 'center' }
    );
    doc.text(gelarKanan, rightCenter, sigY + 4, { align: 'center' });

    // garis tanda tangan (solid) + nama bold di bawahnya
    const lineY = sigY + 4 + sigGapName;
    doc.setDrawColor(148, 163, 184); // Slate 400
    doc.setLineWidth(0.25);
    doc.line(leftCenter - 20, lineY, leftCenter + 20, lineY);
    doc.line(rightCenter - 25, lineY, rightCenter + 25, lineY);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(sigFont);
    doc.setTextColor(15, 23, 42);
    doc.text(namaKanan, rightCenter, lineY + 4, { align: 'center' });
  }

  // Download PDF
  const safeSantriName = (input.santri.nama || 'Santri').replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `Kwitansi_${input.tipe}_${safeSantriName}_${input.idTransaksi}.pdf`;
  doc.save(filename);
}

/**
 * Opens a print window with styled HTML kwitansi using the HVS design and triggers window.print() automatically.
 */
export async function printKwitansiHvsHtml(
  inputOrTransaksi: any,
  dataSantriOrProfil?: any,
  dataProfilParam?: any
): Promise<void> {
  const { input, profil, config } = await parseInputData(
    inputOrTransaksi,
    dataSantriOrProfil,
    dataProfilParam
  );

  const allItems = [...input.items, ...(input.iuranTambahan || [])];
  const themeColor = config.hvs.warna_tema || '#059669';
  const kopDesainAktif = config.gunakan_kop_desain && kopSuratService.isAktif();
  let kopDesainImg = '';
  if (kopDesainAktif) {
    const kopImage = kopSuratService.getImage();
    if (kopImage) {
      kopDesainImg = `<img src="${kopImage}" alt="Kop Surat" style="width:100%;height:auto;display:block;margin-bottom:8px;" />`;
    }
  }
  const kopHtml = kopDesainImg
    ? ''
    : (config.kop_surat || '')
        .split('\n')
        .filter((line) => line.trim())
        .map((line, idx) =>
          idx === 0
            ? `<h1 style="color:${themeColor};margin:0 0 4px 0;font-size:20px;font-weight:700;">${escapeHtml(line)}</h1>`
            : `<p style="margin:2px 0;color:#475569;font-size:12px;">${escapeHtml(line)}</p>`
        )
        .join('');

  const printWindow = window.open('', '_blank', 'width=900,height=650');
  if (!printWindow) return;

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="id">
      <head>
        <meta charset="UTF-8" />
        <title>Kwitansi HVS ${escapeHtml(input.idTransaksi)}</title>
        <style>
          * { box-sizing: border-box; }
          @page { size: ${config.hvs.ukuran_kertas.toLowerCase()} landscape; margin: 10mm; }
          body {
            font-family: Arial, Helvetica, sans-serif;
            margin: 0;
            padding: 8mm;
            color: #1e293b;
            background: #ffffff;
            font-size: ${config.hvs.ukuran_font + 3}px;
            line-height: 1.4;
          }
          .kwitansi-hvs-container {
            width: 100%;
            max-width: 190mm;
            margin: 0 auto;
            border: 1px solid #cbd5e1;
            padding: 8mm;
            border-radius: 8px;
          }
          .kop-hvs {
            border-bottom: 2.5px double ${themeColor};
            padding-bottom: 10px;
            margin-bottom: 14px;
          }
          .title-hvs {
            text-align: center;
            margin-bottom: 14px;
          }
          .title-hvs h2 {
            margin: 0;
            font-size: 16px;
            text-transform: uppercase;
            color: #0f172a;
            letter-spacing: 0.5px;
          }
          .title-hvs p {
            margin: 3px 0 0 0;
            font-size: 11px;
            color: #64748b;
          }
          .info-grid-hvs {
            display: flex;
            justify-content: space-between;
            margin-bottom: 14px;
            background: #f8fafc;
            padding: 10px 14px;
            border-radius: 6px;
            border: 1px solid #e2e8f0;
            font-size: 11px;
          }
          .info-grid-hvs p { margin: 3px 0; }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 12px;
            font-size: ${config.hvs.ukuran_font + 3}px;
          }
          th, td {
            border: 1px solid #cbd5e1;
            padding: 6px 10px;
            text-align: left;
          }
          th {
            background-color: ${themeColor};
            color: #ffffff;
            font-weight: 700;
          }
          tfoot tr td {
            background-color: #f1f5f9;
            font-weight: 700;
          }
          .terbilang-hvs {
            background-color: #f8fafc;
            border: 1px solid #cbd5e1;
            padding: 6px 10px;
            border-radius: 6px;
            font-style: italic;
            color: #1e293b;
            margin-bottom: 10px;
            font-size: 11px;
          }
          .footer-sig-hvs {
            display: flex;
            justify-content: space-between;
            margin-top: 24px;
            font-size: 11px;
          }
          .sig-box-hvs {
            width: 40%;
            text-align: center;
          }
          .sig-space-hvs { height: 40px; }
          .sig-line-hvs {
            border-bottom: 1px solid #64748b;
            margin: 0 10px 2px 10px;
          }
          @media print {
            body { padding: 0; }
            .kwitansi-hvs-container { border: none; padding: 0; width: 100%; max-width: 100%; }
          }
        </style>
      </head>
      <body>
        <div class="kwitansi-hvs-container">
          <div class="kop-hvs">
            ${kopDesainImg}
            ${kopHtml}
            ${!kopDesainImg && config.hvs.tampilkan_pengasuh ? `<p style="margin:2px 0;color:#94a3b8;font-size:10px;">Pengasuh: ${escapeHtml(profil.pengasuh || '-')}</p>` : ''}
          </div>

          <div class="title-hvs">
            <h2>${escapeHtml((config.judul_kwitansi || 'Kwitansi Pembayaran').toUpperCase())}</h2>
            <p>No. Transaksi: <strong>${escapeHtml(input.idTransaksi)}</strong></p>
          </div>

          <div class="info-grid-hvs">
            <div>
              <p><strong>Telah Terima Dari:</strong> ${escapeHtml(input.santri.nama || '-')}</p>
              <p><strong>NIS / Kategori:</strong> ${escapeHtml(input.santri.nis || '-')} (${escapeHtml(input.santri.kategori || 'Santri')})</p>
            </div>
            <div style="text-align: right;">
              <p><strong>Tanggal Bayar:</strong> ${formatDateIndo(input.tanggalBayar)}</p>
              <p><strong>Metode Pembayaran:</strong> ${escapeHtml(input.metode || 'Tunai')}</p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 40px; text-align: center;">No</th>
                <th>Rincian Pembayaran</th>
                <th style="width: 140px; text-align: right;">Nominal</th>
              </tr>
            </thead>
            <tbody>
              ${allItems
                .map(
                  (item, idx) => `
                <tr>
                  <td style="text-align: center;">${idx + 1}</td>
                  <td>${escapeHtml(item.deskripsi)}</td>
                  <td style="text-align: right;">${formatRupiah(item.nominal)}</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="2" style="text-align: right;">TOTAL PEMBAYARAN</td>
                <td style="text-align: right; color: #0f172a; font-size: 14px;">${formatRupiah(input.totalPembayaran)}</td>
              </tr>
            </tfoot>
          </table>

          ${config.tampilkan_terbilang ? `
          <div class="terbilang-hvs">
            <strong>Terbilang:</strong> # ${terbilang(input.totalPembayaran)} #
          </div>
          ` : ''}

          <p style="font-size: 11px; color: #64748b; margin-top: 0; margin-bottom: 16px;">
            ${escapeHtml([input.keterangan, config.footer_kwitansi].filter(Boolean).join(' | '))}
          </p>

          ${config.hvs.tampilkan_tanda_tangan ? `
          <div class="footer-sig-hvs">
            <div class="sig-box-hvs">
              <p>Penyetor,</p>
              <div class="sig-space-hvs"></div>
              <div class="sig-line-hvs"></div>
              <p style="margin-top: 4px;"><strong>${escapeHtml(input.santri.nama || '-')}</strong></p>
            </div>
            <div class="sig-box-hvs">
              <p>${escapeHtml(config.kota_kuitansi || 'Pare')}, ${formatDateIndo(input.tanggalBayar)}</p>
              <p><strong>${escapeHtml(config.gelar_penandatangan || 'Bendahara Pondok')},</strong></p>
              <div class="sig-space-hvs"></div>
              <div class="sig-line-hvs"></div>
              <p style="margin-top: 4px;"><strong>${escapeHtml(config.nama_penandatangan || profil.bendahara || 'Shofil Mubarok')}</strong></p>
            </div>
          </div>
          ` : ''}
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
}

/**
 * Opens a print window with styled HTML kwitansi for thermal printer (58/80mm) and triggers window.print() automatically.
 */
export async function printKwitansiThermalHtml(
  inputOrTransaksi: any,
  dataSantriOrProfil?: any,
  dataProfilParam?: any
): Promise<void> {
  const { input, profil, config } = await parseInputData(
    inputOrTransaksi,
    dataSantriOrProfil,
    dataProfilParam
  );

  const allItems = [...input.items, ...(input.iuranTambahan || [])];
  const thermalInk = '#1a1a1a';
  const is58 = config.thermal.lebar === '58';
  const printWidthMm = is58 ? 58 : 80;
  const contentWidthMm = is58 ? 52 : 74;
  const fontSize = config.thermal.ukuran_font || 9;

  const kopDesainAktif = config.gunakan_kop_desain && kopSuratService.isAktif();
  let kopDesainImg = '';
  if (kopDesainAktif) {
    const kopImage = kopSuratService.getImage();
    if (kopImage) {
      kopDesainImg = `<img src="${kopImage}" alt="Kop Surat" style="width:100%;height:auto;display:block;margin-bottom:4px;" />`;
    }
  }
  const kopHtml = kopDesainImg
    ? ''
    : (config.kop_surat || '')
        .split('\n')
        .filter((line) => line.trim())
        .map((line, idx) =>
          idx === 0
            ? `<h1 style="color:${thermalInk};margin:0;font-size:${fontSize + 3}px;font-weight:700;text-align:center;">${escapeHtml(line)}</h1>`
            : `<p style="margin:1px 0;color:#333333;font-size:${fontSize - 1}px;text-align:center;">${escapeHtml(line)}</p>`
        )
        .join('');

  const printWindow = window.open('', '_blank', 'width=450,height=600');
  if (!printWindow) return;

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="id">
      <head>
        <meta charset="UTF-8" />
        <title>Struk Thermal ${escapeHtml(input.idTransaksi)}</title>
        <style>
          * { box-sizing: border-box; }
          @page {
            size: ${printWidthMm}mm auto;
            margin: 0mm;
          }
          html, body {
            margin: 0;
            padding: 0;
            background: #ffffff;
            font-family: 'Courier New', Courier, monospace;
            color: #1a1a1a;
            font-size: ${fontSize}px;
            line-height: 1.35;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .kwitansi-container {
            width: ${contentWidthMm}mm;
            max-width: ${contentWidthMm}mm;
            margin: 0 auto;
            padding: 3mm 2mm;
            box-sizing: border-box;
          }
          .kop {
            border-bottom: 2px ${config.thermal.garis} ${thermalInk};
            padding-bottom: 6px;
            margin-bottom: 8px;
            text-align: center;
          }
          .title-section {
            text-align: center;
            margin-bottom: 8px;
          }
          .title-section h2 {
            margin: 0;
            font-size: ${fontSize + 2}px;
            text-transform: uppercase;
            font-weight: 700;
            color: #1a1a1a;
          }
          .title-section p {
            margin: 2px 0 0 0;
            font-size: ${fontSize - 1}px;
            color: #4a4a4a;
          }
          .info-block {
            margin-bottom: 8px;
            padding-bottom: 6px;
            border-bottom: 1px ${config.thermal.garis} #999999;
            font-size: ${fontSize - 0.5}px;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            margin: 2px 0;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 8px;
            font-size: ${fontSize - 0.5}px;
          }
          th, td {
            border: 1px solid #b3b3b3;
            padding: 3px 4px;
            text-align: left;
          }
          th {
            background-color: ${thermalInk};
            color: #ffffff;
            font-weight: 700;
          }
          tfoot tr td {
            background-color: #ececec;
            font-weight: 700;
          }
          .terbilang-box {
            background-color: #f8f8f8;
            border: 1px dashed #888888;
            padding: 4px 6px;
            border-radius: 4px;
            font-style: italic;
            color: #1a1a1a;
            margin-bottom: 6px;
            font-size: ${fontSize - 1}px;
          }
          .catatan {
            font-size: ${fontSize - 1.5}px;
            color: #4a4a4a;
            margin-top: 4px;
            margin-bottom: 10px;
          }
          .footer-sig {
            display: flex;
            justify-content: space-between;
            margin-top: 14px;
            text-align: center;
            font-size: ${fontSize - 1}px;
          }
          .sig-box {
            width: 46%;
            overflow-wrap: anywhere;
          }
          .sig-space {
            height: 26px;
          }
          .sig-line {
            border-bottom: 1px solid #333333;
            margin: 0 2px 2px 2px;
          }
          @media print {
            html, body {
              width: ${printWidthMm}mm !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            .kwitansi-container {
              width: ${contentWidthMm}mm !important;
              max-width: ${contentWidthMm}mm !important;
              margin: 0 auto !important;
              padding: 1mm 1mm !important;
              border: none !important;
              box-shadow: none !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="kwitansi-container">
          <div class="kop">
            ${kopDesainImg}
            ${kopHtml}
            ${!kopDesainImg && config.thermal.tampilkan_pengasuh ? `<p style="margin:2px 0 0 0;font-size:${fontSize - 1.5}px;color:#666;text-align:center;">Pengasuh: ${escapeHtml(profil.pengasuh || '-')}</p>` : ''}
          </div>

          <div class="title-section">
            <h2>${escapeHtml((config.judul_kwitansi || 'Kwitansi Pembayaran').toUpperCase())}</h2>
            <p>No: <strong>${escapeHtml(input.idTransaksi)}</strong></p>
          </div>

          <div class="info-block">
            <div class="info-row">
              <span><strong>Dari:</strong> ${escapeHtml(input.santri.nama || '-')}</span>
            </div>
            <div class="info-row">
              <span><strong>NIS/Kat:</strong> ${escapeHtml(input.santri.nis || '-')} (${escapeHtml(input.santri.kategori || 'Santri')})</span>
            </div>
            <div class="info-row">
              <span><strong>Tgl:</strong> ${formatDateIndo(input.tanggalBayar)}</span>
              <span><strong>Metode:</strong> ${escapeHtml(input.metode || 'Tunai')}</span>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 18px; text-align: center;">No</th>
                <th>Rincian</th>
                <th style="width: 58px; text-align: right;">Nominal</th>
              </tr>
            </thead>
            <tbody>
              ${allItems
                .map(
                  (item, idx) => `
                <tr>
                  <td style="text-align: center;">${idx + 1}</td>
                  <td>${escapeHtml(item.deskripsi)}</td>
                  <td style="text-align: right;">${formatRupiah(item.nominal).replace('Rp', '').trim()}</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="2" style="text-align: right; font-weight: 700;">TOTAL</td>
                <td style="text-align: right; font-weight: 700;">${formatRupiah(input.totalPembayaran).replace('Rp', '').trim()}</td>
              </tr>
            </tfoot>
          </table>

          ${config.tampilkan_terbilang ? `
          <div class="terbilang-box">
            # ${terbilang(input.totalPembayaran)} #
          </div>
          ` : ''}

          ${(input.keterangan || config.footer_kwitansi) ? `
          <div class="catatan">
            Catatan: ${escapeHtml([input.keterangan, config.footer_kwitansi].filter(Boolean).join(' | '))}
          </div>
          ` : ''}

          ${config.thermal.tampilkan_tanda_tangan ? `
          <div class="footer-sig">
            <div class="sig-box">
              <div>Penyetor,</div>
              <div class="sig-space"></div>
              <div class="sig-line"></div>
              <div style="margin-top:2px;font-weight:700;">${escapeHtml(input.santri.nama || '-')}</div>
            </div>
            <div class="sig-box">
              <div>${escapeHtml(config.kota_kuitansi || 'Pare')}, ${formatDateIndo(input.tanggalBayar)}</div>
              <div><strong>${escapeHtml(config.gelar_penandatangan || 'Bendahara Pondok')},</strong></div>
              <div class="sig-space"></div>
              <div class="sig-line"></div>
              <div style="font-weight:700;">${escapeHtml(config.nama_penandatangan || profil.bendahara || 'Shofil Mubarok')}</div>
            </div>
          </div>
          ` : ''}
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
}

/**
 * Opens a print window with styled HTML kwitansi and triggers window.print() automatically.
 */
export async function printKwitansiHtml(
  inputOrTransaksi: any,
  dataSantriOrProfil?: any,
  dataProfilParam?: any,
  mode: 'hvs' | 'thermal' = 'thermal'
): Promise<void> {
  if (mode === 'hvs') {
    await printKwitansiHvsHtml(inputOrTransaksi, dataSantriOrProfil, dataProfilParam);
  } else {
    await printKwitansiThermalHtml(inputOrTransaksi, dataSantriOrProfil, dataProfilParam);
  }
}

export interface ExportLaporanPdfSummaryMetric {
  label: string;
  value: string;
}

export interface ExportLaporanPdfFilterInfo {
  label: string;
  value: string;
}

export interface ExportLaporanPdfParams {
  title: string;
  subtitle?: string;
  filename: string;
  orientation?: 'portrait' | 'landscape';
  filterInfo?: ExportLaporanPdfFilterInfo[];
  summaryMetrics?: ExportLaporanPdfSummaryMetric[];
  headers: string[];
  rows: (string | number)[][];
  footers?: (string | number)[][];
  columnStyles?: Record<number | string, { halign?: 'left' | 'center' | 'right'; cellWidth?: number | 'auto' }>;
}

/**
 * Builds and formats a formal Pondok Pesantren PDF report doc.
 * Features official Kop Surat, Title, Filter metadata, Summary Metric Cards,
 * Data Table via autoTable, Signature block, and Page pagination in footer.
 */
export async function buildLaporanPdfDoc(params: ExportLaporanPdfParams): Promise<jsPDF | null> {
  if (!params.rows || params.rows.length === 0) {
    showToast('Tidak ada data untuk diekspor ke PDF', 'error');
    return null;
  }

  const orientation = params.orientation || 'portrait';
  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  const profil = await pengaturanService.getProfil();
  const config = await getKwitansiConfig();
  let y = 14;

  // 1. KOP SURAT — pakai desain aktif dari tab "Desain Kop Surat" bila tersedia
  const kopImage = kopSuratService.getImage();
  if (kopImage) {
    try {
      const kopWidth = pageWidth - 2 * margin;
      const kopProps = doc.getImageProperties(kopImage);
      const kopHeight = (kopProps.height / kopProps.width) * kopWidth;
      doc.addImage(kopImage, 'PNG', margin, y, kopWidth, kopHeight);
      y += kopHeight + 6;
    } catch {
      // Gambar korup → jatuh ke kop teks di bawah.
    }
  }

  if (!kopImage) {
    const pondokName = (profil.nama_pondok || 'PONDOK PESANTREN AL HIDAYAH TERTEK').toUpperCase();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(4, 120, 87); // Emerald 700 (#047857)
    doc.text(pondokName, margin, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105); // Slate 600
    const addressLine = [
      profil.alamat || 'Jln. Mayor Bismo No 71-73 Tertek Pare Kediri',
      profil.kontak ? `Telp: ${profil.kontak}` : '',
      profil.email ? `Email: ${profil.email}` : '',
    ]
      .filter(Boolean)
      .join('  •  ');
    doc.text(addressLine, margin, y);
    y += 4;

    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139); // Slate 500
    doc.text(`Pengasuh: ${profil.pengasuh || 'KH. Mujtaba Thoifur'}`, margin, y);
    y += 3.5;

    // Double Separator Line
    doc.setDrawColor(5, 150, 105); // Emerald 600
    doc.setLineWidth(0.7);
    doc.line(margin, y, pageWidth - margin, y);

    doc.setDrawColor(203, 213, 225); // Slate 300
    doc.setLineWidth(0.2);
    doc.line(margin, y + 0.8, pageWidth - margin, y + 0.8);
    y += 6;
  }

  // 2. JUDUL LAPORAN & SUBTITLE
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(15, 23, 42); // Slate 900
  doc.text(params.title.toUpperCase(), pageWidth / 2, y, { align: 'center' });
  y += 4.5;

  if (params.subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139); // Slate 500
    doc.text(params.subtitle, pageWidth / 2, y, { align: 'center' });
    y += 4.5;
  }

  // 3. FILTER BADGE INFO
  if (params.filterInfo && params.filterInfo.length > 0) {
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    const filterStr = params.filterInfo.map((f) => `${f.label}: ${f.value}`).join('   |   ');
    doc.text(`Kriteria Filter:  ${filterStr}`, margin, y);
    y += 4.5;
  }

  // 4. SUMMARY METRIC CARDS
  if (params.summaryMetrics && params.summaryMetrics.length > 0) {
    const numCards = params.summaryMetrics.length;
    const cardGap = 3;
    const totalWidth = pageWidth - 2 * margin;
    const cardWidth = (totalWidth - (numCards - 1) * cardGap) / numCards;
    const cardHeight = 12;

    params.summaryMetrics.forEach((m, idx) => {
      const cardX = margin + idx * (cardWidth + cardGap);
      // Box background
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.roundedRect(cardX, y, cardWidth, cardHeight, 1.2, 1.2, 'FD');

      // Top accent line in card
      doc.setFillColor(5, 150, 105);
      doc.rect(cardX, y, cardWidth, 1, 'F');

      // Metric Label
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text(m.label, cardX + 3, y + 4.5);

      // Metric Value
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text(m.value, cardX + 3, y + 9);
    });

    y += cardHeight + 4;
  }

  // 5. DATA TABLE
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin, bottom: 22 },
    head: [params.headers],
    body: params.rows,
    foot: params.footers,
    theme: 'grid',
    headStyles: {
      fillColor: [5, 150, 105],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      cellPadding: 2,
      halign: 'left',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    bodyStyles: {
      fontSize: 7,
      textColor: [30, 41, 59],
      cellPadding: 1.8,
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 7.5,
      cellPadding: 2,
    },
    columnStyles: params.columnStyles,
  });

  // @ts-ignore
  let afterTableY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 6 : y + 30;

  // Check if signature block fits on the current page (needs at least 30mm)
  if (afterTableY + 30 > pageHeight - margin) {
    doc.addPage();
    afterTableY = margin + 8;
  }

  // 6. TANDA TANGAN BENDAHARA
  const today = new Date();
  const dateIndo = `${today.getDate()} ${MONTH_NAMES_IND[today.getMonth()]} ${today.getFullYear()}`;
  const rightSigX = pageWidth - margin - 32;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text(`Pare, ${dateIndo}`, rightSigX, afterTableY, { align: 'center' });
  doc.text('Bendahara Pondok,', rightSigX, afterTableY + 4, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.text(
    `( ${config.nama_penandatangan || profil.bendahara || 'Shofil Mubarok'} )`,
    rightSigX,
    afterTableY + 20,
    { align: 'center' }
  );

  // 7. PAGE FOOTER (PAGINATION & TIMESTAMP)
  const totalPages =
    (doc.internal as any).getNumberOfPages ? (doc.internal as any).getNumberOfPages() : (doc as any).getNumberOfPages();
  const nowHours = String(today.getHours()).padStart(2, '0');
  const nowMinutes = String(today.getMinutes()).padStart(2, '0');
  const timestampStr = `${today.getDate()} ${MONTH_NAMES_IND[today.getMonth()]} ${today.getFullYear()} ${nowHours}:${nowMinutes} WIB`;

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.text(
      `Dicetak: ${timestampStr} | Sistem Informasi Pondok Pesantren Al Hidayah`,
      margin,
      pageHeight - 6
    );
    doc.text(`Halaman ${i} dari ${totalPages}`, pageWidth - margin, pageHeight - 6, {
      align: 'right',
    });
  }

  return doc;
}

/**
 * Generates and downloads a formal Pondok Pesantren PDF report.
 */
export async function exportLaporanToPdf(params: ExportLaporanPdfParams): Promise<void> {
  try {
    const doc = await buildLaporanPdfDoc(params);
    if (!doc) return;

    const cleanFilename = params.filename.endsWith('.pdf') ? params.filename : `${params.filename}.pdf`;
    doc.save(cleanFilename);
    showToast(`File PDF "${cleanFilename}" berhasil diunduh`, 'success');
  } catch (err: any) {
    console.error('Failed to export PDF:', err);
    showToast('Gagal mengekspor data ke PDF', 'error');
  }
}

/**
 * Generates a Blob URL for interactive previewing of the printable document inside an iframe or viewer.
 */
export async function generateLaporanPdfBlobUrl(params: ExportLaporanPdfParams): Promise<string | null> {
  try {
    const doc = await buildLaporanPdfDoc(params);
    if (!doc) return null;

    const blob = doc.output('blob');
    return URL.createObjectURL(blob);
  } catch (err: any) {
    console.error('Failed to generate PDF blob URL:', err);
    showToast('Gagal membuat pratinjau dokumen PDF', 'error');
    return null;
  }
}

/**
 * Sends the printable PDF directly to the browser print dialog via an isolated invisible iframe.
 */
export async function printLaporanPdf(params: ExportLaporanPdfParams): Promise<void> {
  try {
    const doc = await buildLaporanPdfDoc(params);
    if (!doc) return;

    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.src = url;

    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {
        // Fallback: save PDF directly
        const cleanFilename = params.filename.endsWith('.pdf') ? params.filename : `${params.filename}.pdf`;
        doc.save(cleanFilename);
      }
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
        URL.revokeObjectURL(url);
      }, 60000);
    };

    document.body.appendChild(iframe);
  } catch (err: any) {
    console.error('Failed to print PDF:', err);
    showToast('Gagal mencetak dokumen PDF', 'error');
  }
}
