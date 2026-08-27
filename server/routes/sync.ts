import { Router, Response, NextFunction } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.ts';
import { syncService } from '../services/syncService.ts';

const router = Router();

/**
 * POST /api/v1/sync/push
 * Menerima batch operasi mutasi dari outbox client
 */
router.post('/push', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { items } = req.body;

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Permintaan push harus menyertakan array "items"',
        },
      });
    }

    const result = await syncService.processPush(user, items);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        error: {
          code: err.code || 'SYNC_ERROR',
          message: err.message || 'Gagal memproses sinkronisasi push',
        },
      });
    }
    next(err);
  }
});

/**
 * GET /api/v1/sync/pull?since={timestamp}
 * Mengambil perubahan data terbaru (incremental) milik farmer terkait
 */
router.get('/pull', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const since = req.query.since as string | undefined;

    const result = await syncService.processPull(user, since);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        error: {
          code: err.code || 'SYNC_ERROR',
          message: err.message || 'Gagal memproses sinkronisasi pull',
        },
      });
    }
    next(err);
  }
});

export const syncRoutes = router;
