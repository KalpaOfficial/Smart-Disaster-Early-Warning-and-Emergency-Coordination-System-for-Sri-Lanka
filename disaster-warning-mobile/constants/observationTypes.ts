/**
 * Observation Type constants and metadata for UC02: Submit and Verify Ground Report.
 * Defined in Case Study 02 & SE3070 UC02 Main Flow Step 3:
 * Observation types include: rising water, blocked road, landslide crack, or other.
 */
import { Ionicons } from '@expo/vector-icons';
import { Colors } from './colors';
import type { ObservationType, ReportStatus } from '@/types/groundReport';

export interface ObservationTypeDefinition {
  value: ObservationType;
  label: string;
  shortLabel: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bgColor: string;
}

export const OBSERVATION_TYPES: readonly ObservationTypeDefinition[] = [
  {
    value: 'rising_water',
    label: 'Rising Water Level',
    shortLabel: 'Rising Water',
    description:
      'Rapidly rising water levels, overflowing riverbanks, breached canals, or submerged access routes.',
    icon: 'water-outline',
    color: Colors.observation.risingWater,
    bgColor: 'rgba(56, 189, 248, 0.14)',
  },
  {
    value: 'blocked_road',
    label: 'Blocked Road / Access Cut',
    shortLabel: 'Blocked Road',
    description:
      'Road blocked by debris, fallen trees, collapsed utility poles, or severe mud accumulation.',
    icon: 'car-outline',
    color: Colors.observation.blockedRoad,
    bgColor: 'rgba(245, 158, 11, 0.14)',
  },
  {
    value: 'landslide_crack',
    label: 'Landslide Crack / Slope Failure',
    shortLabel: 'Landslide Crack',
    description:
      'Visible ground cracks on hill slopes, sudden tilting of trees/posts, or active ground subsidence.',
    icon: 'warning-outline',
    color: Colors.observation.landslideCrack,
    bgColor: 'rgba(244, 63, 94, 0.14)',
  },
  {
    value: 'other',
    label: 'Other Hazard Observation',
    shortLabel: 'Other Hazard',
    description:
      'Other severe emergency ground observations such as bridge structural damage, dam leaks, or fire.',
    icon: 'alert-circle-outline',
    color: Colors.observation.other,
    bgColor: 'rgba(167, 139, 250, 0.14)',
  },
] as const;

export interface ReportStatusDefinition {
  value: ReportStatus;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bgColor: string;
}

export const REPORT_STATUSES: readonly ReportStatusDefinition[] = [
  {
    value: 'pending_verification',
    label: 'Pending Verification',
    description: 'Submitted and placed in the DMC duty officer verification queue.',
    icon: 'time-outline',
    color: Colors.report.pending,
    bgColor: 'rgba(245, 158, 11, 0.14)',
  },
  {
    value: 'verified',
    label: 'Verified',
    description: 'Confirmed by DMC duty officer and linked to the active hazard event.',
    icon: 'checkmark-circle-outline',
    color: Colors.report.verified,
    bgColor: 'rgba(16, 185, 129, 0.14)',
  },
  {
    value: 'info_requested',
    label: 'Information Requested',
    description: 'DMC duty officer requested further photographic or situational clarification.',
    icon: 'help-circle-outline',
    color: Colors.report.infoRequested,
    bgColor: 'rgba(56, 189, 248, 0.14)',
  },
  {
    value: 'rejected',
    label: 'Rejected',
    description: 'Declined with logged rationale. Does not influence official warning levels.',
    icon: 'close-circle-outline',
    color: Colors.report.rejected,
    bgColor: 'rgba(239, 68, 68, 0.14)',
  },
] as const;

/**
 * Get definition object for an observation type.
 */
export function getObservationTypeDefinition(
  type: ObservationType,
): ObservationTypeDefinition {
  const found = OBSERVATION_TYPES.find((item) => item.value === type);
  return (
    found || {
      value: 'other',
      label: 'Other Hazard Observation',
      shortLabel: 'Other',
      description: 'Hazard observation',
      icon: 'alert-circle-outline',
      color: Colors.observation.other,
      bgColor: 'rgba(167, 139, 250, 0.14)',
    }
  );
}

/**
 * Get display label for an observation type.
 */
export function getObservationTypeLabel(type: ObservationType): string {
  return getObservationTypeDefinition(type).label;
}

/**
 * Get definition object for a report status.
 */
export function getReportStatusDefinition(
  status: ReportStatus,
): ReportStatusDefinition {
  const found = REPORT_STATUSES.find((item) => item.value === status);
  return (
    found || {
      value: 'pending_verification',
      label: 'Pending Verification',
      description: 'Awaiting verification review',
      icon: 'time-outline',
      color: Colors.report.pending,
      bgColor: 'rgba(245, 158, 11, 0.14)',
    }
  );
}

/**
 * Get display label for a report status.
 */
export function getReportStatusLabel(status: ReportStatus): string {
  return getReportStatusDefinition(status).label;
}
