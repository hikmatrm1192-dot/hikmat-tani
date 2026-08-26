/**
 * HIKMAT TANI - Common Domain Types & Primitives
 */

export type EntityId = string;
export type ISODateString = string;
export type AreaHa = number;
export type WeightKg = number;
export type Percentage = number;
export type Latitude = number;
export type Longitude = number;
export type VersionNumber = number;

export interface AuditMetadata {
  createdAt: ISODateString;
  updatedAt?: ISODateString;
  version?: VersionNumber;
}
