/**
 * HIKMAT TANI - Utilitas Kompresi & Pemrosesan Foto Lapang (OPT)
 * 
 * Prinsip:
 * - Kompresi foto langsung di perangkat petani (client-side) sebelum disimpan ke IndexedDB.
 * - Mengurangi ukuran data agar tidak membebani memori lokal perangkat dan menghemat penyimpanan.
 * - Bersifat defensif dengan graceful fallback jika browser tidak mendukung Canvas secara penuh.
 * - Foto bersifat opsional (tidak memblokir pencatatan).
 */

export interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

export async function compressImage(
  file: File,
  options: CompressOptions = {}
): Promise<string> {
  const { maxWidth = 800, maxHeight = 800, quality = 0.7 } = options;

  return new Promise((resolve, reject) => {
    // Validasi tipe file
    if (!file.type.startsWith('image/')) {
      return reject(new Error('Berkas yang dipilih bukan gambar yang valid.'));
    }

    const reader = new FileReader();

    reader.onload = (readerEvent) => {
      const img = new Image();

      img.onload = () => {
        try {
          let width = img.width;
          let height = img.height;

          // Hitung rasio resolusi maksimal
          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            // Fallback ke string asli reader jika canvas context gagal
            return resolve(readerEvent.target?.result as string);
          }

          // Gambar ulang dengan ukuran baru
          ctx.drawImage(img, 0, 0, width, height);

          // Ekspor ke format JPEG dengan kompresi terukur
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        } catch (err) {
          // Fallback graceful
          console.warn('Kompresi canvas gagal, menggunakan fallback gambar dasar:', err);
          resolve(readerEvent.target?.result as string);
        }
      };

      img.onerror = () => {
        reject(new Error('Gagal memproses gambar foto.'));
      };

      img.src = readerEvent.target?.result as string;
    };

    reader.onerror = () => {
      reject(new Error('Gagal membaca berkas foto.'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Memproses dan meng-crop foto profil menjadi persegi terpusat (Center-Crop)
 * dengan resolusi proporsional (256x256 px) dan ukuran data ringan (< 50 KB).
 */
export async function processProfilePhoto(
  file: File | Blob,
  targetSize: number = 256,
  quality: number = 0.85
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file instanceof File && !file.type.startsWith('image/')) {
      return reject(new Error('Berkas yang dipilih bukan berkas gambar yang valid.'));
    }

    if (typeof FileReader === 'undefined' || typeof window === 'undefined') {
      return resolve('data:image/jpeg;base64,');
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca berkas foto profil.'));
    reader.onload = (e) => {
      const src = e.target?.result as string;
      if (!src) return reject(new Error('Data gambar kosong.'));

      if (typeof document === 'undefined' || typeof Image === 'undefined') {
        return resolve(src);
      }

      const img = new Image();
      img.onerror = () => reject(new Error('Gagal memproses gambar. Pastikan format foto adalah JPG/PNG/WebP yang valid.'));
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = targetSize;
          canvas.height = targetSize;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return resolve(src);
          }

          // Hitung Center-Crop persegi
          const minDim = Math.min(img.width, img.height);
          const sx = Math.max(0, (img.width - minDim) / 2);
          const sy = Math.max(0, (img.height - minDim) / 2);

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, targetSize, targetSize);

          const result = canvas.toDataURL('image/jpeg', quality);
          resolve(result);
        } catch (err) {
          resolve(src);
        }
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

