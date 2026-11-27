import { storage } from './storage';
/**
 * Klien API untuk mode produksi (VITE_API_MODE=api).
 * Mode default 'local' tetap memakai storage sehingga prototype bisa terus dipakai.
 */
export type ApiMode = 'local' | 'api';

/** Error API dengan status HTTP agar UI bisa membedakan 401/403/5xx. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function pesanRamah(status: number, pesanServer?: string): string {
  switch (status) {
    case 401: return 'Sesi Anda telah berakhir. Silakan login kembali.';
    case 403: return 'Anda tidak memiliki izin untuk melakukan aksi ini.';
    case 404: return 'Data yang diminta tidak ditemukan.';
    default:
      if (status >= 500) return 'Server sedang bermasalah. Silakan coba lagi sebentar.';
      return pesanServer || `Permintaan gagal (HTTP ${status})`;
  }
}

const env = (import.meta as ImportMeta & { env?: Record<string, string> }).env || {};

export const API_MODE: ApiMode = (env.VITE_API_MODE as ApiMode) || 'local';
export const isApiMode = (): boolean => API_MODE === 'api';

// Kosong = same-origin (/api lewat reverse proxy). Mode dev mengisi ini lewat .env.
const BASE_URL = env.VITE_API_URL ?? '';

let csrfToken: string | undefined;

export const setCsrfToken = (token?: string): void => {
  csrfToken = token;
};

export const getCsrfToken = (): string | undefined => csrfToken;

export async function apiRequest<T>(
  path: string,
  options: RequestInit & { skipCsrf?: boolean } = {}
): Promise<T> {
  const { skipCsrf, ...fetchOptions } = options;
  const method = (fetchOptions.method || 'GET').toUpperCase();
  const headers = new Headers(fetchOptions.headers);

  if (fetchOptions.body && !(fetchOptions.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (!['GET', 'HEAD'].includes(method) && !skipCsrf) {
    if (!csrfToken) await refreshCsrf();
    if (csrfToken) headers.set('x-csrf-token', csrfToken);
  }

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...fetchOptions,
      headers,
      credentials: 'include',
    });
  } catch {
    throw new ApiError(0, 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.');
  }

  let payload: any = null;
  try {
    const text = await response.text();
    payload = text ? JSON.parse(text) : null;
  } catch {
    // Server bisa mengembalikan HTML pada error 5xx — jangan sampai parse error
    // menutup pesan error utama.
  }

  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/api/auth/')) {
      setCsrfToken(undefined);
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.assign('/login');
      }
    }
    throw new ApiError(response.status, pesanRamah(response.status, payload?.message), payload?.code);
  }
  return payload as T;
}

export async function refreshCsrf(): Promise<void> {
  const me = await apiRequest<{ data?: { csrfToken?: string } }>('/api/auth/me');
  setCsrfToken(me.data?.csrfToken);
}

export interface ApiLoginResult {
  user: { id: string; username: string; nama: string; role: 'super_admin' | 'admin' | 'pemilik' };
  csrfToken: string;
}

export async function apiLogin(username: string, password: string): Promise<ApiLoginResult> {
  const response = await apiRequest<{ data: ApiLoginResult }>('/api/auth/login', {
    method: 'POST',
    skipCsrf: true,
    body: JSON.stringify({ username, password }),
  });
  setCsrfToken(response.data.csrfToken);
  return response.data;
}

export async function apiSetup(nama: string, username: string, password: string): Promise<void> {
  await apiRequest('/api/auth/setup', {
    method: 'POST',
    skipCsrf: true,
    body: JSON.stringify({ nama, username, password }),
  });
  await apiLogin(username, password);
}

export async function apiNeedsSetup(): Promise<boolean> {
  const status = await apiRequest<{ data: { needsSetup: boolean } }>('/api/auth/setup-status');
  return status.data.needsSetup;
}

export async function apiLogout(): Promise<void> {
  await apiRequest('/api/auth/logout', { method: 'POST' });
  setCsrfToken(undefined);
}
