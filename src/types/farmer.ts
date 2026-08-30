/**
 * HIKMAT TANI - Farmer Domain Model
 * 
 * Prinsip: Data pribadi minimalis, tidak menyimpan NIK/KTP atau password.
 */

import { EntityId, ISODateString } from './common.ts';

export interface Farmer {
  id: EntityId;
  name: string;
  avatarUrl?: string;
  phoneNumber?: string;
  village?: string;
  district?: string;
  regency?: string;
  province?: string;
  farmerGroupName?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
