/**
 * Kalkulasi tagihan syahriyah + keringanan.
 * Helper murni: tidak mengimpor service agar tidak ada circular import.
 */
export type JenisKeringanan = 'kustom' | 'setengah' | 'penuh';

export interface WaiverRingkas {
  santri_id?: string;
  tahun: number;
  bulan_mulai: number;
  bulan_selesai: number;
  nominal_per_bulan: number;
  jenis?: JenisKeringanan;
  snapshot?: Record<string, number>;
}

export interface HasilTagihan {
  tarifDasar: number;
  jenis: JenisKeringanan | null;
  potongan: number;
  tagihanBersih: number;
  dibayar: number;
  sisa: number;
}

/**
 * Urutan hitung:
 * 1. tarif dasar sesuai periode bulan
 * 2. cek keringanan aktif di bulan itu
 * 3. tagihan bersih = tarif - potongan
 * 4. sisa = tagihan bersih - yang sudah dibayar
 *
 * Mode keringanan dikenali dari `snapshot` (tarif saat keringanan dibuat):
 * - potongan >= tarif  -> penuh
 * - potongan ≈ tarif/2 -> 50%
 * - selainnya          -> kustom (dibatasi maksimal tarif berlaku)
 */
export function hitungTagihan(args: {
  tarifDasar: number;
  waivers: WaiverRingkas[];
  santriId?: string;
  tahun: number;
  bulan: number;
  sudahDibayar: number;
}): HasilTagihan {
  const { tarifDasar, waivers, santriId, tahun, bulan, sudahDibayar } = args;
  const tarif = Math.max(0, Number(tarifDasar) || 0);

  const w = waivers.find(
    (item) =>
      (!santriId || item.santri_id === santriId) &&
      Number(item.tahun) === tahun &&
      bulan >= Number(item.bulan_mulai) &&
      bulan <= Number(item.bulan_selesai)
  );

  let jenis: JenisKeringanan | null = null;
  let potongan = 0;

  if (w) {
    const asli = Number(w.snapshot?.[String(bulan)] ?? tarif);
    const pot = Number(w.nominal_per_bulan || 0);

    if (w.jenis === 'penuh') jenis = 'penuh';
    else if (w.jenis === 'setengah') jenis = 'setengah';
    else if (w.jenis === 'kustom') jenis = 'kustom';
    else if (pot >= asli && asli > 0) jenis = 'penuh';
    else if (asli > 0 && Math.abs(pot - asli / 2) <= 1) jenis = 'setengah';
    else jenis = 'kustom';

    potongan =
      jenis === 'penuh'
        ? tarif
        : jenis === 'setengah'
          ? Math.round(tarif / 2)
          : Math.min(Math.max(0, pot), tarif);
  }

  const tagihanBersih = Math.max(0, tarif - potongan);
  const dibayar = Math.max(0, Number(sudahDibayar) || 0);
  const sisa = Math.max(0, tagihanBersih - dibayar);

  return { tarifDasar: tarif, jenis, potongan, tagihanBersih, dibayar, sisa };
}

/** Label ringkas untuk ditampilkan di UI. */
export function labelKeringanan(hasil: HasilTagihan): string {
  if (!hasil.jenis) return '';
  const mode =
    hasil.jenis === 'penuh'
      ? 'Penuh'
      : hasil.jenis === 'setengah'
        ? '50%'
        : `Rp ${hasil.potongan.toLocaleString('id-ID')}`;
  return `Keringanan ${mode}`;
}
