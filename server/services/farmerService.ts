export interface FarmerProfile {
  id: string;
  name: string;
  phoneNumber?: string;
  village?: string;
  district?: string;
  regency?: string;
  province?: string;
  farmerGroupName?: string;
  authUserId?: string;
  createdAt: string;
  updatedAt: string;
}

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
  public async getProfileByUserId(userId: string, farmerId?: string): Promise<FarmerProfile> {
    const now = new Date().toISOString();
    return {
      id: farmerId || `farmer_${userId}`,
      name: 'Pak Sutrisno',
      phoneNumber: '081234567890',
      village: 'Sukamaju',
      district: 'Kasokandel',
      regency: 'Majalengka',
      province: 'Jawa Barat',
      farmerGroupName: 'Kelompok Tani Sri Rejeki',
      authUserId: userId,
      createdAt: now,
      updatedAt: now,
    };
  }
}

export const farmerService = FarmerService.getInstance();
