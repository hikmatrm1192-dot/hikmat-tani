import { Router, Response, NextFunction } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.ts';
import { farmerService } from '../services/farmerService.ts';

const router = Router();

router.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const profile = await farmerService.getProfileByUserId(user.userId, user.farmerId);

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

export const farmerRoutes = router;
