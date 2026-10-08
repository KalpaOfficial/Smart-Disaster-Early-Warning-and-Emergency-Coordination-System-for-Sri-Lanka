/**
 * Relief Supplies Management Screen — UC03 Steps 57–62 + Alternate/Exception Flows.
 * Real-time warehouse telemetry, strict overdraft validation, and distribution log.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';
import { SupplyTypeBadge, OrganisationBadge } from '@/components/Badge';
import { ProgressBar } from '@/components/ProgressBar';
import { FormModal } from '@/components/FormModal';
import { EmptyState } from '@/components/EmptyState';
import { MobileNavBar } from '@/components/MobileNavBar';
import { useAuth } from '@/hooks/useAuth';
import { Colors, FontSize, Spacing, BorderRadius } from '@/constants/colors';
import { SRI_LANKAN_DISTRICTS, ORGANISATION_TYPES, SUPPLY_TYPES } from '@/constants/districts';
import {
  getSupplies,
  createSupply,
  distributeSupply,
  getDistributions,
} from '@/services/reliefSupplyService';
import { getActiveEvents } from '@/services/hazardEventService';
import type {
  ReliefSupply,
  CreateReliefSupplyData,
  Distribution,
  CreateDistributionData,
  HazardEvent,
  SupplyType,
  OrganisationType,
} from '@/types/resources';

const SUPPLY_FILTERS: { label: string; value: SupplyType | 'all' }[] = [
  { label: 'All Commodities', value: 'all' },
  { label: 'Food Rations', value: 'food' },
  { label: 'Drinking Water', value: 'water' },
  { label: 'Trauma Medicine', value: 'medicine' },
  { label: 'Blankets', value: 'blankets' },
  { label: 'Family Tents', value: 'tents' },
];

export default function ReliefSuppliesScreen() {
  const router = useRouter();
  const { state: authState } = useAuth();
  const [supplies, setSupplies] = useState<ReliefSupply[]>([]);
  const [distributions, setDistributions] = useState<Distribution[]>([]);
  const [events, setEvents] = useState<HazardEvent[]>([]);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<SupplyType | 'all'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showAddSupply, setShowAddSupply] = useState(false);
  const [showDistribute, setShowDistribute] = useState<ReliefSupply | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Forms
  const [form, setForm] = useState({
    itemName: '',
    type: 'food' as SupplyType,
    totalQuantity: '',
    unit: 'packs',
    organisationName: '',
    organisationType: 'ngo' as OrganisationType,
    district: 'Ratnapura',
  });

  const [distForm, setDistForm] = useState({
    quantity: '',
    destinationDistrict: 'Ratnapura',
    destinationLocation: '',
    details: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [s, d, e] = await Promise.all([
        getSupplies(),
        getDistributions(),
        getActiveEvents(),
      ]);
      setSupplies(s);
      setDistributions(d);
      setEvents(e);
    } catch (_error) {
      Alert.alert('Notice', 'Could not refresh inventory records. Please check network.');
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

  const resetAddForm = () => {
    setForm({
      itemName: '',
      type: 'food',
      totalQuantity: '',
      unit: 'packs',
      organisationName: '',
      organisationType: 'ngo',
      district: 'Ratnapura',
    });
  };

  const handleAddSupply = async () => {
    if (!form.itemName || !form.type || !form.totalQuantity || !form.unit || !form.organisationName || !form.district) {
      Alert.alert('Validation Error', 'Please complete all mandatory inventory fields.');
      return;
    }

    const qty = parseInt(form.totalQuantity, 10);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Validation Error', 'Total quantity must be greater than zero.');
      return;
    }

    setSubmitting(true);
    try {
      const data: CreateReliefSupplyData = {
        itemName: form.itemName.trim(),
        type: form.type,
        totalQuantity: qty,
        unit: form.unit.trim().toLowerCase(),
        organisationName: form.organisationName.trim(),
        organisationType: form.organisationType,
        district: form.district,
      };

      await createSupply(
        data,
        authState.user?.id || 'officer',
        events.length > 0 ? events[0].id : 'event-monsoon-2026',
      );
      Alert.alert('Inventory Added', `"${form.itemName}" recorded with ${qty} units.`);
      setShowAddSupply(false);
      resetAddForm();
      loadData();
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDistribute = async () => {
    if (!showDistribute) return;

    const qty = parseInt(distForm.quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Validation Error', 'Please specify a valid positive dispatch quantity.');
      return;
    }

    // UC03 Strict Validation: Insufficient stock overdraft guard
    if (qty > showDistribute.remainingQuantity) {
      Alert.alert(
        'Insufficient Inventory (UC03 Exception)',
        `Requested dispatch quantity (${qty} ${showDistribute.unit}) exceeds available depot balance (${showDistribute.remainingQuantity} ${showDistribute.unit}). Transaction denied.`,
      );
      return;
    }

    if (!distForm.destinationLocation.trim()) {
      Alert.alert('Validation Error', 'Target distribution camp or facility is required.');
      return;
    }

    setSubmitting(true);
    try {
      const distData: CreateDistributionData = {
        supplyId: showDistribute.id,
        supplyName: showDistribute.itemName,
        quantity: qty,
        unit: showDistribute.unit,
        destinationDistrict: distForm.destinationDistrict,
        destinationLocation: distForm.destinationLocation.trim(),
        details: distForm.details.trim() || 'Direct field relief convoy',
      };

      await distributeSupply(
        distData,
        authState.user?.id || 'officer',
        events.length > 0 ? events[0].id : 'event-monsoon-2026',
      );
      Alert.alert(
        'Dispatch Recorded',
        `Successfully logged distribution of ${qty} ${showDistribute.unit} to "${distForm.destinationLocation}".`,
      );
      setShowDistribute(null);
      loadData();
    } catch (error) {
      Alert.alert('Distribution Error', (error as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredSupplies = supplies.filter((s) => {
    if (selectedTypeFilter === 'all') return true;
    return s.type === selectedTypeFilter;
  });

  return (
    <ScreenContainer>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={Colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerTitleGroup}>
          <Text style={styles.headerTitle}>Relief Supplies</Text>
          <Text style={styles.headerSubtitle}>
            {supplies.reduce((acc, s) => acc + s.remainingQuantity, 0).toLocaleString()} Units in Warehouses
          </Text>
        </View>
        <TouchableOpacity onPress={() => setShowHistory(true)} style={styles.historyBtn} activeOpacity={0.7}>
          <Ionicons name="receipt-outline" size={18} color={Colors.accent.primary} />
        </TouchableOpacity>
        <Button
          title="Add Stock"
          variant="primary"
          size="sm"
          icon={<Ionicons name="add" size={16} color="#FFFFFF" />}
          onPress={() => setShowAddSupply(true)}
        />
      </View>

      {/* Commodity Type Filters */}
      <View style={styles.filterSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {SUPPLY_FILTERS.map((tab) => {
            const count = tab.value === 'all'
              ? supplies.length
              : supplies.filter((s) => s.type === tab.value).length;
            const active = selectedTypeFilter === tab.value;

            return (
              <TouchableOpacity
                key={tab.value}
                onPress={() => setSelectedTypeFilter(tab.value)}
                style={[styles.filterChip, active && styles.filterChipActive]}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {tab.label} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Supplies List */}
      <FlatList
        data={filteredSupplies}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.accent.primary}
          />
        }
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              iconName="cube-outline"
              title="No Relief Supplies Found"
              message={
                selectedTypeFilter !== 'all'
                  ? `No supplies found for "${selectedTypeFilter}".`
                  : 'Add relief supply inventory items to commence distribution.'
              }
              actionTitle="Register Stock"
              onAction={() => setShowAddSupply(true)}
            />
          ) : null
        }
        renderItem={({ item }) => {
          const percentRemaining = item.totalQuantity > 0
            ? Math.round((item.remainingQuantity / item.totalQuantity) * 100)
            : 0;

          return (
            <Card style={styles.supplyCard}>
              <View style={styles.cardHeader}>
                <View style={styles.headerLeft}>
                  <Text style={styles.itemName}>{item.itemName}</Text>
                  <View style={styles.badgeRow}>
                    <SupplyTypeBadge type={item.type} size="sm" />
                    <OrganisationBadge type={item.organisationType} size="sm" />
                  </View>
                </View>
                <View style={styles.stockBadge}>
                  <Text style={styles.remainingVal}>{item.remainingQuantity.toLocaleString()}</Text>
                  <Text style={styles.unitVal}>{item.unit.toUpperCase()}</Text>
                </View>
              </View>

              {/* Stock Bar */}
              <View style={styles.progressBox}>
                <View style={styles.progressHeader}>
                  <Text style={styles.progressLabel}>Depot Stock Level</Text>
                  <Text style={styles.progressPercent}>{percentRemaining}% Available</Text>
                </View>
                <ProgressBar
                  current={item.remainingQuantity}
                  total={item.totalQuantity}
                  unit={item.unit}
                  color={
                    percentRemaining < 20
                      ? Colors.status.danger
                      : percentRemaining < 50
                      ? Colors.status.warning
                      : Colors.status.success
                  }
                />
              </View>

              {/* Meta */}
              <View style={styles.metaBox}>
                <View style={styles.metaRow}>
                  <Ionicons name="business-outline" size={13} color={Colors.text.tertiary} />
                  <Text style={styles.metaItem}>
                    Managing Agency: <Text style={styles.metaVal}>{item.organisationName}</Text>
                  </Text>
                </View>
                <View style={styles.metaRow}>
                  <Ionicons name="location-sharp" size={13} color={Colors.accent.primary} />
                  <Text style={styles.metaItem}>
                    Regional Depot: <Text style={styles.metaVal}>{item.district} District</Text>
                  </Text>
                </View>
              </View>

              {/* Action */}
              <View style={styles.cardActions}>
                <Button
                  title={item.remainingQuantity > 0 ? 'Distribute Relief to Field' : 'Depot Depleted'}
                  variant={item.remainingQuantity > 0 ? 'primary' : 'outline'}
                  disabled={item.remainingQuantity <= 0}
                  size="sm"
                  icon={
                    <Ionicons
                      name={item.remainingQuantity > 0 ? 'paper-plane' : 'alert-circle'}
                      size={15}
                      color={item.remainingQuantity > 0 ? '#FFFFFF' : Colors.danger}
                    />
                  }
                  onPress={() => {
                    setShowDistribute(item);
                    setDistForm({
                      quantity: '',
                      destinationDistrict: item.district,
                      destinationLocation: '',
                      details: '',
                    });
                  }}
                  style={styles.actionBtn}
                />
              </View>
            </Card>
          );
        }}
      />

      {/* Add Supply Modal */}
      <FormModal
        visible={showAddSupply}
        title="Register Relief Supply Stock"
        onClose={() => setShowAddSupply(false)}
      >
        <Input
          label="Item Specification *"
          placeholder="e.g. WFP Dry Rations 7-Day Pack"
          value={form.itemName}
          onChangeText={(v) => setForm({ ...form, itemName: v })}
          icon={<Ionicons name="cube-outline" size={18} color={Colors.accent.primary} />}
        />
        <Select
          label="Commodity Category *"
          placeholder="Select category"
          value={form.type}
          options={SUPPLY_TYPES}
          onValueChange={(v) => setForm({ ...form, type: v as SupplyType })}
        />
        <Input
          label="Initial Inflow Quantity *"
          placeholder="e.g. 5000"
          keyboardType="numeric"
          value={form.totalQuantity}
          onChangeText={(v) => setForm({ ...form, totalQuantity: v })}
          icon={<Ionicons name="calculator-outline" size={18} color={Colors.accent.primary} />}
        />
        <Input
          label="Quantity Metric / Unit *"
          placeholder="e.g. packs, liters, kits, boxes"
          value={form.unit}
          onChangeText={(v) => setForm({ ...form, unit: v })}
          icon={<Ionicons name="pricetag-outline" size={18} color={Colors.accent.primary} />}
        />
        <Select
          label="Donating / Providing Agency Type *"
          placeholder="Select authority type"
          value={form.organisationType}
          options={ORGANISATION_TYPES}
          onValueChange={(v) => setForm({ ...form, organisationType: v as OrganisationType })}
        />
        <Input
          label="Agency / Donor Name *"
          placeholder="e.g. World Food Programme (WFP)"
          value={form.organisationName}
          onChangeText={(v) => setForm({ ...form, organisationName: v })}
          icon={<Ionicons name="business-outline" size={18} color={Colors.accent.primary} />}
        />
        <Select
          label="Storage Warehouse Depot District *"
          placeholder="Select warehouse location"
          value={form.district}
          options={SRI_LANKAN_DISTRICTS.map((d) => ({ label: d, value: d }))}
          onValueChange={(v) => setForm({ ...form, district: v })}
        />
        <Button
          title="Stock Inbound Inventory"
          variant="primary"
          loading={submitting}
          onPress={handleAddSupply}
          style={styles.modalSubmit}
        />
      </FormModal>

      {/* Distribute Modal */}
      <FormModal
        visible={!!showDistribute}
        title={`Distribute: ${showDistribute?.itemName}`}
        onClose={() => setShowDistribute(null)}
      >
        <View style={styles.stockBalanceCard}>
          <Text style={styles.stockBalanceLabel}>VERIFIED INVENTORY BALANCE</Text>
          <Text style={styles.stockBalanceVal}>
            {showDistribute?.remainingQuantity.toLocaleString()} {showDistribute?.unit.toUpperCase()} AVAILABLE
          </Text>
        </View>

        <Input
          label={`Dispatched Quantity (${showDistribute?.unit}) *`}
          placeholder={`Maximum: ${showDistribute?.remainingQuantity}`}
          keyboardType="numeric"
          value={distForm.quantity}
          onChangeText={(v) => setDistForm({ ...distForm, quantity: v })}
          icon={<Ionicons name="calculator-outline" size={18} color={Colors.accent.primary} />}
        />

        <Select
          label="Target Delivery District *"
          value={distForm.destinationDistrict}
          options={SRI_LANKAN_DISTRICTS.map((d) => ({ label: d, value: d }))}
          onValueChange={(v) => setDistForm({ ...distForm, destinationDistrict: v })}
        />

        <Input
          label="Target Safe Haven Shelter / Relief Post *"
          placeholder="e.g. Bodhiraja Vidyalaya Safe Haven, Camp A"
          value={distForm.destinationLocation}
          onChangeText={(v) => setDistForm({ ...distForm, destinationLocation: v })}
          icon={<Ionicons name="location-outline" size={18} color={Colors.accent.primary} />}
        />

        <Input
          label="Convoy Log / Transit Waybill Notes"
          placeholder="e.g. Dispatched via SL Army Convoy Truck 4B"
          value={distForm.details}
          onChangeText={(v) => setDistForm({ ...distForm, details: v })}
          icon={<Ionicons name="clipboard-outline" size={18} color={Colors.accent.primary} />}
        />

        <Button
          title="Authorize Distribution Convoy"
          variant="primary"
          loading={submitting}
          onPress={handleDistribute}
          style={styles.modalSubmit}
        />
      </FormModal>

      {/* Distribution History Modal */}
      <FormModal
        visible={showHistory}
        title="Field Distribution Ledger"
        onClose={() => setShowHistory(false)}
      >
        {distributions.length === 0 ? (
          <EmptyState
            iconName="receipt-outline"
            title="No Field Dispatches Logged"
            message="Relief supplies distributed will generate immutable audit entries."
          />
        ) : (
          <View style={styles.historyList}>
            {distributions.map((d) => (
              <Card key={d.id} style={styles.historyCard}>
                <View style={styles.historyHeader}>
                  <Text style={styles.historyLoc}>{d.destinationLocation}</Text>
                  <Text style={styles.historyQty}>
                    {d.quantity.toLocaleString()} UNITS
                  </Text>
                </View>
                <Text style={styles.historyDistrict}>Sector: {d.destinationDistrict} District</Text>
                {d.details && <Text style={styles.historyDetails}>{d.details}</Text>}
                <Text style={styles.historyDate}>
                  Dispatched: {new Date(d.distributedAt).toLocaleString()}
                </Text>
              </Card>
            ))}
          </View>
        )}
      </FormModal>

      {/* Bottom Floating Dock */}
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
  headerTitleGroup: {
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
  historyBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  filterSection: {
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.full,
    backgroundColor: '#0F172A',
    marginRight: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  filterChipActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: Colors.accent.primary,
  },
  filterChipText: {
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: Colors.accent.primary,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: 110,
    gap: Spacing.md,
  },
  supplyCard: {
    marginBottom: Spacing.xs,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  headerLeft: {
    flex: 1,
  },
  itemName: {
    fontSize: FontSize.md + 1,
    fontWeight: '800',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  stockBadge: {
    alignItems: 'flex-end',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  remainingVal: {
    fontSize: FontSize.lg,
    fontWeight: '900',
    color: Colors.accent.primary,
  },
  unitVal: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.text.tertiary,
  },
  progressBox: {
    marginBottom: Spacing.md,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  progressLabel: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    fontWeight: '600',
  },
  progressPercent: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.text.secondary,
  },
  metaBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: 5,
    marginBottom: Spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaItem: {
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
    flex: 1,
  },
  metaVal: {
    fontWeight: '700',
    color: Colors.text.primary,
  },
  cardActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionBtn: {
    flex: 1,
  },
  modalSubmit: {
    marginTop: Spacing.lg,
  },
  stockBalanceCard: {
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    marginBottom: Spacing.md,
    alignItems: 'center',
  },
  stockBalanceLabel: {
    fontSize: FontSize.micro,
    fontWeight: '800',
    color: Colors.accent.primary,
  },
  stockBalanceVal: {
    fontSize: FontSize.lg,
    fontWeight: '900',
    color: Colors.text.primary,
    marginTop: 2,
  },
  historyList: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  historyCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: Spacing.md,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  historyLoc: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  historyQty: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    color: Colors.accent.primary,
  },
  historyDistrict: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
  },
  historyDetails: {
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
    marginTop: 2,
    fontStyle: 'italic',
  },
  historyDate: {
    fontSize: FontSize.micro,
    color: Colors.text.tertiary,
    marginTop: 4,
  },
});
