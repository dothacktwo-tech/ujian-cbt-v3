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
): Promise<ApiResponse<T>> {
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

    const data = await res.json().catch(() => ({
      success: res.ok,
      message: res.statusText || 'Terjadi kesalahan pada server.',
    }));

    if (!res.ok && data.success === undefined) {
      data.success = false;
    }

    return data;
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Koneksi jaringan terputus atau server tidak merespon.',
    };
  }
}
