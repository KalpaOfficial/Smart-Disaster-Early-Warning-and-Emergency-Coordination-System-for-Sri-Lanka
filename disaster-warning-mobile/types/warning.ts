/**
 * Hazard Warning types for UC01: Issue Hazard Warning.
 * Strictly aligned with approved Cloud Firestore schema specifications.
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
  warningId: string;
  eventId: string;
  hazardEventId?: string;
  hazardEventTitle?: string;
  hazardType: HazardType;
  severity: WarningSeverity;
  targetMode: TargetMode;
  targetAreas: string[];
  resolvedDistricts: string[];
  recipientCount: number;
  headline: string;
  instructions: string;
  channels: DeliveryChannel[];
  deliveryChannels?: DeliveryChannel[];
  channelResults?: ChannelDeliveryResult[];
  status: WarningStatus;
  issuedBy: string;
  issuedByUid?: string;
  issuedByName?: string;
  createdAt: string;
  dispatchedAt?: string;
  updatedAt?: string;
}

export interface CreateWarningPayload {
  eventId: string;
  hazardEventId?: string;
  hazardEventTitle: string;
  hazardType: HazardType;
  severity: WarningSeverity;
  targetMode: TargetMode;
  targetAreas: string[];
  resolvedDistricts: string[];
  recipientCount: number;
  headline: string;
  instructions: string;
  channels: DeliveryChannel[];
  deliveryChannels?: DeliveryChannel[];
}

export interface DeliveryLog {
  logId: string;
  warningId: string;
  channel: DeliveryChannel;
  recipientCount: number;
  deliveredCount: number;
  failedCount: number;
  status: 'success' | 'failed' | 'partial';
  errorMessage?: string;
  timestamp: string;
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
