import { Router, Response, NextFunction } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.ts';
import { farmerService } from '../services/farmerService.ts';

const router = Router();

/**
 * GET /api/v1/farmers/me
 * Mengambil profil petani terautentikasi (Strictly Isolated)
 */
router.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const profile = await farmerService.getProfileByUserId(user.userId, user.farmerId);

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.userId,
          role: user.role,
          isAnonymous: user.isAnonymous,
        },
        farmer: profile,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/farmers/:id
 * Mengambil profil petani berdasarkan ID dengan pemeriksaan kepemilikan mutlak (Anti-IDOR)
 */
router.get('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const requestedFarmerId = req.params.id;

    // Hanya pemilik akun atau role Admin/Manager yang diizinkan
    const isOwner = user.farmerId === requestedFarmerId;
    const isManagerOrAdmin = ['MANAGER', 'SUPER_ADMIN', 'ADMIN'].includes((user.role || '').toUpperCase());

    if (!isOwner && !isManagerOrAdmin) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN_FARMER_ACCESS',
          message: 'Akses ditolak: Anda tidak memiliki wewenang untuk melihat data petani lain.',
        },
      });
    }

    const profile = await farmerService.getProfileByUserId(user.userId, requestedFarmerId);

    res.status(200).json({
      success: true,
      data: {
        farmer: profile,
      },
    });
  } catch (err) {
    next(err);
  }
});

export const farmerRoutes = router;
