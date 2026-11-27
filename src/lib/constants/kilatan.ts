import { EventKilatan } from '../../types/kilatan';

/** Urutan tampilan event kilatan di seluruh aplikasi. */
export const KILATAN_EVENTS: EventKilatan[] = [
  'Jumadil Ula',
  'Maulid',
  'Romadhon',
  'Dzulhijjah',
];

/** Bulan representatif tiap event, untuk lookup tarif dan urutan pendaftaran. */
export const KILATAN_EVENT_MONTH: Record<EventKilatan, number> = {
  Romadhon: 3,
  Dzulhijjah: 6,
  Maulid: 9,
  'Jumadil Ula': 11,
};
