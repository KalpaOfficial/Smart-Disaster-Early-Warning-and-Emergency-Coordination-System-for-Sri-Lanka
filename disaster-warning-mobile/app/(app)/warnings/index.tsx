/**
 * UC01 – Step 1 UI: Open Hazard Events Control Center
 * Displays open/active hazard events from Firestore for authorized DMC Duty Officers.
 * Features RBAC authorization checks, real-time Firestore queries, event telemetry,
 * verified ground report counters, loading, empty, and error states.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';
import { FormModal } from '@/components/FormModal';
import { EmptyState } from '@/components/EmptyState';
import { MobileNavBar } from '@/components/MobileNavBar';
import { Colors, FontSize, Spacing, BorderRadius } from '@/constants/colors';
import { SRI_LANKA_RIVER_BASINS } from '@/constants/riverBasins';
import {
  getAllWarnings,
  createWarningWithDispatch,
  getGroundReportsForEvent,
} from '@/services/warningService';
import { getActiveEvents } from '@/services/hazardEventService';
import { resolveRecipients } from '@/services/recipientService';
import type {
  HazardWarning,
  WarningSeverity,
  WarningStatus,
  TargetMode,
  DeliveryChannel,
  ChannelDeliveryResult,
  VerifiedGroundReportStub,
} from '@/types/warning';
import type { HazardEvent, HazardType } from '@/types/resources';

const SRI_LANKA_DISTRICTS = [
  'Colombo',
  'Gampaha',
  'Kalutara',
  'Kandy',
  'Matale',
  'Nuwara Eliya',
  'Galle',
  'Matara',
  'Hambantota',
  'Jaffna',
  'Kilinochchi',
  'Mannar',
  'Vavuniya',
  'Mullaitivu',
  'Batticaloa',
  'Ampara',
  'Trincomalee',
  'Kurunegala',
  'Puttalam',
  'Anuradhapura',
  'Polonnaruwa',
  'Badulla',
  'Moneragala',
  'Ratnapura',
  'Kegalle',
];

const SEVERITY_OPTIONS = [
  { label: '🔴 RED — Immediate Evacuation Order', value: 'evacuation' },
  { label: '🟠 AMBER — Severe Warning (Prepare to Move)', value: 'warning' },
  { label: '🟡 YELLOW — General Hazard Advisory', value: 'advisory' },
];

export default function IssueHazardWarningScreen() {
  const { state } = useAuth();
  const router = useRouter();
  const user = state.user;

  // Authorization Guard: Strict RBAC for DMC Officers
  const isDmcOfficer = user?.role === 'dmc_officer';

  // Firestore Data State
  const [activeEvents, setActiveEvents] = useState<HazardEvent[]>([]);
  const [warnings, setWarnings] = useState<HazardWarning[]>([]);
  const [groundReportsMap, setGroundReportsMap] = useState<Record<string, VerifiedGroundReportStub[]>>({});

  // Operational Screen States (Loading, Refreshing, Error)
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selected Hazard Event for Warning Issuance
  const [selectedEventId, setSelectedEventId] = useState<string>('');

  // Composer Modal State (UC01 Steps 3 - 13)
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [hazardType, setHazardType] = useState<HazardType>('flood');
  const [severity, setSeverity] = useState<WarningSeverity>('warning');
  const [targetMode, setTargetMode] = useState<TargetMode>('district');
  const [targetAreas, setTargetAreas] = useState<string[]>(['Ratnapura', 'Kalutara']);
  const [headline, setHeadline] = useState('');
  const [instructions, setInstructions] = useState('');
  const [deliveryChannels, setDeliveryChannels] = useState<DeliveryChannel[]>(['push', 'sms']);

  // Recipient Resolution State (UC01 Steps 8 & 9)
  const [resolvedDistricts, setResolvedDistricts] = useState<string[]>([]);
  const [recipientCount, setRecipientCount] = useState<number>(0);
  const [resolvingRecipients, setResolvingRecipients] = useState(false);

  // Delivery Summary Modal State (UC01 Step 19)
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summaryData, setSummaryData] = useState<{
    warningId: string;
    overallStatus: WarningStatus;
    channelResults: ChannelDeliveryResult[];
    headline: string;
  } | null>(null);

  // Query Open Hazard Events from Firestore (`collection(db, 'hazardEvents')` where status == 'active')
  const fetchOpenEventsAndTelemetry = useCallback(async () => {
    setError(null);
    try {
      const [eventsList, warnList] = await Promise.all([
        getActiveEvents(),
        getAllWarnings(),
      ]);

      setActiveEvents(eventsList);
      setWarnings(warnList);

      // Fetch ground reports count & preview for each active event
      const reportsMap: Record<string, VerifiedGroundReportStub[]> = {};
      await Promise.all(
        eventsList.map(async (evt) => {
          const reports = await getGroundReportsForEvent(evt.id);
          reportsMap[evt.id] = reports;
        }),
      );
      setGroundReportsMap(reportsMap);

      if (eventsList.length > 0 && !selectedEventId) {
        setSelectedEventId(eventsList[0].id);
      }
    } catch (err) {
      console.error('Error fetching open hazard events from Firestore:', err);
      setError('Failed to connect to Cloud Firestore. Please check your network connection.');
    } finally {
      setLoading(false);
    }
  }, [selectedEventId]);

  const params = useLocalSearchParams<{ issueWarningForEventId?: string }>();

  useEffect(() => {
    if (params.issueWarningForEventId && activeEvents.length > 0) {
      const targetEvent = activeEvents.find((e) => e.id === params.issueWarningForEventId);
      if (targetEvent) {
        handleOpenComposerForEvent(targetEvent);
      }
    }
  }, [params.issueWarningForEventId, activeEvents]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOpenEventsAndTelemetry();
    setRefreshing(false);
  };

  // Step 8 & 9: Auto-resolve recipients when targetMode or targetAreas change
  useEffect(() => {
    if (!showModal) return;
    let isCurrent = true;
    setResolvingRecipients(true);

    resolveRecipients(targetMode, targetAreas).then((res) => {
      if (isCurrent) {
        setResolvedDistricts(res.resolvedDistricts);
        setRecipientCount(res.recipientCount);
        setResolvingRecipients(false);
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [targetMode, targetAreas, showModal]);

  const selectedEvent = useMemo(
    () => activeEvents.find((e) => e.id === selectedEventId) || activeEvents[0],
    [activeEvents, selectedEventId],
  );

  // Open Composer Modal for selected event
  const handleOpenComposerForEvent = (event: HazardEvent) => {
    setSelectedEventId(event.id);
    setHazardType(event.hazardType);
    setTargetMode('district');
    setTargetAreas(event.affectedDistricts.length > 0 ? event.affectedDistricts : ['Ratnapura', 'Kalutara']);
    setHeadline(`RED EVACUATION WARNING: ${event.title}`);
    setInstructions('Immediate evacuation ordered for residents in low-lying sectors. Move immediately to designated emergency shelters.');
    setShowModal(true);
  };

  // Toggle Target Areas selection
  const toggleTargetArea = (area: string) => {
    setTargetAreas((prev) => {
      const exists = prev.includes(area);
      if (exists) {
        return prev.filter((a) => a !== area);
      } else {
        return [...prev, area];
      }
    });
  };

  // Toggle Delivery Channel selection
  const toggleDeliveryChannel = (channel: DeliveryChannel) => {
    setDeliveryChannels((prev) => {
      const exists = prev.includes(channel);
      if (exists) {
        if (prev.length === 1) {
          Alert.alert('Delivery Channel Required', 'At least one delivery channel must be selected.');
          return prev;
        }
        return prev.filter((c) => c !== channel);
      } else {
        return [...prev, channel];
      }
    });
  };

  // Submit Warning Pipeline (UC01 Steps 13 - 19)
  const handleSubmitWarning = async (forceFailure?: DeliveryChannel) => {
    if (!headline.trim()) {
      Alert.alert('Validation Error', 'Please enter a warning headline.');
      return;
    }
    if (!instructions.trim()) {
      Alert.alert('Validation Error', 'Please enter emergency instructions.');
      return;
    }
    if (deliveryChannels.length === 0) {
      Alert.alert('Validation Error', 'Please select at least one delivery channel.');
      return;
    }

    // Exception Flow 1: No recipients matched
    if (recipientCount <= 0 || targetAreas.length === 0) {
      Alert.alert(
        'No Recipients Matched',
        'No registered recipients were matched for the selected target areas. Please select valid target districts or river basins.',
      );
      return;
    }

    setSubmitting(true);
    try {
      const issuerUid = user?.id || 'test-user-dmc-officer';
      const issuerName = user?.fullName ? `${user.fullName} (DMC Duty Officer)` : 'DMC Command Centre';

      const result = await createWarningWithDispatch(
        {
          eventId: selectedEvent?.id || '',
          hazardEventId: selectedEvent?.id || '',
          hazardEventTitle: selectedEvent?.title || '',
          hazardType,
          severity,
          targetMode,
          targetAreas,
          resolvedDistricts,
          recipientCount,
          headline: headline.trim(),
          instructions: instructions.trim(),
          channels: deliveryChannels,
          deliveryChannels,
        },
        issuerUid,
        issuerName,
        forceFailure,
      );

      setShowModal(false);
      setSummaryData({
        warningId: result.warningId,
        overallStatus: result.overallStatus,
        channelResults: result.channelResults,
        headline: headline.trim(),
      });
      setShowSummaryModal(true);

      fetchOpenEventsAndTelemetry();
    } catch (err) {
      const msg = (err as Error).message || 'Warning submission failed.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Submission Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (st: WarningStatus) => {
    switch (st) {
      case 'delivered':
        return { label: 'DELIVERED (ALL CHANNELS)', color: Colors.success };
      case 'partially_failed':
        return { label: 'DELIVERED (PARTIAL FAILURES)', color: Colors.warning };
      case 'failed':
        return { label: 'DELIVERY FAILED', color: Colors.danger };
      case 'dispatching':
        return { label: 'DISPATCHING...', color: Colors.accent.primary };
      case 'cancelled':
        return { label: 'CANCELLED', color: Colors.text.tertiary };
      default:
        return { label: st.toUpperCase(), color: Colors.text.tertiary };
    }
  };

  // Authorization Exception: Access Restricted to DMC Officers
  if (!isDmcOfficer && !loading) {
    return (
      <ScreenContainer>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.navHeader}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={20} color={Colors.text.primary} />
            </TouchableOpacity>
            <View style={styles.navTitleBox}>
              <Text style={styles.navPill}>UC01 — RBAC CONTROL</Text>
              <Text style={styles.navTitle}>Issue Hazard Warning</Text>
            </View>
          </View>

          <Card style={styles.rbacCard}>
            <View style={styles.rbacIconBox}>
              <Ionicons name="lock-closed" size={32} color={Colors.danger} />
            </View>
            <Text style={styles.rbacTitle}>Access Restricted: DMC Duty Officers Only</Text>
            <Text style={styles.rbacDesc}>
              UC01 Issue Hazard Warning requires authorized DMC Duty Officer credentials. Your current account role is{' '}
              <Text style={{ fontWeight: '900', color: Colors.accent.primary }}>{user?.role ? user.role.toUpperCase() : 'GUEST'}</Text>.
            </Text>

            <View style={styles.rbacHintBox}>
              <Ionicons name="information-circle-outline" size={16} color={Colors.text.secondary} />
              <Text style={styles.rbacHintText}>
                To test DMC Officer features, sign in as <Text style={{ color: '#FFF', fontWeight: '800' }}>officer@dmc.gov.lk</Text> or update your user profile role in Cloud Firestore.
              </Text>
            </View>

            <Button
              title="Return to Dashboard"
              variant="outline"
              onPress={() => router.replace('/(app)')}
              style={styles.rbacReturnBtn}
            />
          </Card>
        </ScrollView>
        <MobileNavBar />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent.primary} />
        }
      >
        {/* Navigation Header */}
        <View style={styles.navHeader}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color={Colors.text.primary} />
          </TouchableOpacity>
          <View style={styles.navTitleBox}>
            <Text style={styles.navPill}>UC01 STEP 1 — OPEN HAZARD EVENTS</Text>
            <Text style={styles.navTitle}>Hazard Warning Dispatch</Text>
          </View>
        </View>

        {/* Header Hero Banner */}
        <LinearGradient
          colors={['#1E1B4B', '#0F172A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroBanner}
        >
          <View style={styles.heroHeaderRow}>
            <View style={styles.beaconPill}>
              <View style={styles.beaconDot} />
              <Text style={styles.beaconText}>DMC OFFICER COMMAND • AUTHORIZED</Text>
            </View>
            <Text style={styles.heroRoleTag}>FIRESTORE LIVE SYNC</Text>
          </View>

          <Text style={styles.heroTitle}>Open Hazard Events Control Center</Text>
          <Text style={styles.heroDesc}>
            Inspect open disaster hazard events, verified ground reports, and affected river basins to issue location-specific early warnings.
          </Text>
        </LinearGradient>

        {/* Section Header */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>ACTIVE OPEN HAZARD EVENTS FOR WARNING ISSUANCE</Text>
          {loading && <ActivityIndicator size="small" color={Colors.accent.primary} />}
        </View>

        {/* Loading State */}
        {loading ? (
          <Card style={styles.stateCard}>
            <ActivityIndicator size="large" color={Colors.accent.primary} />
            <Text style={styles.stateTitle}>Querying Active Hazard Events...</Text>
            <Text style={styles.stateDesc}>Fetching live telemetry from Cloud Firestore `hazardEvents` collection.</Text>
          </Card>
        ) : error ? (
          /* Error State */
          <Card style={styles.errorCard}>
            <Ionicons name="cloud-offline" size={36} color={Colors.danger} />
            <Text style={styles.errorTitle}>Firestore Connection Error</Text>
            <Text style={styles.errorDesc}>{error}</Text>
            <Button
              title="Retry Connection"
              variant="danger"
              size="sm"
              onPress={fetchOpenEventsAndTelemetry}
              style={styles.retryBtn}
            />
          </Card>
        ) : activeEvents.length > 0 ? (
          /* Open Hazard Events List */
          activeEvents.map((event) => {
            const reports = groundReportsMap[event.id] || [];

            return (
              <Card key={event.id} style={styles.eventCard}>
                <View style={styles.eventCardHeader}>
                  <View style={styles.hazardBadge}>
                    <Ionicons name="warning-outline" size={14} color="#FFF" />
                    <Text style={styles.hazardBadgeText}>{event.hazardType.toUpperCase()}</Text>
                  </View>

                  <View style={styles.warningLevelBadge}>
                    <Text style={styles.warningLevelText}>{event.warningLevel || 'LEVEL 4 ALERT'}</Text>
                  </View>

                  <View style={styles.statusChip}>
                    <View style={styles.statusDot} />
                    <Text style={styles.statusChipText}>{event.status.toUpperCase()}</Text>
                  </View>
                </View>

                {/* Event Title & Description */}
                <Text style={styles.eventTitle}>{event.title}</Text>
                <Text style={styles.eventDesc}>{event.description}</Text>

                {/* Affected Areas & River Basins */}
                <View style={styles.areaSection}>
                  <Text style={styles.areaLabel}>AFFECTED DISTRICTS:</Text>
                  <View style={styles.chipsWrap}>
                    {event.affectedDistricts.map((d) => (
                      <View key={d} style={styles.districtChip}>
                        <Ionicons name="location-sharp" size={11} color={Colors.accent.primary} />
                        <Text style={styles.districtChipText}>{d}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                {event.affectedRiverBasins && event.affectedRiverBasins.length > 0 ? (
                  <View style={styles.areaSection}>
                    <Text style={styles.areaLabel}>AFFECTED RIVER BASINS:</Text>
                    <View style={styles.chipsWrap}>
                      {event.affectedRiverBasins.map((b) => (
                        <View key={b} style={styles.basinChip}>
                          <Ionicons name="water" size={11} color="#38BDF8" />
                          <Text style={styles.basinChipText}>{b}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}

                {/* Verified Ground Reports Preview & Count */}
                <View style={styles.groundReportsContainer}>
                  <View style={styles.groundReportsHeader}>
                    <Ionicons name="shield-checkmark" size={14} color={Colors.success} />
                    <Text style={styles.groundReportsHeaderText}>
                      VERIFIED GROUND REPORTS ({reports.length})
                    </Text>
                  </View>

                  {reports.map((report) => (
                    <View key={report.id} style={styles.reportRow}>
                      <Text style={styles.reportLocation}>📍 {report.locationName}:</Text>
                      <Text style={styles.reportDesc}>{report.description}</Text>
                      <Text style={styles.reportMeta}>Verified by {report.verifiedBy}</Text>
                    </View>
                  ))}
                </View>

                {/* Clear "View Event & Issue Warning" Action Button */}
                <Button
                  title="View Event &amp; Issue Warning"
                  variant="primary"
                  icon={<Ionicons name="megaphone-outline" size={18} color="#FFFFFF" />}
                  onPress={() => handleOpenComposerForEvent(event)}
                  style={styles.viewEventBtn}
                />
              </Card>
            );
          })
        ) : (
          /* Empty State */
          <EmptyState
            iconName="cloud-done-outline"
            title="No Open Hazard Events"
            message="There are currently no active/open hazard events in Cloud Firestore. All monitoring stations are within baseline thresholds."
          />
        )}

        {/* Existing Issued Warnings Timeline Header */}
        <Text style={styles.sectionTitle}>RECENTLY ISSUED WARNING BROADCASTS ({warnings.length})</Text>

        {warnings.map((w) => {
          const st = getStatusBadge(w.status);
          return (
            <Card key={w.id} style={styles.warningHistoryCard}>
              <View style={styles.eventCardHeader}>
                <Text style={styles.cardTitle}>{w.headline}</Text>
                <Text style={[styles.statusTag, { color: st.color }]}>{st.label}</Text>
              </View>

              <Text style={styles.targetInfoText}>
                Target: {w.targetMode.toUpperCase()} ({w.targetAreas.join(', ')}) • {w.recipientCount.toLocaleString()} Recipients
              </Text>
              <Text style={styles.instructionPreview} numberOfLines={2}>
                {w.instructions}
              </Text>
            </Card>
          );
        })}
      </ScrollView>

      {/* Warning Composer FormModal (UC01 Steps 4 - 13) */}
      <FormModal visible={showModal} onClose={() => setShowModal(false)} title="UC01 — Warning Composer">
        <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
          <View style={styles.prefillBanner}>
            <Ionicons name="information-circle" size={16} color={Colors.accent.primary} />
            <Text style={styles.prefillBannerText}>
              PREFILLED HAZARD TYPE: <Text style={{ fontWeight: '900', color: '#FFF' }}>{hazardType.toUpperCase()}</Text> (Event: {selectedEvent?.title})
            </Text>
          </View>

          <Select
            label="Step 5: Warning Severity Level *"
            options={SEVERITY_OPTIONS}
            value={severity}
            onSelect={(val) => setSeverity(val as WarningSeverity)}
          />

          <Text style={styles.fieldLabel}>Step 6: Target Mode *</Text>
          <View style={styles.targetModeRow}>
            <TouchableOpacity
              style={[styles.targetModeBtn, targetMode === 'district' && styles.targetModeBtnActive]}
              onPress={() => {
                setTargetMode('district');
                setTargetAreas(['Ratnapura', 'Kalutara']);
              }}
            >
              <Ionicons name="business-outline" size={16} color={targetMode === 'district' ? Colors.accent.primary : Colors.text.tertiary} />
              <Text style={[styles.targetModeText, targetMode === 'district' && styles.targetModeTextActive]}>
                District Target
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.targetModeBtn, targetMode === 'river_basin' && styles.targetModeBtnActive]}
              onPress={() => {
                setTargetMode('river_basin');
                setTargetAreas(['Kalu River Basin']);
              }}
            >
              <Ionicons name="water-outline" size={16} color={targetMode === 'river_basin' ? Colors.accent.primary : Colors.text.tertiary} />
              <Text style={[styles.targetModeText, targetMode === 'river_basin' && styles.targetModeTextActive]}>
                River Basin Target
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.fieldLabel}>
            Step 7: Select Target {targetMode === 'district' ? 'Districts' : 'River Basins'} *
          </Text>
          <View style={styles.districtsGrid}>
            {(targetMode === 'district' ? SRI_LANKA_DISTRICTS : Object.keys(SRI_LANKA_RIVER_BASINS)).map((area) => {
              const selected = targetAreas.includes(area);
              return (
                <TouchableOpacity
                  key={area}
                  onPress={() => toggleTargetArea(area)}
                  style={[styles.districtPickChip, selected && styles.districtPickChipSelected]}
                >
                  <Ionicons
                    name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                    size={14}
                    color={selected ? Colors.accent.primary : Colors.text.tertiary}
                  />
                  <Text style={[styles.districtPickText, selected && styles.districtPickTextSelected]}>
                    {area}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.recipientBadgeBox}>
            <View style={styles.recipientBadgeHeader}>
              <Ionicons name="people-outline" size={16} color={Colors.accent.primary} />
              <Text style={styles.recipientBadgeTitle}>STEP 8 &amp; 9: RECIPIENT RESOLUTION MATRIX</Text>
            </View>
            {resolvingRecipients ? (
              <ActivityIndicator size="small" color={Colors.accent.primary} style={{ marginVertical: 4 }} />
            ) : (
              <>
                <Text style={styles.recipientCountText}>
                  👥 Estimated Recipients:{' '}
                  <Text style={{ fontSize: FontSize.lg, fontWeight: '900', color: Colors.accent.primary }}>
                    {recipientCount.toLocaleString()}
                  </Text>{' '}
                  registered users
                </Text>
                <Text style={styles.resolvedDistrictsText}>
                  Resolved Districts ({resolvedDistricts.length}): {resolvedDistricts.join(', ')}
                </Text>

                {recipientCount === 0 && (
                  <View style={styles.exceptionNotice}>
                    <Ionicons name="alert-circle" size={16} color="#EF4444" />
                    <Text style={styles.exceptionNoticeText}>
                      EXCEPTION: No registered recipients matched for the selected target areas.
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>

          <Input
            label="Step 10: Warning Headline *"
            placeholder="e.g. RED EVACUATION ALERT: Kalu River Basin Critical Level"
            value={headline}
            onChangeText={setHeadline}
            icon={<Ionicons name="alert-circle-outline" size={18} color={Colors.text.tertiary} />}
          />

          <Input
            label="Step 11: Emergency Safety Instructions *"
            placeholder="e.g. Immediate evacuation required for low-lying areas. Move immediately to Bodhiraja School Emergency Shelter..."
            value={instructions}
            onChangeText={setInstructions}
            multiline
            numberOfLines={4}
            containerStyle={styles.multilineInput}
          />

          <Text style={styles.fieldLabel}>Step 12: Delivery Channels *</Text>
          <View style={styles.channelsRow}>
            {[
              { id: 'push' as const, label: '📱 Push Notification' },
              { id: 'sms' as const, label: '💬 SMS Broadcast' },
              { id: 'audible' as const, label: '🔊 Audible Siren' },
            ].map((ch) => {
              const selected = deliveryChannels.includes(ch.id);
              return (
                <TouchableOpacity
                  key={ch.id}
                  onPress={() => toggleDeliveryChannel(ch.id)}
                  style={[styles.channelChip, selected && styles.channelChipSelected]}
                >
                  <Ionicons name={selected ? 'checkbox' : 'square-outline'} size={16} color={selected ? Colors.accent.primary : Colors.text.tertiary} />
                  <Text style={[styles.channelChipText, selected && styles.channelChipTextSelected]}>
                    {ch.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.modalActionRow}>
            <Button title="Cancel" variant="outline" onPress={() => setShowModal(false)} style={styles.modalCancelBtn} />
            <Button
              title="Submit &amp; Dispatch Warning"
              variant="primary"
              icon={<Ionicons name="megaphone-outline" size={18} color="#FFFFFF" />}
              loading={submitting}
              onPress={() => handleSubmitWarning()}
              style={styles.modalSubmitBtn}
            />
          </View>
        </ScrollView>
      </FormModal>

      {/* Step 19: Delivery Summary Modal Overlay */}
      <FormModal
        visible={showSummaryModal}
        onClose={() => setShowSummaryModal(false)}
        title="Step 19: Delivery Broadcast Summary"
      >
        {summaryData ? (
          <View style={styles.summaryContainer}>
            <View style={styles.summaryHeader}>
              <View style={[styles.summaryStatusBadge, { backgroundColor: getStatusBadge(summaryData.overallStatus).color + '20', borderColor: getStatusBadge(summaryData.overallStatus).color }]}>
                <Ionicons name="checkmark-done-circle" size={20} color={getStatusBadge(summaryData.overallStatus).color} />
                <Text style={[styles.summaryStatusText, { color: getStatusBadge(summaryData.overallStatus).color }]}>
                  {getStatusBadge(summaryData.overallStatus).label}
                </Text>
              </View>
              <Text style={styles.summaryWarningId}>ID: {summaryData.warningId}</Text>
            </View>

            <Text style={styles.summaryHeadline}>{summaryData.headline}</Text>

            <Text style={styles.summaryTableTitle}>PER-CHANNEL BROADCAST DISPATCH RESULTS:</Text>

            {summaryData.channelResults.map((ch) => (
              <View key={ch.channel} style={styles.summaryRow}>
                <View style={styles.summaryRowLeft}>
                  <Ionicons
                    name={ch.status === 'success' ? 'checkmark-circle' : 'alert-circle'}
                    size={18}
                    color={ch.status === 'success' ? Colors.success : Colors.danger}
                  />
                  <Text style={styles.summaryChannelName}>{ch.channel.toUpperCase()} CHANNEL</Text>
                </View>
                <View style={styles.summaryRowRight}>
                  <Text style={[styles.summaryResultStatus, { color: ch.status === 'success' ? Colors.success : Colors.danger }]}>
                    {ch.status.toUpperCase()} ({ch.recipientCount} Recv)
                  </Text>
                </View>
              </View>
            ))}

            <Button
              title="Close Operational Summary"
              variant="primary"
              onPress={() => setShowSummaryModal(false)}
              style={styles.summaryCloseBtn}
            />
          </View>
        ) : null}
      </FormModal>

      <MobileNavBar />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: 110,
  },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  navTitleBox: {
    flex: 1,
  },
  navPill: {
    fontSize: FontSize.micro,
    fontWeight: '800',
    color: Colors.accent.primary,
    letterSpacing: 0.8,
  },
  navTitle: {
    fontSize: FontSize.lg,
    fontWeight: '900',
    color: Colors.text.primary,
  },
  heroBanner: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.35)',
    marginBottom: Spacing.xl,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  beaconPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    gap: 6,
  },
  beaconDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  beaconText: {
    fontSize: FontSize.micro,
    fontWeight: '800',
    color: '#FCA5A5',
    letterSpacing: 0.5,
  },
  heroRoleTag: {
    fontSize: FontSize.micro,
    fontWeight: '700',
    color: Colors.text.tertiary,
  },
  heroTitle: {
    fontSize: FontSize.xl,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: Spacing.xs,
  },
  heroDesc: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    lineHeight: 18,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.micro,
    fontWeight: '800',
    color: Colors.text.tertiary,
    letterSpacing: 1,
  },
  eventCard: {
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  eventCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
    flexWrap: 'wrap',
  },
  hazardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingVertical: 3,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  hazardBadgeText: {
    fontSize: FontSize.micro,
    fontWeight: '900',
    color: '#FFF',
  },
  warningLevelBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingVertical: 3,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  warningLevelText: {
    fontSize: FontSize.micro,
    fontWeight: '800',
    color: '#FDE047',
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingVertical: 3,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    marginLeft: 'auto',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.success,
  },
  statusChipText: {
    fontSize: FontSize.micro,
    fontWeight: '800',
    color: Colors.success,
  },
  eventTitle: {
    fontSize: FontSize.lg,
    fontWeight: '900',
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  eventDesc: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    lineHeight: 18,
    marginBottom: Spacing.md,
  },
  areaSection: {
    marginBottom: Spacing.sm,
  },
  areaLabel: {
    fontSize: FontSize.micro,
    fontWeight: '800',
    color: Colors.text.tertiary,
    marginBottom: 4,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  districtChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    paddingVertical: 3,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  districtChipText: {
    fontSize: FontSize.micro,
    color: Colors.accent.primary,
    fontWeight: '700',
  },
  basinChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingVertical: 3,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
  },
  basinChipText: {
    fontSize: FontSize.micro,
    color: '#38BDF8',
    fontWeight: '800',
  },
  groundReportsContainer: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  groundReportsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.xs,
  },
  groundReportsHeaderText: {
    fontSize: FontSize.micro,
    fontWeight: '800',
    color: Colors.success,
    letterSpacing: 0.6,
  },
  reportRow: {
    backgroundColor: '#0F172A',
    padding: Spacing.xs + 2,
    borderRadius: BorderRadius.xs,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  reportLocation: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: '#FFF',
  },
  reportDesc: {
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
    lineHeight: 16,
    marginTop: 2,
  },
  reportMeta: {
    fontSize: FontSize.micro,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  viewEventBtn: {
    marginTop: Spacing.xs,
  },
  stateCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxxl,
    marginBottom: Spacing.xl,
  },
  stateTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text.primary,
    marginTop: Spacing.md,
  },
  stateDesc: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    marginTop: 4,
    textAlign: 'center',
  },
  errorCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxxl,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    marginBottom: Spacing.xl,
  },
  errorTitle: {
    fontSize: FontSize.lg,
    fontWeight: '900',
    color: Colors.danger,
    marginTop: Spacing.md,
  },
  errorDesc: {
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  retryBtn: {
    minWidth: 160,
  },
  warningHistoryCard: {
    marginBottom: Spacing.md,
  },
  cardTitle: {
    fontSize: FontSize.sm,
    fontWeight: '800',
    color: Colors.text.primary,
    flex: 1,
  },
  statusTag: {
    fontSize: FontSize.micro,
    fontWeight: '800',
  },
  targetInfoText: {
    fontSize: FontSize.micro,
    color: Colors.accent.primary,
    fontWeight: '700',
    marginTop: 4,
  },
  instructionPreview: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    marginTop: 4,
    lineHeight: 16,
  },
  rbacCard: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.xl,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  rbacIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  rbacTitle: {
    fontSize: FontSize.lg,
    fontWeight: '900',
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  rbacDesc: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },
  rbacHintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: Spacing.xl,
  },
  rbacHintText: {
    flex: 1,
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    lineHeight: 16,
  },
  rbacReturnBtn: {
    width: '100%',
  },
  formScroll: {
    paddingVertical: Spacing.sm,
  },
  prefillBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    marginBottom: Spacing.md,
  },
  prefillBannerText: {
    fontSize: FontSize.xs,
    color: '#38BDF8',
    fontWeight: '700',
  },
  fieldLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.text.secondary,
    marginBottom: 6,
    marginTop: Spacing.sm,
  },
  targetModeRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  targetModeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0F172A',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  targetModeBtnActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: Colors.accent.primary,
  },
  targetModeText: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    fontWeight: '600',
  },
  targetModeTextActive: {
    color: Colors.accent.primary,
    fontWeight: '800',
  },
  districtsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: Spacing.md,
  },
  districtPickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0F172A',
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  districtPickChipSelected: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: Colors.accent.primary,
  },
  districtPickText: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
  },
  districtPickTextSelected: {
    color: Colors.accent.primary,
    fontWeight: '700',
  },
  recipientBadgeBox: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    marginBottom: Spacing.md,
  },
  recipientBadgeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  recipientBadgeTitle: {
    fontSize: FontSize.micro,
    fontWeight: '800',
    color: Colors.accent.primary,
    letterSpacing: 0.8,
  },
  recipientCountText: {
    fontSize: FontSize.sm,
    color: Colors.text.primary,
    marginTop: 2,
  },
  resolvedDistrictsText: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  exceptionNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    padding: Spacing.xs + 2,
    borderRadius: BorderRadius.xs,
    marginTop: Spacing.xs,
  },
  exceptionNoticeText: {
    fontSize: FontSize.xs,
    color: '#FCA5A5',
    fontWeight: '700',
  },
  multilineInput: {
    minHeight: 90,
  },
  channelsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: Spacing.md,
  },
  channelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0F172A',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  channelChipSelected: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: Colors.accent.primary,
  },
  channelChipText: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
  },
  channelChipTextSelected: {
    color: Colors.accent.primary,
    fontWeight: '700',
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.md,
    marginBottom: Spacing.xl,
  },
  modalCancelBtn: {
    flex: 1,
  },
  modalSubmitBtn: {
    flex: 2,
  },
  summaryContainer: {
    paddingVertical: Spacing.md,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  summaryStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  summaryStatusText: {
    fontSize: FontSize.xs,
    fontWeight: '800',
  },
  summaryWarningId: {
    fontSize: FontSize.micro,
    color: Colors.text.tertiary,
  },
  summaryHeadline: {
    fontSize: FontSize.md,
    fontWeight: '900',
    color: '#FFF',
    marginBottom: Spacing.lg,
  },
  summaryTableTitle: {
    fontSize: FontSize.micro,
    fontWeight: '800',
    color: Colors.text.tertiary,
    letterSpacing: 0.8,
    marginBottom: Spacing.xs,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  summaryRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryChannelName: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: '#FFF',
  },
  summaryRowRight: {},
  summaryResultStatus: {
    fontSize: FontSize.xs,
    fontWeight: '800',
  },
  summaryCloseBtn: {
    marginTop: Spacing.xl,
  },
});
