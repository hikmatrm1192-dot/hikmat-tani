/**
 * HIKMAT TANI - Knowledge & Information API Routes (Langkah 11C)
 * 
 * Endpoints:
 * - GET /api/v1/knowledge/version   (Cek versi cepat hemat bandwidth)
 * - GET /api/v1/knowledge/bundle    (Unduh full bundle untuk instalasi awal / recovery)
 * - GET /api/v1/knowledge/updates   (Unduh pembaruan inkremental sejak versi/timestamp tertentu)
 */

import { Router, Request, Response } from 'express';
import { knowledgeService } from '../services/knowledgeService.ts';

const router = Router();

/**
 * GET /api/v1/knowledge/version
 * Mengembalikan informasi versi dan ringkasan entitas knowledge tanpa mengirim data besar.
 */
router.get('/version', (req: Request, res: Response) => {
  try {
    const versionInfo = knowledgeService.getVersionInfo();
    res.json({
      success: true,
      data: versionInfo,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'KNOWLEDGE_VERSION_ERROR',
        message: error?.message || 'Gagal mengambil informasi versi knowledge',
      },
    });
  }
});

/**
 * GET /api/v1/knowledge/bundle
 * Mengembalikan paket lengkap master data agronomi untuk seeding lokal atau recovery.
 */
router.get('/bundle', (req: Request, res: Response) => {
  try {
    const bundle = knowledgeService.getKnowledgeBundle();
    res.json({
      success: true,
      data: bundle,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'KNOWLEDGE_BUNDLE_ERROR',
        message: error?.message || 'Gagal mengunduh bundle knowledge',
      },
    });
  }
});

/**
 * GET /api/v1/knowledge/updates?since={version/timestamp}
 * Mengembalikan data yang mengalami perubahan sejak versi atau timestamp yang diminta.
 */
router.get('/updates', (req: Request, res: Response) => {
  try {
    const since = req.query.since as string | undefined;
    const updates = knowledgeService.getKnowledgeUpdates(since);
    res.json({
      success: true,
      data: updates,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'KNOWLEDGE_UPDATES_ERROR',
        message: error?.message || 'Gagal mengambil pembaruan knowledge',
      },
    });
  }
});

export { router as knowledgeRoutes };
