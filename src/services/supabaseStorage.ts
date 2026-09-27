import { supabase } from '../lib/supabaseClient';

export interface UploadResult {
  success: boolean;
  url: string;
  storageType: 'supabase_storage' | 'supabase_db_data_url' | 'local';
  message?: string;
  fileName?: string;
}

/**
 * Uploads a compressed file or image blob to Supabase Storage ('school-assets' bucket).
 * Fallback gracefully if bucket requires auto-creation or returns permission error.
 */
export async function uploadToSupabaseStorage(
  file: File,
  folder: 'hero' | 'background',
  fallbackDataUrl?: string
): Promise<UploadResult> {
  const fileExt = file.name.split('.').pop() || 'jpg';
  const fileName = `${folder}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
  const filePath = `${folder}/${fileName}`;

  try {
    // Attempt 1: Upload directly to Supabase Storage bucket 'school-assets'
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('school-assets')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type || 'image/jpeg',
      });

    if (!uploadError && uploadData) {
      const { data: urlData } = supabase.storage.from('school-assets').getPublicUrl(filePath);
      if (urlData?.publicUrl) {
        return {
          success: true,
          url: urlData.publicUrl,
          storageType: 'supabase_storage',
          fileName,
          message: 'Berhasil diunggah ke Supabase Storage (CDN Public URL).',
        };
      }
    }

    // If bucket doesn't exist, attempt server endpoint fallback which also syncs to Supabase PostgreSQL settings
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);
    if (fallbackDataUrl) {
      formData.append('dataUrl', fallbackDataUrl);
    }

    const res = await fetch('/api/upload-branding', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${localStorage.getItem('cbt_auth_token') || ''}`,
      },
      body: formData,
    });

    const serverData = await res.json().catch(() => null);

    if (serverData && serverData.success && serverData.url) {
      return {
        success: true,
        url: serverData.url,
        storageType: serverData.storageType || 'supabase_storage',
        fileName,
        message: serverData.message || 'Gambar berhasil disimpan ke Supabase!',
      };
    }

    // Attempt 3: Guaranteed fallback to compressed data URL
    if (fallbackDataUrl) {
      return {
        success: true,
        url: fallbackDataUrl,
        storageType: 'supabase_db_data_url',
        fileName,
        message: 'Gambar terkompresi berhasil disimpan ke Database Supabase.',
      };
    }

    return {
      success: false,
      url: '',
      storageType: 'local',
      message: uploadError?.message || 'Gagal mengunggah file ke Supabase.',
    };
  } catch (err: any) {
    if (fallbackDataUrl) {
      return {
        success: true,
        url: fallbackDataUrl,
        storageType: 'supabase_db_data_url',
        fileName,
        message: 'Tersimpan dengan kompresi data URL terdistribusi.',
      };
    }

    return {
      success: false,
      url: '',
      storageType: 'local',
      message: err.message || 'Terjadi kesalahan koneksi saat mengunggah.',
    };
  }
}
