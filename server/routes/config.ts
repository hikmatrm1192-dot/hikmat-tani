/**
 * HIKMAT TANI - Public Application Configuration Route (Langkah 15)
 * 
 * Endpoints:
 * - GET /api/v1/config/public -> Membaca konfigurasi resmi publik HIKMAT TANI
 *   (Dapat diakses oleh semua pengguna/petani, aman tanpa kredensial admin).
 */

import { Router, Request, Response } from 'express';
import { adminService } from '../services/adminService.ts';

const router = Router();

router.get('/public', (_req: Request, res: Response) => {
  try {
    const publicConfig = adminService.getPublicConfig();
    return res.status(200).json({
      success: true,
      data: publicConfig,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: {
        code: 'CONFIG_FETCH_ERROR',
        message: error?.message || 'Gagal memuat konfigurasi publik.',
      },
    });
  }
});

export const configRoutes = router;
