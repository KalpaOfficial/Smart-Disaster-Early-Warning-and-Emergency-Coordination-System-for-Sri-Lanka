/**
 * UC01 – Issue Hazard Warning (Main Screen)
 * Allows DMC Officers to issue, broadcast, and manage location-specific disaster warnings,
 * while allowing citizens, responders, and officers to monitor real-time hazard alerts.
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
import {
  getAllWarnings,
  createWarning,
  updateWarningStatus,
} from '@/services/warningService';
import { getActiveEvents } from '@/services/hazardEventService';
import type { HazardWarning, WarningSeverity, WarningStatus, CreateWarningData } from '@/types/warning';
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

const HAZARD_TYPE_OPTIONS = [
  { label: 'Flood Emergency', value: 'flood' },
  { label: 'Landslide Warning', value: 'landslide' },
  { label: 'Cyclone / High Winds', value: 'cyclone' },
  { label: 'Tsunami Alert', value: 'tsunami' },
  { label: 'Drought Advisory', value: 'drought' },
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

  // State
  const [warnings, setWarnings] = useState<HazardWarning[]>([]);
  const [activeEvents, setActiveEvents] = useState<HazardEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeverityFilter, setSelectedSeverityFilter] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State for New Warning (UC01)
  const [formData, setFormData] = useState<CreateWarningData>({
    title: '',
    hazardType: 'flood',
    severity: 'warning',
    targetDistricts: ['Ratnapura', 'Kalutara'],
    instructions: '',
    hazardEventId: '',
    hazardEventTitle: '',
  });

  const loadData = useCallback(async () => {
    try {
      const [warnList, eventList] = await Promise.all([
        getAllWarnings(),
        getActiveEvents(),
      ]);
      setWarnings(warnList);
      setActiveEvents(eventList);
    } catch (err) {
      console.warn('Error loading warnings data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Filtered Warnings
  const filteredWarnings = useMemo(() => {
    return warnings.filter((w) => {
      const matchesSearch =
        w.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.instructions.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.targetDistricts.some((d) => d.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesSeverity =
        selectedSeverityFilter === 'all' || w.severity === selectedSeverityFilter;

      return matchesSearch && matchesSeverity;
    });
  }, [warnings, searchQuery, selectedSeverityFilter]);

  // Telemetry metrics
  const evacuationCount = useMemo(
    () => warnings.filter((w) => w.status === 'active' && w.severity === 'evacuation').length,
    [warnings],
  );
  const amberCount = useMemo(
    () => warnings.filter((w) => w.status === 'active' && w.severity === 'warning').length,
    [warnings],
  );
  const affectedDistrictsSet = useMemo(() => {
    const set = new Set<string>();
    warnings.filter((w) => w.status === 'active').forEach((w) => w.targetDistricts.forEach((d) => set.add(d)));
    return set.size;
  }, [warnings]);

  // District Toggle for Form
  const toggleDistrictSelection = (district: string) => {
    setFormData((prev) => {
      const exists = prev.targetDistricts.includes(district);
      if (exists) {
        if (prev.targetDistricts.length === 1) {
          Alert.alert('District Required', 'At least one target district must be selected.');
          return prev;
        }
        return { ...prev, targetDistricts: prev.targetDistricts.filter((d) => d !== district) };
      } else {
        return { ...prev, targetDistricts: [...prev.targetDistricts, district] };
      }
    });
  };

  // Submit New Warning (UC01 Action)
  const handleSubmitWarning = async () => {
    if (!formData.title.trim()) {
      Alert.alert('Validation Error', 'Please enter a warning headline/title.');
      return;
    }
    if (formData.targetDistricts.length === 0) {
      Alert.alert('Validation Error', 'Please select at least one target district.');
      return;
    }
    if (!formData.instructions.trim()) {
      Alert.alert('Validation Error', 'Please provide safety instructions for citizens.');
      return;
    }

    setSubmitting(true);
    try {
      const issuerUid = user?.id || 'dmc-officer-uid';
      const issuerName = user?.fullName ? `${user.fullName} (DMC Duty Officer)` : 'DMC Command Centre';

      await createWarning(formData, issuerUid, issuerName);

      if (Platform.OS === 'web') {
        window.alert('🚨 Hazard Warning Issued and Broadcast Successfully!');
      } else {
        Alert.alert('Success', '🚨 Hazard Warning Issued and Broadcast Successfully!');
      }

      setShowModal(false);
      setFormData({
        title: '',
        hazardType: 'flood',
        severity: 'warning',
        targetDistricts: ['Ratnapura', 'Kalutara'],
        instructions: '',
        hazardEventId: '',
        hazardEventTitle: '',
      });
      loadData();
    } catch (err) {
      const msg = (err as Error).message || 'Failed to issue warning.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Issuance Failed', msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle warning status (Cancel / Expire)
  const handleUpdateStatus = (id: string, newStatus: WarningStatus) => {
    const actionLabel = newStatus === 'cancelled' ? 'Cancel' : 'Expire';
    const execute = async () => {
      try {
        await updateWarningStatus(id, newStatus);
        loadData();
      } catch (err) {
        Alert.alert('Error', (err as Error).message);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Are you sure you want to ${actionLabel.toLowerCase()} this warning?`)) {
        execute();
      }
    } else {
      Alert.alert(`Confirm ${actionLabel}`, `Are you sure you want to ${actionLabel.toLowerCase()} this warning?`, [
        { text: 'Back', style: 'cancel' },
        { text: actionLabel, style: 'destructive', onPress: execute },
      ]);
    }
  };

  const getSeverityStyle = (severity: WarningSeverity) => {
    switch (severity) {
      case 'evacuation':
        return { bg: 'rgba(239, 68, 68, 0.15)', border: '#EF4444', text: '#FCA5A5', label: 'RED — EVACUATION ORDER' };
      case 'warning':
        return { bg: 'rgba(245, 158, 11, 0.15)', border: '#F59E0B', text: '#FDE047', label: 'AMBER — SEVERE WARNING' };
      case 'advisory':
        return { bg: 'rgba(56, 189, 248, 0.15)', border: '#38BDF8', text: '#93C5FD', label: 'YELLOW — ADVISORY' };
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
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color={Colors.text.primary} />
          </TouchableOpacity>
          <View style={styles.navTitleBox}>
            <Text style={styles.navPill}>UC01 — EARLY WARNING SYSTEM</Text>
            <Text style={styles.navTitle}>Hazard Warnings &amp; Alerts</Text>
          </View>
        </View>

        {/* Hero Operational Banner */}
        <LinearGradient
          colors={['#1E1B4B', '#0F172A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroBanner}
        >
          <View style={styles.heroHeaderRow}>
            <View style={styles.beaconPill}>
              <View style={styles.beaconDot} />
              <Text style={styles.beaconText}>DMC BROADCAST ENGINE • LIVE</Text>
            </View>
            <Text style={styles.heroRoleTag}>
              {isDmcOfficer ? 'AUTHORIZATION: DMC OFFICER' : 'VIEW MODE: PUBLIC FEED'}
            </Text>
          </View>

          <Text style={styles.heroTitle}>Disaster Early Warning Control</Text>
          <Text style={styles.heroDesc}>
            Location-specific emergency warnings, evacuation orders, and public safety advisories for Sri Lankan districts.
          </Text>

          {/* KPI Summary Strip */}
          <View style={styles.kpiRow}>
            <View style={styles.kpiBox}>
              <Text style={[styles.kpiNum, { color: '#EF4444' }]}>{evacuationCount}</Text>
              <Text style={styles.kpiLabel}>Red Evacuations</Text>
            </View>
            <View style={styles.kpiDivider} />
            <View style={styles.kpiBox}>
              <Text style={[styles.kpiNum, { color: '#F59E0B' }]}>{amberCount}</Text>
              <Text style={styles.kpiLabel}>Amber Warnings</Text>
            </View>
            <View style={styles.kpiDivider} />
            <View style={styles.kpiBox}>
              <Text style={[styles.kpiNum, { color: Colors.accent.primary }]}>{affectedDistrictsSet}</Text>
              <Text style={styles.kpiLabel}>Districts Alerted</Text>
            </View>
          </View>

          {/* Action Button for DMC Officer */}
          {isDmcOfficer ? (
            <Button
              title="Issue Official Hazard Warning"
              variant="primary"
              icon={<Ionicons name="megaphone-outline" size={18} color="#FFFFFF" />}
              onPress={() => setShowModal(true)}
              style={styles.issueBtn}
            />
          ) : (
            <View style={styles.nonOfficerNotice}>
              <Ionicons name="information-circle-outline" size={16} color={Colors.text.tertiary} />
              <Text style={styles.nonOfficerText}>
                Warning issuance is restricted to DMC Officers. You are viewing live official broadcasts.
              </Text>
            </View>
          )}
        </LinearGradient>

        {/* Filter & Search Bar */}
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
              { id: 'all', label: 'All Alerts' },
              { id: 'evacuation', label: '🔴 Red Evacuation' },
              { id: 'warning', label: '🟠 Amber Warning' },
              { id: 'advisory', label: '🟡 Yellow Advisory' },
            ].map((tab) => (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setSelectedSeverityFilter(tab.id)}
                style={[
                  styles.filterPill,
                  selectedSeverityFilter === tab.id && styles.filterPillActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    selectedSeverityFilter === tab.id && styles.filterPillTextActive,
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Warnings Feed */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>OFFICIAL DISASTER WARNING BROADCASTS</Text>
          {loading && <ActivityIndicator size="small" color={Colors.accent.primary} />}
        </View>

        {filteredWarnings.length > 0 ? (
          filteredWarnings.map((w) => {
            const sev = getSeverityStyle(w.severity);
            const isActive = w.status === 'active';

            return (
              <Card key={w.id} style={{ ...styles.warningCard, ...(isActive ? {} : styles.warningCardInactive) }}>
                {/* Top Badge Strip */}
                <View style={styles.cardHeaderRow}>
                  <View style={[styles.sevBadge, { backgroundColor: sev.bg, borderColor: sev.border }]}>
                    <View style={[styles.sevDot, { backgroundColor: sev.border }]} />
                    <Text style={[styles.sevText, { color: sev.text }]}>{sev.label}</Text>
                  </View>

                  <View style={styles.hazardTypeChip}>
                    <Ionicons name="warning-outline" size={12} color={Colors.text.secondary} />
                    <Text style={styles.hazardTypeText}>{w.hazardType.toUpperCase()}</Text>
                  </View>
                </View>

                {/* Title */}
                <Text style={styles.cardTitle}>{w.title}</Text>

                {/* Event Linkage if present */}
                {w.hazardEventTitle ? (
                  <View style={styles.eventLinkRow}>
                    <Ionicons name="git-network-outline" size={13} color={Colors.accent.primary} />
                    <Text style={styles.eventLinkText}>Linked Event: {w.hazardEventTitle}</Text>
                  </View>
                ) : null}

                {/* Affected Districts */}
                <View style={styles.districtsRow}>
                  <Ionicons name="location-sharp" size={14} color="#F43F5E" />
                  <Text style={styles.districtsLabel}>Affected Districts:</Text>
                  <View style={styles.districtTagsWrap}>
                    {w.targetDistricts.map((d) => (
                      <View key={d} style={styles.districtTag}>
                        <Text style={styles.districtTagText}>{d}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Emergency Instructions Box */}
                <View style={styles.instructionBox}>
                  <View style={styles.instructionHeader}>
                    <Ionicons name="shield-checkmark-outline" size={16} color="#38BDF8" />
                    <Text style={styles.instructionTitle}>EMERGENCY SAFETY INSTRUCTIONS</Text>
                  </View>
                  <Text style={styles.instructionBody}>{w.instructions}</Text>
                </View>

                {/* Footer Meta & Actions */}
                <View style={styles.cardFooter}>
                  <View style={styles.metaCol}>
                    <Text style={styles.metaIssuer}>{w.issuedByName}</Text>
                    <Text style={styles.metaTime}>
                      Issued: {new Date(w.issuedAt).toLocaleString()}
                    </Text>
                  </View>

                  {isDmcOfficer && isActive ? (
                    <TouchableOpacity
                      style={styles.cancelBtn}
                      onPress={() => handleUpdateStatus(w.id, 'cancelled')}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="close-circle-outline" size={14} color="#EF4444" />
                      <Text style={styles.cancelBtnText}>Cancel Alert</Text>
                    </TouchableOpacity>
                  ) : null}

                  {!isActive && (
                    <View style={styles.inactiveTag}>
                      <Text style={styles.inactiveTagText}>{w.status.toUpperCase()}</Text>
                    </View>
                  )}
                </View>
              </Card>
            );
          })
        ) : (
          <EmptyState
            iconName="megaphone-outline"
            title="No Warnings Found"
            message={
              searchQuery
                ? 'No disaster warnings match your search query or filter criteria.'
                : 'There are currently no active warnings issued.'
            }
          />
        )}
      </ScrollView>

      {/* Form Modal for UC01: Issue Hazard Warning */}
      <FormModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        title="Issue Official Hazard Warning"
      >
        <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
          {/* Headline Title */}
          <Input
            label="Warning Headline / Title *"
            placeholder="e.g. RED EVACUATION ORDER: Kelani River Flash Floods"
            value={formData.title}
            onChangeText={(text) => setFormData((prev) => ({ ...prev, title: text }))}
            icon={<Ionicons name="alert-circle-outline" size={18} color={Colors.text.tertiary} />}
          />

          {/* Hazard Type Select */}
          <Select
            label="Disaster Hazard Type *"
            options={HAZARD_TYPE_OPTIONS}
            value={formData.hazardType}
            onSelect={(val) => setFormData((prev) => ({ ...prev, hazardType: val as HazardType }))}
          />

          {/* Warning Severity Level Select */}
          <Select
            label="Warning Severity Level *"
            options={SEVERITY_OPTIONS}
            value={formData.severity}
            onSelect={(val) => setFormData((prev) => ({ ...prev, severity: val as WarningSeverity }))}
          />

          {/* Linked Hazard Event (Optional) */}
          <Select
            label="Linked Active Hazard Event (Optional)"
            options={[
              { label: 'None (Standalone Warning)', value: '' },
              ...activeEvents.map((e) => ({ label: e.title, value: e.id })),
            ]}
            value={formData.hazardEventId || ''}
            onSelect={(val) => {
              const selectedEvent = activeEvents.find((e) => e.id === val);
              setFormData((prev) => ({
                ...prev,
                hazardEventId: val,
                hazardEventTitle: selectedEvent ? selectedEvent.title : '',
                targetDistricts: selectedEvent?.affectedDistricts?.length
                  ? selectedEvent.affectedDistricts
                  : prev.targetDistricts,
              }));
            }}
          />

          {/* Target Districts Selection */}
          <Text style={styles.fieldLabel}>Target Affected Districts *</Text>
          <Text style={styles.fieldSub}>Select all Sri Lankan districts targeted by this warning:</Text>

          <View style={styles.districtsGrid}>
            {SRI_LANKA_DISTRICTS.map((d) => {
              const selected = formData.targetDistricts.includes(d);
              return (
                <TouchableOpacity
                  key={d}
                  onPress={() => toggleDistrictSelection(d)}
                  style={[styles.districtPickChip, selected && styles.districtPickChipSelected]}
                >
                  <Ionicons
                    name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                    size={14}
                    color={selected ? Colors.accent.primary : Colors.text.tertiary}
                  />
                  <Text style={[styles.districtPickText, selected && styles.districtPickTextSelected]}>
                    {d}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Emergency Instructions */}
          <Input
            label="Emergency Safety Instructions *"
            placeholder="e.g. Immediate evacuation required for low-lying sectors. Proceed immediately to designated school shelters..."
            value={formData.instructions}
            onChangeText={(text) => setFormData((prev) => ({ ...prev, instructions: text }))}
            multiline
            numberOfLines={4}
            containerStyle={styles.multilineInput}
          />

          {/* Submit Action */}
          <View style={styles.modalActionRow}>
            <Button
              title="Cancel"
              variant="outline"
              onPress={() => setShowModal(false)}
              style={styles.modalCancelBtn}
            />
            <Button
              title="Broadcast Warning"
              variant="primary"
              icon={<Ionicons name="megaphone-outline" size={18} color="#FFFFFF" />}
              loading={submitting}
              onPress={handleSubmitWarning}
              style={styles.modalSubmitBtn}
            />
          </View>
        </ScrollView>
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
    marginBottom: Spacing.lg,
  },
  kpiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  kpiBox: {
    flex: 1,
    alignItems: 'center',
  },
  kpiNum: {
    fontSize: FontSize.lg,
    fontWeight: '900',
  },
  kpiLabel: {
    fontSize: FontSize.micro,
    color: Colors.text.tertiary,
    marginTop: 2,
    fontWeight: '600',
  },
  kpiDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  issueBtn: {
    marginTop: Spacing.xs,
  },
  nonOfficerNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  nonOfficerText: {
    flex: 1,
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
    paddingVertical: 2,
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
  warningCard: {
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  warningCardInactive: {
    opacity: 0.6,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
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
    letterSpacing: 0.5,
  },
  hazardTypeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 2,
    paddingHorizontal: Spacing.xs + 2,
    borderRadius: BorderRadius.xs,
  },
  hazardTypeText: {
    fontSize: FontSize.micro,
    color: Colors.text.secondary,
    fontWeight: '700',
  },
  cardTitle: {
    fontSize: FontSize.md,
    fontWeight: '900',
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
    lineHeight: 22,
  },
  eventLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.sm,
  },
  eventLinkText: {
    fontSize: FontSize.xs,
    color: Colors.accent.primary,
    fontWeight: '600',
  },
  districtsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.md,
    flexWrap: 'wrap',
  },
  districtsLabel: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    fontWeight: '700',
  },
  districtTagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
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
    marginBottom: Spacing.md,
  },
  instructionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  instructionTitle: {
    fontSize: FontSize.micro,
    fontWeight: '800',
    color: '#38BDF8',
    letterSpacing: 0.6,
  },
  instructionBody: {
    fontSize: FontSize.sm,
    color: Colors.text.secondary,
    lineHeight: 18,
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
  inactiveTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.xs,
  },
  inactiveTagText: {
    fontSize: FontSize.micro,
    color: Colors.text.tertiary,
    fontWeight: '700',
  },
  formScroll: {
    paddingVertical: Spacing.sm,
  },
  fieldLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.text.secondary,
    marginBottom: 2,
    marginTop: Spacing.sm,
  },
  fieldSub: {
    fontSize: FontSize.micro,
    color: Colors.text.tertiary,
    marginBottom: Spacing.sm,
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
  multilineInput: {
    minHeight: 90,
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  modalCancelBtn: {
    flex: 1,
  },
  modalSubmitBtn: {
    flex: 2,
  },
});
