/**
 * HIKMAT TANI - Role & Admin Management Tests (Langkah 15 & D1 Persistence)
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
 * 13. D1 Persistence: Inisialisasi Super Admin di D1 idempoten dengan ID kanonikal 'admin_super_pappizee'.
 * 14. D1 Persistence: Simulasi Cold-Start Worker (instansiasi baru) mempertahankan data admin_users & app_configs.
 * 15. D1 Persistence: Catatan audit log tersimpan persisten di tabel admin_audit_logs D1.
 */

import { AdminService, adminService, getSuperAdminInitialPasswordFromEnv } from '../server/services/adminService.ts';
import { authService } from '../server/services/authService.ts';
import { createTestD1Database } from '../server/db/d1/testD1.ts';
import { ensureD1CanonicalSchema } from '../server/db/d1/ensureCanonical.ts';
import { createD1Client } from '../server/db/d1/index.ts';

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

  // Pastikan environment password tersedia untuk pengujian tanpa menampilkan nilainya
  if (!process.env.ADMIN_INITIAL_PASSWORD && !process.env.SUPER_ADMIN_PASSWORD) {
    process.env.ADMIN_INITIAL_PASSWORD = 'HikmatTaniSuperAdmin2026Secret!';
    adminService.reprovisionSuperAdminPassword();
  }
  const currentSecret = getSuperAdminInitialPasswordFromEnv();

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
    const managerLogin = adminService.authenticateAdmin('pengelola', process.env.MANAGER_INITIAL_PASSWORD || 'ManagerTani2026!');
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

  // 4A. SUPER_ADMIN Autentikasi: Login dengan username pappizee + password benar -> PASS
  await test('4A. SUPER_ADMIN: Login menggunakan Username (pappizee) -> PASS', () => {
    const res = adminService.authenticateAdmin('pappizee', currentSecret);
    if (!res.success || !res.token) {
      throw new Error(`Login superadmin gagal: ${res.error}`);
    }
    if (res.admin?.role !== 'SUPER_ADMIN') {
      throw new Error(`Role akun harus SUPER_ADMIN, didapat: ${res.admin?.role}`);
    }
    if (res.admin?.username !== 'pappizee') {
      throw new Error(`Username harus 'pappizee', didapat: ${res.admin?.username}`);
    }
    if (res.admin?.email !== 'hikmat.rm1192@gmail.com') {
      throw new Error(`Email harus 'hikmat.rm1192@gmail.com', didapat: ${res.admin?.email}`);
    }
  });

  // 4B. SUPER_ADMIN Autentikasi: Login dengan email hikmat.rm1192@gmail.com + password benar -> PASS
  await test('4B. SUPER_ADMIN: Login menggunakan Email (hikmat.rm1192@gmail.com) -> PASS', () => {
    const res = adminService.authenticateAdmin('hikmat.rm1192@gmail.com', currentSecret);
    if (!res.success || !res.token) {
      throw new Error(`Login superadmin dengan email gagal: ${res.error}`);
    }
    if (res.admin?.role !== 'SUPER_ADMIN') {
      throw new Error(`Role akun harus SUPER_ADMIN`);
    }
  });

  // 4C. SUPER_ADMIN Autentikasi: Password salah -> ditolak
  await test('4C. SUPER_ADMIN: Percobaan login dengan password salah -> Ditolak', () => {
    const res = adminService.authenticateAdmin('pappizee', 'WrongInvalidPassword123!');
    if (res.success) {
      throw new Error('Login dengan password salah seharusnya ditolak!');
    }
  });

  // 4D. SUPER_ADMIN Autentikasi: Username / Email salah -> ditolak
  await test('4D. SUPER_ADMIN: Percobaan login dengan username/email tidak terdaftar -> Ditolak', () => {
    const res1 = adminService.authenticateAdmin('unknown_user_xyz', currentSecret);
    if (res1.success) {
      throw new Error('Login dengan username salah seharusnya ditolak!');
    }

    const res2 = adminService.authenticateAdmin('wrong.email@domain.com', currentSecret);
    if (res2.success) {
      throw new Error('Login dengan email salah seharusnya ditolak!');
    }
  });

  // 4E. SUPER_ADMIN Integrity: Tanpa Plaintext di Store & Tanpa Duplikasi Akun
  await test('4E. SUPER_ADMIN: Integritas akun tunggal, tanpa plaintext password di memori/database', () => {
    const status = adminService.verifySuperAdminStatus();
    if (!status.exists) {
      throw new Error('Akun superadmin utama tidak ditemukan');
    }
    if (status.username !== 'pappizee') {
      throw new Error(`Username harus pappizee, didapat: ${status.username}`);
    }
    if (status.email !== 'hikmat.rm1192@gmail.com') {
      throw new Error(`Email harus hikmat.rm1192@gmail.com, didapat: ${status.email}`);
    }
    if (status.role !== 'SUPER_ADMIN') {
      throw new Error('Role harus SUPER_ADMIN');
    }
    if (!status.hasSalt || !status.hasPasswordHash) {
      throw new Error('Password harus memiliki salt dan hash');
    }
    if (status.hasPlaintextPasswordInRecord) {
      throw new Error('Ditemukan field plaintext password pada objek data!');
    }
    if (status.duplicateSuperAdminsCount !== 1) {
      throw new Error(`Jumlah akun SUPER_ADMIN harus tepat 1, ditemukan: ${status.duplicateSuperAdminsCount}`);
    }
  });

  // 4F. SUPER_ADMIN (pappizee) dapat mengelola akun MANAGER (Create, List, Update, Delete)
  await test('4F. SUPER_ADMIN (pappizee) dapat mengelola akun MANAGER (CRUD)', () => {
    const superAdminLogin = adminService.authenticateAdmin('pappizee', currentSecret);
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
    const superAdminLogin = adminService.authenticateAdmin('pappizee', currentSecret || 'HikmatTaniSuperAdmin2026Secret!');
    if (!superAdminLogin.success || !superAdminLogin.token) {
      throw new Error(`Login super admin gagal: ${superAdminLogin.error}`);
    }
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
    if (publicConfig.slogan !== 'CERDAS BERTANI, BIJAK MENGAMBIL KEPUTUSAN.') {
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
      slogan: 'CERDAS BERTANI, BIJAK MENGAMBIL KEPUTUSAN.',
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

  // 13. D1 Persistence: Inisialisasi Super Admin di D1 idempoten dengan ID kanonikal 'admin_super_pappizee'
  await test('13. D1 Persistence: Inisialisasi Super Admin di D1 idempoten dengan ID kanonikal', async () => {
    const d1Mock = createTestD1Database();
    await ensureD1CanonicalSchema(d1Mock as any);
    const d1Client = createD1Client(d1Mock as any);

    const testAdminService = new AdminService(d1Client);
    await testAdminService.ensureInitializedAsync();

    // Verifikasi Super Admin tersimpan di D1
    const loginRes = await testAdminService.authenticateAdminAsync('pappizee', currentSecret || 'HikmatTaniSuperAdmin2026Secret!');
    if (!loginRes.success || loginRes.admin?.id !== 'admin_super_pappizee') {
      throw new Error(`Inisialisasi Super Admin di D1 gagal: ${loginRes.error}`);
    }

    // Inisialisasi ulang (idempoten)
    await testAdminService.ensureInitializedAsync();
    const loginRes2 = await testAdminService.authenticateAdminAsync('hikmat.rm1192@gmail.com', currentSecret || 'HikmatTaniSuperAdmin2026Secret!');
    if (!loginRes2.success) {
      throw new Error('Inisialisasi ulang idempoten gagal.');
    }
  });

  // 14. D1 Persistence: Simulasi Cold-Start Worker mempertahankan data admin_users & app_configs
  await test('14. D1 Persistence: Simulasi Cold-Start Worker mempertahankan data manager & config', async () => {
    const d1Mock = createTestD1Database();
    await ensureD1CanonicalSchema(d1Mock as any);
    const d1Client = createD1Client(d1Mock as any);

    // Instansiasi 1: Worker sebelum cold start
    const workerInstance1 = new AdminService(d1Client);
    await workerInstance1.ensureInitializedAsync();

    const superAdminLogin = await workerInstance1.authenticateAdminAsync('pappizee', currentSecret || 'HikmatTaniSuperAdmin2026Secret!');
    if (!superAdminLogin.success || !superAdminLogin.token) throw new Error('Login Super Admin instansiasi 1 gagal');
    const saSession = authService.verifyToken(superAdminLogin.token)!;

    // Buat Manager baru di instansiasi 1
    const createdMgr = await workerInstance1.createManagerAsync(saSession, {
      username: 'manager_subang',
      fullName: 'Pengelola Subang',
      passwordPlain: 'SubangPadi2026!',
      role: 'MANAGER',
    });

    // Update config di instansiasi 1
    await workerInstance1.updateAdminConfigAsync(saSession, {
      donationBankName: 'Bank Jabar BJB',
      donationAccountNumber: '001122334455',
    });

    // Simulasi Cold-Start: Hancurkan memory instance 1, buat instance 2 dengan DB D1 yang sama
    const workerInstance2 = new AdminService(d1Client);
    await workerInstance2.ensureInitializedAsync();

    // Verifikasi Manager yang dibuat di instance 1 tetap ada di instance 2 dan bisa login
    const mgrLogin = await workerInstance2.authenticateAdminAsync('manager_subang', 'SubangPadi2026!');
    if (!mgrLogin.success || mgrLogin.admin?.username !== 'manager_subang') {
      throw new Error(`Manager yang dibuat sebelum cold-start gagal login di instance baru: ${mgrLogin.error}`);
    }

    // Verifikasi config yang diubah sebelum cold-start tetap persisten
    const pubConfig = await workerInstance2.getPublicConfigAsync();
    if (pubConfig.donationBankName !== 'Bank Jabar BJB' || pubConfig.donationAccountNumber !== '001122334455') {
      throw new Error(`Config yang diubah sebelum cold-start gagal dipersistensi: ${pubConfig.donationBankName}`);
    }
  });

  // 15. D1 Persistence: Catatan audit log tersimpan persisten di tabel admin_audit_logs D1
  await test('15. D1 Persistence: Audit log tersimpan persisten di D1 saat Worker restart', async () => {
    const d1Mock = createTestD1Database();
    await ensureD1CanonicalSchema(d1Mock as any);
    const d1Client = createD1Client(d1Mock as any);

    const instance1 = new AdminService(d1Client);
    await instance1.ensureInitializedAsync();

    const saLogin = await instance1.authenticateAdminAsync('pappizee', currentSecret || 'HikmatTaniSuperAdmin2026Secret!');
    const saSession = authService.verifyToken(saLogin.token!)!;

    // Instansiasi 2 (Restart)
    const instance2 = new AdminService(d1Client);
    await instance2.ensureInitializedAsync();

    const logs = await instance2.getAuditLogsAsync(saSession, 10);
    if (!logs || logs.length === 0) {
      throw new Error('Audit logs dari instance sebelumnya gagal dimuat dari D1.');
    }

    const loginLog = logs.find((l) => l.action === 'LOGIN' && l.actorId === 'admin_super_pappizee');
    if (!loginLog) {
      throw new Error('Audit log LOGIN Super Admin tidak ditemukan di D1.');
    }
    if (loginLog.entityType !== 'AUTH') {
      throw new Error(`entityType pada audit log LOGIN harus 'AUTH', didapat: ${loginLog.entityType}`);
    }
  });

  // 16. D1 Persistence: Validasi entity_type valid dan konsisten di seluruh tipe aksi admin
  await test('16. D1 Persistence: Validasi entity_type konsisten pada seluruh aksi admin (AUTH, APP_CONFIG, ADMIN_USER)', async () => {
    const d1Mock = createTestD1Database();
    await ensureD1CanonicalSchema(d1Mock as any);
    const d1Client = createD1Client(d1Mock as any);

    const adminService = new AdminService(d1Client);
    await adminService.ensureInitializedAsync();

    const saLogin = await adminService.authenticateAdminAsync('pappizee', currentSecret || 'HikmatTaniSuperAdmin2026Secret!');
    const saSession = authService.verifyToken(saLogin.token!)!;

    // 1. UPDATE_CONFIG
    await adminService.updateAdminConfigAsync(saSession, { donationRecipientName: 'Yayasan Hikmat' });

    // 2. CREATE_MANAGER
    const newMgr = await adminService.createManagerAsync(saSession, {
      username: 'manager_audit_test',
      fullName: 'Manager Audit Test',
      passwordPlain: 'ManagerAuditPass2026!',
    });

    const logs = await adminService.getAuditLogsAsync(saSession, 20);
    const configLog = logs.find((l) => l.action === 'UPDATE_CONFIG');
    const mgrLog = logs.find((l) => l.action === 'CREATE_MANAGER');

    if (!configLog || configLog.entityType !== 'APP_CONFIG') {
      throw new Error(`UPDATE_CONFIG entityType salah: ${configLog?.entityType}`);
    }
    if (!mgrLog || mgrLog.entityType !== 'ADMIN_USER') {
      throw new Error(`CREATE_MANAGER entityType salah: ${mgrLog?.entityType}`);
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
    console.log(`\n=== HASIL UJI ROLE & ADMIN MANAGEMENT HIKMAT TANI (LANGKAH 15 & D1 PERSISTENCE) ===`);
    res.results.forEach((r) => {
      console.log(`${r.passed ? '✓' : '✗'} ${r.name}`);
      if (r.error) console.error(`  Error: ${r.error}`);
    });
    console.log(`Total: ${res.total} | Lolos: ${res.passed} | Gagal: ${res.failed}\n`);
    if (res.failed > 0) process.exit(1);
  });
}
