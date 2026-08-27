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
