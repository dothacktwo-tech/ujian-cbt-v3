export interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0 to 1
  mimeType?: 'image/jpeg' | 'image/webp' | 'image/png';
}

export interface CompressResult {
  file: File;
  dataUrl: string;
  sizeKb: number;
  originalSizeKb: number;
  savedPercentage: number;
}

/**
 * Compresses an image file on the client side using HTML5 Canvas.
 * Significantly reduces image dimensions & payload size before uploading.
 */
export async function compressImage(
  file: File,
  options: CompressOptions = {}
): Promise<CompressResult> {
  const {
    maxWidth = 1600,
    maxHeight = 1200,
    quality = 0.8,
    mimeType = 'image/jpeg',
  } = options;

  const originalSizeKb = Math.round(file.size / 1024);

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca berkas gambar.'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Format file gambar tidak valid atau corrupt.'));
      img.onload = () => {
        let { width, height } = img;

        // Calculate aspect ratio scaling
        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Gagal menginisialisasi kanvas kompresi.'));
          return;
        }

        // Fill background with white for JPEG transparency fix
        if (mimeType === 'image/jpeg') {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
        }

        // Draw compressed image onto canvas
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL(mimeType, quality);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Gagal mengekspor hasil kompresi gambar.'));
              return;
            }

            const cleanFileName = file.name.replace(/\.[^/.]+$/, '') + '.jpg';
            const compressedFile = new File([blob], cleanFileName, {
              type: mimeType,
              lastModified: Date.now(),
            });

            const sizeKb = Math.round(blob.size / 1024);
            const savedPercentage = Math.max(
              0,
              Math.round(((originalSizeKb - sizeKb) / (originalSizeKb || 1)) * 100)
            );

            resolve({
              file: compressedFile,
              dataUrl,
              sizeKb,
              originalSizeKb,
              savedPercentage,
            });
          },
          mimeType,
          quality
        );
      };

      img.src = e.target?.result as string;
    };

    reader.readAsDataURL(file);
  });
}
