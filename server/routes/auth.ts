import { Router, Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService.ts';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.ts';

const router = Router();

/**
 * POST /api/v1/auth/register
 * Pendaftaran Identitas Petani Baru
 */
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      name,
      nik,
      phoneNumber,
      pin,
      village,
      district,
      regency,
      province,
      farmerGroupName,
    } = req.body;

    const result = await authService.registerFarmerAsync({
      name,
      nik,
      phoneNumber,
      pin,
      village,
      district,
      regency,
      province,
      farmerGroupName,
    });

    res.status(201).json({
      success: true,
      message: 'Pendaftaran identitas petani berhasil',
      data: result,
    });
  } catch (err: any) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        error: {
          code: err.code || 'REGISTRATION_ERROR',
          message: err.message,
        },
      });
    }
    next(err);
  }
});

/**
 * POST /api/v1/auth/login
 * Masuk Petani menggunakan NIK atau Nomor HP + PIN
 */
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { identifier, nik, phoneNumber, pin } = req.body;
    const cleanIdentifier = identifier || nik || phoneNumber;

    const result = await authService.loginFarmerAsync({
      identifier: cleanIdentifier,
      pin,
    });

    res.status(200).json({
      success: true,
      message: 'Login berhasil',
      data: result,
    });
  } catch (err: any) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        error: {
          code: err.code || 'AUTH_ERROR',
          message: err.message,
        },
      });
    }
    next(err);
  }
});

/**
 * GET /api/v1/auth/me
 * Mengambil profil & sesi petani yang sedang terautentikasi
 */
router.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const profile = authService.getFarmerProfile(user.farmerId) || {
      id: user.farmerId,
      name: user.name || 'Petani Padi Indonesia',
      nikMasked: '3210********0001',
      phoneNumber: user.phoneNumber || '081234567890',
      role: user.role,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

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
 * POST /api/v1/auth/logout
 * Keluar dari sesi
 */
router.post('/logout', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Sesi berhasil diakhiri',
  });
});

/**
 * POST /api/v1/auth/anonymous-or-register
 * Kompatibilitas mundur
 */
router.post('/anonymous-or-register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { anonymousId, farmerName, phoneNumber, village } = req.body;

    const result = authService.processAnonymousOrRegister({
      anonymousId,
      farmerName,
      phoneNumber,
      village,
    });

    res.status(200).json({
      success: true,
      message: farmerName ? 'Registrasi profil petani berhasil' : 'Sesi berhasil dibuat',
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

export const authRoutes = router;
