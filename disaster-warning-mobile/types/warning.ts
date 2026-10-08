/**
 * Hazard Warning types for UC01: Issue Hazard Warning.
 * Used by DMC Duty Officers to issue, broadcast, and manage disaster warnings.
 */
import type { HazardType } from './resources';

export type WarningSeverity = 'advisory' | 'warning' | 'evacuation';
export type WarningStatus = 'active' | 'cancelled' | 'expired';

export interface HazardWarning {
  id: string;
  title: string;
  hazardType: HazardType;
  severity: WarningSeverity;
  status: WarningStatus;
  targetDistricts: string[];
  instructions: string;
  hazardEventId?: string;
  hazardEventTitle?: string;
  issuedByUid: string;
  issuedByName: string;
  issuedAt: string;
  updatedAt?: string;
}

export interface CreateWarningData {
  title: string;
  hazardType: HazardType;
  severity: WarningSeverity;
  targetDistricts: string[];
  instructions: string;
  hazardEventId?: string;
  hazardEventTitle?: string;
}
