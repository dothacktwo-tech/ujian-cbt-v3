import { ApiResponse } from '../types';

let authToken: string | null = localStorage.getItem('cbt_auth_token');

export const setStoredToken = (token: string | null) => {
  authToken = token;
  if (token) {
    localStorage.setItem('cbt_auth_token', token);
  } else {
    localStorage.removeItem('cbt_auth_token');
  }
};

export const getStoredToken = () => {
  return authToken || localStorage.getItem('cbt_auth_token');
};

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T> & { statusCode?: number }> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  try {
    const res = await fetch(endpoint, {
      ...options,
      headers,
    });

    let data: any;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        data = await res.json();
      } catch {
        data = null;
      }
    }

    if (!data) {
      const text = await res.text().catch(() => '');
      const isHtml = text.includes('<!DOCTYPE') || text.includes('<html') || text.includes('<pre>');
      data = {
        success: res.ok,
        message: text && !isHtml && text.length < 200
          ? text
          : (res.ok ? 'Sukses' : `Terjadi kesalahan pada server (HTTP ${res.status}). Silakan coba beberapa saat lagi.`),
      };
    }

    data.statusCode = res.status;

    if (!res.ok) {
      data.success = false;

      // Only log severe server errors (5xx) with console.error to avoid spamming errors on expected 401 auth checks
      if (res.status >= 500) {
        console.error(`[API Server Error ${res.status}]`, {
          endpoint,
          status: res.status,
          statusText: res.statusText,
          response: data,
        });
      } else {
        console.info(`[API ${res.status}]`, endpoint, data.message || res.statusText);
      }

      if (!data.message) {
        if (res.status === 401) {
          data.message = 'Silakan login terlebih dahulu.';
        } else if (res.status === 403) {
          data.message = 'Akses ditolak: Anda tidak memiliki izin untuk tindakan ini.';
        } else if (res.status === 404) {
          data.message = 'Endpoint atau data yang diminta tidak ditemukan.';
        } else if (res.status >= 500) {
          data.message = data.error 
            ? `Kesalahan Server: ${data.error}`
            : 'Terjadi kesalahan pada server saat memproses permintaan.';
        } else {
          data.message = 'Permintaan gagal diproses.';
        }
      }
    }

    return data;
  } catch (err: any) {
    console.error('[API Network/Fetch Error]', endpoint, err);
    return {
      success: false,
      statusCode: 0,
      message: err?.message || 'Koneksi jaringan terputus atau server tidak merespon.',
    };
  }
}
