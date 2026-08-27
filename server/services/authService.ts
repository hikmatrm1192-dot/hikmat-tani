import jwt from 'jsonwebtoken';
import { config } from '../config.ts';

export interface AuthSessionPayload {
  userId: string;
  role: string;
  isAnonymous: boolean;
  farmerId?: string;
  issuedAt: number;
}

export class AuthService {
  private static instance: AuthService;

  private constructor() {}

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * Menghasilkan token sesi aman untuk identitas anonim atau terdaftar
   */
  public generateSessionToken(payload: {
    userId: string;
    role?: string;
    isAnonymous?: boolean;
    farmerId?: string;
  }): { token: string; expiresIn: string; session: AuthSessionPayload } {
    const session: AuthSessionPayload = {
      userId: payload.userId,
      role: payload.role || 'farmer',
      isAnonymous: payload.isAnonymous ?? true,
      farmerId: payload.farmerId,
      issuedAt: Date.now(),
    };

    const token = jwt.sign(session, config.jwtSecret, {
      expiresIn: '30d',
      algorithm: 'HS256',
    });

    return {
      token,
      expiresIn: '30d',
      session,
    };
  }

  /**
   * Memverifikasi token JWT dan mengekstrak payload sesi
   */
  public verifyToken(token: string): AuthSessionPayload | null {
    try {
      const decoded = jwt.verify(token, config.jwtSecret, {
        algorithms: ['HS256'],
      }) as AuthSessionPayload;
      return decoded;
    } catch {
      return null;
    }
  }

  /**
   * Inisialisasi atau hubungkan akun lokal (anonymous or register)
   */
  public processAnonymousOrRegister(params: {
    anonymousId?: string;
    farmerName?: string;
    phoneNumber?: string;
    village?: string;
  }): {
    success: boolean;
    token: string;
    user: { id: string; role: string; isAnonymous: boolean };
    farmer: { id: string; name: string; village?: string };
  } {
    const userId = params.anonymousId || `usr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const farmerId = `farmer_${userId}`;
    const isAnonymous = !params.farmerName;

    const sessionRes = this.generateSessionToken({
      userId,
      role: 'farmer',
      isAnonymous,
      farmerId,
    });

    return {
      success: true,
      token: sessionRes.token,
      user: {
        id: userId,
        role: 'farmer',
        isAnonymous,
      },
      farmer: {
        id: farmerId,
        name: params.farmerName || 'Petani Mandiri (Lokal)',
        village: params.village || 'Sukamaju',
      },
    };
  }
}

export const authService = AuthService.getInstance();
