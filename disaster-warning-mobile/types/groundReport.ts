/**
 * TypeScript Type Definitions for UC02: Submit and Verify Ground Report.
 * Strictly aligned with Cloud Firestore schema and SE3070 UC02 specifications.
 */
import type { UserRole } from './auth';

/**
 * Standard observation categories for hazard ground reporting.
 * Case Study 02 / UC02 Main Flow Step 3:
 * 'rising_water' | 'blocked_road' | 'landslide_crack' | 'other'
 */
export type ObservationType =
  | 'rising_water'
  | 'blocked_road'
  | 'landslide_crack'
  | 'other';

/**
 * Lifecycle verification status of a ground report.
 * - 'pending_verification': Initial status upon submission; awaits DMC duty officer review.
 * - 'verified': Officer confirmed validity; linked to active hazard event.
 * - 'rejected': Officer rejected report with recorded rationale; does NOT influence warnings.
 * - 'info_requested': Officer requested further evidence/details from the citizen/volunteer.
 */
export type ReportStatus =
  | 'pending_verification'
  | 'verified'
  | 'rejected'
  | 'info_requested';

/**
 * Geographic GPS coordinates.
 */
export interface GeoLocation {
  latitude: number;
  longitude: number;
  altitude?: number | null;
  accuracy?: number | null;
}

/**
 * Complete Ground Report data entity matching Cloud Firestore.
 */
export interface GroundReport {
  id: string;
  referenceNumber: string;
  observationType: ObservationType;
  description: string;
  photoUrl: string;
  photoPath?: string | null;
  location: GeoLocation;
  locationName: string;
  district: string;
  isManualLocation: boolean;
  captureTime: string; // ISO string representing photo/incident observation time
  submitterId: string;
  submitterName: string;
  submitterRole: UserRole;
  status: ReportStatus;
  hazardEventId: string | null;
  hazardEventTitle: string | null;
  verifiedBy: string | null;
  verifiedByName: string | null;
  verificationDecision: string | null;
  verificationTimestamp: string | null;
  infoRequestedMessage: string | null;
  additionalInfo: string | null;
  createdAt: string; // ISO string
  updatedAt?: string; // ISO string
}

/**
 * Payload provided by Citizen or Volunteer when submitting a report.
 */
export interface CreateGroundReportData {
  observationType: ObservationType;
  description: string;
  photoUri: string; // Local device URI (file://...) before upload
  location: GeoLocation;
  locationName: string;
  district: string;
  isManualLocation: boolean;
  captureTime: string;
}

/**
 * Payload submitted by DMC Duty Officer during verification review.
 */
export interface VerifyReportPayload {
  status: 'verified' | 'rejected' | 'info_requested';
  hazardEventId?: string;
  hazardEventTitle?: string;
  verificationDecision?: string;
  infoRequestedMessage?: string;
}

/**
 * Offline Queued Report saved in local device storage.
 * Handled when device has no network connectivity during submission.
 */
export interface OfflineReportQueueItem {
  queueId: string;
  reportData: Omit<CreateGroundReportData, 'photoUri'>;
  localPhotoUri: string;
  submitterId: string;
  submitterName: string;
  submitterRole: UserRole;
  queuedAt: string;
  syncAttempts: number;
  lastSyncError?: string | null;
}

/**
 * Filter options for listing and queueing ground reports.
 */
export interface GroundReportFilter {
  status?: ReportStatus | 'all';
  observationType?: ObservationType | 'all';
  district?: string | 'all';
  hazardEventId?: string;
}

/**
 * Summary telemetry counts for Ground Reports.
 */
export interface GroundReportStats {
  total: number;
  pending: number;
  verified: number;
  rejected: number;
  infoRequested: number;
  offlineQueued: number;
}

/**
 * In-App Notification emitted when officer verifies, rejects, or requests info on a report.
 * (UC02 Phase 6 Submitter Feedback)
 */
export interface ReportNotification {
  id: string;
  reportId: string;
  referenceNumber: string;
  status: ReportStatus;
  title: string;
  message: string;
  timestamp: string;
  officerName?: string | null;
  hazardEventTitle?: string | null;
}
