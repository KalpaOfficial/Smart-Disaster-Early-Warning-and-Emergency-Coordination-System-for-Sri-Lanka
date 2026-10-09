/**
 * Submit Ground Report Screen — Multi-Step Hazard Observation Form.
 * UC02 Main Flow Steps 1-12: Observation type → Description → Photo → Location → Review → Submit.
 * Supports offline submission via queue when device has no connectivity.
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import { ScreenContainer } from '@/components/ScreenContainer';
import { PhotoCapture } from '@/components/PhotoCapture';
import { LocationPicker } from '@/components/LocationPicker';
import { ObservationTypeBadge } from '@/components/ObservationTypeBadge';
import { Colors, BorderRadius, Spacing, FontSize } from '@/constants/colors';
import { OBSERVATION_TYPES } from '@/constants/observationTypes';
import { getRoleLabel } from '@/constants/roles';
import { getReportPermissions } from '@/constants/reportPermissions';
import { useAuth } from '@/hooks/useAuth';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { submitGroundReport } from '@/services/groundReportService';
import { uploadGroundReportPhoto } from '@/services/photoUploadService';
import { queueOfflineReport } from '@/services/offlineQueueService';
import type { ObservationType, GeoLocation, CreateGroundReportData } from '@/types/groundReport';

const TOTAL_STEPS = 5;

export default function SubmitReportScreen() {
  const { state: authState } = useAuth();
  const router = useRouter();
  const user = authState.user;
  const permissions = getReportPermissions(user?.role);
  const { isOffline } = useNetworkStatus();

  // Multi-step state
  const [currentStep, setCurrentStep] = useState(1);

  // Form data
  const [observationType, setObservationType] = useState<ObservationType | null>(null);
  const [description, setDescription] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [location, setLocation] = useState<GeoLocation>({
    latitude: 6.9271,
    longitude: 79.8612,
  });
  const [locationName, setLocationName] = useState('');
  const [district, setDistrict] = useState(user?.district || 'Colombo');
  const [isManualLocation, setIsManualLocation] = useState(false);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedRef, setSubmittedRef] = useState('');
  const [submittedOffline, setSubmittedOffline] = useState(false);

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  const progressPercent = (currentStep / TOTAL_STEPS) * 100;

  const validateStep = useCallback((step: number): boolean => {
    const newErrors: Record<string, string | null> = {};

    switch (step) {
      case 1:
        if (!observationType) {
          newErrors.observationType = 'Please select an observation type.';
        }
        break;
      case 2:
        if (!description.trim() || description.trim().length < 10) {
          newErrors.description = 'Description must be at least 10 characters.';
        }
        break;
      case 3:
        if (!photoUri) {
          newErrors.photo = 'A photograph of the hazard is required.';
        }
        break;
      case 4:
        if (!locationName.trim()) {
          newErrors.locationName = 'Location name is required.';
        }
        if (!district) {
          newErrors.district = 'Please select a district.';
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [observationType, description, photoUri, locationName, district]);

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, TOTAL_STEPS));
    }
  };

  const handleBack = () => {
    if (currentStep === 1) {
      router.back();
    } else {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSubmit = useCallback(async () => {
    if (!user || !observationType || !photoUri) return;
    if (!permissions.canSubmit) {
      Alert.alert(
        'Submission Prohibited',
        `Users with role '${user?.role ? getRoleLabel(user.role) : 'Unknown'}' cannot submit ground observations. Only registered citizens and volunteers can submit reports.`,
      );
      return;
    }
    if (!validateStep(4)) return;

    setSubmitting(true);
    const captureTime = new Date().toISOString();

    const reportData: CreateGroundReportData = {
      observationType,
      description: description.trim(),
      photoUri,
      location,
      locationName: locationName.trim(),
      district,
      isManualLocation,
      captureTime,
    };

    try {
      // Check connectivity
      const netState = await NetInfo.fetch();
      const isOnline = netState.isConnected && netState.isInternetReachable !== false;

      if (!isOnline) {
        // Queue for offline sync
        await queueOfflineReport(reportData, {
          id: user.id,
          fullName: user.fullName,
          role: user.role,
        });
        setSubmittedOffline(true);
        setSubmitted(true);
        return;
      }

      // Online: Upload photo then submit report
      const uploadResult = await uploadGroundReportPhoto(
        photoUri,
        `report-${Date.now()}`,
      );

      const result = await submitGroundReport(
        reportData,
        uploadResult.photoUrl,
        uploadResult.photoPath,
        {
          id: user.id,
          fullName: user.fullName,
          role: user.role,
        },
      );

      setSubmittedRef(result.referenceNumber);
      setSubmittedOffline(false);
      setSubmitted(true);
    } catch (err) {
      // If network error during submission, fall back to offline queue
      try {
        await queueOfflineReport(reportData, {
          id: user.id,
          fullName: user.fullName,
          role: user.role,
        });
        setSubmittedOffline(true);
        setSubmitted(true);
      } catch (_queueErr) {
        Alert.alert(
          'Submission Failed',
          (err as Error)?.message || 'An unexpected error occurred. Please try again.',
        );
      }
    } finally {
      setSubmitting(false);
    }
  }, [
    user,
    observationType,
    photoUri,
    permissions.canSubmit,
    validateStep,
    description,
    location,
    locationName,
    district,
    isManualLocation,
  ]);

  // --- Success View ---
  if (submitted) {
    return (
      <ScreenContainer>
        <View style={styles.successContainer}>
          <View style={styles.successIconWrapper}>
            <Ionicons
              name={submittedOffline ? 'cloud-upload-outline' : 'checkmark-circle'}
              size={56}
              color={submittedOffline ? Colors.warning : Colors.success}
            />
          </View>

          <Text style={styles.successTitle}>
            {submittedOffline ? 'Report Queued for Sync' : 'Report Submitted!'}
          </Text>

          <Text style={styles.successDescription}>
            {submittedOffline
              ? 'Your report has been saved locally and will be automatically synced when connectivity is restored.'
              : `Your ground report has been submitted and is now pending DMC verification.`}
          </Text>

          {!submittedOffline && submittedRef && (
            <View style={styles.refCard}>
              <Text style={styles.refLabel}>Reference Number</Text>
              <Text style={styles.refValue}>{submittedRef}</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.successBtn}
            onPress={() => router.replace('/(app)/reports' as never)}
            activeOpacity={0.85}
          >
            <Ionicons name="list" size={16} color="#080C14" />
            <Text style={styles.successBtnText}>View My Reports</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.successBtnSecondary}
            onPress={() => router.replace('/(app)' as never)}
            activeOpacity={0.7}
          >
            <Text style={styles.successBtnSecondaryText}>Back to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  // --- Access Restricted View (UC02 Phase 7.3: Role-Based Access) ---
  if (!permissions.canSubmit) {
    return (
      <ScreenContainer>
        <View style={styles.restrictedContainer}>
          <View style={styles.restrictedIconBox}>
            <Ionicons name="shield-outline" size={48} color={Colors.accent.primary} />
          </View>
          <Text style={styles.restrictedTitle}>Submission Access Restricted</Text>
          <Text style={styles.restrictedDesc}>
            Ground hazard observations can only be submitted by registered Citizens and Community Disaster Volunteers in the field.
          </Text>
          <View style={styles.restrictedRoleBox}>
            <Text style={styles.restrictedRoleLabel}>Your Current Role:</Text>
            <Text style={styles.restrictedRoleValue}>
              {user?.role ? getRoleLabel(user.role) : 'Unassigned'}
            </Text>
            <Text style={styles.restrictedRoleHint}>
              {user?.role === 'dmc_officer'
                ? 'DMC Duty Officers review and verify incoming citizen reports in the Verification Queue.'
                : 'District Officers coordinate tactical emergency resources, shelters, and relief distribution.'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.restrictedBackBtn}
            onPress={() => router.replace('/(app)/reports' as never)}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={18} color="#080C14" />
            <Text style={styles.restrictedBackBtnText}>Back to Reports Hub</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  // --- Step Renderers ---
  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Select Observation Type</Text>
      <Text style={styles.stepDescription}>
        What type of hazard are you observing? Select the category that best describes the situation.
      </Text>

      <View style={styles.typeGrid}>
        {OBSERVATION_TYPES.map((type) => {
          const selected = observationType === type.value;
          return (
            <TouchableOpacity
              key={type.value}
              style={[
                styles.typeCard,
                selected && {
                  borderColor: type.color,
                  backgroundColor: type.bgColor,
                },
              ]}
              onPress={() => {
                setObservationType(type.value);
                setErrors((prev) => ({ ...prev, observationType: null }));
              }}
              activeOpacity={0.8}
            >
              <View style={[styles.typeIconWrapper, { backgroundColor: type.bgColor }]}>
                <Ionicons name={type.icon} size={24} color={type.color} />
              </View>
              <Text style={styles.typeLabel}>{type.shortLabel}</Text>
              <Text style={styles.typeDesc} numberOfLines={2}>
                {type.description}
              </Text>
              {selected && (
                <View style={[styles.typeCheck, { backgroundColor: type.color }]}>
                  <Ionicons name="checkmark" size={12} color="#FFF" />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {errors.observationType && (
        <Text style={styles.errorText}>{errors.observationType}</Text>
      )}
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Describe the Hazard</Text>
      <Text style={styles.stepDescription}>
        Provide a clear, detailed description of the hazard you are observing. Include estimated
        severity, scale, and any immediate risks.
      </Text>

      <TextInput
        style={[
          styles.textArea,
          errors.description ? styles.inputError : null,
        ]}
        value={description}
        onChangeText={(text) => {
          setDescription(text);
          if (text.trim().length >= 10) {
            setErrors((prev) => ({ ...prev, description: null }));
          }
        }}
        placeholder="e.g. Water level at Kelani bridge rising rapidly, approximately 2m above normal. Road partially submerged. Multiple vehicles stranded..."
        placeholderTextColor={Colors.input.placeholder}
        multiline
        textAlignVertical="top"
        maxLength={1000}
      />
      <Text style={styles.charCount}>{description.length} / 1000</Text>

      {errors.description && (
        <Text style={styles.errorText}>{errors.description}</Text>
      )}
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Capture Evidence Photo</Text>
      <Text style={styles.stepDescription}>
        Take a photograph or select an existing image that clearly shows the hazard. This evidence
        will be reviewed by a DMC Duty Officer.
      </Text>

      <PhotoCapture
        photoUri={photoUri}
        onPhotoSelected={(uri) => {
          setPhotoUri(uri);
          setErrors((prev) => ({ ...prev, photo: null }));
        }}
        onPhotoRemoved={() => setPhotoUri(null)}
        error={errors.photo}
      />
    </View>
  );

  const renderStep4 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Confirm Location</Text>
      <Text style={styles.stepDescription}>
        Your GPS coordinates are automatically obtained. Adjust the pin or enter the location
        manually if GPS is unavailable.
      </Text>

      <LocationPicker
        location={location}
        locationName={locationName}
        district={district}
        isManualLocation={isManualLocation}
        onLocationChange={(loc, manual) => {
          setLocation(loc);
          setIsManualLocation(manual);
        }}
        onLocationNameChange={(name) => {
          setLocationName(name);
          if (name.trim()) {
            setErrors((prev) => ({ ...prev, locationName: null }));
          }
        }}
        onDistrictChange={setDistrict}
        error={errors.locationName || errors.district}
      />
    </View>
  );

  const renderStep5 = () => {
    const obsType = OBSERVATION_TYPES.find((t) => t.value === observationType);
    return (
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>Review & Submit</Text>
        <Text style={styles.stepDescription}>
          Please review all the information below before submitting your ground report to the DMC.
        </Text>

        {/* Summary Card */}
        <View style={styles.summaryCard}>
          {/* Observation Type */}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Observation Type</Text>
            {obsType && <ObservationTypeBadge type={observationType!} size="sm" />}
          </View>

          {/* Description Preview */}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Description</Text>
            <Text style={styles.summaryValue} numberOfLines={3}>
              {description}
            </Text>
          </View>

          {/* Photo Preview */}
          {photoUri && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Evidence Photo</Text>
              <Image
                source={{ uri: photoUri }}
                style={styles.summaryPhoto}
                contentFit="cover"
                transition={200}
              />
            </View>
          )}

          {/* Location */}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Location</Text>
            <View>
              <Text style={styles.summaryValue}>{locationName || 'Not set'}</Text>
              <Text style={styles.summaryMuted}>
                {district} • {location.latitude.toFixed(4)}°N, {location.longitude.toFixed(4)}°E
                {isManualLocation ? ' (Manual)' : ' (GPS)'}
              </Text>
            </View>
          </View>

          {/* Submitter */}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Observer</Text>
            <Text style={styles.summaryValue}>
              {user?.fullName} ({user?.role === 'volunteer' ? 'Volunteer' : 'Citizen'})
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const steps: Record<number, () => React.ReactNode> = {
    1: renderStep1,
    2: renderStep2,
    3: renderStep3,
    4: renderStep4,
    5: renderStep5,
  };

  const stepLabels = ['Type', 'Details', 'Photo', 'Location', 'Review'];

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={handleBack} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={20} color={Colors.text.secondary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Submit Ground Report</Text>
            <Text style={styles.headerSubtitle}>Step {currentStep} of {TOTAL_STEPS}</Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
          </View>
          <View style={styles.stepIndicators}>
            {stepLabels.map((label, i) => {
              const stepNum = i + 1;
              const isCompleted = currentStep > stepNum;
              const isCurrent = currentStep === stepNum;
              return (
                <View key={label} style={styles.stepDot}>
                  <View
                    style={[
                      styles.dot,
                      isCompleted && styles.dotCompleted,
                      isCurrent && styles.dotCurrent,
                    ]}
                  >
                    {isCompleted ? (
                      <Ionicons name="checkmark" size={10} color="#080C14" />
                    ) : (
                      <Text style={[styles.dotText, isCurrent && styles.dotTextCurrent]}>
                        {stepNum}
                      </Text>
                    )}
                  </View>
                  <Text style={[styles.dotLabel, isCurrent && styles.dotLabelCurrent]}>
                    {label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Offline indicator banner */}
        {isOffline && (
          <View style={styles.offlineBanner}>
            <Ionicons name="cloud-offline" size={14} color="#F59E0B" />
            <Text style={styles.offlineBannerText}>
              Offline mode: Report will be queued locally and automatically uploaded when connected.
            </Text>
          </View>
        )}

        {/* Step Content */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {steps[currentStep]?.()}
        </ScrollView>

        {/* Footer Navigation */}
        <View style={styles.footer}>
          {currentStep < TOTAL_STEPS ? (
            <TouchableOpacity
              style={styles.nextBtn}
              onPress={handleNext}
              activeOpacity={0.85}
            >
              <Text style={styles.nextBtnText}>Continue</Text>
              <Ionicons name="arrow-forward" size={16} color="#080C14" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.nextBtn, styles.submitBtn]}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#080C14" />
              ) : (
                <>
                  <Ionicons name="paper-plane" size={16} color="#080C14" />
                  <Text style={styles.nextBtnText}>Submit Report</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.text.primary,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    marginTop: 1,
  },

  // Progress
  progressContainer: {
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
  },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.accent.primary,
    borderRadius: 2,
  },
  stepIndicators: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stepDot: {
    alignItems: 'center',
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
  dotCompleted: {
    backgroundColor: Colors.accent.primary,
  },
  dotCurrent: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    borderWidth: 1.5,
    borderColor: Colors.accent.primary,
  },
  dotText: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.text.tertiary,
  },
  dotTextCurrent: {
    color: Colors.accent.primary,
  },
  dotLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: Colors.text.muted,
  },
  dotLabelCurrent: {
    color: Colors.accent.primary,
  },

  // Content
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.huge,
  },
  stepContent: {
    paddingTop: Spacing.sm,
  },
  stepTitle: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
    letterSpacing: -0.3,
  },
  stepDescription: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },

  // Step 1: Observation Type
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  typeCard: {
    width: '47%',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    position: 'relative',
  },
  typeIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  typeLabel: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  typeDesc: {
    fontSize: FontSize.micro + 1,
    color: Colors.text.tertiary,
    lineHeight: 15,
  },
  typeCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Step 2: Description
  textArea: {
    backgroundColor: Colors.input.bg,
    borderWidth: 1,
    borderColor: Colors.input.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    color: Colors.input.text,
    fontSize: FontSize.md,
    minHeight: 160,
    lineHeight: 22,
  },
  inputError: {
    borderColor: Colors.danger,
  },
  charCount: {
    fontSize: FontSize.micro,
    color: Colors.text.muted,
    textAlign: 'right',
    marginTop: Spacing.xs,
  },

  // Errors
  errorText: {
    fontSize: FontSize.xs,
    color: Colors.danger,
    marginTop: Spacing.sm,
    fontWeight: '600',
  },

  // Step 5: Summary
  summaryCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  summaryRow: {
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  summaryLabel: {
    fontSize: FontSize.micro,
    fontWeight: '700',
    color: Colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: Spacing.xs,
  },
  summaryValue: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text.primary,
    lineHeight: 20,
  },
  summaryMuted: {
    fontSize: FontSize.micro,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  summaryPhoto: {
    width: '100%',
    height: 150,
    borderRadius: BorderRadius.md,
    backgroundColor: '#000',
  },

  // Footer
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    paddingBottom: Spacing.xxl,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.accent.primary,
    paddingVertical: Spacing.md + 2,
    borderRadius: BorderRadius.md,
  },
  submitBtn: {
    backgroundColor: Colors.accent.emerald,
  },
  nextBtnText: {
    fontSize: FontSize.md,
    fontWeight: '800',
    color: '#080C14',
  },

  // Success
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxxl,
  },
  successIconWrapper: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xxl,
  },
  successTitle: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  successDescription: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.xxl,
  },
  refCard: {
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.xxl,
    alignItems: 'center',
  },
  refLabel: {
    fontSize: FontSize.micro,
    fontWeight: '700',
    color: Colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  refValue: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.accent.primary,
    letterSpacing: 1,
  },
  successBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.accent.primary,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  successBtnText: {
    fontSize: FontSize.md,
    fontWeight: '800',
    color: '#080C14',
  },
  successBtnSecondary: {
    paddingVertical: Spacing.sm,
  },
  successBtnSecondaryText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245, 158, 11, 0.25)',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xs + 2,
  },
  offlineBannerText: {
    fontSize: FontSize.micro,
    color: '#F59E0B',
    fontWeight: '600',
    flex: 1,
  },
  restrictedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  restrictedIconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  restrictedTitle: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  restrictedDesc: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.xl,
  },
  restrictedRoleBox: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    alignItems: 'center',
  },
  restrictedRoleLabel: {
    fontSize: FontSize.micro,
    color: Colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  restrictedRoleValue: {
    fontSize: FontSize.md,
    fontWeight: '800',
    color: Colors.accent.primary,
    marginBottom: Spacing.xs,
  },
  restrictedRoleHint: {
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 17,
  },
  restrictedBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.accent.primary,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  restrictedBackBtnText: {
    fontSize: FontSize.sm,
    fontWeight: '800',
    color: '#080C14',
  },
});
