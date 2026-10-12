import { MobileTypography } from '@/constants/colors';
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LightColors } from '@/constants/colors';
import { getObservationTypeDefinition } from '@/constants/observationTypes';
import type { GroundReport, ReportStatus } from '@/types/groundReport';

export const LIGHT_REPORT_STATUS: Record<
  ReportStatus,
  { label: string; color: string; background: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  pending_verification: {
    label: 'Pending review',
    color: '#946000',
    background: '#FFF2D4',
    icon: 'time-outline',
  },
  verified: {
    label: 'Verified',
    color: '#07834B',
    background: '#E5F7ED',
    icon: 'checkmark-circle-outline',
  },
  info_requested: {
    label: 'Needs info',
    color: '#0066FF',
    background: '#EAF2FF',
    icon: 'chatbubble-ellipses-outline',
  },
  rejected: {
    label: 'Rejected',
    color: '#C52D3E',
    background: '#FFF0F2',
    icon: 'close-circle-outline',
  },
};

export function CommunityReportCard({
  report,
  onPress,
  isNew,
  showSubmitter,
}: {
  report: GroundReport;
  onPress: () => void;
  isNew: boolean;
  showSubmitter: boolean;
}) {
  const observation = getObservationTypeDefinition(report.observationType);
  const status = LIGHT_REPORT_STATUS[report.status];
  const photos = report.photoUrls?.length
    ? report.photoUrls
    : report.photoUrl
      ? [report.photoUrl]
      : [];
  const feedback =
    report.status === 'info_requested'
      ? report.infoRequestedMessage
      : report.status === 'rejected'
        ? report.verificationDecision
        : null;
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.card, isNew && styles.unreadCard]}
      accessibilityRole="button"
      accessibilityLabel={`${observation.shortLabel}, ${status.label}, ${report.referenceNumber}`}
      activeOpacity={0.8}
    >
      <View style={styles.topRow}>
        <Text style={styles.reference} numberOfLines={1}>
          {report.referenceNumber}
        </Text>
        <View style={[styles.status, { backgroundColor: status.background }]}>
          <Ionicons name={status.icon} size={13} color={status.color} />
          <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>
      <View style={styles.bodyRow}>
        <View style={styles.thumbnail}>
          {photos[0] ? (
            <Image
              source={{ uri: photos[0] }}
              style={styles.image}
              contentFit="cover"
              transition={180}
            />
          ) : (
            <Ionicons name={observation.icon} size={27} color={LightColors.primary} />
          )}
          {photos.length > 1 && (
            <View style={styles.photoCount}>
              <Ionicons name="images-outline" size={10} color="#FFFFFF" />
              <Text style={styles.photoCountText}>{photos.length}</Text>
            </View>
          )}
        </View>
        <View style={styles.copy}>
          <View style={styles.titleRow}>
            <Ionicons name={observation.icon} size={15} color={LightColors.primary} />
            <Text style={styles.title}>{observation.shortLabel}</Text>
            {isNew && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.description} numberOfLines={2}>
            {report.description}
          </Text>
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={12} color={LightColors.mutedText} />
            <Text style={styles.location} numberOfLines={1}>
              {report.locationName}
            </Text>
          </View>
        </View>
      </View>
      {!!feedback && (
        <View style={[styles.feedback, { backgroundColor: status.background }]}>
          <Ionicons name={status.icon} size={16} color={status.color} />
          <View style={styles.copy}>
            <Text style={[styles.feedbackTitle, { color: status.color }]}>
              {report.status === 'info_requested'
                ? 'Add details to your report'
                : 'Review feedback'}
            </Text>
            <Text style={[styles.feedbackText, { color: status.color }]} numberOfLines={2}>
              {feedback}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={15} color={status.color} />
        </View>
      )}
      <View style={styles.footer}>
        <View style={styles.footerCopy}>
          <Text style={styles.district}>{report.district}</Text>
          <Text style={styles.date}>
            {new Date(report.createdAt).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
            {showSubmitter ? ' / ' + report.submitterName : ''}
          </Text>
        </View>
        <Text style={styles.viewText}>View report</Text>
        <Ionicons name="chevron-forward" size={14} color={LightColors.primary} />
      </View>
    </TouchableOpacity>
  );
}
const styles = StyleSheet.create({
  card: {
    marginHorizontal: 18,
    marginBottom: 13,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5ECF6',
    backgroundColor: '#FFFFFF',
    shadowColor: '#154893',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.045,
    shadowRadius: 12,
    elevation: 2,
  },
  unreadCard: { borderColor: '#B9D4FF' },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  reference: {
    flex: 1,
    color: LightColors.mutedText,
    ...MobileTypography.caption,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  statusText: { ...MobileTypography.badge, fontWeight: '600' },
  bodyRow: { flexDirection: 'row', gap: 12 },
  thumbnail: {
    width: 76,
    height: 84,
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LightColors.primarySoft,
  },
  image: { width: '100%', height: '100%' },
  photoCount: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    flexDirection: 'row',
    gap: 3,
    alignItems: 'center',
    backgroundColor: 'rgba(7,16,31,0.7)',
    borderRadius: 6,
    padding: 4,
  },
  photoCountText: { color: '#FFFFFF', ...MobileTypography.small },
  copy: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
  title: {
    flexShrink: 1,
    color: LightColors.text,
    fontWeight: '700',
    ...MobileTypography.body,
    letterSpacing: -0.2,
  },
  unreadDot: { width: 6, height: 6, backgroundColor: LightColors.primary, borderRadius: 3 },
  description: { color: LightColors.secondaryText, ...MobileTypography.body },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 7 },
  location: { flex: 1, color: LightColors.mutedText, ...MobileTypography.caption },
  feedback: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    padding: 11,
    borderRadius: 12,
    marginTop: 13,
  },
  feedbackTitle: { ...MobileTypography.body, fontWeight: '700', marginBottom: 3 },
  feedbackText: { ...MobileTypography.caption },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderTopWidth: 1,
    borderTopColor: '#EDF2F8',
    marginTop: 14,
    paddingTop: 11,
  },
  footerCopy: { flex: 1 },
  district: {
    color: LightColors.secondaryText,
    ...MobileTypography.caption,
    fontWeight: '600',
    marginBottom: 3,
  },
  date: { color: LightColors.mutedText, ...MobileTypography.caption },
  viewText: { color: LightColors.primary, ...MobileTypography.caption, fontWeight: '600' },
});
