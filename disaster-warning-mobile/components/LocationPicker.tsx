/**
 * Location Picker Component for UC02: Submit and Verify Ground Report.
 * Automatically acquires device GPS fix and allows manual map adjustment.
 * Aligned with UC02 Main Flow Steps 6-7 and Exception Flow: GPS Fix Unavailable.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Platform,
  Alert,
} from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius, Spacing, FontSize } from '@/constants/colors';
import { SRI_LANKAN_DISTRICTS } from '@/constants/districts';
import { Select } from './Select';
import type { GeoLocation } from '@/types/groundReport';

// Optional native MapView import
let MapView: any = null;
let Marker: any = null;
try {
  const maps = require('react-native-maps');
  MapView = maps.default || maps.MapView;
  Marker = maps.Marker;
} catch {
  // Graceful fallback on web or environments where native maps are unlinked
  MapView = null;
  Marker = null;
}

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

  // Request GPS fix on mount if location is default
  const acquireGpsLocation = useCallback(async () => {
    try {
      setFetchingGps(true);
      setGpsError(null);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setGpsError('GPS permission was denied. Please select location manually.');
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

      // Attempt reverse geocoding to suggest local place name
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
        // Reverse geocoding error is non-fatal
      }
    } catch (err) {
      console.warn('GPS acquisition error:', err);
      setGpsError('Could not obtain GPS fix. Manual location selection enabled.');
    } finally {
      setFetchingGps(false);
    }
  }, [district, locationName, onDistrictChange, onLocationChange, onLocationNameChange]);

  useEffect(() => {
    // If location is default (0 or default Colombo), attempt initial GPS fetch
    if (!location.latitude || location.latitude === 6.9271) {
      acquireGpsLocation();
    }
  }, [acquireGpsLocation, location.latitude]);

  const handleManualCoordinateChange = (latStr: string, lngStr: string) => {
    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);
    if (!isNaN(lat) && !isNaN(lng)) {
      onLocationChange({ latitude: lat, longitude: lng }, true);
    }
  };

  const districtOptions = SRI_LANKAN_DISTRICTS.map((d: string) => ({
    value: d,
    label: d,
  }));

  const canRenderNativeMap = Platform.OS !== 'web' && MapView && Marker;

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
              <Ionicons name="navigate-outline" size={14} color={Colors.accent.primary} />
              <Text style={styles.gpsRetryBtnText}>Acquire GPS</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Map or Coordinates Display */}
      <View style={styles.mapCard}>
        {canRenderNativeMap ? (
          <View style={styles.mapContainer}>
            <MapView
              style={styles.map}
              region={{
                latitude: location.latitude,
                longitude: location.longitude,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              }}
              onPress={(e: any) => {
                const coord = e.nativeEvent?.coordinate;
                if (coord) {
                  onLocationChange(coord, true);
                }
              }}
            >
              <Marker
                coordinate={{
                  latitude: location.latitude,
                  longitude: location.longitude,
                }}
                draggable
                onDragEnd={(e: any) => {
                  const coord = e.nativeEvent?.coordinate;
                  if (coord) {
                    onLocationChange(coord, true);
                  }
                }}
                title={locationName || 'Hazard Location'}
                description={isManualLocation ? 'Manually Selected' : 'GPS Fix'}
              />
            </MapView>
            <View style={styles.mapHelpPill}>
              <Text style={styles.mapHelpText}>Tap or drag pin to adjust coordinates</Text>
            </View>
          </View>
        ) : (
          <View style={styles.webFallbackContainer}>
            <View style={styles.coordDisplayRow}>
              <View style={styles.coordItem}>
                <Text style={styles.coordLabel}>Latitude</Text>
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
                <Text style={styles.coordLabel}>Longitude</Text>
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
        )}

        {/* Status Indicator */}
        <View style={styles.metaRow}>
          <View
            style={[
              styles.locationStatusPill,
              isManualLocation ? styles.pillManual : styles.pillGps,
            ]}
          >
            <Ionicons
              name={isManualLocation ? 'pin-outline' : 'locate-outline'}
              size={12}
              color={isManualLocation ? Colors.warning : Colors.success}
            />
            <Text
              style={[
                styles.locationStatusText,
                { color: isManualLocation ? Colors.warning : Colors.success },
              ]}
            >
              {isManualLocation ? 'Manually Placed' : 'GPS Fix Acquired'}
            </Text>
          </View>

          <Text style={styles.coordSnippet}>
            {location.latitude.toFixed(4)}° N, {location.longitude.toFixed(4)}° E
          </Text>
        </View>
      </View>

      {gpsError && (
        <View style={styles.gpsErrorBanner}>
          <Ionicons name="information-circle-outline" size={14} color={Colors.warning} />
          <Text style={styles.gpsErrorText}>{gpsError}</Text>
        </View>
      )}

      {/* Landmark / Location Name Input */}
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Landmark / Street / Bridge Name</Text>
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
        onValueChange={onDistrictChange}
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
    marginBottom: Spacing.sm,
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
    gap: 4,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  gpsRetryBtnText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.accent.primary,
  },
  mapCard: {
    backgroundColor: '#0D1527',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  mapContainer: {
    height: 180,
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
    backgroundColor: 'rgba(8, 12, 20, 0.85)',
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  mapHelpText: {
    fontSize: FontSize.micro,
    color: Colors.text.primary,
    fontWeight: '600',
  },
  webFallbackContainer: {
    padding: Spacing.md,
  },
  coordDisplayRow: {
    flexDirection: 'row',
    gap: Spacing.md,
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
    backgroundColor: '#090F1C',
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
    color: Colors.text.primary,
    fontSize: FontSize.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    backgroundColor: '#0B1222',
  },
  locationStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  pillGps: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  pillManual: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  locationStatusText: {
    fontSize: FontSize.micro,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  coordSnippet: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
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
