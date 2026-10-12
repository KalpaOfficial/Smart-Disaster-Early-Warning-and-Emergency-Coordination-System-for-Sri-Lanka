import { MobileTypography } from '@/constants/colors';
/** Single-page hazard report with online submission and offline saving. */
import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenContainer } from '@/components/ScreenContainer';
import { ReportPhotos } from '@/components/ReportPhotos';
import { ReportLocationField } from '@/components/ReportLocationField';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { Input } from '@/components/Input';
import { LightColors } from '@/constants/colors';
import { OBSERVATION_TYPES } from '@/constants/observationTypes';
import { getReportPermissions } from '@/constants/reportPermissions';
import { useAuth } from '@/hooks/useAuth';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { submitGroundReport } from '@/services/groundReportService';
import { uploadGroundReportPhoto } from '@/services/photoUploadService';
import { queueOfflineReport } from '@/services/offlineQueueService';
import { validateReportForm } from '@/utils/reportForm';
import type { ObservationType, GeoLocation, CreateGroundReportData } from '@/types/groundReport';

export default function SubmitReportScreen() {
  const { state: authState } = useAuth();
  const user = authState.user;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const permissions = getReportPermissions(user?.role);
  const { isOffline } = useNetworkStatus();
  const scroll = useRef<ScrollView>(null);
  const sectionOffsets = useRef({ details: 0, photo: 0, location: 0 });
  const formOffset = useRef(0);
  const submissionLock = useRef(false);
  const [observationType, setObservationType] = useState<ObservationType | null>(null);
  const [description, setDescription] = useState('');
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const photoUri = photoUris[0] || null;
  const [location, setLocation] = useState<GeoLocation>({ latitude: 6.9271, longitude: 79.8612 });
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  const [locationName, setLocationName] = useState('');
  const [district, setDistrict] = useState(user?.district || '');
  const [isManualLocation, setIsManualLocation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedRef, setSubmittedRef] = useState('');
  const [submittedOffline, setSubmittedOffline] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [leaveConfirmation, setLeaveConfirmation] = useState(false);
  const clearError = (field: string) => {
    setErrors(prev => ({ ...prev, [field]: undefined }));
    setSubmitError('');
  };

  const handleSubmit = async () => {
    if (submissionLock.current || !user || !permissions.canSubmit) return;
    const formErrors = validateReportForm(
      {
        observationType: observationType || undefined,
        description,
        photoUri: photoUri || undefined,
        photoUris,
        location,
        locationName,
        district,
      },
      locationConfirmed
    );
    setErrors(formErrors);
    setSubmitError('');
    Keyboard.dismiss();
    if (Object.keys(formErrors).length) {
      const section =
        formErrors.observationType || formErrors.description
          ? 'details'
          : formErrors.photo
            ? 'photo'
            : 'location';
      scroll.current?.scrollTo({
        y: Math.max(0, formOffset.current + sectionOffsets.current[section] - 12),
        animated: true,
      });
      return;
    }
    if (!observationType || !photoUri) return;
    submissionLock.current = true;
    setSubmitting(true);
    const data: CreateGroundReportData = {
      observationType,
      description: description.trim(),
      photoUri,
      photoUris,
      location,
      locationName: locationName.trim(),
      district,
      isManualLocation,
      captureTime: new Date().toISOString(),
    };
    const submitter = { id: user.id, fullName: user.fullName, role: user.role };
    const saveOffline = async () => {
      await queueOfflineReport(data, submitter);
      setSubmittedOffline(true);
      setSubmitted(true);
    };
    try {
      const net = await NetInfo.fetch();
      if (!net.isConnected || net.isInternetReachable === false) {
        await saveOffline();
        return;
      }
      const identifier = 'report-' + Date.now();
      const photos = [];
      for (let index = 0; index < photoUris.length; index++) {
        photos.push(
          await uploadGroundReportPhoto(photoUris[index], identifier + '-photo-' + index)
        );
      }
      const result = await submitGroundReport(
        data,
        photos[0].photoUrl,
        photos[0].photoPath,
        submitter,
        photos
      );
      setSubmittedRef(result.referenceNumber);
      setSubmittedOffline(false);
      setSubmitted(true);
    } catch (err) {
      // Preserve the report locally if connectivity is lost during submission.
      try {
        await saveOffline();
      } catch {
        setSubmitError(
          err instanceof Error
            ? err.message
            : 'We could not send or save your report. Please try again.'
        );
      }
    } finally {
      submissionLock.current = false;
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    if (submitting) return;
    const leave = () => router.back();
    if (
      !observationType &&
      !description.trim() &&
      !photoUri &&
      !locationName.trim() &&
      !locationConfirmed
    ) {
      leave();
      return;
    }
    Keyboard.dismiss();
    setLeaveConfirmation(true);
  };

  if (submitted || !permissions.canSubmit) {
    return (
      <ScreenContainer style={styles.lightScreen} contentStyle={styles.shell}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.resultContent}>
          <View style={[styles.resultIcon, submittedOffline && styles.offlineIcon]}>
            <Ionicons
              name={
                !submitted
                  ? 'shield-outline'
                  : submittedOffline
                    ? 'cloud-upload-outline'
                    : 'checkmark'
              }
              size={44}
              color={submittedOffline ? '#A16B06' : '#079A60'}
            />
          </View>
          <Text accessibilityRole="header" style={styles.resultTitle}>
            {!submitted
              ? 'Citizen and volunteer reports'
              : submittedOffline
                ? 'Report saved on this device'
                : 'Thank you for reporting'}
          </Text>
          <Text style={styles.resultDescription}>
            {!submitted
              ? 'Hazard reports can be submitted by citizens and community volunteers.'
              : submittedOffline
                ? 'Your report is waiting to upload when a connection is available. You can track it in Saved reports.'
                : 'Your report has been sent to the DMC team for review. Track its status in My reports.'}
          </Text>
          {!!submittedRef && (
            <View style={styles.referenceCard}>
              <Text style={styles.referenceLabel}>REPORT REFERENCE</Text>
              <Text selectable style={styles.referenceValue}>
                {submittedRef}
              </Text>
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingText}>Pending review</Text>
              </View>
            </View>
          )}
          <TouchableOpacity
            style={styles.primaryButton}
            accessibilityRole="button"
            onPress={() =>
              router.replace(
                submittedOffline
                  ? '/(app)/reports/offline-queue'
                  : { pathname: '/(app)/reports', params: { tab: 'my_reports' } }
              )
            }
          >
            <Text style={styles.primaryText}>
              {!submitted
                ? 'Back to reports'
                : submittedOffline
                  ? 'View saved reports'
                  : 'View my reports'}
            </Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            accessibilityRole="button"
            onPress={() => router.replace('/(app)')}
          >
            <Text style={styles.secondaryText}>Back to Home</Text>
          </TouchableOpacity>
        </ScrollView>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer style={styles.screen} contentStyle={styles.shell}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <LinearGradient
            colors={['#0855D9', '#1265D9', '#2475D5']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={styles.headerRow}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={handleBack}
                disabled={submitting}
                accessibilityRole="button"
                accessibilityLabel="Back"
              >
                <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.headerLabel}>Community reporting</Text>
              <View style={styles.headerIcon}>
                <Ionicons name="camera-outline" size={22} color="#FFFFFF" />
              </View>
            </View>
            <Text accessibilityRole="header" style={styles.heroTitle}>
              Report a hazard
            </Text>
            <Text style={styles.heroDescription}>
              Share what you see. Help your community respond.
            </Text>
          </LinearGradient>
          <View
            style={styles.formBody}
            onLayout={e => {
              formOffset.current = e.nativeEvent.layout.y;
            }}
          >
            {isOffline && (
              <View style={styles.offlineBanner}>
                <Ionicons name="cloud-offline-outline" size={19} color="#A16B06" />
                <Text style={styles.offlineText}>
                  You are offline. Your report will be saved on this device until it can be
                  uploaded.
                </Text>
              </View>
            )}
            <View
              style={styles.card}
              onLayout={e => {
                sectionOffsets.current.details = e.nativeEvent.layout.y;
              }}
            >
              <View style={styles.sectionHeading}>
                <View style={styles.sectionIcon}>
                  <Ionicons name="warning-outline" size={19} color={LightColors.primary} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.sectionTitle}>What happened?</Text>
                  <Text style={styles.sectionCaption}>Choose a hazard and add a few details.</Text>
                </View>
              </View>
              <View style={styles.typeGrid}>
                {OBSERVATION_TYPES.map(type => {
                  const selected = observationType === type.value;
                  return (
                    <TouchableOpacity
                      key={type.value}
                      disabled={submitting}
                      onPress={() => {
                        setObservationType(type.value);
                        clearError('observationType');
                      }}
                      style={[styles.typeOption, selected && styles.typeSelected]}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected, disabled: submitting }}
                      accessibilityLabel={type.shortLabel}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name={type.icon}
                        size={20}
                        color={selected ? LightColors.primary : LightColors.secondaryText}
                      />
                      <Text style={[styles.typeLabel, selected && styles.typeLabelSelected]}>
                        {type.shortLabel}
                      </Text>
                      {selected && (
                        <Ionicons name="checkmark-circle" size={15} color={LightColors.primary} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
              {!!errors.observationType && (
                <Text style={styles.errorText} accessibilityLiveRegion="polite">
                  {errors.observationType}
                </Text>
              )}
              <Input
                label="Description"
                placeholder="e.g. Water is rising near the bridge and covering the road."
                appearance="light"
                value={description}
                editable={!submitting}
                onChangeText={val => {
                  setDescription(val);
                  clearError('description');
                }}
                multiline
                textAlignVertical="top"
                maxLength={1000}
                inputStyle={styles.descriptionInput}
                containerStyle={styles.descriptionField}
                error={errors.description}
              />
              <Text style={styles.charCount}>{description.length}/1000</Text>
            </View>
            <View
              style={styles.card}
              onLayout={e => {
                sectionOffsets.current.photo = e.nativeEvent.layout.y;
              }}
            >
              <View style={styles.sectionHeading}>
                <View style={styles.sectionIcon}>
                  <Ionicons name="images-outline" size={19} color={LightColors.primary} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.sectionTitle}>Add a photo</Text>
                  <Text style={styles.sectionCaption}>
                    A clear photo helps the team review your report.
                  </Text>
                </View>
              </View>
              <ReportPhotos
                disabled={submitting}
                photos={photoUris}
                onChange={uris => {
                  setPhotoUris(uris);
                  clearError('photo');
                }}
                error={errors.photo}
              />
            </View>
            <View
              style={styles.card}
              onLayout={e => {
                sectionOffsets.current.location = e.nativeEvent.layout.y;
              }}
            >
              <View style={styles.sectionHeading}>
                <View style={styles.sectionIcon}>
                  <Ionicons name="location-outline" size={19} color={LightColors.primary} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.sectionTitle}>Where is it?</Text>
                  <Text style={styles.sectionCaption}>
                    Add the location where you observed the hazard.
                  </Text>
                </View>
              </View>
              <ReportLocationField
                location={location}
                confirmed={locationConfirmed}
                isManual={isManualLocation}
                locationName={locationName}
                district={district}
                disabled={submitting}
                errors={errors}
                onLocationChange={(loc, manual) => {
                  setLocation(loc);
                  setIsManualLocation(manual);
                  setLocationConfirmed(true);
                  clearError('location');
                }}
                onInvalidLocation={() => setLocationConfirmed(false)}
                onNameChange={val => {
                  setLocationName(val);
                  clearError('locationName');
                }}
                onDistrictChange={val => {
                  setDistrict(val);
                  clearError('district');
                }}
              />
            </View>
            <View style={styles.helperRow}>
              <Ionicons
                name="information-circle-outline"
                size={17}
                color={LightColors.secondaryText}
              />
              <Text style={styles.helperText}>
                Check your details before sending. All fields and a photo are required.
              </Text>
            </View>
            {!!submitError && (
              <View style={styles.submitError} accessibilityRole="alert">
                <Text style={styles.errorText}>{submitError}</Text>
              </View>
            )}
          </View>
        </ScrollView>
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={submitting}
            style={[styles.primaryButton, submitting && styles.busyButton]}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityState={{ disabled: submitting, busy: submitting }}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Ionicons
                name={isOffline ? 'cloud-upload-outline' : 'paper-plane-outline'}
                size={19}
                color="#FFFFFF"
              />
            )}
            <Text style={styles.primaryText}>
              {submitting
                ? 'Sending your report...'
                : isOffline
                  ? 'Save report offline'
                  : 'Submit report'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
      <ConfirmationDialog
        visible={leaveConfirmation}
        title="Leave this report?"
        message="Your unsent changes will be lost. Keep editing to finish your report."
        confirmLabel="Leave report"
        cancelLabel="Keep editing"
        icon="exit-outline"
        onCancel={() => setLeaveConfirmation(false)}
        onConfirm={() => {
          setLeaveConfirmation(false);
          router.back();
        }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { backgroundColor: '#0855D9' },
  lightScreen: { backgroundColor: LightColors.background },
  shell: {
    backgroundColor: LightColors.background,
    borderColor: LightColors.border,
    shadowOpacity: 0.06,
  },
  scrollContent: { paddingBottom: 12 },
  hero: {
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 42,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 22 },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLabel: { flex: 1, color: '#DCEBFF', ...MobileTypography.caption, fontWeight: '600' },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 29,
    lineHeight: 36,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  heroDescription: { color: '#E4F0FF', ...MobileTypography.body, marginTop: 8 },
  formBody: { paddingHorizontal: 18, marginTop: -22 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E7EEF8',
    padding: 18,
    marginBottom: 14,
    shadowColor: '#154893',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 2,
  },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  sectionIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: LightColors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    color: LightColors.text,
    ...MobileTypography.section,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  sectionCaption: { color: LightColors.secondaryText, ...MobileTypography.caption, marginTop: 3 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  typeOption: {
    flexBasis: '46%',
    flexGrow: 1,
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: LightColors.border,
    borderRadius: 13,
    backgroundColor: '#F8FAFD',
    padding: 10,
  },
  typeSelected: { borderColor: LightColors.primary, backgroundColor: LightColors.primarySoft },
  typeLabel: {
    flex: 1,
    color: LightColors.secondaryText,
    ...MobileTypography.caption,
    fontWeight: '600',
  },
  typeLabelSelected: { color: LightColors.primary },
  descriptionInput: { minHeight: 96, lineHeight: 21 },
  descriptionField: { marginBottom: 4 },
  charCount: { textAlign: 'right', ...MobileTypography.caption, color: LightColors.mutedText },
  errorText: { color: LightColors.danger, ...MobileTypography.caption, marginBottom: 10 },
  submitError: { backgroundColor: LightColors.dangerSoft, padding: 12, borderRadius: 12 },
  helperRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 4, marginTop: 2, marginBottom: 10 },
  helperText: { flex: 1, color: LightColors.secondaryText, ...MobileTypography.caption },
  footer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: LightColors.border,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  primaryButton: {
    width: '100%',
    minHeight: 52,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: LightColors.primary,
    shadowColor: LightColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 2,
  },
  primaryText: { color: '#FFFFFF', ...MobileTypography.button, fontWeight: '700' },
  busyButton: { backgroundColor: LightColors.primaryPressed },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: '#FFF5DC',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  offlineText: { flex: 1, color: '#946000', ...MobileTypography.caption },
  resultContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 44,
  },
  resultIcon: {
    width: 90,
    height: 90,
    borderRadius: 30,
    backgroundColor: '#E2F7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  offlineIcon: { backgroundColor: '#FFF2D4' },
  resultTitle: {
    color: LightColors.text,
    fontSize: 26,
    lineHeight: 33,
    fontWeight: '800',
    letterSpacing: -0.7,
    textAlign: 'center',
  },
  resultDescription: {
    color: LightColors.secondaryText,
    ...MobileTypography.body,

    textAlign: 'center',
    marginTop: 14,
    marginBottom: 26,
  },
  referenceCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: LightColors.border,
    borderRadius: 20,
    padding: 22,
    alignItems: 'center',
    marginBottom: 28,
  },
  referenceLabel: {
    color: LightColors.mutedText,
    ...MobileTypography.caption,
    fontWeight: '600',
    letterSpacing: 1,
  },
  referenceValue: {
    color: LightColors.text,
    ...MobileTypography.body,
    fontWeight: '700',
    marginTop: 10,
  },
  pendingBadge: {
    borderRadius: 8,
    backgroundColor: '#FFF2D4',
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 14,
  },
  pendingText: { color: '#946000', ...MobileTypography.badge, fontWeight: '600' },
  secondaryButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  secondaryText: { color: LightColors.primary, ...MobileTypography.button, fontWeight: '600' },
});
