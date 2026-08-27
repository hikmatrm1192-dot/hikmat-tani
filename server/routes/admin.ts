/**
 * HIKMAT TANI - Role & Admin Management API Routes (Langkah 15)
 * 
 * Endpoints:
 * - POST   /api/v1/admin/auth/login     -> Login untuk MANAGER & SUPER_ADMIN
 * - GET    /api/v1/admin/me             -> Profil Pengelola Aktif
 * - GET    /api/v1/admin/config         -> Ambil Konfigurasi Resmi Lengkap (MANAGER+)
 * - PUT    /api/v1/admin/config         -> Ubah Konfigurasi Resmi (MANAGER+)
 * - POST   /api/v1/admin/qris           -> Upload/Ubah Gambar QRIS (MANAGER+)
 * - GET    /api/v1/admin/audit-logs     -> Riwayat Audit Log (MANAGER+)
 * - GET    /api/v1/admin/managers       -> Daftar Akun Pengelola (SUPER_ADMIN ONLY)
 * - POST   /api/v1/admin/managers       -> Tambah Akun Pengelola (SUPER_ADMIN ONLY)
 * - PATCH  /api/v1/admin/managers/:id   -> Ubah Akun Pengelola (SUPER_ADMIN ONLY)
 * - DELETE /api/v1/admin/managers/:id   -> Hapus Akun Pengelola (SUPER_ADMIN ONLY)
 */

import { Router, Request, Response, NextFunction } from 'express';
import { adminService } from '../services/adminService.ts';
import { requireManager, requireSuperAdmin, AuthenticatedRequest } from '../middleware/auth.ts';
import { validateBody } from '../middleware/validate.ts';

const router = Router();

// ==========================================
// 1. AUTENTIKASI PENGELOLA
// ==========================================

const validateLoginInput = (body: any) => {
  if (!body.username || typeof body.username !== 'string') {
    return { isValid: false, message: 'Nama pengguna atau email wajib diisi.' };
  }
  if (!body.password || typeof body.password !== 'string') {
    return { isValid: false, message: 'Kata sandi pengelola wajib diisi.' };
  }
  return { isValid: true };
};

router.post(
  '/auth/login',
  validateBody(validateLoginInput),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { username, password } = req.body;
      const ipAddress = req.ip || req.socket.remoteAddress || '127.0.0.1';

      const authResult = adminService.authenticateAdmin(username, password, ipAddress);

      if (!authResult.success) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: authResult.error || 'Autentikasi pengelola gagal.',
          },
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Login pengelola berhasil.',
        data: {
          token: authResult.token,
          admin: authResult.admin,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// Profil Pengelola Aktif
router.get('/me', requireManager, async (req: AuthenticatedRequest, res: Response) => {
  return res.status(200).json({
    success: true,
    data: {
      userId: req.user?.userId,
      role: req.user?.role,
    },
  });
});

// Ganti Kata Sandi Akun Pengelola Aktif
router.post('/auth/change-password', requireManager, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const ipAddress = req.ip || req.socket.remoteAddress || '127.0.0.1';

    if (!currentPassword || typeof currentPassword !== 'string') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Kata sandi saat ini wajib diisi.' },
      });
    }

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Kata sandi baru minimal 6 karakter.' },
      });
    }

    const result = adminService.changePassword(req.user!, currentPassword, newPassword, ipAddress);

    return res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'CHANGE_PASSWORD_ERROR',
        message: err.message || 'Gagal mengubah kata sandi.',
      },
    });
  }
});

// ==========================================
// 2. KONFIGURASI RESMI HIKMAT TANI (MANAGER+)
// ==========================================

router.get('/config', requireManager, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const config = adminService.getAdminConfig(req.user!);
    return res.status(200).json({
      success: true,
      data: config,
    });
  } catch (err: any) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: err.message || 'Gagal memuat konfigurasi pengelola.',
      },
    });
  }
});

router.put('/config', requireManager, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const ipAddress = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const updated = adminService.updateAdminConfig(req.user!, req.body, ipAddress);

    return res.status(200).json({
      success: true,
      message: 'Konfigurasi resmi HIKMAT TANI berhasil diperbarui.',
      data: updated,
    });
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'CONFIG_UPDATE_ERROR',
        message: err.message || 'Gagal memperbarui konfigurasi resmi.',
      },
    });
  }
});

router.post('/qris', requireManager, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { qrisImage } = req.body;
    const ipAddress = req.ip || req.socket.remoteAddress || '127.0.0.1';

    const result = adminService.updateQrisImage(req.user!, qrisImage, ipAddress);

    return res.status(200).json({
      success: true,
      message: 'Gambar QRIS resmi berhasil diperbarui.',
      data: result,
    });
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'QRIS_UPDATE_ERROR',
        message: err.message || 'Gagal memperbarui QRIS.',
      },
    });
  }
});

// ==========================================
// 3. AUDIT LOGS (MANAGER+)
// ==========================================

router.get('/audit-logs', requireManager, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const limit = Number(req.query.limit) || 50;
    const logs = adminService.getAuditLogs(req.user!, limit);

    return res.status(200).json({
      success: true,
      data: logs,
    });
  } catch (err: any) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: err.message || 'Gagal memuat catatan audit.',
      },
    });
  }
});

// ==========================================
// 4. MANAJEMEN PENGELOLA (SUPER_ADMIN ONLY)
// ==========================================

router.get('/managers', requireSuperAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const managers = adminService.listManagers(req.user!);
    return res.status(200).json({
      success: true,
      data: managers,
    });
  } catch (err: any) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: err.message || 'Gagal memuat daftar pengelola.',
      },
    });
  }
});

router.post('/managers', requireSuperAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ipAddress = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const newManager = adminService.createManager(req.user!, req.body, ipAddress);

    return res.status(201).json({
      success: true,
      message: 'Akun pengelola baru berhasil dibuat.',
      data: newManager,
    });
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'CREATE_MANAGER_ERROR',
        message: err.message || 'Gagal membuat akun pengelola.',
      },
    });
  }
});

router.patch('/managers/:id', requireSuperAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const ipAddress = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const updated = adminService.updateManager(req.user!, id, req.body, ipAddress);

    return res.status(200).json({
      success: true,
      message: 'Data pengelola berhasil diperbarui.',
      data: updated,
    });
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'UPDATE_MANAGER_ERROR',
        message: err.message || 'Gagal memperbarui data pengelola.',
      },
    });
  }
});

router.delete('/managers/:id', requireSuperAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const ipAddress = req.ip || req.socket.remoteAddress || '127.0.0.1';
    adminService.deleteManager(req.user!, id, ipAddress);

    return res.status(200).json({
      success: true,
      message: 'Akun pengelola berhasil dihapus.',
    });
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'DELETE_MANAGER_ERROR',
        message: err.message || 'Gagal menghapus pengelola.',
      },
    });
  }
});

export const adminRoutes = router;
