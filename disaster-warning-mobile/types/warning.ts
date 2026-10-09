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

export type ChannelDeliveryStatus = 'Success' | 'Partial' | 'Failed';

export interface ChannelResult {
  channel: DeliveryChannel;
  recipientCount: number;
  deliveredCount: number;
  failedCount: number;
  status: ChannelDeliveryStatus;
  errorMessage?: string;
}

export interface ChannelDeliveryResult {
  channel: DeliveryChannel;
  status: 'success' | 'failed' | 'Success' | 'Partial' | 'Failed';
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
  previousWarningId?: string | null;
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
  previousWarningId?: string | null;
}

export interface DeliveryLog {
  logId: string;
  warningId: string;
  channel: DeliveryChannel;
  recipientCount: number;
  deliveredCount: number;
  failedCount: number;
  status: ChannelDeliveryStatus | 'success' | 'failed' | 'partial';
  errorMessage?: string;
  timestamp: string;
}

export interface VerifiedGroundReportStub {
  id: string;
  referenceNumber?: string;
  hazardEventId: string;
  district: string;
  locationName: string;
  description: string;
  observationType?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  verifiedBy: string;
  reportedAt: string;
}
