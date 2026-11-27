import { storage } from './storage';
import type { ApiMode } from './apiClient';

const MODE_KEY = 'al_hidayah_mode';
const VERSION_KEY = 'al_hidayah_storage_version';
const VERSION = '2';

/**
 * Bersihkan cache storage sekali kali ketika versi/mode berubah.
 * Mencegah data hasil sinkron API (mis. 3 santri smoke) tetap dipakai
 * ketika aplikasi kembali ke mode lokal, dan sebaliknya.
 */
export function siapkanStorage(mode: ApiMode): void {
  // Produksi memakai storage memori yang selalu kosong saat start — tidak perlu
  // metadata mode/version, dan tidak ada satu pun yang ditulis ke browser.
  if (mode === 'api') return;
  if (typeof storage === 'undefined') return;

  const modeSebelumnya = storage.getItem(MODE_KEY);
  const versiSebelumnya = storage.getItem(VERSION_KEY);
  const perluBersih = versiSebelumnya !== VERSION || (modeSebelumnya && modeSebelumnya !== mode);

  if (perluBersih) {
    const kunci: string[] = [];
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (key?.startsWith('al_hidayah_')) kunci.push(key);
    }
    kunci.forEach((key) => storage.removeItem(key));
    storage.setItem(VERSION_KEY, VERSION);
  }

  storage.setItem(MODE_KEY, mode);
}
