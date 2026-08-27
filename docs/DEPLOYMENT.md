# PANDUAN DEPLOYMENT PRODUCTION & OPERASIONAL
## HIKMAT TANI
**Tagline Resmi: "CERDAS BERTANI, BIJAK MENGAMBIL KEPUTUSAN."**

Dokumen ini menjelaskan tata cara deployment, konfigurasi environment, migrasi database PostgreSQL, pengoperasian server Express, dan pemantauan sistem HIKMAT TANI di lingkungan production (Cloud Run, Docker Container, VPS, atau PaaS).

---

## 1. Arsitektur Deployment

HIKMAT TANI dirancang dengan arsitektur **Hybrid Offline-First Full-Stack**:
- **Client (Frontend)**: React 19 + TypeScript + Vite + Tailwind CSS + Dexie (IndexedDB) + PWA Service Worker. Berjalan offline secara mandiri di perangkat petani.
- **Server (Backend)**: Node.js / Express + TypeScript (dibundel menjadi `dist/server.cjs` menggunakan esbuild) + Drizzle ORM.
- **Database (Cloud Persistence)**: PostgreSQL 14+ (Cloud SQL, Supabase, Neon, RDS, atau instance PostgreSQL mandiri).

---

## 2. Variabel Lingkungan (Environment Variables)

Salin `.env.example` ke `.env` di server atau atur variabel lingkungan pada platform deployment (misal: Cloud Run Secret Manager / Environment Variables):

| Variabel | Tipe | Wajib | Keterangan | Contoh Nilai |
| :--- | :--- | :---: | :--- | :--- |
| `PORT` | Number | Opsional | Port listener server HTTP (default: `3000`) | `3000` atau `8080` |
| `NODE_ENV` | String | **Wajib** | Mode runtime Node.js | `production` |
| `JWT_SECRET` | String | **Wajib** | Secret key acak untuk token sesi (HS256) | `openssl rand -base64 32` |
| `CORS_ORIGIN` | String | Opsional | Domain yang diizinkan (atau `*` untuk multi-domain) | `https://app.hikmattani.id` |
| `DATABASE_URL` | String | Opsional | Connection string PostgreSQL Drizzle | `postgresql://user:pass@host:5432/dbname?sslmode=require` |
| `VITE_DONATION_URL` | String | Opsional | URL tautan donasi eksternal (Kitabisa/Saweria/dll) | `https://saweria.co/hikmattani` |

> ⚠️ **Catatan Keamanan**: Jangan pernah menyertakan `JWT_SECRET` atau `DATABASE_URL` nyata ke dalam repository git.

---

## 3. Langkah-Langkah Deployment

### Tahap 1: Instalasi Dependensi
```bash
npm ci
```

### Tahap 2: Migrasi Database PostgreSQL (Idempotent)
Jalankan migrasi skema SQL sebelum menyalakan server production:
```bash
npm run db:migrate
```
*Skrip `server/db/migrations/0000_init.sql` bersifat idempotent menggunakan klausa `CREATE TABLE IF NOT EXISTS`, sehingga aman dijalankan berulang kali.*

### Tahap 3: Kompilasi / Build Production
Kompilasi client SPA dan backend server:
```bash
npm run build
```
Perintah ini akan menghasilkan:
1. `dist/` — Artefak statis web (HTML, JS, CSS, PWA manifest, service worker).
2. `dist/server.cjs` — Bundle server Express CommonJS mandiri siap eksekusi.

### Tahap 4: Menjalankan Server Production
Jalankan server menggunakan Node.js:
```bash
NODE_ENV=production npm start
# atau
NODE_ENV=production node dist/server.cjs
```

---

## 4. Health Check & Monitoring

Sistem menyediakan dua endpoint health check untuk orkestrator kontainer (Kubernetes, Docker Swarm, Cloud Run, AWS ECS):

### 1. Endpoint Utama: `GET /api/v1/health`
**Respons:**
```json
{
  "success": true,
  "status": "ok",
  "app": "HIKMAT TANI",
  "version": "1.0.0",
  "apiVersion": "v1",
  "environment": "production",
  "database": {
    "configured": true,
    "connected": true,
    "engine": "PostgreSQL (Drizzle ORM)",
    "schemaVersion": "1.0.0"
  },
  "timestamp": "2026-08-27T10:00:00.000Z"
}
```

### 2. Endpoint Kompatibilitas: `GET /api/health`
**Respons:**
```json
{
  "status": "ok",
  "app": "HIKMAT TANI",
  "mode": "production",
  "database": {
    "configured": true,
    "connected": true,
    "engine": "PostgreSQL (Drizzle ORM)",
    "schemaVersion": "1.0.0"
  },
  "timestamp": "2026-08-27T10:00:00.000Z"
}
```

---

## 5. Konfigurasi Container (Dockerfile Contoh)

```dockerfile
# Multi-stage Dockerfile untuk HIKMAT TANI
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/v1/health || exit 1

CMD ["node", "dist/server.cjs"]
```

---

## 6. Prosedur Graceful Shutdown

Server Express telah dilengkapi pendengar sinyal `SIGTERM` dan `SIGINT`:
- Saat menerima sinyal penghentian, server menghentikan penerimaan request baru dan menyelesaikan request yang sedang berjalan.
- Koneksi HTTP ditutup secara bersih dengan batas waktu maksimal 10 detik sebelum proses dimatikan.

---

## 7. Prosedur Pencadangan & Pemulihan (Backup & Disaster Recovery)

1. **Sisi Klien (Petani)**:
   - Petani dapat melakukan ekspor JSON cadangan data lokal secara mandiri melalui menu **Pengaturan $\rightarrow$ Cadangkan Data**.
   - Berkas backup terenkapsulasi dengan skema JSON standar HIKMAT TANI dan dapat dipulihkan kapan saja (*Atomic Restore*).

2. **Sisi Server (PostgreSQL)**:
   - Gunakan `pg_dump` standar untuk pencadangan rutin basis data:
   ```bash
   pg_dump -U postgres -d hikmat_tani -F c -b -v -f "/backup/hikmat_tani_$(date +%Y%m%d_%H%M%S).dump"
   ```
