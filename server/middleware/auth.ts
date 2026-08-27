import { Request, Response, NextFunction } from 'express';
import { authService, AuthSessionPayload } from '../services/authService.ts';

export interface AuthenticatedRequest extends Request {
  user?: AuthSessionPayload;
}

export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Akses ditolak: Token otentikasi (Bearer token) diperlukan',
      },
    });
    return;
  }

  const token = authHeader.split(' ')[1];
  const session = authService.verifyToken(token);

  if (!session) {
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Token otentikasi tidak valid atau telah kedaluwarsa',
      },
    });
    return;
  }

  req.user = session;
  next();
}

/**
 * Middleware untuk memverifikasi role pengguna (Role-Based Access Control)
 * Memastikan role pengguna cocok dengan daftar role yang diizinkan (misal: MANAGER, SUPER_ADMIN).
 * FARMER / pengguna tanpa role yang sesuai akan ditolak dengan status HTTP 403 Forbidden.
 */
export function requireRole(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    // Jalankan requireAuth terlebih dahulu jika belum diautentikasi
    if (!req.user) {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Akses ditolak: Token otentikasi (Bearer token) diperlukan.',
          },
        });
        return;
      }

      const token = authHeader.split(' ')[1];
      const session = authService.verifyToken(token);

      if (!session) {
        res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Token otentikasi tidak valid atau telah kedaluwarsa.',
          },
        });
        return;
      }

      req.user = session;
    }

    const userRole = (req.user.role || 'farmer').toUpperCase();
    const normalizedAllowedRoles = allowedRoles.map((r) => r.toUpperCase());

    if (!normalizedAllowedRoles.includes(userRole)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN_ROLE',
          message: `Akses ditolak: Anda tidak memiliki wewenang untuk tindakan ini. (Dibutuhkan peran: ${allowedRoles.join(' atau ')})`,
        },
      });
      return;
    }

    next();
  };
}

/**
 * Middleware khusus untuk Pengelola / Manager dan Super Admin
 */
export const requireManager = requireRole(['MANAGER', 'SUPER_ADMIN']);

/**
 * Middleware khusus untuk Super Admin (Hak Tertinggi)
 */
export const requireSuperAdmin = requireRole(['SUPER_ADMIN']);

/**
 * Middleware opsional auth (jika ada token diproses, jika tidak tetap lanjut)
 */
export function optionalAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const session = authService.verifyToken(token);
    if (session) {
      req.user = session;
    }
  }
  next();
}
