# Panduan Deployment Production — HIKMAT TANI

Dokumen ini adalah panduan deployment **arsitektur production yang saat ini digunakan HIKMAT TANI**: React/Vite PWA di Cloudflare Workers Assets, API di Cloudflare Worker, dan persistence cloud di Cloudflare D1.

## 1. Arsitektur Production

```text
Petani / Browser / PWA
        │
        ▼
https://app.hikmattani.id
        │
        ▼
Cloudflare Worker: hikmat-tani
        ├── SPA Assets
        ├── /api/v1/*
        ├── Auth & RBAC
        ├── Offline sync gateway
        └── Scheduled outbox drain
                │
                ▼
Cloudflare D1: hikmat-tani-db
```

Frontend tetap **offline-first** menggunakan IndexedDB/Dexie. Data cloud disinkronkan melalui Worker ketika koneksi tersedia.

## 2. Repository dan Environment

Source of truth deployment adalah repository GitHub HIKMAT TANI dan konfigurasi `wrangler.toml`.

Production binding saat ini:

| Item | Nilai |
|---|---|
| Worker | `hikmat-tani` |
| Custom domain | `app.hikmattani.id` |
| Fallback | `hikmat-tani.hikmat-rm1192.workers.dev` |
| D1 | `hikmat-tani-db` |
| D1 binding | `DB` |
| Provider | `d1` |
| Runtime | Cloudflare Workers (Edge) |
| API version | `v1` |

Jangan commit secret production ke repository.

Secret/credential production dikelola melalui Cloudflare, termasuk secret autentikasi pengelola dan secret JWT bila dikonfigurasi.

## 3. Build dan Validasi Sebelum Deploy

Gunakan Node.js 22.

```bash
npm install
npm run lint
npm test
npm run build
npx wrangler deploy --dry-run
```

CI production-readiness menjalankan urutan:

1. Type check
2. Polygon tap regression
3. Full regression suite
4. Production build
5. Wrangler dry-run validation
6. Non-mutating live production smoke

Regression BIG administrative boundary adalah pemeriksaan khusus/manual karena upstream BIG dapat mengalami timeout/HTTP 5xx dan bukan dependency yang boleh membuat seluruh aplikasi gagal.

## 4. Deployment Cloudflare

Setelah validasi lokal/CI lolos:

```bash
npm run build
npx wrangler deploy
```

Pastikan Wrangler menunjukkan binding D1 `DB` menuju database production yang benar.

Jangan menjalankan migration production secara sembarang dari laptop. Gunakan migration SQL yang versioned dan prosedur D1 yang sudah ditetapkan repository.

## 5. D1 Migration

Migration production berada di:

```text
server/db/d1/migrations/
```

Migration harus idempotent atau dijalankan melalui migration runner resmi yang mencatat migration yang sudah diterapkan.

Sebelum perubahan schema:

- pastikan migration sudah diuji;
- pastikan tidak ada destructive operation yang tidak disengaja;
- verifikasi schema D1 setelah deployment;
- jangan menghapus data petani sebagai bagian dari deployment normal.

## 6. Health Check

Endpoint utama:

```text
GET /api/v1/health
```

Health production memeriksa **koneksi D1 secara nyata dengan `SELECT 1`**, bukan hanya keberadaan binding Worker.

Respons sehat harus memiliki:

```json
{
  "status": "ok",
  "app": "HIKMAT TANI",
  "runtime": "Cloudflare Workers (Edge)",
  "database": {
    "configured": true,
    "connected": true
  }
}
```

Jika D1 tidak dapat diprobe, health menjadi `degraded` dan HTTP `503`.

Endpoint kompatibilitas tetap tersedia:

```text
GET /api/health
```

## 7. CORS dan Security Boundary

Production tidak menggunakan wildcard CORS secara default.

Origin production yang dipercaya secara eksplisit:

- `https://app.hikmattani.id`
- `https://hikmat-tani.hikmat-rm1192.workers.dev`

Origin lain tidak otomatis dipercaya hanya karena merupakan subdomain `hikmattani.id` atau `workers.dev`.

Jika `CORS_ORIGIN` diatur, gunakan daftar origin eksplisit yang dipisahkan koma. Wildcard `*` hanya boleh digunakan jika memang sengaja dibutuhkan dan dipahami konsekuensinya.

## 8. Authentication dan Data Isolation

Authentication petani menggunakan session token. Endpoint terproteksi harus memperoleh identitas dari token, bukan mempercayai `farmerId` yang dikirim bebas oleh client.

Aturan penting:

- Farmer A tidak boleh membaca atau mengubah data Farmer B.
- Sync push/pull wajib terikat pada identitas sesi.
- Duplicate operation harus idempotent.
- Password/PIN tidak disimpan plaintext.
- Secret Worker tidak dimasukkan ke frontend atau config publik.

## 9. Offline-First dan PWA

Aplikasi dirancang agar fungsi inti tetap dapat digunakan tanpa internet.

PWA production harus menyediakan:

- manifest;
- service worker;
- asset lokal untuk startup;
- IndexedDB/Dexie untuk data lokal;
- outbox untuk perubahan yang menunggu sinkronisasi.

Saat online kembali, sync menggunakan operation ID/idempotency agar retry tidak menggandakan transaksi.

## 10. Backup dan Recovery

### Data lokal petani

Gunakan fitur **Cadangkan Data / Backup** pada aplikasi untuk membuat backup JSON lokal. Restore harus divalidasi sebelum data diterapkan.

### Data cloud

Cloudflare D1 harus diperlakukan sebagai persistence production. Ikuti kemampuan backup/time-travel/export yang tersedia pada akun Cloudflare dan lakukan prosedur recovery secara terpisah dari deployment biasa.

Jangan mengandalkan backup lokal petani sebagai satu-satunya backup database cloud.

## 11. Smoke Test Setelah Deploy

Setelah deployment, verifikasi minimal:

```text
GET https://app.hikmattani.id/api/v1/health
GET https://app.hikmattani.id/
```

Kemudian secara manual dari perangkat Android:

1. buka domain production;
2. install/add to home screen sebagai PWA;
3. buka ulang aplikasi;
4. uji login/register dengan data uji yang aman;
5. buat satu data lahan uji;
6. matikan internet;
7. pastikan data lokal masih dapat dibaca/ditambah;
8. nyalakan internet;
9. pastikan sync kembali berjalan;
10. hapus data uji sesuai prosedur.

**Catatan:** CI live smoke adalah bukti HTTP dari runner, bukan pengganti pengujian fisik Android.

## 12. Rollback

Jika deployment baru menyebabkan regresi:

1. hentikan perubahan lanjutan;
2. identifikasi commit/deployment terakhir yang sehat;
3. rollback Worker ke versi yang sudah terverifikasi;
4. jangan melakukan rollback schema D1 secara destruktif tanpa migration/recovery plan;
5. verifikasi `/api/v1/health` dan SPA setelah rollback;
6. catat incident dan root cause.

## 13. Production Readiness Gate

Deployment dinyatakan siap apabila:

- type check lulus;
- seluruh regression suite lulus;
- build production lulus;
- Wrangler dry-run lulus;
- live production HTTP smoke lulus;
- D1 health probe nyata lulus;
- CORS tidak memberikan wildcard kepada origin asing;
- farmer data isolation lulus;
- PWA/startup regression lulus;
- tidak ada secret production yang masuk repository;
- pengujian Android fisik sudah dilakukan sebelum distribusi luas.

Jika pengujian fisik Android belum dilakukan, status harus dicatat sebagai **production readiness terbukti secara otomatis, physical-device verification masih pending** — bukan dianggap sudah terbukti.
