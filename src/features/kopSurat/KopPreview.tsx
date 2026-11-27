import React from 'react';
import { KopSuratConfig, KopTextRow, KopLogoConfig } from '../../types/kopSurat';

const PAPER_WIDTH = 595;
const PAPER_MIN_HEIGHT: Record<'kop' | 'A4' | 'F4', number> = {
  kop: 0, // tinggi mengikuti isi
  A4: 842,
  F4: 935,
};

export function getKopPaperSize(tinggiHalaman: 'kop' | 'A4' | 'F4') {
  return {
    width: PAPER_WIDTH,
    minHeight: PAPER_MIN_HEIGHT[tinggiHalaman] || 0,
    autoHeight: tinggiHalaman === 'kop',
  };
}

/** Susun teks baris kontak dari field instansi */
export function buildKontakText(config: KopSuratConfig): string {
  const items: string[] = [];
  if (config.alamat.trim()) items.push(config.alamat.trim());
  const kontak: string[] = [];
  if (config.telepon.trim()) kontak.push(config.telepon.trim());
  if (config.email.trim()) kontak.push(config.email.trim());
  if (config.website.trim()) kontak.push(config.website.trim());
  if (config.kodePos.trim()) kontak.push(config.kodePos.trim());
  if (kontak.length) items.push(kontak.join('  |  '));
  return items.join('\n');
}

function logoShapeStyle(logo: KopLogoConfig): React.CSSProperties {
  const base: React.CSSProperties = {
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor:
      logo.bg === 'transparan'
        ? 'transparent'
        : logo.bg === 'putih'
          ? '#ffffff'
          : logo.bgColor,
  };
  if (logo.shape === 'bulat') return { ...base, borderRadius: '50%' };
  if (logo.shape === 'membulat') return { ...base, borderRadius: '12px' };
  return base;
}

function PlaceholderLogo({ label1, label2 }: { label1: string; label2: string }) {
  return (
    <div
      style={{
        color: '#cbd5e1',
        fontSize: 9,
        fontWeight: 700,
        textAlign: 'center',
        lineHeight: 1.3,
        userSelect: 'none',
      }}
    >
      {label1}
      <br />
      {label2}
    </div>
  );
}

function LogoSide({ logo, side }: { logo: KopLogoConfig; side: 'kiri' | 'kanan' }) {
  if (!logo.visible) return null;
  const style = logoShapeStyle(logo);
  const marginStyle: React.CSSProperties =
    side === 'kiri' ? { marginLeft: logo.marginX } : { marginRight: logo.marginX };
  return (
    <div
      style={{
        flexShrink: 0,
        width: logo.size,
        height: logo.size,
        marginTop: logo.marginTop,
        ...marginStyle,
        ...style,
      }}
    >
      {logo.dataUrl ? (
        <img
          src={logo.dataUrl}
          alt={`Logo ${side}`}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      ) : (
        <PlaceholderLogo label1="LOGO" label2={side.toUpperCase()} />
      )}
    </div>
  );
}

interface BarisData {
  row: KopTextRow;
  text: string;
}

/**
 * Render . Urut sesuai konfigurasi baris (1..6), lalu garis.
 * Semua style inline agar hasil html2canvas identik dengan tampilan.
 */
export const KopPreview: React.FC<{ config: KopSuratConfig }> = ({ config }) => {
  const alignGlobal: React.CSSProperties['textAlign'] =
    config.posisiTeks === 'kiri' ? 'left' : config.posisiTeks === 'kanan' ? 'right' : 'center';
  const alignOf = (row: KopTextRow): React.CSSProperties['textAlign'] =>
    row.align === 'global' ? alignGlobal : (row.align as React.CSSProperties['textAlign']);

  const bg =
    config.background === 'putih'
      ? '#ffffff'
      : config.background === 'abu'
        ? '#f5f5f5'
        : config.customBg;

  const barisList: BarisData[] = [
    { row: config.barisYayasan, text: config.namaYayasan },
    { row: config.barisPondok, text: config.namaPondok || 'NAMA PONDOK' },
    { row: config.barisSubUnit, text: config.subUnit },
    { row: config.barisKontak, text: buildKontakText(config) },
    { row: config.barisRegistrasi, text: config.barisRegistrasi.text ?? '' },
    { row: config.barisKustom, text: config.barisKustom.text ?? '' },
  ].filter((b) => b.row.visible && b.text.trim() !== '');

  const garisBorder = (jenis: string, tebal: number, warna: string): string =>
    `${tebal}px ${jenis} ${warna}`;

  return (
    <div
      className="kop-preview-paper"
      style={{
        width: PAPER_WIDTH,
        minHeight: getKopPaperSize(config.tinggiHalaman).minHeight || undefined,
        background: bg,
        borderRadius: config.radius,
        boxSizing: 'border-box',
      }}
    >
      {/* Header kop */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          width: '100%',
          boxSizing: 'border-box',
          gap: config.jarakLogoTeks,
          padding:
            config.tinggiHalaman === 'kop'
              ? 0
              : `${config.padAtas}px ${config.padKanan}px 0px ${config.padKiri}px`,
        }}
      >
        <LogoSide logo={config.logoKiri} side="kiri" />

        <div style={{ flex: 1, minWidth: 0 }}>
          {barisList.map((b, idx) => (
            <div
              key={idx}
              style={{
                fontFamily: b.row.font,
                fontSize: b.row.size,
                fontWeight: b.row.bold ? 700 : 400,
                fontStyle: b.row.italic ? 'italic' : 'normal',
                textTransform: b.row.uppercase ? 'uppercase' : 'none',
                letterSpacing: b.row.letterSpacing,
                lineHeight: b.row.lineHeight,
                color: b.row.color,
                opacity: b.row.opacity / 100,
                margin: 0,
                marginBottom: b.row.marginBottom,
                textAlign: alignOf(b.row),
                whiteSpace: 'pre-line',
                minWidth: 0,
              }}
            >
              {b.text}
            </div>
          ))}
        </div>

        <LogoSide logo={config.logoKanan} side="kanan" />
      </div>

      {/* Garis 1 + Garis 2 */}
      {config.garis1.visible && (
        <>
          <div style={{ height: config.garis1.jarakTeks }} />
          <div
            style={{
              borderTop: garisBorder(config.garis1.jenis, config.garis1.tebal, config.garis1.warna),
              width: `${config.garis1.lebar}%`,
              margin: '0 auto',
            }}
          />
          {config.garis2.visible && (
            <>
              <div style={{ height: config.garis2.jarakGaris }} />
              <div
                style={{
                  borderTop: garisBorder(
                    config.garis2.jenis,
                    config.garis2.tebal,
                    config.garis2.warna
                  ),
                  width: `${config.garis2.lebar}%`,
                  margin: '0 auto',
                }}
              />
            </>
          )}
        </>
      )}

      {/*padding bawah saat kertas penuh (A4/F4) — tidak ada di mode kop */}
      {config.tinggiHalaman !== 'kop' && <div style={{ height: config.padBawah }} />}
    </div>
  );
};

export default KopPreview;
