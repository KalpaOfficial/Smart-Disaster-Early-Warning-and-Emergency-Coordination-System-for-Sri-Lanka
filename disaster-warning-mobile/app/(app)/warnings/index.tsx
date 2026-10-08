/**
 * UC01 – Issue Hazard Warning (Main Screen & Control Center)
 * Implements the exact 20-step business workflow, channel delivery execution,
 * recipient deduplication (river basin alternate flow), and exception handling.
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
import { useRouter } from 'expo-router';
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
  updateWarningStatus,
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
  const isDmcOfficer = user?.role === 'dmc_officer';

  // Core State
  const [warnings, setWarnings] = useState<HazardWarning[]>([]);
  const [activeEvents, setActiveEvents] = useState<HazardEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [groundReports, setGroundReports] = useState<VerifiedGroundReportStub[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeverityFilter, setSelectedSeverityFilter] = useState<string>('all');

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

  // Load data
  const loadData = useCallback(async () => {
    try {
      const [warnList, eventList] = await Promise.all([
        getAllWarnings(),
        getActiveEvents(),
      ]);
      setWarnings(warnList);
      setActiveEvents(eventList);

      if (eventList.length > 0 && !selectedEventId) {
        setSelectedEventId(eventList[0].id);
      }
    } catch (err) {
      console.warn('Error loading warnings data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedEventId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Step 2: Fetch verified ground reports when selected hazard event changes
  useEffect(() => {
    if (selectedEventId) {
      getGroundReportsForEvent(selectedEventId).then((reports) => {
        setGroundReports(reports);
      });
      const currentEvt = activeEvents.find((e) => e.id === selectedEventId);
      if (currentEvt) {
        setHazardType(currentEvt.hazardType);
      }
    }
  }, [selectedEventId, activeEvents]);

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

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const selectedEvent = useMemo(
    () => activeEvents.find((e) => e.id === selectedEventId) || activeEvents[0],
    [activeEvents, selectedEventId],
  );

  // Open Composer Modal (UC01 Steps 3 & 4)
  const handleOpenComposer = () => {
    if (selectedEvent) {
      setHazardType(selectedEvent.hazardType);
      setTargetMode('district');
      setTargetAreas(selectedEvent.affectedDistricts.length > 0 ? selectedEvent.affectedDistricts : ['Ratnapura', 'Kalutara']);
      setHeadline(`RED EVACUATION WARNING: ${selectedEvent.title}`);
      setInstructions('Immediate evacuation ordered for residents in low-lying sectors. Move immediately to designated emergency shelters.');
    }
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

  // Submit Warning (UC01 Steps 13 - 19)
  const handleSubmitWarning = async (forceFailure?: DeliveryChannel) => {
    // Step 14: Validation guards
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
      const issuerUid = user?.id || 'dmc-officer-uid';
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

      // Step 19: Close composer and display Delivery Summary Modal
      setShowModal(false);
      setSummaryData({
        warningId: result.warningId,
        overallStatus: result.overallStatus,
        channelResults: result.channelResults,
        headline: headline.trim(),
      });
      setShowSummaryModal(true);

      loadData();
    } catch (err) {
      const msg = (err as Error).message || 'Warning submission failed.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Submission Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Cancel Warning
  const handleCancelWarning = (id: string) => {
    const execute = async () => {
      try {
        await updateWarningStatus(id, 'cancelled');
        loadData();
      } catch (err) {
        Alert.alert('Error', (err as Error).message);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Cancel this active disaster warning broadcast?')) execute();
    } else {
      Alert.alert('Cancel Warning', 'Cancel this active disaster warning broadcast?', [
        { text: 'No', style: 'cancel' },
        { text: 'Cancel Warning', style: 'destructive', onPress: execute },
      ]);
    }
  };

  // Filtered Warnings
  const filteredWarnings = useMemo(() => {
    return warnings.filter((w) => {
      const matchesSearch =
        w.headline.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.instructions.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.targetAreas.some((d) => d.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesSeverity =
        selectedSeverityFilter === 'all' || w.severity === selectedSeverityFilter;

      return matchesSearch && matchesSeverity;
    });
  }, [warnings, searchQuery, selectedSeverityFilter]);

  const getSeverityStyle = (sev: WarningSeverity) => {
    switch (sev) {
      case 'evacuation':
        return { bg: 'rgba(239, 68, 68, 0.15)', border: '#EF4444', text: '#FCA5A5', label: 'RED — EVACUATION ORDER' };
      case 'warning':
        return { bg: 'rgba(245, 158, 11, 0.15)', border: '#F59E0B', text: '#FDE047', label: 'AMBER — SEVERE WARNING' };
      case 'advisory':
        return { bg: 'rgba(56, 189, 248, 0.15)', border: '#38BDF8', text: '#93C5FD', label: 'YELLOW — ADVISORY' };
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
            <Text style={styles.navPill}>UC01 — EARLY WARNING SYSTEM</Text>
            <Text style={styles.navTitle}>Hazard Warning Dispatch</Text>
          </View>
        </View>

        {/* Step 1 & 2: Open Hazard Event Selector & Ground Reports Panel */}
        <Card style={styles.eventCard}>
          <Text style={styles.stepTitle}>STEP 1 &amp; 2: SELECT OPEN HAZARD EVENT &amp; INSPECT TELEMETRY</Text>

          <Select
            label="Open Hazard Event *"
            options={activeEvents.map((e) => ({ label: `${e.title} (${e.hazardType.toUpperCase()})`, value: e.id }))}
            value={selectedEventId}
            onSelect={(val) => setSelectedEventId(val)}
          />

          {selectedEvent ? (
            <View style={styles.eventTelemetryBox}>
              <View style={styles.telemetryGrid}>
                <View style={styles.telemetryItem}>
                  <Text style={styles.telemetryLabel}>HAZARD TYPE</Text>
                  <Text style={styles.telemetryVal}>{selectedEvent.hazardType.toUpperCase()}</Text>
                </View>
                <View style={styles.telemetryItem}>
                  <Text style={styles.telemetryLabel}>WARNING LEVEL</Text>
                  <Text style={[styles.telemetryVal, { color: '#EF4444' }]}>LEVEL 4 ALERT</Text>
                </View>
                <View style={styles.telemetryItem}>
                  <Text style={styles.telemetryLabel}>AFFECTED AREAS</Text>
                  <Text style={styles.telemetryVal}>{selectedEvent.affectedDistricts.join(', ')}</Text>
                </View>
              </View>

              {/* Verified Ground Reports (Step 2) */}
              <Text style={styles.groundReportTitle}>
                VERIFIED GROUND REPORTS ({groundReports.length})
              </Text>
              {groundReports.map((report) => (
                <View key={report.id} style={styles.groundReportItem}>
                  <View style={styles.groundReportHeader}>
                    <View style={styles.groundReportBadge}>
                      <Ionicons name="checkmark-circle" size={12} color={Colors.success} />
                      <Text style={styles.groundReportBadgeText}>VERIFIED BY {report.verifiedBy}</Text>
                    </View>
                    <Text style={styles.groundReportTime}>
                      {new Date(report.reportedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <Text style={styles.groundReportDesc}>
                    📍 <Text style={{ fontWeight: '800', color: '#FFF' }}>{report.locationName}:</Text>{' '}
                    {report.description}
                  </Text>
                </View>
              ))}

              {/* Step 3: Issue Warning CTA Button */}
              {isDmcOfficer ? (
                <Button
                  title="Issue Hazard Warning for this Event"
                  variant="primary"
                  icon={<Ionicons name="megaphone-outline" size={18} color="#FFFFFF" />}
                  onPress={handleOpenComposer}
                  style={styles.issueBtn}
                />
              ) : (
                <View style={styles.nonOfficerNotice}>
                  <Ionicons name="information-circle-outline" size={16} color={Colors.text.tertiary} />
                  <Text style={styles.nonOfficerText}>
                    Warning issuance is restricted to DMC Duty Officers. You are viewing live event reports.
                  </Text>
                </View>
              )}
            </View>
          ) : null}
        </Card>

        {/* Warning Feed & Search */}
        <View style={styles.filterSection}>
          <Input
            placeholder="Search warnings, districts, or instructions..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            icon={<Ionicons name="search-outline" size={18} color={Colors.text.tertiary} />}
            containerStyle={styles.searchInput}
          />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsScroll}>
            {[
              { id: 'all', label: 'All Warnings' },
              { id: 'evacuation', label: '🔴 Red Evacuation' },
              { id: 'warning', label: '🟠 Amber Warning' },
              { id: 'advisory', label: '🟡 Yellow Advisory' },
            ].map((tab) => (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setSelectedSeverityFilter(tab.id)}
                style={[styles.filterPill, selectedSeverityFilter === tab.id && styles.filterPillActive]}
              >
                <Text style={[styles.filterPillText, selectedSeverityFilter === tab.id && styles.filterPillTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Warning Cards Stream */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md }}>
          <Text style={styles.sectionTitle}>ISSUED DISASTER WARNING TIMELINE</Text>
          {loading && <ActivityIndicator size="small" color={Colors.accent.primary} />}
        </View>

        {filteredWarnings.length > 0 ? (
          filteredWarnings.map((w) => {
            const sev = getSeverityStyle(w.severity);
            const st = getStatusBadge(w.status);

            return (
              <Card key={w.id} style={styles.warningCard}>
                <View style={styles.cardHeaderRow}>
                  <View style={[styles.sevBadge, { backgroundColor: sev.bg, borderColor: sev.border }]}>
                    <View style={[styles.sevDot, { backgroundColor: sev.border }]} />
                    <Text style={[styles.sevText, { color: sev.text }]}>{sev.label}</Text>
                  </View>
                  <Text style={[styles.statusTag, { color: st.color }]}>{st.label}</Text>
                </View>

                <Text style={styles.cardTitle}>{w.headline}</Text>

                <View style={styles.targetInfoRow}>
                  <Text style={styles.targetInfoLabel}>TARGET MODE:</Text>
                  <Text style={styles.targetInfoVal}>{w.targetMode.toUpperCase()}</Text>
                  <Text style={styles.targetInfoLabel}>• RECIPIENTS:</Text>
                  <Text style={styles.targetInfoVal}>{w.recipientCount.toLocaleString()}</Text>
                </View>

                <View style={styles.districtsRow}>
                  <Ionicons name="location-sharp" size={13} color="#F43F5E" />
                  <Text style={styles.districtsLabel}>Areas Alerted:</Text>
                  {w.targetAreas.map((a) => (
                    <View key={a} style={styles.districtTag}>
                      <Text style={styles.districtTagText}>{a}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.instructionBox}>
                  <Text style={styles.instructionTitle}>EMERGENCY SAFETY INSTRUCTIONS</Text>
                  <Text style={styles.instructionBody}>{w.instructions}</Text>
                </View>

                {/* Per-Channel Status Pills */}
                {w.channelResults && w.channelResults.length > 0 ? (
                  <View style={styles.channelPillsRow}>
                    {w.channelResults.map((ch) => (
                      <View
                        key={ch.channel}
                        style={[
                          styles.channelPill,
                          ch.status === 'success' ? styles.channelPillSuccess : styles.channelPillFailed,
                        ]}
                      >
                        <Ionicons
                          name={ch.status === 'success' ? 'checkmark-circle' : 'alert-circle'}
                          size={12}
                          color={ch.status === 'success' ? Colors.success : Colors.danger}
                        />
                        <Text
                          style={[
                            styles.channelPillText,
                            { color: ch.status === 'success' ? Colors.success : Colors.danger },
                          ]}
                        >
                          {ch.channel.toUpperCase()}: {ch.status.toUpperCase()}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                <View style={styles.cardFooter}>
                  <View style={styles.metaCol}>
                    <Text style={styles.metaIssuer}>{w.issuedByName}</Text>
                    <Text style={styles.metaTime}>Issued: {new Date(w.dispatchedAt || w.createdAt).toLocaleString()}</Text>
                  </View>
                  {isDmcOfficer && w.status !== 'cancelled' ? (
                    <TouchableOpacity style={styles.cancelBtn} onPress={() => handleCancelWarning(w.id)}>
                      <Ionicons name="close-circle-outline" size={14} color="#EF4444" />
                      <Text style={styles.cancelBtnText}>Cancel Alert</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </Card>
            );
          })
        ) : (
          <EmptyState
            iconName="megaphone-outline"
            title="No Disaster Warnings Issued"
            message="No disaster warnings match your search or filter criteria."
          />
        )}
      </ScrollView>

      {/* Warning Composer FormModal (UC01 Steps 4 - 13) */}
      <FormModal visible={showModal} onClose={() => setShowModal(false)} title="UC01 — Warning Composer">
        <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
          {/* Step 4: Prefilled Hazard Type Indicator */}
          <View style={styles.prefillBanner}>
            <Ionicons name="information-circle" size={16} color={Colors.accent.primary} />
            <Text style={styles.prefillBannerText}>
              PREFILLED HAZARD TYPE: <Text style={{ fontWeight: '900', color: '#FFF' }}>{hazardType.toUpperCase()}</Text> (From Event: {selectedEvent?.title})
            </Text>
          </View>

          {/* Step 5: Select Severity */}
          <Select
            label="Step 5: Warning Severity Level *"
            options={SEVERITY_OPTIONS}
            value={severity}
            onSelect={(val) => setSeverity(val as WarningSeverity)}
          />

          {/* Step 6: Select Target Mode (District vs River Basin) */}
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

          {/* Step 7: Select Target Areas */}
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

          {/* Step 8 & 9: Recipient Resolution Badge */}
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

                {/* Exception 1 Guard Notice */}
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

          {/* Step 10: Warning Headline */}
          <Input
            label="Step 10: Warning Headline *"
            placeholder="e.g. RED EVACUATION ALERT: Kalu River Basin Critical Level"
            value={headline}
            onChangeText={setHeadline}
            icon={<Ionicons name="alert-circle-outline" size={18} color={Colors.text.tertiary} />}
          />

          {/* Step 11: Instruction Text */}
          <Input
            label="Step 11: Emergency Safety Instructions *"
            placeholder="e.g. Immediate evacuation required for low-lying areas. Move immediately to Bodhiraja School Emergency Shelter..."
            value={instructions}
            onChangeText={setInstructions}
            multiline
            numberOfLines={4}
            containerStyle={styles.multilineInput}
          />

          {/* Step 12: Delivery Channels Checkboxes */}
          <Text style={styles.fieldLabel}>Step 12: Delivery Channels *</Text>
          <View style={styles.channelsRow}>
            {[
              { id: 'push' as const, label: '📱 Push Notification', icon: 'notifications-outline' },
              { id: 'sms' as const, label: '💬 SMS Broadcast', icon: 'chatbox-ellipses-outline' },
              { id: 'audible' as const, label: '🔊 Audible Siren', icon: 'volume-high-outline' },
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

          {/* Testing Actions for Exception Flows */}
          <View style={styles.testActionsRow}>
            <Text style={styles.testActionsLabel}>TEST EXCEPTION FLOWS:</Text>
            <TouchableOpacity onPress={() => handleSubmitWarning('sms')} style={styles.testActionBtn}>
              <Text style={styles.testActionBtnText}>Simulate 1 Channel Fail (SMS)</Text>
            </TouchableOpacity>
          </View>

          {/* Step 13: Submit Warning */}
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

      {/* Navigation Dock */}
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
  eventCard: {
    marginBottom: Spacing.xl,
  },
  stepTitle: {
    fontSize: FontSize.micro,
    fontWeight: '800',
    color: Colors.accent.primary,
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
  },
  eventTelemetryBox: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginTop: Spacing.xs,
  },
  telemetryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
    gap: Spacing.xs,
  },
  telemetryItem: {
    flex: 1,
    backgroundColor: '#0F172A',
    padding: Spacing.xs + 2,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  telemetryLabel: {
    fontSize: FontSize.micro,
    color: Colors.text.tertiary,
    fontWeight: '700',
  },
  telemetryVal: {
    fontSize: FontSize.xs,
    color: '#FFF',
    fontWeight: '800',
    marginTop: 2,
  },
  groundReportTitle: {
    fontSize: FontSize.micro,
    fontWeight: '800',
    color: Colors.text.tertiary,
    letterSpacing: 0.8,
    marginBottom: Spacing.xs,
  },
  groundReportItem: {
    backgroundColor: '#0F172A',
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  groundReportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  groundReportBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  groundReportBadgeText: {
    fontSize: FontSize.micro,
    color: Colors.success,
    fontWeight: '700',
  },
  groundReportTime: {
    fontSize: FontSize.micro,
    color: Colors.text.tertiary,
  },
  groundReportDesc: {
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
    lineHeight: 16,
  },
  issueBtn: {
    marginTop: Spacing.md,
  },
  nonOfficerNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.md,
    padding: Spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: BorderRadius.xs,
  },
  nonOfficerText: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
  },
  filterSection: {
    marginBottom: Spacing.lg,
  },
  searchInput: {
    marginBottom: Spacing.sm,
  },
  pillsScroll: {
    gap: Spacing.xs,
  },
  filterPill: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  filterPillActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: Colors.accent.primary,
  },
  filterPillText: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    fontWeight: '600',
  },
  filterPillTextActive: {
    color: Colors.accent.primary,
    fontWeight: '800',
  },
  sectionTitle: {
    fontSize: FontSize.micro,
    fontWeight: '800',
    color: Colors.text.tertiary,
    letterSpacing: 1,
    marginBottom: Spacing.md,
  },
  warningCard: {
    marginBottom: Spacing.lg,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  sevBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    gap: 6,
  },
  sevDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  sevText: {
    fontSize: FontSize.micro,
    fontWeight: '800',
  },
  statusTag: {
    fontSize: FontSize.micro,
    fontWeight: '800',
  },
  cardTitle: {
    fontSize: FontSize.md,
    fontWeight: '900',
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
    lineHeight: 22,
  },
  targetInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: Spacing.xs,
  },
  targetInfoLabel: {
    fontSize: FontSize.micro,
    color: Colors.text.tertiary,
    fontWeight: '700',
  },
  targetInfoVal: {
    fontSize: FontSize.micro,
    color: Colors.accent.primary,
    fontWeight: '800',
  },
  districtsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.sm,
    flexWrap: 'wrap',
  },
  districtsLabel: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    fontWeight: '700',
  },
  districtTag: {
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
    paddingVertical: 2,
    paddingHorizontal: Spacing.xs,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.25)',
  },
  districtTagText: {
    fontSize: FontSize.micro,
    color: '#F43F5E',
    fontWeight: '700',
  },
  instructionBox: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.2)',
    marginBottom: Spacing.sm,
  },
  instructionTitle: {
    fontSize: FontSize.micro,
    fontWeight: '800',
    color: '#38BDF8',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  instructionBody: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    lineHeight: 18,
  },
  channelPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: Spacing.sm,
  },
  channelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: Spacing.xs + 2,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
  },
  channelPillSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  channelPillFailed: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  channelPillText: {
    fontSize: FontSize.micro,
    fontWeight: '800',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  metaCol: {
    flex: 1,
  },
  metaIssuer: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.text.secondary,
  },
  metaTime: {
    fontSize: FontSize.micro,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  cancelBtnText: {
    fontSize: FontSize.xs,
    color: '#EF4444',
    fontWeight: '700',
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
  testActionsRow: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
  },
  testActionsLabel: {
    fontSize: FontSize.micro,
    fontWeight: '800',
    color: Colors.text.tertiary,
    marginBottom: 4,
  },
  testActionBtn: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.xs,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  testActionBtnText: {
    fontSize: FontSize.micro,
    color: '#F59E0B',
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
