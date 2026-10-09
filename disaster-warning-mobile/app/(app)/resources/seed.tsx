/**
 * Database Seed & Operational Telemetry Diagnostic Screen.
 * Allows DMC and District Officers to populate real Sri Lankan disaster management data into Firestore.
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { MobileNavBar } from '@/components/MobileNavBar';
import { Colors, FontSize, Spacing, BorderRadius } from '@/constants/colors';
import { seedFirestoreDatabase, isDatabaseSeeded, SEED_DATA } from '@/utils/seedFirestore';

export default function SeedScreen() {
  const router = useRouter();
  const [seeding, setSeeding] = useState(false);
  const [checking, setChecking] = useState(true);
  const [alreadySeeded, setAlreadySeeded] = useState(false);
  const [seedResult, setSeedResult] = useState<{
    events: number;
    shelters: number;
    teams: number;
    supplies: number;
    distributions: number;
    groundReports?: number;
  } | null>(null);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    setChecking(true);
    const seeded = await isDatabaseSeeded();
    setAlreadySeeded(seeded);
    setChecking(false);
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const res = await seedFirestoreDatabase();
      setSeedResult(res);
      setAlreadySeeded(true);
      Alert.alert(
        'Database Synchronized',
        `Successfully populated:\n• ${res.events} Hazard Events\n• ${res.shelters} Safe Shelters\n• ${res.teams} SAR Units\n• ${res.supplies} Relief Stocks\n• ${res.distributions} Distribution Records\n• ${res.groundReports} Ground Reports (UC02)\n\nAuthentic Sri Lankan emergency telemetry is online.`,
      );
    } catch (error) {
      Alert.alert(
        'Seeding Error',
        (error as Error).message ||
          'Failed to write seed data to Firestore. Falling back to local offline storage.',
      );
    } finally {
      setSeeding(false);
    }
  };

  const manifestItems = [
    {
      title: `Hazard Events (${SEED_DATA.hazardEvents.length})`,
      desc: 'Monsoon Flooding (Kalu/Kelani Basins), Landslides (Kegalle/Badulla)',
      icon: 'water-outline' as const,
      color: '#38BDF8',
    },
    {
      title: `Emergency Shelters (${SEED_DATA.shelters.length})`,
      desc: 'Bodhiraja MV (Ratnapura), Kalutara Town Hall, Dharmaloka MV, Terrence De Silva',
      icon: 'home-outline' as const,
      color: '#10B981',
    },
    {
      title: `Rescue Teams (${SEED_DATA.rescueTeams.length})`,
      desc: 'SL Army 58th Div, SL Navy RABS Unit 4, SLAF Helo SAR, Red Cross DRT, NBRO',
      icon: 'shield-outline' as const,
      color: '#F43F5E',
    },
    {
      title: `Relief Supplies (${SEED_DATA.reliefSupplies.length})`,
      desc: 'WFP Dry Rations, Purified Water (5L), First Aid Trauma Kits, Family Tents',
      icon: 'cube-outline' as const,
      color: '#F59E0B',
    },
    {
      title: `Distribution Records (${SEED_DATA.distributions.length})`,
      desc: 'Historical convoy dispatches to Ratnapura and Kalutara shelter safe zones',
      icon: 'receipt-outline' as const,
      color: '#A855F7',
    },
  ];

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={Colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>System Data Seeder</Text>
          <Text style={styles.headerSubtitle}>Real Sri Lanka Operational Dataset</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.introCard}>
          <LinearGradient
            colors={['#0284C7', '#0F172A']}
            style={styles.introIconOrb}
          >
            <Ionicons name="cloud-upload-outline" size={32} color="#FFFFFF" />
          </LinearGradient>

          <Text style={styles.introTitle}>Live Disaster Data Initialization</Text>
          <Text style={styles.introDesc}>
            Populate Cloud Firestore and local persistence cache with authentic Sri Lankan disaster
            management datasets matching the UC03 specification from the DMC case study.
          </Text>

          {checking ? (
            <ActivityIndicator color={Colors.accent.primary} style={{ marginVertical: Spacing.md }} />
          ) : (
            <View
              style={[
                styles.statusPill,
                {
                  backgroundColor: alreadySeeded ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
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
                {alreadySeeded ? 'Firestore Collections Active' : 'Database Ready for Seeding'}
              </Text>
            </View>
          )}
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
              <Text style={styles.resultItem}>• {seedResult.events} Active Hazard Events synchronized</Text>
              <Text style={styles.resultItem}>• {seedResult.shelters} Safe Havens registered & active</Text>
              <Text style={styles.resultItem}>• {seedResult.teams} SAR Units commissioned to grid</Text>
              <Text style={styles.resultItem}>• {seedResult.supplies} Relief Inventories established</Text>
              <Text style={styles.resultItem}>• {seedResult.distributions} Historical Dispatches logged</Text>
            </View>
          </Card>
        )}

        <Button
          title={seeding ? 'Writing Data to Firestore...' : alreadySeeded ? 'Re-seed Operational Dataset' : 'Seed Real Sri Lanka Data Now'}
          variant="primary"
          loading={seeding}
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
    backgroundColor: '#0F172A',
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
