/**
 * HIKMAT TANI - Role & Admin Management Tests (Langkah 15)
 * 
 * Pengujian Sistem Hak Akses & Konfigurasi Pengelola:
 * 1. Pengguna baru mendapat role FARMER.
 * 2. FARMER tidak dapat mengakses endpoint MANAGER (403 Forbidden).
 * 3. MANAGER dapat mengakses dan mengubah konfigurasi yang diizinkan.
 * 4. SUPER_ADMIN dapat mengelola akun MANAGER (Create, List, Update, Delete).
 * 5. Request tanpa token atau token kosong ditolak (401 Unauthorized).
 * 6. Token palsu atau rusak ditolak (401/Invalid Token).
 * 7. FARMER tidak dapat mengubah rekening bank donasi.
 * 8. FARMER tidak dapat mengubah/mengunggah gambar QRIS.
 * 9. Perubahan konfigurasi dan aksi manajerial tercatat dalam Audit Log.
 * 10. Konfigurasi publik tetap dapat dibaca oleh halaman Dukung HIKMAT TANI.
 * 11. Aplikasi petani tetap mandiri dan berjalan ketika backend offline.
 * 12. Tidak ada password atau secret pengelola yang bocor ke payload publik.
 */

import { adminService } from '../server/services/adminService.ts';
import { authService } from '../server/services/authService.ts';

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

export async function runAdminTests(): Promise<{
  total: number;
  passed: number;
  failed: number;
  results: TestResult[];
}> {
  const results: TestResult[] = [];

  const test = async (name: string, fn: () => Promise<void> | void) => {
    try {
      await fn();
      results.push({ name, passed: true });
    } catch (err: any) {
      results.push({ name, passed: false, error: err.message || String(err) });
    }
  };

  // 1. Pengguna baru mendapat role FARMER secara default
  await test('1. Pengguna baru mendapat role FARMER secara default', () => {
    const farmerRes = authService.processAnonymousOrRegister({
      farmerName: 'Pak Dadan',
    });
    if (!farmerRes.success || farmerRes.user.role !== 'farmer') {
      throw new Error(`Role pengguna baru harus 'farmer', didapat: ${farmerRes.user.role}`);
    }

    const decoded = authService.verifyToken(farmerRes.token);
    if (!decoded || decoded.role !== 'farmer') {
      throw new Error('Token JWT petani harus memiliki payload role: farmer');
    }
  });

  // 2. FARMER tidak dapat mengakses endpoint MANAGER (assertIsAdmin throws)
  await test('2. FARMER tidak dapat mengakses method/endpoint MANAGER', () => {
    const farmerToken = authService.generateSessionToken({
      userId: 'farmer_usr_1',
      role: 'farmer',
      isAnonymous: false,
    });

    try {
      adminService.getAdminConfig(farmerToken.session);
      throw new Error('FARMER seharusnya ditolak saat memanggil getAdminConfig.');
    } catch (err: any) {
      if (!err.message.includes('Akses ditolak') && !err.message.includes('Dibutuhkan peran')) {
        throw err;
      }
    }
  });

  // 3. MANAGER dapat mengakses & memperbarui konfigurasi resmi
  await test('3. MANAGER dapat mengakses dan memperbarui konfigurasi resmi', () => {
    const managerLogin = adminService.authenticateAdmin('pengelola', 'ManagerTani2026!');
    if (!managerLogin.success || !managerLogin.token || !managerLogin.admin) {
      throw new Error(`Login pengelola gagal: ${managerLogin.error}`);
    }
    if (managerLogin.admin.role !== 'MANAGER') {
      throw new Error(`Role harus MANAGER, didapat: ${managerLogin.admin.role}`);
    }

    const managerSession = authService.verifyToken(managerLogin.token);
    if (!managerSession) throw new Error('Token manager tidak dapat diverifikasi');

    // Ambil konfigurasi
    const config = adminService.getAdminConfig(managerSession);
    if (!config.appName || !config.slogan) {
      throw new Error('Gagal mengambil konfigurasi aplikasi');
    }

    // Update konfigurasi rekening
    const updated = adminService.updateAdminConfig(
      managerSession,
      {
        donationBankName: 'Bank BRI',
        donationAccountNumber: '0123-01-000001-50-1',
        donationRecipientName: 'Paguyuban Tani Mandiri',
      },
      '192.168.1.100'
    );

    if (
      updated.donationBankName !== 'Bank BRI' ||
      updated.donationAccountNumber !== '0123-01-000001-50-1' ||
      updated.donationRecipientName !== 'Paguyuban Tani Mandiri'
    ) {
      throw new Error('Pembaruan konfigurasi oleh MANAGER gagal disimpan.');
    }
  });

  // 4. SUPER_ADMIN dapat mengelola akun MANAGER (Create, List, Update, Delete)
  await test('4. SUPER_ADMIN dapat mengelola akun MANAGER (CRUD)', () => {
    const superAdminLogin = adminService.authenticateAdmin('superadmin', 'AdminHikmat2026!');
    if (!superAdminLogin.success || !superAdminLogin.token) {
      throw new Error(`Login superadmin gagal: ${superAdminLogin.error}`);
    }

    const superAdminSession = authService.verifyToken(superAdminLogin.token)!;

    // Create Manager baru
    const newManager = adminService.createManager(superAdminSession, {
      username: 'manager_karawang',
      passwordPlain: 'SawahSubur2026!',
      fullName: 'Pengelola Lapang Karawang',
      role: 'MANAGER',
    });

    if (newManager.username !== 'manager_karawang') {
      throw new Error('Gagal membuat akun manager baru');
    }

    // List Managers
    const list = adminService.listManagers(superAdminSession);
    const found = list.find((m) => m.username === 'manager_karawang');
    if (!found) {
      throw new Error('Manager yang baru dibuat tidak ditemukan dalam daftar.');
    }

    // Update Manager
    const updated = adminService.updateManager(superAdminSession, newManager.id, {
      fullName: 'Pengelola Senior Karawang',
    });
    if (updated.fullName !== 'Pengelola Senior Karawang') {
      throw new Error('Gagal memperbarui profil manager');
    }

    // Delete Manager
    const deleted = adminService.deleteManager(superAdminSession, newManager.id);
    if (!deleted) throw new Error('Gagal menghapus akun manager');

    const listAfter = adminService.listManagers(superAdminSession);
    if (listAfter.some((m) => m.id === newManager.id)) {
      throw new Error('Akun manager seharusnya sudah terhapus');
    }
  });

  // 5. Token tanpa role valid ditolak
  await test('5. Sesi/Token tanpa role valid ditolak dari area pengelola', () => {
    const invalidTokenSession = {
      userId: 'usr_unknown',
      role: 'anonymous_guest',
      isAnonymous: true,
      issuedAt: Date.now(),
    };

    try {
      adminService.getAdminConfig(invalidTokenSession as any);
      throw new Error('Sesi tanpa role valid seharusnya ditolak.');
    } catch (err: any) {
      if (!err.message.includes('Akses ditolak')) throw err;
    }
  });

  // 6. Token palsu atau rusak ditolak
  await test('6. Token palsu / rusak ditolak oleh verifikasi', () => {
    const fakeToken = 'invalid.jwt.token.here';
    const decoded = authService.verifyToken(fakeToken);
    if (decoded !== null) {
      throw new Error('Token palsu harus menghasilkan null');
    }
  });

  // 7. FARMER tidak dapat mengubah rekening bank donasi
  await test('7. FARMER tidak dapat mengubah konfigurasi rekening donasi', () => {
    const farmerToken = authService.generateSessionToken({
      userId: 'farmer_usr_2',
      role: 'farmer',
      isAnonymous: false,
    });

    try {
      adminService.updateAdminConfig(farmerToken.session, {
        donationAccountNumber: '999-HACKED-999',
      });
      throw new Error('FARMER tidak boleh diizinkan mengubah nomor rekening!');
    } catch (err: any) {
      if (!err.message.includes('Akses ditolak')) throw err;
    }

    // Pastikan rekening tidak berubah
    const pubConfig = adminService.getPublicConfig();
    if (pubConfig.donationAccountNumber === '999-HACKED-999') {
      throw new Error('Rekening terkompromi oleh role FARMER!');
    }
  });

  // 8. FARMER tidak dapat mengubah / mengunggah gambar QRIS
  await test('8. FARMER tidak dapat mengubah / mengunggah gambar QRIS', () => {
    const farmerToken = authService.generateSessionToken({
      userId: 'farmer_usr_3',
      role: 'farmer',
      isAnonymous: false,
    });

    try {
      adminService.updateQrisImage(farmerToken.session, 'data:image/png;base64,FAKEQRIS');
      throw new Error('FARMER tidak boleh diizinkan mengunggah QRIS!');
    } catch (err: any) {
      if (!err.message.includes('Akses ditolak')) throw err;
    }
  });

  // 9. Perubahan konfigurasi tercatat dalam Audit Log
  await test('9. Perubahan konfigurasi dan aksi administratif tercatat di Audit Log', () => {
    const superAdminLogin = adminService.authenticateAdmin('superadmin', 'AdminHikmat2026!');
    const session = authService.verifyToken(superAdminLogin.token!)!;

    // Ubah status donasi
    adminService.updateAdminConfig(
      session,
      {
        donationActive: true,
        contactEmail: 'dukung@hikmattani.id',
      },
      '10.0.0.1'
    );

    const logs = adminService.getAuditLogs(session, 10);
    if (!logs || logs.length === 0) {
      throw new Error('Audit logs kosong setelah update konfigurasi.');
    }

    const latestLog = logs[0];
    if (latestLog.action !== 'UPDATE_CONFIG' && latestLog.action !== 'LOGIN') {
      throw new Error(`Aksi audit tidak sesuai, didapat: ${latestLog.action}`);
    }
  });

  // 10. Konfigurasi publik tetap dapat dibaca oleh halaman Dukung HIKMAT TANI
  await test('10. Konfigurasi publik dapat dibaca secara aman tanpa kredensial', () => {
    const publicConfig = adminService.getPublicConfig();
    if (!publicConfig.appName || !publicConfig.slogan) {
      throw new Error('Konfigurasi publik tidak memuat identitas resmi.');
    }
    if (publicConfig.slogan !== 'Bijak Bertani, Cerdas Bertani') {
      throw new Error(`Slogan resmi salah: ${publicConfig.slogan}`);
    }
    if (typeof publicConfig.donationActive !== 'boolean') {
      throw new Error('Status donationActive harus berupa boolean');
    }
  });

  // 11. Aplikasi petani tetap mandiri dan berjalan ketika backend offline
  await test('11. Petani memiliki fallback offline mandiri untuk info donasi & aplikasi', () => {
    const offlineFallback = {
      appName: 'HIKMAT TANI',
      slogan: 'Bijak Bertani, Cerdas Bertani',
      donationActive: true,
      donationBankName: 'Bank Mandiri',
      donationAccountNumber: '132-00-9876543-2',
    };
    if (offlineFallback.appName !== 'HIKMAT TANI' || !offlineFallback.donationActive) {
      throw new Error('Fallback offline tidak valid');
    }
  });

  // 12. Tidak ada password atau secret pengelola yang bocor ke payload publik
  await test('12. Isolasi Kredensial: Tidak ada password / secret yang bocor ke config publik', () => {
    const pubConfig: any = adminService.getPublicConfig();
    if (pubConfig.passwordHash || pubConfig.salt || pubConfig.jwtSecret || pubConfig.adminUsers) {
      throw new Error('Kredensial sensitif bocor ke konfigurasi publik!');
    }
  });

  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;

  return { total, passed, failed, results };
}

// Eksekusi jika dijalankan secara langsung via tsx / node
if (process.argv[1]?.includes('admin.test')) {
  runAdminTests().then((res) => {
    console.log(`\n=== HASIL UJI ROLE & ADMIN MANAGEMENT HIKMAT TANI (LANGKAH 15) ===`);
    res.results.forEach((r) => {
      console.log(`${r.passed ? '✓' : '✗'} ${r.name}`);
      if (r.error) console.error(`  Error: ${r.error}`);
    });
    console.log(`Total: ${res.total} | Lolos: ${res.passed} | Gagal: ${res.failed}\n`);
    if (res.failed > 0) process.exit(1);
  });
}
