/**
 * Location Picker Component for UC02: Submit and Verify Ground Report.
 * Automatically acquires device GPS fix and provides an interactive map preview on both Web and Native.
 * Aligned with UC02 Main Flow Steps 23-24 and Exception Flow: GPS Fix Unavailable.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  ScrollView,
  Platform,
} from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius, Spacing, FontSize } from '@/constants/colors';
import { SRI_LANKAN_DISTRICTS } from '@/constants/districts';
import { Select } from './Select';
import type { GeoLocation } from '@/types/groundReport';

// Optional native MapView import
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
let MapView: any = null;
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
let Marker: any = null;
try {
  /* eslint-disable-next-line @typescript-eslint/no-require-imports */
  const maps = require('react-native-maps');
  MapView = maps.default || maps.MapView;
  Marker = maps.Marker;
} catch {
  // Graceful fallback on web or environments where native maps are unlinked
  MapView = null;
  Marker = null;
}

const DISTRICT_CENTERS: Record<string, { lat: number; lng: number }> = {
  Colombo: { lat: 6.9271, lng: 79.8612 },
  Gampaha: { lat: 7.0840, lng: 80.0098 },
  Kalutara: { lat: 6.5854, lng: 79.9607 },
  Kandy: { lat: 7.2906, lng: 80.6337 },
  Matale: { lat: 7.4675, lng: 80.6234 },
  'Nuwara Eliya': { lat: 6.9497, lng: 80.7891 },
  Galle: { lat: 6.0535, lng: 80.2210 },
  Matara: { lat: 5.9549, lng: 80.5550 },
  Hambantota: { lat: 6.1429, lng: 81.1212 },
  Jaffna: { lat: 9.6615, lng: 80.0255 },
  Kilinochchi: { lat: 9.3803, lng: 80.3770 },
  Mannar: { lat: 8.9810, lng: 79.9044 },
  Vavuniya: { lat: 8.7542, lng: 80.4982 },
  Mullaitivu: { lat: 9.2671, lng: 80.8142 },
  Batticaloa: { lat: 7.7310, lng: 81.6747 },
  Ampara: { lat: 7.2975, lng: 81.6747 },
  Trincomalee: { lat: 8.5874, lng: 81.2152 },
  Kurunegala: { lat: 7.4863, lng: 80.3623 },
  Puttalam: { lat: 8.0408, lng: 79.8394 },
  Anuradhapura: { lat: 8.3114, lng: 80.4037 },
  Polonnaruwa: { lat: 7.9403, lng: 81.0188 },
  Badulla: { lat: 6.9934, lng: 81.0550 },
  Monaragala: { lat: 6.8728, lng: 81.3507 },
  Ratnapura: { lat: 6.6828, lng: 80.4037 },
  Kegalle: { lat: 7.2513, lng: 80.3464 },
};

const POPULAR_DISASTER_PRESETS = [
  'Colombo',
  'Gampaha',
  'Kalutara',
  'Ratnapura',
  'Kandy',
  'Galle',
  'Matara',
  'Badulla',
];

interface LocationPickerProps {
  location: GeoLocation;
  locationName: string;
  district: string;
  isManualLocation: boolean;
  onLocationChange: (loc: GeoLocation, isManual: boolean) => void;
  onLocationNameChange: (name: string) => void;
  onDistrictChange: (district: string) => void;
  error?: string | null;
}

interface MapEventWithCoordinate {
  nativeEvent?: {
    coordinate?: {
      latitude: number;
      longitude: number;
    };
  };
}

export function LocationPicker({
  location,
  locationName,
  district,
  isManualLocation,
  onLocationChange,
  onLocationNameChange,
  onDistrictChange,
  error,
}: LocationPickerProps) {
  const [fetchingGps, setFetchingGps] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [lastFixTime, setLastFixTime] = useState<string | null>(null);

  // Acquire live device GPS fix
  const acquireGpsLocation = useCallback(async () => {
    try {
      setFetchingGps(true);
      setGpsError(null);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setGpsError('GPS permission was denied. Please select location manually on the map.');
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const newLoc: GeoLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        altitude: position.coords.altitude,
        accuracy: position.coords.accuracy,
      };

      onLocationChange(newLoc, false);
      setLastFixTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

      // Reverse geocoding on Web (using OpenStreetMap Nominatim API)
      if (Platform.OS === 'web') {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${newLoc.latitude}&lon=${newLoc.longitude}`,
            { headers: { Accept: 'application/json' } },
          );
          if (res.ok) {
            const data = await res.json();
            const placeName = (data.display_name || '').split(',').slice(0, 3).join(', ');
            if (placeName && !locationName) {
              onLocationNameChange(placeName);
            }
            const address = data.address || {};
            const city = `${address.city || ''} ${address.town || ''} ${address.county || ''} ${address.state_district || ''} ${address.state || ''}`.toLowerCase();
            const matchedDistrict = SRI_LANKAN_DISTRICTS.find((d: string) =>
              city.includes(d.toLowerCase()),
            );
            if (matchedDistrict && !district) {
              onDistrictChange(matchedDistrict);
            }
          }
        } catch {
          // non-fatal
        }
      } else {
        // Native Reverse Geocoding
        try {
          const geocode = await Location.reverseGeocodeAsync({
            latitude: newLoc.latitude,
            longitude: newLoc.longitude,
          });

          if (geocode && geocode.length > 0) {
            const place = geocode[0];
            const suggestedName = [place.name, place.street, place.subregion, place.city]
              .filter(Boolean)
              .join(', ');

            if (suggestedName && !locationName) {
              onLocationNameChange(suggestedName);
            }

            if (place.subregion || place.city) {
              const matchedDistrict = SRI_LANKAN_DISTRICTS.find(
                (d: string) =>
                  d.toLowerCase() === (place.subregion || '').toLowerCase() ||
                  d.toLowerCase() === (place.city || '').toLowerCase(),
              );
              if (matchedDistrict && !district) {
                onDistrictChange(matchedDistrict);
              }
            }
          }
        } catch {
          // non-fatal
        }
      }
    } catch (err) {
      console.warn('GPS acquisition error:', err);
      setGpsError('Could not obtain live GPS fix. Manual location adjustment is enabled.');
    } finally {
      setFetchingGps(false);
    }
  }, [district, locationName, onDistrictChange, onLocationChange, onLocationNameChange]);

  useEffect(() => {
    // If location is at default initial point, attempt automatic initial GPS fix
    if (!location.latitude || location.latitude === 6.9271) {
      acquireGpsLocation();
    }
  }, [acquireGpsLocation, location.latitude]);

  const handleManualCoordinateChange = (latStr: string, lngStr: string) => {
    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);
    if (!isNaN(lat) && !isNaN(lng)) {
      onLocationChange({ ...location, latitude: lat, longitude: lng }, true);
    }
  };

  const handleNudge = (deltaLat: number, deltaLng: number) => {
    onLocationChange(
      {
        ...location,
        latitude: parseFloat((location.latitude + deltaLat).toFixed(5)),
        longitude: parseFloat((location.longitude + deltaLng).toFixed(5)),
      },
      true,
    );
  };

  const handlePresetSelect = (presetDistrict: string) => {
    const coords = DISTRICT_CENTERS[presetDistrict];
    if (coords) {
      onLocationChange(
        {
          latitude: coords.lat,
          longitude: coords.lng,
          accuracy: 50,
        },
        true,
      );
      onDistrictChange(presetDistrict);
      if (!locationName || locationName.includes('Sri Lanka') || locationName.includes('Town')) {
        onLocationNameChange(`${presetDistrict} Town, Sri Lanka`);
      }
    }
  };

  const districtOptions = SRI_LANKAN_DISTRICTS.map((d: string) => ({
    value: d,
    label: d,
  }));

  const canRenderNativeMap = Platform.OS !== 'web' && MapView && Marker;

  // Calculate bounding box for embedded web OpenStreetMap
  const webBbox = `${(location.longitude - 0.015).toFixed(4)}%2C${(location.latitude - 0.015).toFixed(4)}%2C${(location.longitude + 0.015).toFixed(4)}%2C${(location.latitude + 0.015).toFixed(4)}`;
  const webMapSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${webBbox}&layer=mapnik&marker=${location.latitude.toFixed(5)}%2C${location.longitude.toFixed(5)}`;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>
          Incident Location <Text style={styles.required}>*</Text>
        </Text>

        <TouchableOpacity
          style={styles.gpsRetryBtn}
          onPress={acquireGpsLocation}
          disabled={fetchingGps}
          activeOpacity={0.7}
        >
          {fetchingGps ? (
            <ActivityIndicator size="small" color={Colors.accent.primary} />
          ) : (
            <>
              <Ionicons name="navigate-circle" size={16} color={Colors.accent.primary} />
              <Text style={styles.gpsRetryBtnText}>Acquire Current GPS</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* GPS Telemetry Status Banner */}
      <View style={styles.telemetryCard}>
        <View style={styles.telemetryStatusRow}>
          <View
            style={[
              styles.pulseIndicator,
              { backgroundColor: isManualLocation ? Colors.warning : Colors.success },
            ]}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.telemetryStatusTitle}>
              {fetchingGps
                ? 'Acquiring GPS Telemetry Fix...'
                : isManualLocation
                ? 'Manual Map Pin Placed'
                : 'Live GPS Satellite Fix Verified'}
            </Text>
            <Text style={styles.telemetryStatusSubtitle}>
              {location.latitude.toFixed(5)}° N, {location.longitude.toFixed(5)}° E
              {location.accuracy ? ` • Accuracy: ±${Math.round(location.accuracy)}m` : ''}
              {lastFixTime ? ` • Updated at ${lastFixTime}` : ''}
            </Text>
          </View>
        </View>
      </View>

      {/* Map Display & Pin Placement */}
      <View style={styles.mapCard}>
        {Platform.OS === 'web' ? (
          <View style={styles.webMapContainer}>
            <iframe
              title="Hazard Incident Map"
              src={webMapSrc}
              style={{
                width: '100%',
                height: 220,
                border: 0,
                backgroundColor: '#090F1C',
              }}
            />
            <View style={styles.mapHelpPill}>
              <Ionicons name="location" size={12} color={Colors.accent.primary} />
              <Text style={styles.mapHelpText}>
                Plotted at {location.latitude.toFixed(4)}° N, {location.longitude.toFixed(4)}° E
              </Text>
            </View>
          </View>
        ) : canRenderNativeMap ? (
          <View style={styles.mapContainer}>
            <MapView
              style={styles.map}
              region={{
                latitude: location.latitude,
                longitude: location.longitude,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              }}
              onPress={(e: MapEventWithCoordinate) => {
                const coord = e.nativeEvent?.coordinate;
                if (coord) {
                  onLocationChange({ ...location, ...coord }, true);
                }
              }}
            >
              <Marker
                coordinate={{
                  latitude: location.latitude,
                  longitude: location.longitude,
                }}
                draggable
                onDragEnd={(e: MapEventWithCoordinate) => {
                  const coord = e.nativeEvent?.coordinate;
                  if (coord) {
                    onLocationChange({ ...location, ...coord }, true);
                  }
                }}
                title={locationName || 'Hazard Location'}
                description={isManualLocation ? 'Manually Selected' : 'GPS Satellite Fix'}
              />
            </MapView>
            <View style={styles.mapHelpPill}>
              <Text style={styles.mapHelpText}>Tap or drag pin to adjust coordinates</Text>
            </View>
          </View>
        ) : null}

        {/* Nudge / Fine-Tuning Controls */}
        <View style={styles.nudgeSection}>
          <Text style={styles.nudgeSectionLabel}>Adjust Pin Coordinates:</Text>
          <View style={styles.nudgeBtnRow}>
            <TouchableOpacity
              style={styles.nudgeBtn}
              onPress={() => handleNudge(0.005, 0)}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-up" size={14} color="#FFF" />
              <Text style={styles.nudgeBtnText}>North</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.nudgeBtn}
              onPress={() => handleNudge(-0.005, 0)}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-down" size={14} color="#FFF" />
              <Text style={styles.nudgeBtnText}>South</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.nudgeBtn}
              onPress={() => handleNudge(0, -0.005)}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={14} color="#FFF" />
              <Text style={styles.nudgeBtnText}>West</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.nudgeBtn}
              onPress={() => handleNudge(0, 0.005)}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-forward" size={14} color="#FFF" />
              <Text style={styles.nudgeBtnText}>East</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Manual Latitude / Longitude Edit Inputs */}
        <View style={styles.coordDisplayRow}>
          <View style={styles.coordItem}>
            <Text style={styles.coordLabel}>Latitude (°N)</Text>
            <TextInput
              style={styles.coordInput}
              value={String(location.latitude)}
              onChangeText={(val) =>
                handleManualCoordinateChange(val, String(location.longitude))
              }
              keyboardType="numeric"
              placeholder="e.g. 6.9271"
              placeholderTextColor={Colors.input.placeholder}
            />
          </View>

          <View style={styles.coordItem}>
            <Text style={styles.coordLabel}>Longitude (°E)</Text>
            <TextInput
              style={styles.coordInput}
              value={String(location.longitude)}
              onChangeText={(val) =>
                handleManualCoordinateChange(String(location.latitude), val)
              }
              keyboardType="numeric"
              placeholder="e.g. 79.8612"
              placeholderTextColor={Colors.input.placeholder}
            />
          </View>
        </View>
      </View>

      {/* Quick District Presets */}
      <View style={styles.presetGroup}>
        <Text style={styles.presetLabel}>Quick Snap to Disaster Zones:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetScroll}>
          {POPULAR_DISASTER_PRESETS.map((p) => {
            const isSelected = district === p;
            return (
              <TouchableOpacity
                key={p}
                style={[styles.presetChip, isSelected && styles.presetChipActive]}
                onPress={() => handlePresetSelect(p)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="location-outline"
                  size={12}
                  color={isSelected ? '#080C14' : Colors.accent.primary}
                />
                <Text style={[styles.presetChipText, isSelected && styles.presetChipTextActive]}>
                  {p}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {gpsError && (
        <View style={styles.gpsErrorBanner}>
          <Ionicons name="information-circle-outline" size={14} color={Colors.warning} />
          <Text style={styles.gpsErrorText}>{gpsError}</Text>
        </View>
      )}

      {/* Landmark / Location Name Input */}
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Landmark / Street / Location Name</Text>
        <TextInput
          style={styles.textInput}
          value={locationName}
          onChangeText={onLocationNameChange}
          placeholder="e.g. Kalu Ganga Bridge, Ratnapura-Panadura Road"
          placeholderTextColor={Colors.input.placeholder}
        />
      </View>

      {/* District Selector */}
      <Select
        label="District"
        placeholder="Select District"
        options={districtOptions}
        value={district}
        onValueChange={(val) => {
          onDistrictChange(val);
          const coords = DISTRICT_CENTERS[val];
          if (coords && (!location.latitude || location.latitude === 6.9271)) {
            onLocationChange(
              {
                latitude: coords.lat,
                longitude: coords.lng,
                accuracy: 50,
              },
              true,
            );
          }
        }}
      />

      {!!error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.xl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  label: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  required: {
    color: Colors.danger,
  },
  gpsRetryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: Spacing.sm + 4,
    paddingVertical: 5,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  gpsRetryBtnText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.accent.primary,
  },
  telemetryCard: {
    backgroundColor: '#0A1224',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.16)',
    padding: Spacing.sm + 2,
    marginBottom: Spacing.sm,
  },
  telemetryStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  pulseIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  telemetryStatusTitle: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  telemetryStatusSubtitle: {
    fontSize: FontSize.micro,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  mapCard: {
    backgroundColor: '#0D1527',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  webMapContainer: {
    height: 220,
    width: '100%',
    position: 'relative',
    backgroundColor: '#000',
  },
  mapContainer: {
    height: 200,
    width: '100%',
    position: 'relative',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  mapHelpPill: {
    position: 'absolute',
    top: 8,
    alignSelf: 'center',
    backgroundColor: 'rgba(8, 12, 20, 0.88)',
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mapHelpText: {
    fontSize: FontSize.micro,
    color: Colors.text.primary,
    fontWeight: '600',
  },
  nudgeSection: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
    backgroundColor: '#090F1E',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  nudgeSectionLabel: {
    fontSize: FontSize.micro,
    color: Colors.text.tertiary,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  nudgeBtnRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  nudgeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#1E293B',
    paddingVertical: 6,
    borderRadius: BorderRadius.xs,
  },
  nudgeBtnText: {
    fontSize: FontSize.micro,
    color: '#FFF',
    fontWeight: '600',
  },
  coordDisplayRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    padding: Spacing.md,
    backgroundColor: '#0B1222',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  coordItem: {
    flex: 1,
  },
  coordLabel: {
    fontSize: FontSize.micro,
    color: Colors.text.tertiary,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  coordInput: {
    backgroundColor: '#080E1C',
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
    color: Colors.text.primary,
    fontSize: FontSize.sm,
  },
  presetGroup: {
    marginBottom: Spacing.md,
  },
  presetLabel: {
    fontSize: FontSize.micro,
    fontWeight: '700',
    color: Colors.text.tertiary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  presetScroll: {
    flexDirection: 'row',
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0F172A',
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: BorderRadius.sm,
    marginRight: Spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  presetChipActive: {
    backgroundColor: Colors.accent.primary,
    borderColor: Colors.accent.primary,
  },
  presetChipText: {
    fontSize: FontSize.micro,
    color: Colors.text.secondary,
    fontWeight: '600',
  },
  presetChipTextActive: {
    color: '#080C14',
    fontWeight: '800',
  },
  gpsErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
  },
  gpsErrorText: {
    fontSize: FontSize.xs,
    color: Colors.warning,
    flex: 1,
  },
  inputGroup: {
    marginBottom: Spacing.md,
  },
  inputLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.text.secondary,
    marginBottom: Spacing.xs + 2,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  textInput: {
    backgroundColor: '#0D1527',
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.09)',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    fontSize: FontSize.md,
    color: Colors.text.primary,
  },
  errorText: {
    fontSize: FontSize.xs,
    color: Colors.danger,
    marginTop: Spacing.xs,
    marginLeft: Spacing.xs,
  },
});
