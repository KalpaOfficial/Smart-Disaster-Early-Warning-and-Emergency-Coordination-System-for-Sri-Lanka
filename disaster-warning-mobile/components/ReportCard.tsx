/**
 * Report Card Component for UC02: Submit and Verify Ground Report.
 * Glassmorphic list item representing a ground report in queue and user history screens.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './Card';
import { ReportStatusBadge } from './ReportStatusBadge';
import { ObservationTypeBadge } from './ObservationTypeBadge';
import { Colors, BorderRadius, Spacing, FontSize } from '@/constants/colors';
import type { GroundReport } from '@/types/groundReport';

interface ReportCardProps {
  report: GroundReport;
  onPress: () => void;
  showSubmitter?: boolean;
  isNew?: boolean;
}

export function ReportCard({
  report,
  onPress,
  showSubmitter = true,
  isNew = false,
}: ReportCardProps) {
  // Format readable time string
  const formattedTime = new Date(report.captureTime).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  const cardGlow = isNew
    ? report.status === 'verified'
      ? Colors.report.verified
      : report.status === 'rejected'
      ? Colors.report.rejected
      : Colors.accent.primary
    : report.status === 'info_requested'
    ? Colors.info
    : report.status === 'pending_verification'
    ? Colors.warning
    : undefined;

  return (
    <Card
      onPress={onPress}
      style={isNew ? [styles.card, styles.cardHighlight] : styles.card}
      glowColor={cardGlow}
    >
      {/* Header Row: Reference Number + NEW Badge + Status Badge */}
      <View style={styles.headerRow}>
        <View style={styles.refContainer}>
          <Ionicons name="document-text-outline" size={14} color={Colors.accent.primary} />
          <Text style={styles.refNumber}>{report.referenceNumber}</Text>
          {isNew && (
            <View style={styles.newBadge}>
              <View style={styles.newBadgeDot} />
              <Text style={styles.newBadgeText}>NEW</Text>
            </View>
          )}
        </View>
        <ReportStatusBadge status={report.status} size="sm" />
      </View>

      {/* Observation Badge + Submitter Row */}
      <View style={styles.badgeRow}>
        <ObservationTypeBadge type={report.observationType} size="sm" />
        {report.isManualLocation && (
          <View style={styles.manualPinPill}>
            <Ionicons name="pin" size={10} color={Colors.warning} />
            <Text style={styles.manualPinText}>Manual Pin</Text>
          </View>
        )}
      </View>

      {/* Content Row: Description + Thumbnail */}
      <View style={styles.bodyRow}>
        <View style={styles.textColumn}>
          <Text style={styles.description} numberOfLines={2}>
            {report.description}
          </Text>

          {/* Location & District */}
          <View style={styles.locationRow}>
            <Ionicons name="location-sharp" size={13} color={Colors.accent.primary} />
            <Text style={styles.locationText} numberOfLines={1}>
              {report.locationName} • <Text style={styles.districtText}>{report.district}</Text>
            </Text>
          </View>
        </View>

        {report.photoUrl ? (
          <Image
            source={{ uri: report.photoUrl }}
            style={styles.thumbnail}
            contentFit="cover"
            transition={200}
          />
        ) : null}
      </View>

      {/* Decision / Feedback Feedback Banners */}
      {report.status === 'rejected' && report.verificationDecision && (
        <View style={styles.rejectionSnippetBox}>
          <Ionicons name="close-circle-outline" size={14} color={Colors.report.rejected} />
          <Text style={styles.rejectionSnippetText} numberOfLines={1}>
            Officer Reason: {report.verificationDecision}
          </Text>
        </View>
      )}

      {report.status === 'verified' && (report.hazardEventTitle || report.verificationDecision) && (
        <View style={styles.verifiedSnippetBox}>
          <Ionicons name="shield-checkmark-outline" size={14} color={Colors.report.verified} />
          <Text style={styles.verifiedSnippetText} numberOfLines={1}>
            {report.hazardEventTitle
              ? `Linked to Event: ${report.hazardEventTitle}`
              : `Review Note: ${report.verificationDecision}`}
          </Text>
        </View>
      )}

      {/* Info Requested Notice (if applicable) */}
      {report.status === 'info_requested' && report.infoRequestedMessage && (
        <View style={styles.infoRequestedBox}>
          <Ionicons name="alert-circle" size={14} color={Colors.info} />
          <Text style={styles.infoRequestedText} numberOfLines={1}>
            Clarification requested: {report.infoRequestedMessage}
          </Text>
        </View>
      )}

      {/* Footer Row: Capture Time & Submitter */}
      <View style={styles.footerRow}>
        <View style={styles.timeRow}>
          <Ionicons name="time-outline" size={12} color={Colors.text.tertiary} />
          <Text style={styles.timeText}>{formattedTime}</Text>
        </View>

        {showSubmitter && (
          <View style={styles.submitterRow}>
            <Ionicons
              name={report.submitterRole === 'volunteer' ? 'shield-checkmark' : 'person'}
              size={12}
              color={report.submitterRole === 'volunteer' ? Colors.accent.emerald : Colors.text.tertiary}
            />
            <Text style={styles.submitterName} numberOfLines={1}>
              {report.submitterName}
            </Text>
          </View>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: Spacing.md,
    padding: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs + 2,
  },
  refContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  refNumber: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.accent.primary,
    letterSpacing: 0.5,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  manualPinPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  manualPinText: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.warning,
    textTransform: 'uppercase',
  },
  bodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  textColumn: {
    flex: 1,
  },
  description: {
    fontSize: FontSize.sm,
    color: Colors.text.primary,
    lineHeight: 20,
    marginBottom: Spacing.xs + 2,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
    flex: 1,
  },
  districtText: {
    color: Colors.accent.primary,
    fontWeight: '600',
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: BorderRadius.md,
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  infoRequestedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    marginBottom: Spacing.sm,
  },
  infoRequestedText: {
    fontSize: FontSize.micro,
    color: Colors.info,
    fontWeight: '600',
    flex: 1,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.xs + 2,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: FontSize.micro,
    color: Colors.text.tertiary,
  },
  submitterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: 160,
  },
  submitterName: {
    fontSize: FontSize.micro,
    color: Colors.text.secondary,
    fontWeight: '600',
  },
  cardHighlight: {
    borderColor: 'rgba(56, 189, 248, 0.4)',
    borderWidth: 1.5,
  },
  newBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(56, 189, 248, 0.16)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.4)',
  },
  newBadgeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Colors.accent.primary,
  },
  newBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.accent.primary,
    letterSpacing: 0.5,
  },
  rejectionSnippetBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    marginBottom: Spacing.sm,
  },
  rejectionSnippetText: {
    fontSize: FontSize.micro,
    color: Colors.report.rejected,
    fontWeight: '600',
    flex: 1,
  },
  verifiedSnippetBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    marginBottom: Spacing.sm,
  },
  verifiedSnippetText: {
    fontSize: FontSize.micro,
    color: Colors.report.verified,
    fontWeight: '600',
    flex: 1,
  },
});
