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
    try {
      data = await res.json();
    } catch {
      data = {
        success: res.ok,
        message: res.statusText || (res.ok ? 'Sukses' : 'Terjadi kesalahan pada respon server.'),
      };
    }

    data.statusCode = res.status;

    if (!res.ok) {
      data.success = false;

      // Log server error details in browser console for fast debugging
      console.error(`[API Error ${res.status}]`, {
        endpoint,
        status: res.status,
        statusText: res.statusText,
        response: data,
      });

      if (!data.message) {
        if (res.status === 401) {
          data.message = 'Email/Username atau Password salah.';
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
