import { storage } from './storage';
import { BACKUP_APP_ID, BACKUP_VERSION } from './backupService';
import { apiRequest } from './apiClient';
import { syncFromApi } from './apiCache';

/**
 * Backup/restore dalam mode API memakai endpoint server, bukan storage.
 * Format file sama dengan envelope backup aplikasi, tetapi `data` berisi tabel DB.
 */
export async function unduhBackupApi(): Promise<{
  app: string;
  version: number;
  created_at: string;
  data: Record<string, unknown>;
}> {
  const response = await apiRequest<{ data: Record<string, unknown> }>('/api/backup');
  return {
    app: BACKUP_APP_ID,
    version: BACKUP_VERSION,
    created_at: new Date().toISOString(),
    data: response.data,
  };
}

export async function pulihkanBackupApi(json: unknown): Promise<number> {
  const envelope = json as { app?: unknown; data?: unknown } | null;
  const data = (envelope && envelope.data && envelope.app ? envelope.data : json) as
    | Record<string, unknown>
    | null;

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Format file backup tidak valid');
  }

  const kunciLokal = Object.keys(data).filter((key) => key.startsWith('al_hidayah_'));
  if (kunciLokal.length > 0) {
    throw new Error(
      'Backup format storage tidak dapat dipulihkan dalam mode API. Gunakan backup yang diunduh dari menu ini.'
    );
  }

  const response = await apiRequest<{ data: { dipulihkan: number } }>('/api/restore', {
    method: 'POST',
    body: JSON.stringify({ konfirmasi: true, data }),
  });
  await syncFromApi();
  return response.data.dipulihkan;
}
