/**
 * HIKMAT TANI - Farmer Service (Isolated Profile Management)
 */

import { authService, SanitizedFarmerProfile } from './authService.ts';

export class FarmerService {
  private static instance: FarmerService;

  private constructor() {}

  public static getInstance(): FarmerService {
    if (!FarmerService.instance) {
      FarmerService.instance = new FarmerService();
    }
    return FarmerService.instance;
  }

  /**
   * Mengambil profil petani berdasarkan auth user id atau farmer id
   */
  public async getProfileByUserId(userId: string, farmerId?: string): Promise<SanitizedFarmerProfile> {
    if (farmerId) {
      const profile = authService.getFarmerProfile(farmerId);
      if (profile) return profile;
    }

    const byUser = authService.getFarmerProfileByUserId(userId);
    if (byUser) return byUser;

    const now = new Date().toISOString();
    return {
      id: farmerId || `farmer_${userId}`,
      name: 'Petani Padi Indonesia',
      nikMasked: '3210********0001',
      phoneNumber: '081234567890',
      village: 'Sukamaju',
      district: 'Kasokandel',
      regency: 'Majalengka',
      province: 'Jawa Barat',
      farmerGroupName: 'Kelompok Tani Sri Rejeki',
      role: 'farmer',
      createdAt: now,
      updatedAt: now,
    };
  }
}

export const farmerService = FarmerService.getInstance();
