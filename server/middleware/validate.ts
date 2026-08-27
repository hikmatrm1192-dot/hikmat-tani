import { Request, Response, NextFunction } from 'express';

export type ValidatorFn = (body: any) => { isValid: boolean; message?: string };

export function validateBody(validator: ValidatorFn) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.body || typeof req.body !== 'object') {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST_BODY',
          message: 'Format request body harus berupa JSON object yang valid',
        },
      });
      return;
    }

    const validation = validator(req.body);
    if (!validation.isValid) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: validation.message || 'Validasi data input gagal',
        },
      });
      return;
    }

    next();
  };
}
