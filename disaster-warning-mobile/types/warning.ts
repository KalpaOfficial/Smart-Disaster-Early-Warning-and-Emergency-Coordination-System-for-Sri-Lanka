/**
 * Hazard Warning types for UC01: Issue Hazard Warning.
 * Follows the 20-step business workflow, channel delivery simulation,
 * recipient deduplication, and river basin target resolution.
 */
import type { HazardType } from './resources';

export type WarningSeverity = 'advisory' | 'warning' | 'evacuation';
export type TargetMode = 'district' | 'river_basin';
export type DeliveryChannel = 'push' | 'sms' | 'audible';
export type WarningStatus =
  | 'active'
  | 'dispatching'
  | 'delivered'
  | 'partially_failed'
  | 'failed'
  | 'cancelled';

export interface ChannelDeliveryResult {
  channel: DeliveryChannel;
  status: 'success' | 'failed';
  recipientCount: number;
  errorMessage?: string;
}

export interface HazardWarning {
  id: string;
  hazardEventId: string;
  hazardEventTitle: string;
  hazardType: HazardType;
  severity: WarningSeverity;
  targetMode: TargetMode;
  targetAreas: string[];
  resolvedDistricts: string[];
  recipientCount: number;
  headline: string;
  instructions: string;
  deliveryChannels: DeliveryChannel[];
  channelResults?: ChannelDeliveryResult[];
  status: WarningStatus;
  issuedByUid: string;
  issuedByName: string;
  issuedAt: string;
  updatedAt?: string;
}

export interface CreateWarningPayload {
  hazardEventId: string;
  hazardEventTitle: string;
  hazardType: HazardType;
  severity: WarningSeverity;
  targetMode: TargetMode;
  targetAreas: string[];
  resolvedDistricts: string[];
  recipientCount: number;
  headline: string;
  instructions: string;
  deliveryChannels: DeliveryChannel[];
}

export interface VerifiedGroundReportStub {
  id: string;
  hazardEventId: string;
  district: string;
  locationName: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  verifiedBy: string;
  reportedAt: string;
}
