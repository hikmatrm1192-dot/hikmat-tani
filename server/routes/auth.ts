import { Router, Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService.ts';
import { validateBody } from '../middleware/validate.ts';

const router = Router();

// Validator untuk anonymous-or-register
const validateAuthInput = (body: any) => {
  if (body.phoneNumber && typeof body.phoneNumber !== 'string') {
    return { isValid: false, message: 'Nomor telepon harus berupa string' };
  }
  if (body.farmerName && typeof body.farmerName !== 'string') {
    return { isValid: false, message: 'Nama petani harus berupa string' };
  }
  return { isValid: true };
};

router.post(
  '/anonymous-or-register',
  validateBody(validateAuthInput),
  async (req: Request, res: Response, next: NextFunction) => {
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
        message: farmerName ? 'Registrasi profil petani berhasil' : 'Sesi anonim berhasil dibuat',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
);

export const authRoutes = router;
