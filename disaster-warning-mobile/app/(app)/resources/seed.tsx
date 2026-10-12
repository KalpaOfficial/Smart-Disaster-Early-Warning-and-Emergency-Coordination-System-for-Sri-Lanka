import { AppAlert } from '@/utils/appNotice';
import { ReportScreenHero } from '@/components/ReportScreenHero';
/**
 * Database Seed & Operational Telemetry Diagnostic Screen.
 * Allows DMC officers to populate linked demo scenarios across UC01-UC04.
 */
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ScreenContainer,
  Card,
  Button,
  MobileNavBar,
  ResourceColors as Colors,
} from '@/components/ResourceComponents';
import { FontSize, Spacing, BorderRadius, LightColors } from '@/constants/colors';
import {
  seedFirestoreDatabase,
  isDatabaseSeeded,
  SEED_DATA,
  type SeedResult,
} from '@/utils/seedFirestore';
import { useAuth } from '@/hooks/useAuth';

export default function SeedScreen() {
  const router = useRouter();
  const { state } = useAuth();
  const canSeed = state.user?.role === 'dmc_officer';
  const [seeding, setSeeding] = useState(false);
  const [checking, setChecking] = useState(true);
  const [alreadySeeded, setAlreadySeeded] = useState(false);
  const [seedResult, setSeedResult] = useState<SeedResult | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  useEffect(() => {
    if (canSeed) checkStatus();
    else setChecking(false);
  }, [canSeed]);

  const checkStatus = async () => {
    setChecking(true);
    setStatusError(null);
    try {
      setAlreadySeeded(await isDatabaseSeeded());
    } catch (error) {
      setStatusError((error as Error).message || 'Could not check the database.');
    } finally {
      setChecking(false);
    }
  };

  const handleSeed = async () => {
    if (!canSeed || seeding) return;
    setSeeding(true);
    setSeedResult(null);
    try {
      const res = await seedFirestoreDatabase();
      setSeedResult(res);
      setAlreadySeeded(true);
      setStatusError(null);
      AppAlert.alert(
        'Database Synchronized',
        `Demo data populated:\n• ${res.events} Hazard Events\n• ${res.warnings} Warnings\n• ${res.deliveryLogs} Delivery Logs\n• ${res.timelines} Timeline Entries\n• ${res.groundReports} Ground Reports\n• ${res.shelters} Shelters\n• ${res.teams} Rescue Teams\n• ${res.supplies} Supply Inventories\n• ${res.distributions} Supply Distributions\n• ${res.postEventReports} Post-Event Reports\n• ${res.donorDistributions} Donor Audit Examples\n\n${res.users} existing users preserved.`
      );
    } catch (error) {
      AppAlert.alert(
        'Seeding Error',
        (error as Error).message ||
          'Failed to write demo data to Firestore. No local fallback was used.'
      );
    } finally {
      setSeeding(false);
    }
  };

  const manifestItems = [
    {
      title: `Hazard Events (${SEED_DATA.hazardEvents.length})`,
      desc: 'Active flood and landslide scenarios plus a closed eastern coastal exercise',
      icon: 'water-outline' as const,
      color: '#38BDF8',
    },
    {
      title: `Warnings (${SEED_DATA.warnings.length})`,
      desc: 'Advisory, escalation, evacuation, failed delivery and cancelled examples',
      icon: 'warning-outline' as const,
      color: '#F59E0B',
    },
    {
      title: `Delivery Logs (${SEED_DATA.deliveryLogs.length})`,
      desc: 'Linked push, SMS and audible channel outcomes',
      icon: 'notifications-outline' as const,
      color: '#38BDF8',
    },
    {
      title: `Event Timelines (${SEED_DATA.timelines.length})`,
      desc: 'Warning and verified observation history for each event',
      icon: 'time-outline' as const,
      color: '#A855F7',
    },
    {
      title: `Ground Reports (${SEED_DATA.groundReports.length} + personal reports)`,
      desc: 'All verification states plus a pending submission for each existing citizen or volunteer',
      icon: 'document-text-outline' as const,
      color: '#10B981',
    },
    {
      title: `Emergency Shelters (${SEED_DATA.shelters.length})`,
      desc: 'Registered, active, empty, over-capacity and inactive shelters',
      icon: 'home-outline' as const,
      color: '#10B981',
    },
    {
      title: `Rescue Teams (${SEED_DATA.rescueTeams.length})`,
      desc: 'Available, dispatched, en-route, on-site, completed and unavailable teams',
      icon: 'shield-outline' as const,
      color: '#F43F5E',
    },
    {
      title: `Relief Supplies (${SEED_DATA.reliefSupplies.length})`,
      desc: 'All supply categories, including exhausted stock and closed-event inventories',
      icon: 'cube-outline' as const,
      color: '#F59E0B',
    },
    {
      title: `Distribution Records (${SEED_DATA.distributions.length})`,
      desc: 'Distribution quantities reconcile with each inventory balance',
      icon: 'receipt-outline' as const,
      color: '#A855F7',
    },
    {
      title: `Post-Event Reports (${SEED_DATA.postEventReports.length})`,
      desc: 'Closed-event report with alert, reach, occupancy and distribution metrics',
      icon: 'bar-chart-outline' as const,
      color: '#38BDF8',
    },
    {
      title: `Donor Audit Examples (${SEED_DATA.donorDistributions.length})`,
      desc: 'PDF and CSV failure examples; no files or messages are sent',
      icon: 'share-outline' as const,
      color: '#10B981',
    },
  ];

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={{ marginHorizontal: -Spacing.xl, marginBottom: 20 }}>
          <ReportScreenHero
            title="Demo data setup"
            caption="Development tools"
            icon="cloud-upload-outline"
            description="Manage the linked fictional scenarios used for demonstrations."
            onBack={() => router.back()}
          />
        </View>
        <Card style={styles.introCard}>
          <LinearGradient colors={['#0866FF', '#2476D5']} style={styles.introIconOrb}>
            <Ionicons name="cloud-upload-outline" size={32} color="#FFFFFF" />
          </LinearGradient>

          <Text style={styles.introTitle}>Complete Demo Data Initialization</Text>
          <Text style={styles.introDesc}>
            Populate all app modules with linked fictional Sri Lankan scenarios. Existing user
            accounts are preserved. Re-seeding resets these demo records; warnings are not sent.
          </Text>

          {checking ? (
            <ActivityIndicator
              color={Colors.accent.primary}
              style={{ marginVertical: Spacing.md }}
            />
          ) : (
            <View
              style={[
                styles.statusPill,
                {
                  backgroundColor: alreadySeeded
                    ? 'rgba(16, 185, 129, 0.15)'
                    : 'rgba(245, 158, 11, 0.15)',
                  borderColor: alreadySeeded ? Colors.success : Colors.warning,
                },
              ]}
            >
              <Ionicons
                name={alreadySeeded ? 'checkmark-circle' : 'alert-circle'}
                size={14}
                color={alreadySeeded ? Colors.success : Colors.warning}
              />
              <Text
                style={[
                  styles.statusText,
                  { color: alreadySeeded ? Colors.success : Colors.warning },
                ]}
              >
                {!canSeed
                  ? 'Sign in as a DMC officer to seed'
                  : statusError
                    ? 'Database status unavailable'
                    : alreadySeeded
                      ? 'Complete Demo Dataset Present'
                      : 'Demo Dataset Missing or Incomplete'}
              </Text>
            </View>
          )}
          {statusError && <Text style={styles.introDesc}>{statusError}</Text>}
        </Card>

        <Text style={styles.sectionHeader}>DATASET MANIFEST</Text>

        <View style={styles.manifestList}>
          {manifestItems.map((item, index) => (
            <Card key={index} style={styles.manifestCard}>
              <View style={[styles.manifestIconWrap, { backgroundColor: `${item.color}20` }]}>
                <Ionicons name={item.icon} size={22} color={item.color} />
              </View>
              <View style={styles.manifestInfo}>
                <Text style={styles.manifestTitle}>{item.title}</Text>
                <Text style={styles.manifestSubtitle}>{item.desc}</Text>
              </View>
            </Card>
          ))}
        </View>

        {seedResult && (
          <Card style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <Ionicons name="checkmark-done-circle" size={20} color={Colors.success} />
              <Text style={styles.resultTitle}>Seeding Diagnostics Summary</Text>
            </View>
            <View style={styles.resultList}>
              <Text style={styles.resultItem}>
                • {seedResult.events} Active and closed hazard events synchronized
              </Text>
              <Text style={styles.resultItem}>
                • {seedResult.warnings} Warnings and {seedResult.deliveryLogs} delivery logs
              </Text>
              <Text style={styles.resultItem}>• {seedResult.timelines} Event timeline entries</Text>
              <Text style={styles.resultItem}>
                • {seedResult.groundReports} Ground reports linked to existing users
              </Text>
              <Text style={styles.resultItem}>
                • {seedResult.shelters} Safe Havens registered & active
              </Text>
              <Text style={styles.resultItem}>
                • {seedResult.teams} SAR Units commissioned to grid
              </Text>
              <Text style={styles.resultItem}>
                • {seedResult.supplies} Relief Inventories established
              </Text>
              <Text style={styles.resultItem}>
                • {seedResult.distributions} Historical Dispatches logged
              </Text>
              <Text style={styles.resultItem}>
                • {seedResult.postEventReports} Post-event reports
              </Text>
              <Text style={styles.resultItem}>
                • {seedResult.donorDistributions} Donor audit examples
              </Text>
              <Text style={styles.resultItem}>• {seedResult.users} Existing users preserved</Text>
            </View>
          </Card>
        )}

        <Button
          title={
            seeding
              ? 'Writing Data to Firestore...'
              : alreadySeeded
                ? 'Reset Demo Dataset'
                : 'Seed Complete Demo Dataset'
          }
          variant="primary"
          loading={seeding}
          disabled={!canSeed || checking || seeding}
          icon={<Ionicons name="flash" size={18} color="#FFFFFF" />}
          onPress={handleSeed}
          style={styles.seedBtn}
        />

        <Button
          title="Return to Resource Coordination"
          variant="outline"
          icon={<Ionicons name="arrow-back" size={16} color={Colors.accent.primary} />}
          onPress={() => router.push('/(app)/resources')}
          style={styles.returnBtn}
        />
      </ScrollView>

      {/* Floating Bottom Dock */}
      <MobileNavBar />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: LightColors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: '900',
    color: Colors.text.primary,
  },
  headerSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    marginTop: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: 110,
  },
  introCard: {
    alignItems: 'center',
    padding: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  introIconOrb: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  introTitle: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  introDesc: {
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: Spacing.md,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    gap: 6,
  },
  statusText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  sectionHeader: {
    fontSize: FontSize.micro + 1,
    fontWeight: '800',
    color: Colors.text.tertiary,
    letterSpacing: 1.2,
    marginBottom: Spacing.md,
  },
  manifestList: {
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  manifestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
  },
  manifestIconWrap: {
    width: 42,
    height: 42,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manifestInfo: {
    flex: 1,
  },
  manifestTitle: {
    fontSize: FontSize.md,
    fontWeight: '800',
    color: Colors.text.primary,
    marginBottom: 2,
  },
  manifestSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    lineHeight: 16,
  },
  resultCard: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderWidth: 1,
    marginBottom: Spacing.xl,
    padding: Spacing.md,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.sm,
  },
  resultTitle: {
    fontSize: FontSize.md,
    fontWeight: '800',
    color: Colors.success,
  },
  resultList: {
    gap: 3,
  },
  resultItem: {
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
  },
  seedBtn: {
    marginBottom: Spacing.md,
  },
  returnBtn: {
    marginBottom: Spacing.xl,
  },
});
