/**
 * HIKMAT TANI - External Info & Weather API Routes (Langkah 12)
 * 
 * Endpoints:
 * - GET /api/v1/info/weather?lat={lat}&lon={lon}
 * - GET /api/v1/info/regional-alerts?district_id={id}&lat={lat}&lon={lon}
 * 
 * Prinsip:
 * - Backend bertindak sebagai proxy aman dan isolator provider eksternal.
 * - Format data disederhanakan dan dibersihkan dari kerumitan teknis.
 */

import { Router, Request, Response } from 'express';
import { weatherService } from '../services/weatherService.ts';
import { regionalAlertService } from '../services/regionalAlertService.ts';

const router = Router();

/**
 * GET /api/v1/info/weather
 * Parameter query:
 * - lat: latitude (misal: -6.55)
 * - lon: longitude (misal: 107.75)
 */
router.get('/weather', async (req: Request, res: Response) => {
  try {
    const latStr = req.query.lat as string | undefined;
    const lonStr = req.query.lon as string | undefined;

    if (!latStr || !lonStr) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_COORDINATES',
          message: 'Parameter lat (latitude) dan lon (longitude) diperlukan.',
        },
      });
    }

    const lat = parseFloat(latStr);
    const lon = parseFloat(lonStr);

    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_COORDINATES',
          message: 'Koordinat lat dan lon harus berupa angka yang valid.',
        },
      });
    }

    const weatherData = await weatherService.getWeather(lat, lon);

    return res.json({
      success: true,
      data: weatherData,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: {
        code: 'WEATHER_SERVICE_ERROR',
        message: error?.message || 'Gagal memuat perkiraan cuaca.',
      },
    });
  }
});

/**
 * GET /api/v1/info/regional-alerts
 * Parameter query opsional:
 * - district_id: ID kecamatan/kabupaten
 * - lat: latitude
 * - lon: longitude
 */
router.get('/regional-alerts', async (req: Request, res: Response) => {
  try {
    const districtId = req.query.district_id as string | undefined;
    const lat = req.query.lat ? parseFloat(req.query.lat as string) : undefined;
    const lon = req.query.lon ? parseFloat(req.query.lon as string) : undefined;

    const alertsData = await regionalAlertService.getAlerts({
      districtId,
      lat,
      lon,
    });

    return res.json({
      success: true,
      data: alertsData,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: {
        code: 'REGIONAL_ALERTS_ERROR',
        message: error?.message || 'Gagal memeriksa peringatan regional.',
      },
    });
  }
});

export { router as infoRoutes };
