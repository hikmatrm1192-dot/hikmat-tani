/**
 * HIKMAT TANI - Knowledge & Information API Routes (Langkah 9 & 11)
 * 
 * Endpoints:
 * - GET /api/v1/knowledge/version           (Cek versi cepat hemat bandwidth)
 * - GET /api/v1/knowledge/bundle            (Unduh full bundle untuk instalasi awal / recovery)
 * - GET /api/v1/knowledge/updates           (Unduh pembaruan inkremental sejak versi/timestamp tertentu)
 * - GET /api/v1/knowledge/field-aggregates  (Agregasi pengetahuan lapangan teranonimkan & k-anonymity)
 * - GET /api/v1/knowledge/field-insights    (Peta peringatan dini & tren agronomi per wilayah)
 */

import { Router, Request, Response } from 'express';
import { knowledgeService } from '../services/knowledgeService.ts';
import { fieldKnowledgeService } from '../services/fieldKnowledgeService.ts';

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

/**
 * GET /api/v1/knowledge/field-aggregates
 * Mengambil data agregasi statistik & pola lapangan multi-petani (Anonymized & K-Anonymity Guarded)
 */
router.get('/field-aggregates', (req: Request, res: Response) => {
  try {
    const { regency, optId, includeSuppressed } = req.query;
    const result = fieldKnowledgeService.getPublishedKnowledge({
      regency: typeof regency === 'string' ? regency : undefined,
      optId: typeof optId === 'string' ? optId : undefined,
      includeSuppressed: includeSuppressed === 'true',
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'FIELD_AGGREGATES_ERROR',
        message: error?.message || 'Gagal mengambil agregasi pengetahuan lapangan',
      },
    });
  }
});

/**
 * GET /api/v1/knowledge/field-insights
 * Ringkasan peringatan dini penyebaran OPT dan tren lapangan per wilayah
 */
router.get('/field-insights', (_req: Request, res: Response) => {
  try {
    const insights = fieldKnowledgeService.getRegionalFieldInsights();
    res.json({
      success: true,
      data: insights,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'FIELD_INSIGHTS_ERROR',
        message: error?.message || 'Gagal mengambil ringkasan wawasan lapangan',
      },
    });
  }
});

export { router as knowledgeRoutes };
