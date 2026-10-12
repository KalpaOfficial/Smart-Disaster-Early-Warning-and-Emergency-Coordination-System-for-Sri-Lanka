import { AppAlert } from '@/utils/appNotice';
import { useFormFeedback } from '@/hooks/useFormFeedback';
import {
  requiredFields,
  positiveQuantityError,
  officerDistrictError,
} from '@/utils/formValidation';
import { FormError } from '@/components/FormError';
import { MobileTypography } from '@/constants/colors';
import { ResourceColors as Colors } from '@/components/ResourceComponents';
import { ResourceDirectoryHeader } from '@/components/ResourceDirectoryHeader';
import { canCoordinateResources } from '@/constants/resourcePermissions';
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
  RefreshControl,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '@/components/ResourceComponents';
import { Card } from '@/components/ResourceComponents';
import { Button } from '@/components/ResourceComponents';
import { Input } from '@/components/ResourceComponents';
import { Select } from '@/components/ResourceComponents';
import { StatusBar } from 'expo-status-bar';
import { FormModal } from '@/components/ResourceComponents';
import { EmptyState } from '@/components/ResourceComponents';
import { MobileNavBar } from '@/components/ResourceComponents';
import { useAuth } from '@/hooks/useAuth';
import { Spacing, BorderRadius } from '@/constants/colors';
import { SRI_LANKAN_DISTRICTS, ORGANISATION_TYPES, SUPPLY_TYPES } from '@/constants/districts';
import {
  getSupplies,
  createSupply,
  distributeSupply,
  getDistributions,
  setSupplyAvailability,
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
  { label: 'All supplies', value: 'all' },
  { label: 'Food', value: 'food' },
  { label: 'Water', value: 'water' },
  { label: 'Medicine', value: 'medicine' },
  { label: 'Blankets', value: 'blankets' },
  { label: 'Tents', value: 'tents' },
];

const SUPPLY_THEME: Record<
  SupplyType,
  { label: string; color: string; background: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  food: { label: 'Food', color: '#A85E00', background: '#FFF4DF', icon: 'restaurant-outline' },
  water: { label: 'Water', color: '#075ADB', background: '#EAF2FF', icon: 'water-outline' },
  medicine: { label: 'Medicine', color: '#B43545', background: '#FFF0F2', icon: 'medkit-outline' },
  blankets: { label: 'Blankets', color: '#7043AE', background: '#F2ECFC', icon: 'bed-outline' },
  tents: { label: 'Tents', color: '#07834B', background: '#E5F7ED', icon: 'home-outline' },
};

export default function ReliefSuppliesScreen() {
  const compact = useWindowDimensions().width < 380;
  const { state: authState } = useAuth();
  const canManage = canCoordinateResources(authState.user?.role);
  const scopeDistrict = canManage ? authState.user?.district : undefined;
  const [supplies, setSupplies] = useState<ReliefSupply[]>([]);
  const [distributions, setDistributions] = useState<Distribution[]>([]);
  const [events, setEvents] = useState<HazardEvent[]>([]);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<SupplyType | 'all'>('all');
  const [search, setSearch] = useState('');
  const [districtFilter, setDistrictFilter] = useState(authState.user?.district || '');
  const [organisationFilter, setOrganisationFilter] = useState('');
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
    district: authState.user?.district || '',
  });

  const [distForm, setDistForm] = useState({
    quantity: '',
    destinationDistrict: authState.user?.district || '',
    destinationLocation: '',
    details: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const stockFeedback = useFormFeedback(form, showAddSupply);
  const distributionFeedback = useFormFeedback(distForm, showDistribute?.id);

  const loadData = useCallback(async () => {
    try {
      const [s, d, e] = await Promise.all([getSupplies(), getDistributions(), getActiveEvents()]);
      setSupplies(s.filter(supply => !scopeDistrict || supply.district === scopeDistrict));
      setDistributions(
        d.filter(
          distribution => !scopeDistrict || distribution.destinationDistrict === scopeDistrict
        )
      );
      setEvents(
        e.filter(event => !scopeDistrict || event.affectedDistricts.includes(scopeDistrict))
      );
    } catch (_error) {
      AppAlert.alert('Notice', 'Could not refresh inventory records. Please check network.');
    } finally {
      setLoading(false);
    }
  }, [scopeDistrict]);

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
      district: authState.user?.district || '',
    });
  };

  const handleAddSupply = async () => {
    if (!canManage || submitting) return;
    stockFeedback.setError('');
    const errors = requiredFields(form, {
      itemName: 'Item name',
      type: 'Category',
      totalQuantity: 'Quantity',
      unit: 'Unit',
      organisationName: 'Organisation name',
      district: 'Storage district',
      organisationType: 'Organisation type',
    });
    const quantityError = positiveQuantityError(form.totalQuantity, 'Quantity');
    if (quantityError) errors.totalQuantity = quantityError;
    const districtError = officerDistrictError(form.district, scopeDistrict);
    if (districtError) errors.district = districtError;
    if (!events.some(event => event.affectedDistricts.includes(form.district)) && !errors.district)
      errors.district = `No active hazard event covers ${form.district || 'this district'}. Ask a DMC Officer to create or activate an event before adding stock.`;
    stockFeedback.setErrors(errors);
    if (Object.keys(errors).length) return;
    const qty = Number(form.totalQuantity);

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

      const event = events.find(event => event.affectedDistricts.includes(data.district));
      if (!event) throw new Error('Select a depot district covered by an active hazard event.');
      await createSupply(data, authState.user?.id || 'officer', event.id);
      AppAlert.alert('Inventory Added', `"${form.itemName}" recorded with ${qty} units.`);
      setShowAddSupply(false);
      resetAddForm();
      loadData();
    } catch (error) {
      stockFeedback.setError((error as Error).message || 'Could not add stock. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDistribute = async () => {
    if (!canManage || submitting) return;
    if (!showDistribute) return;
    distributionFeedback.setError('');
    const errors = requiredFields(distForm, {
      quantity: 'Distribution quantity',
      destinationDistrict: 'Destination district',
      destinationLocation: 'Delivery location',
    });
    const quantityError = positiveQuantityError(distForm.quantity, 'Distribution quantity');
    if (quantityError) errors.quantity = quantityError;
    const qty = Number(distForm.quantity);
    if (!quantityError && qty > showDistribute.remainingQuantity)
      errors.quantity = `Only ${showDistribute.remainingQuantity} ${showDistribute.unit} remain. Enter a quantity within the available balance.`;
    if (
      !errors.destinationDistrict &&
      !events.some(
        event =>
          event.affectedDistricts.includes(showDistribute.district) &&
          event.affectedDistricts.includes(distForm.destinationDistrict)
      )
    )
      errors.destinationDistrict = `Stock in ${showDistribute.district} can be sent to ${distForm.destinationDistrict} only when one active hazard event covers both districts. Select a covered district or ask a DMC Officer to update the event.`;
    distributionFeedback.setErrors(errors);
    if (Object.keys(errors).length) return;

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

      const event =
        events.find(
          event =>
            event.id === showDistribute.hazardEventId &&
            event.affectedDistricts.includes(showDistribute.district) &&
            event.affectedDistricts.includes(distData.destinationDistrict)
        ) ||
        events.find(
          event =>
            event.affectedDistricts.includes(showDistribute.district) &&
            event.affectedDistricts.includes(distData.destinationDistrict)
        );
      if (!event)
        throw new Error(
          'The depot and destination must be covered by the same active hazard event.'
        );
      await distributeSupply(distData, authState.user?.id || 'officer', event.id);
      AppAlert.alert(
        'Dispatch Recorded',
        `Successfully logged distribution of ${qty} ${showDistribute.unit} to "${distForm.destinationLocation}".`
      );
      setShowDistribute(null);
      loadData();
    } catch (error) {
      distributionFeedback.setError(
        (error as Error).message || 'Could not record the distribution. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleAvailability = async (item: ReliefSupply) => {
    if (!canManage || submitting) return;
    setSubmitting(true);
    try {
      await setSupplyAvailability(
        item.id,
        item.availability === 'withdrawn' ? 'available' : 'withdrawn'
      );
      await loadData();
    } catch (error) {
      AppAlert.alert('Could not update availability', (error as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredSupplies = supplies.filter(item => {
    const matchesSearch =
      !search.trim() ||
      [item.itemName, item.unit, item.organisationName, item.district]
        .join(' ')
        .toLowerCase()
        .includes(search.trim().toLowerCase());
    return (
      matchesSearch &&
      (!districtFilter || item.district === districtFilter) &&
      (!organisationFilter || item.organisationType === organisationFilter) &&
      (selectedTypeFilter === 'all' || item.type === selectedTypeFilter)
    );
  });

  return (
    <ScreenContainer>
      <StatusBar style="light" />
      {/* Supplies List */}
      <FlatList
        showsVerticalScrollIndicator={false}
        data={filteredSupplies}
        keyExtractor={item => item.id}
        ListHeaderComponent={
          <ResourceDirectoryHeader
            title={canManage ? 'Manage relief supplies' : 'Relief supplies'}
            description="Track relief stock and record deliveries to affected communities."
            icon="cube-outline"
            search={search}
            onSearch={setSearch}
            placeholder="Search item, organisation or unit"
            action={
              canManage
                ? { title: 'Add relief stock', onPress: () => setShowAddSupply(true) }
                : undefined
            }
            secondaryAction={{
              title: 'View distribution history',
              onPress: () => setShowHistory(true),
            }}
            directoryTitle="Relief stock directory"
            count={filteredSupplies.length}
            loading={loading}
          >
            <View style={[styles.filterRow, compact && { flexDirection: 'column' }]}>
              <Select
                value={districtFilter}
                onSelect={setDistrictFilter}
                options={[
                  { value: '', label: 'All districts' },
                  ...SRI_LANKAN_DISTRICTS.map(d => ({ value: d, label: d })),
                ]}
                containerStyle={styles.filterSelect}
              />
              <Select
                value={organisationFilter}
                onSelect={setOrganisationFilter}
                options={[{ value: '', label: 'Any organisation' }, ...ORGANISATION_TYPES]}
                containerStyle={styles.filterSelect}
              />
            </View>
            <View style={styles.tabs}>
              {SUPPLY_FILTERS.map(tab => {
                const count =
                  tab.value === 'all'
                    ? supplies.length
                    : supplies.filter(item => item.type === tab.value).length;
                const active = selectedTypeFilter === tab.value;
                return (
                  <TouchableOpacity
                    key={tab.value}
                    onPress={() => setSelectedTypeFilter(tab.value)}
                    style={[styles.filterChip, active && styles.filterChipActive]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                      {tab.label} ({count})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ResourceDirectoryHeader>
        }
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.accent.primary}
          />
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={{ marginTop: 30 }} color={Colors.accent.primary} />
          ) : (
            <EmptyState
              iconName="cube-outline"
              title="No relief supplies yet"
              message={
                selectedTypeFilter !== 'all'
                  ? `No supplies found for "${selectedTypeFilter}".`
                  : canManage
                    ? 'Add stock to start recording relief distributions.'
                    : 'Available relief supplies will appear here.'
              }
              actionTitle={canManage ? 'Add stock' : undefined}
              onAction={canManage ? () => setShowAddSupply(true) : undefined}
            />
          )
        }
        renderItem={({ item }) => {
          const percentRemaining =
            item.totalQuantity > 0
              ? Math.round((item.remainingQuantity / item.totalQuantity) * 100)
              : 0;
          const stockColor =
            item.remainingQuantity <= 0 ? '#B43545' : percentRemaining < 20 ? '#C47A08' : '#08A86B';
          const typeTheme = SUPPLY_THEME[item.type];

          return (
            <Card style={styles.supplyCard}>
              <View style={styles.cardHeader}>
                <View style={styles.resourceIcon}>
                  <Ionicons name={typeTheme.icon} size={23} color={Colors.accent.primary} />
                </View>
                <View style={styles.headerLeft}>
                  <Text style={styles.itemName}>{item.itemName}</Text>
                  <Text style={styles.cardCaption}>{item.district}</Text>
                </View>
              </View>
              <View style={styles.badgeRow}>
                <View style={styles.stockBadge}>
                  <Text style={styles.remainingVal}>{item.remainingQuantity.toLocaleString()}</Text>
                  <Text style={styles.unitVal}>{item.unit}</Text>
                </View>
                <View style={[styles.typePill, { backgroundColor: typeTheme.background }]}>
                  <Ionicons name={typeTheme.icon} size={13} color={typeTheme.color} />
                  <Text style={[styles.typeText, { color: typeTheme.color }]}>
                    {typeTheme.label}
                  </Text>
                </View>
                <View style={styles.organisationPill}>
                  <Text style={styles.organisationText}>
                    {ORGANISATION_TYPES.find(type => type.value === item.organisationType)?.label ||
                      item.organisationType}
                  </Text>
                </View>
              </View>

              {/* Stock Bar */}
              <View style={styles.progressBox}>
                <View style={styles.progressHeader}>
                  <Text style={styles.progressLabel}>Available stock</Text>
                  <Text style={[styles.progressPercent, { color: stockColor }]}>
                    {item.availability === 'withdrawn'
                      ? 'Withdrawn by owner'
                      : item.remainingQuantity <= 0
                        ? 'Out of stock'
                        : percentRemaining < 20
                          ? 'Low stock'
                          : `${percentRemaining}% remaining`}
                  </Text>
                </View>
                <Text style={styles.stockCaption}>
                  {item.remainingQuantity.toLocaleString()} of {item.totalQuantity.toLocaleString()}{' '}
                  {item.unit}
                </Text>
                <View
                  style={styles.progressTrack}
                  accessibilityRole="progressbar"
                  accessibilityLabel="Stock remaining"
                  accessibilityValue={{
                    min: 0,
                    max: Math.max(1, item.totalQuantity),
                    now: item.remainingQuantity,
                  }}
                >
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.min(100, Math.max(0, percentRemaining))}%`,
                        backgroundColor: stockColor,
                      },
                    ]}
                  />
                </View>
              </View>

              {/* Meta */}
              <View style={styles.metaBox}>
                <View style={styles.metaRow}>
                  <Ionicons name="business-outline" size={13} color={Colors.text.tertiary} />
                  <Text style={styles.metaItem}>
                    Organisation: <Text style={styles.metaVal}>{item.organisationName}</Text>
                  </Text>
                </View>
                <View style={styles.metaRow}>
                  <Ionicons name="location-sharp" size={13} color={Colors.accent.primary} />
                  <Text style={styles.metaItem}>
                    District: <Text style={styles.metaVal}>{item.district}</Text>
                  </Text>
                </View>
              </View>

              {/* Action */}
              {canManage && (
                <View style={styles.cardActions}>
                  <Button
                    title={
                      item.availability === 'withdrawn'
                        ? 'Stock withdrawn'
                        : item.remainingQuantity > 0
                          ? 'Record distribution'
                          : 'Out of stock'
                    }
                    variant={item.remainingQuantity > 0 ? 'primary' : 'outline'}
                    disabled={
                      submitting || item.remainingQuantity <= 0 || item.availability === 'withdrawn'
                    }
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
                  <Button
                    title={
                      item.availability === 'withdrawn' ? 'Restore availability' : 'Withdraw stock'
                    }
                    variant="outline"
                    size="sm"
                    disabled={submitting}
                    onPress={() => void handleAvailability(item)}
                    style={styles.actionBtn}
                  />
                </View>
              )}
            </Card>
          );
        }}
      />

      {/* Add Supply Modal */}
      <FormModal
        visible={canManage && showAddSupply}
        title="Add relief stock"
        feedbackKey={stockFeedback.attempt}
        onClose={() => setShowAddSupply(false)}
      >
        <FormError message={stockFeedback.error} />
        <Input
          label="Item name *"
          error={stockFeedback.errors.itemName}
          placeholder="e.g. WFP Dry Rations 7-Day Pack"
          value={form.itemName}
          onChangeText={v => setForm({ ...form, itemName: v })}
          icon={<Ionicons name="cube-outline" size={18} color={Colors.accent.primary} />}
        />
        <Select
          label="Category *"
          error={stockFeedback.errors.type}
          placeholder="Select category"
          value={form.type}
          options={SUPPLY_TYPES}
          onValueChange={v => setForm({ ...form, type: v as SupplyType })}
        />
        <Input
          label="Quantity *"
          error={stockFeedback.errors.totalQuantity}
          placeholder="e.g. 5000"
          keyboardType="numeric"
          value={form.totalQuantity}
          onChangeText={v => setForm({ ...form, totalQuantity: v })}
          icon={<Ionicons name="calculator-outline" size={18} color={Colors.accent.primary} />}
        />
        <Input
          label="Unit *"
          error={stockFeedback.errors.unit}
          placeholder="e.g. packs, liters, kits, boxes"
          value={form.unit}
          onChangeText={v => setForm({ ...form, unit: v })}
          icon={<Ionicons name="pricetag-outline" size={18} color={Colors.accent.primary} />}
        />
        <Select
          label="Organisation type *"
          error={stockFeedback.errors.organisationType}
          placeholder="Select authority type"
          value={form.organisationType}
          options={ORGANISATION_TYPES}
          onValueChange={v => setForm({ ...form, organisationType: v as OrganisationType })}
        />
        <Input
          label="Organisation name *"
          error={stockFeedback.errors.organisationName}
          placeholder="e.g. World Food Programme (WFP)"
          value={form.organisationName}
          onChangeText={v => setForm({ ...form, organisationName: v })}
          icon={<Ionicons name="business-outline" size={18} color={Colors.accent.primary} />}
        />
        <Select
          label="Storage district *"
          error={
            stockFeedback.errors.district || officerDistrictError(form.district, scopeDistrict)
          }
          placeholder="Select warehouse location"
          value={form.district}
          options={SRI_LANKAN_DISTRICTS.map(d => ({ label: d, value: d }))}
          onValueChange={v => setForm({ ...form, district: v })}
        />
        <Button
          title="Add stock"
          variant="primary"
          loading={submitting}
          onPress={handleAddSupply}
          style={styles.modalSubmit}
        />
      </FormModal>

      {/* Distribute Modal */}
      <FormModal
        visible={canManage && !!showDistribute}
        title="Record distribution"
        feedbackKey={distributionFeedback.attempt}
        onClose={() => setShowDistribute(null)}
      >
        <View style={styles.stockBalanceCard}>
          <Text style={styles.stockBalanceLabel}>{showDistribute?.itemName}</Text>
          <Text style={styles.stockBalanceVal}>
            {showDistribute?.remainingQuantity.toLocaleString()} {showDistribute?.unit} available
          </Text>
        </View>

        <FormError message={distributionFeedback.error} />
        <Input
          label={`Quantity (${showDistribute?.unit}) *`}
          error={distributionFeedback.errors.quantity}
          placeholder={`Maximum: ${showDistribute?.remainingQuantity}`}
          keyboardType="numeric"
          value={distForm.quantity}
          onChangeText={v => setDistForm({ ...distForm, quantity: v })}
          icon={<Ionicons name="calculator-outline" size={18} color={Colors.accent.primary} />}
        />

        <Select
          label="Destination district *"
          error={distributionFeedback.errors.destinationDistrict}
          value={distForm.destinationDistrict}
          options={SRI_LANKAN_DISTRICTS.map(d => ({ label: d, value: d }))}
          onValueChange={v => setDistForm({ ...distForm, destinationDistrict: v })}
        />

        <Input
          label="Delivery location *"
          error={distributionFeedback.errors.destinationLocation}
          placeholder="e.g. Bodhiraja Vidyalaya Safe Haven, Camp A"
          value={distForm.destinationLocation}
          onChangeText={v => setDistForm({ ...distForm, destinationLocation: v })}
          icon={<Ionicons name="location-outline" size={18} color={Colors.accent.primary} />}
        />

        <Input
          label="Notes (optional)"
          placeholder="e.g. Dispatched via SL Army Convoy Truck 4B"
          value={distForm.details}
          onChangeText={v => setDistForm({ ...distForm, details: v })}
          icon={<Ionicons name="clipboard-outline" size={18} color={Colors.accent.primary} />}
        />

        <Button
          title="Record distribution"
          variant="primary"
          loading={submitting}
          onPress={handleDistribute}
          style={styles.modalSubmit}
        />
      </FormModal>

      {/* Distribution History Modal */}
      <FormModal
        visible={showHistory}
        title="Distribution history"
        onClose={() => setShowHistory(false)}
      >
        {distributions.length === 0 ? (
          <EmptyState
            iconName="receipt-outline"
            title="No distributions yet"
            message="Recorded deliveries will appear here with their quantities and destinations."
          />
        ) : (
          <View style={styles.historyList}>
            {distributions.map(d => (
              <Card key={d.id} style={styles.historyCard}>
                <View style={styles.historyHeader}>
                  <Text style={styles.historyLoc}>{d.supplyName}</Text>
                  <Text style={styles.historyQty}>
                    {d.quantity.toLocaleString()} {d.unit}
                  </Text>
                </View>
                <Text style={styles.historyDistrict}>
                  {d.destinationLocation} • {d.destinationDistrict}
                </Text>
                {!!d.details && <Text style={styles.historyDetails}>{d.details}</Text>}
                <Text style={styles.historyDate}>{new Date(d.distributedAt).toLocaleString()}</Text>
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
  filterRow: { flexDirection: 'row', gap: 8 },
  filterSelect: { flex: 1, marginBottom: 10 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: {
    paddingHorizontal: 12,
    minHeight: 44,
    maxWidth: '100%',
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: '#F6F9FD',
  },
  filterChipActive: { backgroundColor: '#EAF2FF' },
  filterChipText: {
    ...MobileTypography.caption,
    color: Colors.text.secondary,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'center',
  },
  filterChipTextActive: { color: Colors.accent.primary },
  listContent: {
    paddingBottom: 110,
  },
  supplyCard: {
    marginHorizontal: 18,
    marginBottom: 13,
    padding: 16,
    borderColor: '#E7EEF8',
    shadowOpacity: 0,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 10,
  },
  headerLeft: {
    flex: 1,
  },
  resourceIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#EAF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCaption: { ...MobileTypography.caption, color: Colors.text.secondary },
  itemName: {
    ...MobileTypography.body,

    fontWeight: '800',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  typeText: { ...MobileTypography.caption, fontWeight: '700' },
  organisationPill: {
    backgroundColor: '#F1F5FA',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  organisationText: { ...MobileTypography.badge, fontWeight: '600', color: Colors.text.secondary },
  stockBadge: {
    alignItems: 'flex-end',
    backgroundColor: '#EAF2FF',
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: 12,
  },
  remainingVal: {
    ...MobileTypography.body,
    fontWeight: '900',
    color: Colors.accent.primary,
  },
  unitVal: {
    ...MobileTypography.badge,
    fontWeight: '500',
    color: Colors.text.tertiary,
  },
  progressBox: {
    marginBottom: 16,
  },
  stockCaption: { ...MobileTypography.caption, color: Colors.text.secondary, marginBottom: 8 },
  progressTrack: { height: 7, borderRadius: 4, backgroundColor: '#E8EEF6', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  progressLabel: {
    ...MobileTypography.caption,
    color: Colors.text.tertiary,
    fontWeight: '600',
  },
  progressPercent: {
    ...MobileTypography.caption,
    fontWeight: '700',
    color: Colors.text.secondary,
  },
  metaBox: {
    backgroundColor: 'transparent',
    padding: 0,
    borderRadius: BorderRadius.md,
    gap: 12,
    marginBottom: Spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  metaItem: {
    ...MobileTypography.caption,
    color: Colors.text.secondary,
    flex: 1,
  },
  metaVal: {
    fontWeight: '700',
    color: Colors.text.primary,
  },
  cardActions: {
    flexDirection: 'column',
    gap: Spacing.sm,
  },
  actionBtn: {
    minHeight: 50,
    borderRadius: 14,
  },
  modalSubmit: {
    marginTop: Spacing.lg,
  },
  stockBalanceCard: {
    backgroundColor: '#EAF2FF',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#D6E5FF',
    marginBottom: Spacing.md,
    alignItems: 'center',
  },
  stockBalanceLabel: {
    ...MobileTypography.caption,
    fontWeight: '600',
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: 6,
  },
  stockBalanceVal: {
    ...MobileTypography.body,
    fontWeight: '900',
    color: Colors.text.primary,
    marginTop: 2,
  },
  historyList: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DFE7F1',
    padding: Spacing.md,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 10,
  },
  historyLoc: {
    ...MobileTypography.caption,
    fontWeight: '700',
    color: Colors.text.primary,
    flex: 1,
  },
  historyQty: {
    ...MobileTypography.caption,
    fontWeight: '800',
    color: Colors.accent.primary,
    backgroundColor: '#EAF2FF',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    maxWidth: '40%',
  },
  historyDistrict: {
    ...MobileTypography.caption,
    color: Colors.text.tertiary,
  },
  historyDetails: {
    ...MobileTypography.caption,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  historyDate: {
    ...MobileTypography.caption,
    color: Colors.text.tertiary,
    marginTop: 10,
  },
});
