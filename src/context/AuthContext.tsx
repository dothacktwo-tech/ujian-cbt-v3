import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AppSettings } from '../types';
import { apiRequest, setStoredToken, getStoredToken } from '../services/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  settings: AppSettings;
  login: (username: string, password: string) => Promise<{ success: boolean; message?: string; role?: string; statusCode?: number }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  refreshSettings: () => Promise<void>;
}

const defaultSettings: AppSettings = {
  school_name: 'SMA Negeri 1 Lumbung',
  school_short_name: 'SMAN 1 Lumbung',
  school_description: 'Sistem Computer Based Test',
  school_logo_url: '',
  academic_year: '2024/2025',
  login_title: 'Login Ujian CBT',
  login_subtitle: 'SMA Negeri 1 Lumbung',
  login_description: 'Silakan masuk untuk mengikuti ujian.',
  login_button_text: 'MASUK KE UJIAN',
  login_illustration_url: '',
  illustration_position: 'center',
  illustration_size: 100,
  illustration_fit: 'contain',
  primary_color: '#FFB646',
  button_color: '#6097EA',
  background_color: '#EAF2FF',
  allow_student_print_result: '1',
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);

  const fetchSettings = async () => {
    try {
      const res = await apiRequest<Record<string, string>>('/api/settings');
      if (res.success && res.data) {
        setSettings({
          school_name: res.data.school_name || defaultSettings.school_name,
          school_short_name: res.data.school_short_name || 'SMAN 1 Lumbung',
          school_description: res.data.school_description || 'Sistem Computer Based Test',
          school_logo_url: res.data.school_logo_url || res.data.school_logo || '',
          academic_year: res.data.academic_year || defaultSettings.academic_year,
          school_logo: res.data.school_logo || res.data.school_logo_url || '',
          default_shuffle_questions: res.data.default_shuffle_questions,
          default_shuffle_answers: res.data.default_shuffle_answers,
          default_show_score: res.data.default_show_score,
          login_title: res.data.login_title || 'Login Ujian CBT',
          login_subtitle: res.data.login_subtitle || res.data.school_name || 'SMA Negeri 1 Lumbung',
          login_description: res.data.login_description || 'Silakan masuk untuk mengikuti ujian.',
          login_button_text: res.data.login_button_text || 'MASUK KE UJIAN',
          login_illustration_url: res.data.login_illustration_url || res.data.login_image_url || '',
          illustration_position: (res.data.illustration_position as any) || 'center',
          illustration_size: res.data.illustration_size ? parseInt(res.data.illustration_size, 10) : 100,
          illustration_fit: (res.data.illustration_fit as any) || 'contain',
          primary_color: res.data.primary_color || '#FFB646',
          button_color: res.data.button_color || '#6097EA',
          background_color: res.data.background_color || '#EAF2FF',
          login_image_type: (res.data.login_image_type as any) || 'default_waving',
          login_image_url: res.data.login_image_url || res.data.login_illustration_url || '',
          login_bg_type: (res.data.login_bg_type as any) || 'default',
          login_bg_url: res.data.login_bg_url || '',
          login_bg_overlay: res.data.login_bg_overlay || '0.4',
          allow_student_print_result: res.data.allow_student_print_result !== '0' ? '1' : '0',
          card_title: res.data.card_title || 'KARTU PESERTA UJIAN CBT',
          card_subtitle: res.data.card_subtitle || 'PENILAIAN AKHIR SEMESTER (PAS) / UTS',
          card_header_color: res.data.card_header_color || 'indigo',
          card_layout_grid: res.data.card_layout_grid || '8',
          card_show_photo: res.data.card_show_photo !== '0' ? '1' : '0',
          card_show_qr: res.data.card_show_qr !== '0' ? '1' : '0',
          card_show_rules: res.data.card_show_rules !== '0' ? '1' : '0',
          card_rules_text: res.data.card_rules_text || '1. Bawa kartu ini setiap mengikuti ujian.\n2. Jaga kerahasiaan username & password Anda.\n3. Dilarang membawa alat komunikasi saat ujian.',
          card_sign_location: res.data.card_sign_location || 'Lumbung',
          card_sign_title: res.data.card_sign_title || 'Kepala Sekolah',
          card_sign_name: res.data.card_sign_name || 'Drs. H. Mamat Rahmat, M.Pd',
          card_sign_nip: res.data.card_sign_nip || '19750812 200212 1 003',
        });
      }
    } catch (e) {
      console.error('Error fetching settings:', e);
    }
  };

  const fetchUser = async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const res = await apiRequest<User>('/api/me');
      if (res.success && res.user) {
        setUser(res.user);
      } else {
        setStoredToken(null);
        setUser(null);
      }
    } catch (e) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchUser();
  }, []);

  const login = async (username: string, password: string) => {
    const cleanUsername = typeof username === 'string' ? username.trim() : '';
    const cleanPassword = typeof password === 'string' ? password : '';

    if (!cleanUsername || !cleanPassword) {
      return {
        success: false,
        message: 'Silakan masukkan username/email dan password Anda.',
        statusCode: 400,
      };
    }

    try {
      const res = await apiRequest('/api/login', {
        method: 'POST',
        body: JSON.stringify({ username: cleanUsername, password: cleanPassword }),
      });

      if (res.success && res.token && res.user) {
        setStoredToken(res.token);
        setUser(res.user);
        return { success: true, role: res.user.role, statusCode: 200 };
      }

      console.warn('[AuthContext] Login gagal:', {
        statusCode: res.statusCode,
        message: res.message,
      });

      return {
        success: false,
        message: res.message || (res.statusCode === 401 ? 'Email/Username atau Password salah.' : 'Login gagal.'),
        statusCode: res.statusCode || 401,
      };
    } catch (err: any) {
      console.error('[AuthContext] Login Exception:', err);
      return {
        success: false,
        message: err?.message || 'Tidak dapat terhubung ke server CBT.',
        statusCode: 0,
      };
    }
  };

  const logout = async () => {
    try {
      await apiRequest('/api/logout', { method: 'POST' });
    } catch (e) {
      // ignore
    } finally {
      setStoredToken(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        settings,
        login,
        logout,
        refreshUser: fetchUser,
        refreshSettings: fetchSettings,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
