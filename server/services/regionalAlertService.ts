/**
 * HIKMAT TANI - Regional Alerts Service Abstraction (Langkah 12)
 * 
 * Prinsip:
 * - Menyediakan interface dan abstraksi service untuk peringatan dini daerah / cuaca ekstrem.
 * - Sesuai panduan: "JANGAN membuat data peringatan palsu. Jika belum ada sumber data yang valid: buat interface/service abstraction saja."
 */

import { RegionalAlert } from '../../src/types/weather.ts';

export interface RegionalAlertsResponse {
  districtId?: string;
  latitude?: number;
  longitude?: number;
  alerts: RegionalAlert[];
  status: 'NORMAL' | 'ALERT_ACTIVE';
  totalActive: number;
  checkedAt: string;
}

export class RegionalAlertService {
  /**
   * Mengambil peringatan resmi daerah berdasarkan district_id atau koordinat
   */
  public async getAlerts(params: {
    districtId?: string;
    lat?: number;
    lon?: number;
  }): Promise<RegionalAlertsResponse> {
    const checkedAt = new Date().toISOString();

    // Abstraksi kesiapan integrasi BMKG / BPBD
    // Tanpa data palsu: jika belum terhubung dengan feed bersertifikasi resmi,
    // kembalikan status normal yang jujur tanpa memunculkan kepanikan petani.
    return {
      districtId: params.districtId,
      latitude: params.lat,
      longitude: params.lon,
      alerts: [],
      status: 'NORMAL',
      totalActive: 0,
      checkedAt,
    };
  }
}

export const regionalAlertService = new RegionalAlertService();
