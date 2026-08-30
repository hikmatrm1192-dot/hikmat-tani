/**
 * HIKMAT TANI - Image Resizing & Compression Utility
 *
 * Mengoptimalkan gambar logo/ikon di sisi browser menggunakan HTML5 Canvas
 * agar payload Base64 tetap ringan (< 80-100 KB) dan aman untuk query SQLite Cloudflare D1.
 */

export interface ImageResizeOptions {
  maxWidth: number;
  maxHeight: number;
  maxBase64Length?: number; // Batas panjang karakter data URL (default: 120.000 chars ~ 90KB)
  preserveTransparency?: boolean;
  quality?: number;
}

/**
 * Mengubah dan mengompresi berkas gambar ke format Base64 yang aman untuk penyimpanan D1
 */
export async function resizeImageFileToBase64(
  file: File | Blob,
  options: ImageResizeOptions
): Promise<string> {
  const {
    maxWidth,
    maxHeight,
    maxBase64Length = 120_000,
    preserveTransparency = true,
    quality = 0.88,
  } = options;

  // Jika di lingkungan Node.js (misalnya Unit Testing / Server-side)
  if (typeof FileReader === 'undefined' || typeof window === 'undefined') {
    if (typeof (file as any).arrayBuffer === 'function') {
      const arrayBuf = await (file as any).arrayBuffer();
      const buffer = Buffer.from(arrayBuf);
      const mime = (file as any).type || 'image/png';
      const base64 = `data:${mime};base64,${buffer.toString('base64')}`;
      if (base64.length > maxBase64Length) {
        throw new Error(`Ukuran data gambar melebihi batas (${Math.round(base64.length / 1024)} KB > ${Math.round(maxBase64Length / 1024)} KB).`);
      }
      return base64;
    }
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca berkas gambar.'));
    reader.onload = (e) => {
      const src = e.target?.result as string;
      if (!src) {
        return reject(new Error('Data gambar kosong.'));
      }

      // Jika dijalankan di luar browser (misal SSR / Node test), kembalikan string jika kecil
      if (typeof window === 'undefined' || typeof document === 'undefined' || typeof Image === 'undefined') {
        if (src.length > maxBase64Length) {
          return reject(new Error(`Ukuran data gambar melebihi batas (${Math.round(src.length / 1024)} KB > ${Math.round(maxBase64Length / 1024)} KB).`));
        }
        return resolve(src);
      }

      const img = new Image();
      img.onerror = () => reject(new Error('Gagal memproses gambar. Pastikan format file adalah gambar valid.'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Hitung rasio aspek
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.max(1, Math.round(width * ratio));
          height = Math.max(1, Math.round(height * ratio));
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Canvas context tidak didukung pada peramban ini.'));
        }

        // Hapus canvas untuk menjaga transparansi
        ctx.clearRect(0, 0, width, height);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        const isJpeg = (file instanceof File && file.type === 'image/jpeg') || (!preserveTransparency && !src.startsWith('data:image/png'));
        const mime = isJpeg ? 'image/jpeg' : 'image/png';
        let base64 = canvas.toDataURL(mime, quality);

        // Jika format PNG masih melebihi batas, coba WebP berkualitas tinggi
        if (base64.length > maxBase64Length && !isJpeg) {
          const webp = canvas.toDataURL('image/webp', quality);
          if (webp.startsWith('data:image/webp') && webp.length < base64.length) {
            base64 = webp;
          }
        }

        // Jika masih terlalu besar, lakukan re-scaling bertahap (0.8x)
        if (base64.length > maxBase64Length) {
          const canvas2 = document.createElement('canvas');
          canvas2.width = Math.max(1, Math.round(width * 0.75));
          canvas2.height = Math.max(1, Math.round(height * 0.75));
          const ctx2 = canvas2.getContext('2d');
          if (ctx2) {
            ctx2.clearRect(0, 0, canvas2.width, canvas2.height);
            ctx2.imageSmoothingEnabled = true;
            ctx2.imageSmoothingQuality = 'high';
            ctx2.drawImage(img, 0, 0, canvas2.width, canvas2.height);
            const reduced = canvas2.toDataURL(isJpeg ? 'image/jpeg' : 'image/png', quality);
            if (reduced.length < base64.length) {
              base64 = reduced;
            }
          }
        }

        if (base64.length > maxBase64Length) {
          return reject(new Error(`Ukuran data gambar (${Math.round(base64.length / 1024)} KB) melebihi batas aman database (maks ${Math.round(maxBase64Length / 1024)} KB). Harap gunakan gambar dengan dimensi lebih kecil.`));
        }

        resolve(base64);
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}
