/**
 * HIKMAT TANI - Local Backup & Restore Foundation
 */

import { ISODateString } from './common.ts';
import { Farmer } from './farmer.ts';
import { Land } from './land.ts';
import { CropSeason } from './cropSeason.ts';
import { Activity } from './activity.ts';
import { Fertilizer, FertilizerApplication } from './fertilizer.ts';
import { Opt, OptObservation } from './opt.ts';
import { NaturalEnemy } from './naturalEnemy.ts';
import { RiceVariety } from './variety.ts';
import { Recommendation, FarmerDecision, ActualAction, DecisionRecord } from './recommendation.ts';
import { Reference } from './reference.ts';
import { KnowledgeArticle } from './knowledge.ts';

export interface BackupMetadata {
  backupVersion: string; // e.g. "1.0.0"
  appVersion: string;    // e.g. "1.0.0"
  createdAt: ISODateString;
  deviceId?: string;
  recordCounts: Record<string, number>;
}

export interface HikmatBackupData {
  farmers: Farmer[];
  lands: Land[];
  cropSeasons: CropSeason[];
  activities: Activity[];
  fertilizerApplications: FertilizerApplication[];
  optObservations: OptObservation[];
  farmerDecisions: FarmerDecision[];
  actualActions: ActualAction[];
  decisionRecords: DecisionRecord[];
  recommendations: Recommendation[];
  customFertilizers: Fertilizer[];
  customOpts: Opt[];
  customNaturalEnemies: NaturalEnemy[];
  customVarieties: RiceVariety[];
  references: Reference[];
  knowledgeArticles: KnowledgeArticle[];
}

export interface HikmatBackup {
  format: 'hikmat-tani-backup';
  version: number;
  createdAt: ISODateString;
  metadata?: BackupMetadata;
  data: Partial<HikmatBackupData>;
}
