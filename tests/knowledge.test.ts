/**
 * HIKMAT TANI - Knowledge & Information Sync Test Suite (Langkah 11C)
 * 
 * Pengujian:
 * 1. Bundle Download (GET /api/v1/knowledge/bundle)
 * 2. Bundle Validation (Validasi tipe & struktur)
 * 3. Local Persistence (Penyimpanan ke Dexie / IndexedDB)
 * 4. Knowledge Versioning (Perbandingan versi server vs client)
 * 5. Incremental Update (GET /api/v1/knowledge/updates?since=...)
 * 6. Duplicate Update (Idempotent update handling)
 * 7. Atomic Update (Transaksi Dexie atomik)
 * 8. Corrupted Update Rejection (Penolakan payload cacat tanpa merusak data lokal)
 * 9. Offline Knowledge Access (Akses langsung ke Dexie tanpa API)
 * 10. Reference Traceability (Penelusuran OPT, pupuk, varietas, artikel ke referensi)
 * 11. Alias Search (Pencarian nama lokal seperti "Sundep", "Beluk", "Kresek")
 * 12. VERIFIED / REVIEW Handling (Pembedaan status verifikasi ilmiah)
 */

import 'fake-indexeddb/auto';
import { knowledgeService } from '../server/services/knowledgeService.ts';
import { ClientKnowledgeSyncEngine } from '../src/sync/knowledgeSync.ts';
import { db } from '../src/db/database.ts';
import { knowledgeRepository } from '../src/db/repositories/knowledgeRepository.ts';
import { initializeDatabase } from '../src/db/database.ts';

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

export async function runKnowledgeTests(): Promise<{
  total: number;
  passed: number;
  failed: number;
  results: TestResult[];
}> {
  const results: TestResult[] = [];

  const runTest = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
      results.push({ name, passed: true });
    } catch (err: any) {
      results.push({ name, passed: false, error: err?.message || String(err) });
    }
  };

  // Inisialisasi basis data lokal Dexie
  await initializeDatabase();
  knowledgeService.resetStore();
  const syncEngine = new ClientKnowledgeSyncEngine();

  // ==========================================
  // 1. Bundle Download
  // ==========================================
  await runTest('1. Bundle Download: Mengunduh master knowledge bundle lengkap dari server', async () => {
    const bundle = knowledgeService.getKnowledgeBundle();
    if (!bundle || !bundle.version) {
      throw new Error('Bundle tidak valid atau versi hilang');
    }
    if (!Array.isArray(bundle.references) || bundle.references.length === 0) {
      throw new Error('Bundle tidak memuat references');
    }
    if (!Array.isArray(bundle.opts) || bundle.opts.length === 0) {
      throw new Error('Bundle tidak memuat opts');
    }
    if (!Array.isArray(bundle.fertilizers) || bundle.fertilizers.length === 0) {
      throw new Error('Bundle tidak memuat fertilizers');
    }
    if (!Array.isArray(bundle.riceVarieties) || bundle.riceVarieties.length === 0) {
      throw new Error('Bundle tidak memuat riceVarieties');
    }
    if (!Array.isArray(bundle.naturalEnemies) || bundle.naturalEnemies.length === 0) {
      throw new Error('Bundle tidak memuat naturalEnemies');
    }
    if (!Array.isArray(bundle.knowledgeArticles) || bundle.knowledgeArticles.length === 0) {
      throw new Error('Bundle tidak memuat knowledgeArticles');
    }
  });

  // ==========================================
  // 2. Bundle Validation
  // ==========================================
  await runTest('2. Bundle Validation: Memvalidasi integritas struktur bundle', async () => {
    const validBundle = knowledgeService.getKnowledgeBundle();
    const validationResult = syncEngine.validatePayload(validBundle);
    if (!validationResult) {
      throw new Error('Valid bundle ditolak oleh validator');
    }

    const invalidBundle1 = { version: 123 }; // version bukan string
    if (syncEngine.validatePayload(invalidBundle1)) {
      throw new Error('Invalid bundle 1 seharusnya ditolak');
    }

    const invalidBundle2 = {
      version: 'v1.0.0',
      opts: [{ commonName: 'Hama Tanpa ID' }], // kehilangan ID
    };
    if (syncEngine.validatePayload(invalidBundle2)) {
      throw new Error('Invalid bundle 2 (missing ID) seharusnya ditolak');
    }
  });

  // ==========================================
  // 3. Local Persistence
  // ==========================================
  await runTest('3. Local Persistence: Menyimpan bundle ke Dexie IndexedDB', async () => {
    const bundle = knowledgeService.getKnowledgeBundle();
    const result = await syncEngine.applyKnowledgeAtomically(bundle);

    if (!result.success || result.appliedCount === 0) {
      throw new Error('Gagal menerapkan bundle ke basis data lokal');
    }

    // Verifikasi data ada di IndexedDB
    const optsInDb = await db.opts.toArray();
    if (optsInDb.length === 0) {
      throw new Error('Tabel opts di IndexedDB kosong setelah persistensi');
    }
  });

  // ==========================================
  // 4. Knowledge Versioning
  // ==========================================
  await runTest('4. Knowledge Versioning: Pemeriksaan versi server vs client', async () => {
    const versionInfo = knowledgeService.getVersionInfo();
    if (!versionInfo.version || typeof versionInfo.totalEntities !== 'number') {
      throw new Error('VersionInfo tidak lengkap');
    }

    syncEngine.setLocalVersion('v1.0.0');
    const localVer = syncEngine.getLocalVersion();
    if (localVer !== 'v1.0.0') {
      throw new Error('Gagal menyimpan atau membaca local version');
    }
  });

  // ==========================================
  // 5. Incremental Update
  // ==========================================
  await runTest('5. Incremental Update: Mengambil hanya entitas yang mengalami pembaruan', async () => {
    const oldTimestamp = '2025-01-01T00:00:00.000Z';
    const futureTimestamp = '2099-01-01T00:00:00.000Z';

    // 1. Updates sejak tanggal lampau (sebelum seed date 2026-01-01) -> harus menghasilkan entitas perubahan
    const pastUpdates = knowledgeService.getKnowledgeUpdates(oldTimestamp);
    if (!pastUpdates.hasUpdates || pastUpdates.changes.opts.length === 0) {
      throw new Error('Seharusnya ada updates untuk timestamp lampau');
    }

    // 2. Updates sejak tanggal masa depan -> tidak ada perubahan (hemat kuota)
    const futureUpdates = knowledgeService.getKnowledgeUpdates(futureTimestamp);
    if (futureUpdates.hasUpdates || futureUpdates.metadata.totalChangedEntities > 0) {
      throw new Error('Seharusnya tidak ada updates untuk timestamp masa depan');
    }
  });

  // ==========================================
  // 6. Duplicate Update (Idempotency)
  // ==========================================
  await runTest('6. Duplicate Update: Menerapkan update yang sama berkali-kali secara aman', async () => {
    const bundle = knowledgeService.getKnowledgeBundle();
    const firstRes = await syncEngine.applyKnowledgeAtomically(bundle);
    const secondRes = await syncEngine.applyKnowledgeAtomically(bundle);

    if (!firstRes.success || !secondRes.success) {
      throw new Error('Update berulang gagal diterapkan');
    }

    // Pastikan jumlah entitas tidak membengkak/menduplikasi record
    const count = await db.opts.count();
    if (count !== bundle.opts.length) {
      throw new Error(`Entitas terduplikasi di DB! Diharapkan ${bundle.opts.length}, didapat ${count}`);
    }
  });

  // ==========================================
  // 7. Atomic Update
  // ==========================================
  await runTest('7. Atomic Update: Seluruh koleksi diperbarui dalam satu transaksi utuh', async () => {
    const testArticle = {
      id: 'art-atomic-test',
      category: 'CULTIVATION',
      title: 'Artikel Uji Atomik',
      summary: 'Ringkasan',
      content: 'Isi lengkap',
      tags: ['Uji'],
      status: 'VERIFIED' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updatePayload = {
      version: 'v1.1.99',
      updatedAt: new Date().toISOString(),
      changes: {
        knowledgeArticles: [testArticle],
      },
    };

    await syncEngine.applyKnowledgeAtomically(updatePayload);
    const retrieved = await db.knowledgeArticles.get('art-atomic-test');
    if (!retrieved || retrieved.title !== 'Artikel Uji Atomik') {
      throw new Error('Transaksi atomik gagal menyimpan artikel uji');
    }
  });

  // ==========================================
  // 8. Corrupted Update Rejection
  // ==========================================
  await runTest('8. Corrupted Update Rejection: Menolak data korup tanpa merusak DB lokal', async () => {
    const corruptedPayload: any = {
      version: 'v9.9.9',
      changes: {
        opts: [{ invalidField: 123 }], // Tanpa ID
      },
    };

    let rejected = false;
    try {
      await syncEngine.applyKnowledgeAtomically(corruptedPayload);
    } catch {
      rejected = true;
    }

    if (!rejected) {
      throw new Error('Payload korup seharusnya ditolak');
    }

    // Pastikan versi lokal tidak berubah menjadi versi payload yang ditolak
    if (syncEngine.getLocalVersion() === 'v9.9.9') {
      throw new Error('Versi lokal tidak boleh diubah saat transaksi gagal');
    }
  });

  // ==========================================
  // 9. Offline Knowledge Access
  // ==========================================
  await runTest('9. Offline Access: Membaca seluruh pustaka langsung dari Dexie secara instan', async () => {
    const allOpts = await knowledgeRepository.getAllOpts();
    const allFerts = await knowledgeRepository.getAllFertilizers();
    const allVars = await knowledgeRepository.getAllVarieties();
    const allEnemies = await knowledgeRepository.getAllNaturalEnemies();
    const allArticles = await knowledgeRepository.getAllArticles();

    if (allOpts.length === 0 || allFerts.length === 0 || allVars.length === 0) {
      throw new Error('Pembacaan offline master data gagal');
    }
    if (allEnemies.length === 0 || allArticles.length === 0) {
      throw new Error('Pembacaan musuh alami atau artikel offline gagal');
    }
  });

  // ==========================================
  // 10. Reference Traceability
  // ==========================================
  await runTest('10. Reference Traceability: Setiap entitas terhubung ke dokumen rujukan resmi', async () => {
    const optsWithRef = await db.opts.filter((o) => !!o.referenceId).toArray();
    if (optsWithRef.length === 0) {
      throw new Error('Tidak ada OPT yang memiliki referenceId');
    }

    // Verifikasi bahwa referenceId tersebut ada di tabel references
    for (const opt of optsWithRef) {
      const ref = await db.references.get(opt.referenceId!);
      if (!ref) {
        throw new Error(`Reference ID '${opt.referenceId}' pada OPT '${opt.commonName}' tidak ditemukan di tabel references`);
      }
    }
  });

  // ==========================================
  // 11. Alias Search (Offline)
  // ==========================================
  await runTest('11. Alias Search: Pencarian berbasis nama lokal (Sundep, Kresek, dll)', async () => {
    // 1. Cari alias "Sundep" -> harus menemukan Penggerek Batang Padi Kuning
    const sundepResults = await knowledgeRepository.searchOpts('Sundep');
    if (sundepResults.length === 0) {
      throw new Error('Pencarian alias "Sundep" tidak mengembalikan hasil');
    }
    const isPBPK = sundepResults.some((o) =>
      o.commonName.toLowerCase().includes('penggerek') ||
      o.aliases.includes('Sundep')
    );
    if (!isPBPK) {
      throw new Error('Hasil pencarian "Sundep" tidak cocok dengan Penggerek Batang');
    }

    // 2. Cari alias pupuk "Urea" atau "Pupuk Putih"
    const ureaResults = await knowledgeRepository.searchFertilizers('Pupuk Putih');
    if (ureaResults.length === 0 || !ureaResults.some((f) => f.name.includes('Urea'))) {
      throw new Error('Pencarian alias pupuk "Pupuk Putih" gagal');
    }
  });

  // ==========================================
  // 12. VERIFIED / REVIEW Handling
  // ==========================================
  await runTest('12. VERIFIED / REVIEW: Mempertahankan dan membedakan status validasi ilmiah', async () => {
    const verifiedRefs = await db.references
      .filter((r) => r.validationStatus === 'VERIFIED')
      .toArray();
    const reviewRefs = await db.references
      .filter((r) => r.validationStatus === 'REVIEW')
      .toArray();

    if (verifiedRefs.length === 0) {
      throw new Error('Tidak ada referensi dengan status VERIFIED');
    }
    if (reviewRefs.length === 0) {
      throw new Error('Tidak ada referensi dengan status REVIEW');
    }
  });

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;

  return { total, passed, failed, results };
}

// Eksekusi jika dijalankan secara mandiri via CLI (tsx tests/knowledge.test.ts)
if (process.argv[1]?.includes('knowledge.test')) {
  runKnowledgeTests().then((res) => {
    console.log(`\n=== HASIL UJI KNOWLEDGE & INFORMASI SYNC (LANGKAH 11C) ===`);
    res.results.forEach((r) => {
      console.log(`${r.passed ? '✓' : '✗'} ${r.name}`);
      if (r.error) console.error(`  Error: ${r.error}`);
    });
    console.log(`Total: ${res.total} | Lolos: ${res.passed} | Gagal: ${res.failed}\n`);
    if (res.failed > 0) process.exit(1);
  });
}
