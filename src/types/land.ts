/**
 * HIKMAT TANI - Land Domain Model
 */

import { AreaHa, EntityId, ISODateString, Latitude, Longitude } from './common.ts';

export type WaterSource =
  | 'IRRIGATION_TECHNICAL'
  | 'IRRIGATION_SEMI_TECHNICAL'
  | 'RAIN_FED'
  | 'GROUNDWATER'
  | 'OTHER'
  | string;

export type LandType =
  | 'LOWLAND_PADDY'
  | 'RAINFED_PADDY'
  | 'TIDAL_SWAMP'
  | 'UPLAND'
  | 'OTHER'
  | string;

export type LandStatus = 'ACTIVE' | 'ARCHIVED';

export interface Land {
  id: EntityId;
  farmerId: EntityId;
  name: string;
  areaHa: AreaHa;
  location?: string;
  waterSource?: WaterSource;
  landType?: LandType;
  status?: LandStatus; // 'ACTIVE' (default) | 'ARCHIVED'
  latitude?: Latitude;
  longitude?: Longitude;
  notes?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
