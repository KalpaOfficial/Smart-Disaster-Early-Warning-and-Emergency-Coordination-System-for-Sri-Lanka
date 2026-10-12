import { MobileTypography } from '@/constants/colors';
import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';
import { LightColors } from '@/constants/colors';
import { SRI_LANKAN_DISTRICTS } from '@/constants/districts';
import type { GeoLocation } from '@/types/groundReport';
import { getFreshCurrentLocation, resolveReportLocation } from '@/services/reportLocationService';

// Native map selection is optional; manual coordinates remain available on web.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let NativeMap: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let NativeMarker: any = null;
if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const maps = require('react-native-maps');
    NativeMap = maps.default;
    NativeMarker = maps.Marker;
  } catch {
    /* Keep coordinate entry available when native maps are unavailable. */
  }
}

interface Props {
  location: GeoLocation;
  confirmed: boolean;
  isManual: boolean;
  locationName: string;
  district: string;
  disabled: boolean;
  errors: Record<string, string | undefined>;
  onLocationChange: (location: GeoLocation, manual: boolean) => void;
  onNameChange: (name: string) => void;
  onDistrictChange: (district: string) => void;
  onInvalidLocation: () => void;
}

export function ReportLocationField(props: Props) {
  const [fetching, setFetching] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const [manual, setManual] = useState(false);
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [resolvingDistrict, setResolvingDistrict] = useState(false);
  const [districtHint, setDistrictHint] = useState('');
  const latest = useRef(props);
  latest.current = props;
  const mounted = useRef(true);
  const gpsRequest = useRef(0);
  const gpsBusy = useRef(false);
  const lookupRequest = useRef(0);
  const lookupController = useRef<AbortController | null>(null);
  const [locationRevision, setLocationRevision] = useState(0);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      gpsRequest.current += 1;
      gpsBusy.current = false;
      lookupRequest.current += 1;
      lookupController.current?.abort();
    };
  }, []);

  useEffect(() => {
    const request = ++lookupRequest.current;
    if (!props.confirmed) {
      setResolvingDistrict(false);
      setDistrictHint('');
      return;
    }
    let active = true;
    const controller = new AbortController();
    lookupController.current = controller;
    setResolvingDistrict(true);
    latest.current.onDistrictChange('');
    latest.current.onNameChange('');
    setDistrictHint('');
    const timer = setTimeout(async () => {
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const deadline = new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new Error('Location lookup timed out'));
        }, 10000);
      });
      try {
        const result = await Promise.race([
          resolveReportLocation(
            { latitude: props.location.latitude, longitude: props.location.longitude },
            controller.signal
          ),
          deadline,
        ]);
        if (!active || request !== lookupRequest.current || latest.current.disabled) return;
        latest.current.onDistrictChange(result.district || '');
        latest.current.onNameChange(result.name || '');
        setDistrictHint(
          result.district
            ? result.name
              ? 'Street and district updated from your location.'
              : 'District detected. Enter the street or landmark below.'
            : 'Check the street or landmark and select your district below.'
        );
      } catch {
        if (active && request === lookupRequest.current && !latest.current.disabled) {
          latest.current.onDistrictChange('');
          latest.current.onNameChange('');
          setDistrictHint(
            'Address lookup is unavailable. Enter the street or landmark and select your district.'
          );
        }
      } finally {
        clearTimeout(timeout);
        if (active && request === lookupRequest.current) setResolvingDistrict(false);
      }
    }, 600);
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [props.confirmed, props.location.latitude, props.location.longitude, locationRevision]);

  const acquireCurrentLocation = useCallback(async () => {
    if (gpsBusy.current || latest.current.disabled) return;
    gpsBusy.current = true;
    const request = ++gpsRequest.current;
    lookupRequest.current += 1;
    lookupController.current?.abort();
    setResolvingDistrict(false);
    setDistrictHint('');
    setFetching(true);
    setGpsError('');
    try {
      const position = await getFreshCurrentLocation();
      if (!mounted.current || request !== gpsRequest.current) return;
      latest.current.onLocationChange(position, false);
      setLocationRevision(revision => revision + 1);
      setLatitude(String(position.latitude));
      setLongitude(String(position.longitude));
      setManual(false);
    } catch (err) {
      if (mounted.current && request === gpsRequest.current)
        setGpsError(
          err instanceof Error
            ? err.message
            : 'Location is unavailable. Try again or enter coordinates manually.'
        );
    } finally {
      if (mounted.current && request === gpsRequest.current) {
        gpsBusy.current = false;
        setFetching(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!latest.current.confirmed) void acquireCurrentLocation();
  }, [acquireCurrentLocation]);

  const editCoordinate = (lat: string, lng: string) => {
    gpsRequest.current += 1;
    gpsBusy.current = false;
    setFetching(false);
    lookupRequest.current += 1;
    lookupController.current?.abort();
    setLatitude(lat);
    setLongitude(lng);
    const latNumber = Number(lat);
    const lngNumber = Number(lng);
    if (
      lat.trim() &&
      lng.trim() &&
      Number.isFinite(latNumber) &&
      Number.isFinite(lngNumber) &&
      Math.abs(latNumber) <= 90 &&
      Math.abs(lngNumber) <= 180
    ) {
      props.onLocationChange({ latitude: latNumber, longitude: lngNumber }, true);
      setLocationRevision(revision => revision + 1);
    } else props.onInvalidLocation();
  };

  return (
    <View>
      <TouchableOpacity
        disabled={props.disabled || fetching}
        onPress={acquireCurrentLocation}
        style={styles.gpsButton}
        accessibilityRole="button"
        accessibilityLabel={fetching ? 'Finding your location' : 'Use my current location'}
        accessibilityState={{ disabled: props.disabled || fetching, busy: fetching }}
      >
        {fetching ? (
          <ActivityIndicator color={LightColors.primary} />
        ) : (
          <Ionicons name="navigate" size={18} color={LightColors.primary} />
        )}
        <Text style={styles.gpsText}>
          {fetching ? 'Finding your location...' : 'Use my current location'}
        </Text>
      </TouchableOpacity>
      {props.confirmed && (
        <View style={styles.locationStatus}>
          <Ionicons name="checkmark-circle" size={17} color="#07834B" />
          <Text style={styles.statusText}>
            {props.isManual ? 'Manual location set' : 'Current location added'}
            <Text style={styles.coordinates}>
              {'\n'}
              {props.location.latitude.toFixed(5)}, {props.location.longitude.toFixed(5)}
            </Text>
          </Text>
        </View>
      )}
      {!!gpsError && <Text style={styles.hint}>{gpsError}</Text>}
      <TouchableOpacity
        onPress={() => {
          gpsRequest.current += 1;
          gpsBusy.current = false;
          setFetching(false);
          if (!manual && props.confirmed) {
            setLatitude(String(props.location.latitude));
            setLongitude(String(props.location.longitude));
          }
          setManual(!manual);
        }}
        disabled={props.disabled}
        style={styles.manualLink}
        accessibilityRole="button"
        accessibilityState={{ expanded: manual }}
      >
        <Text style={styles.manualText}>
          {manual ? 'Hide manual coordinates' : 'Set a different location'}
        </Text>
        <Ionicons
          name={manual ? 'chevron-up' : 'chevron-down'}
          size={15}
          color={LightColors.secondaryText}
        />
      </TouchableOpacity>
      {(props.confirmed || manual) && Platform.OS === 'web' && (
        <View style={styles.mapPanel}>
          <iframe
            title="Hazard location map"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${props.location.longitude - 0.01},${props.location.latitude - 0.01},${props.location.longitude + 0.01},${props.location.latitude + 0.01}&layer=mapnik${props.confirmed ? `&marker=${props.location.latitude},${props.location.longitude}` : ''}`}
            style={{ width: '100%', height: 190, border: 0 }}
          />
          <Text style={styles.mapHint}>
            {props.confirmed
              ? 'Your selected hazard location'
              : 'Set coordinates below to place the pin.'}
          </Text>
        </View>
      )}
      {(props.confirmed || manual) && NativeMap && NativeMarker && (
        <View style={styles.mapPanel}>
          <NativeMap
            style={styles.map}
            region={{
              latitude: props.location.latitude,
              longitude: props.location.longitude,
              latitudeDelta: 0.035,
              longitudeDelta: 0.035,
            }}
            onPress={(event: { nativeEvent: { coordinate: GeoLocation } }) => {
              if (!props.disabled)
                editCoordinate(
                  String(event.nativeEvent.coordinate.latitude),
                  String(event.nativeEvent.coordinate.longitude)
                );
            }}
          >
            {props.confirmed && (
              <NativeMarker
                coordinate={props.location}
                draggable={!props.disabled}
                onDragEnd={(event: { nativeEvent: { coordinate: GeoLocation } }) => {
                  if (!props.disabled)
                    editCoordinate(
                      String(event.nativeEvent.coordinate.latitude),
                      String(event.nativeEvent.coordinate.longitude)
                    );
                }}
              />
            )}
          </NativeMap>
          <Text style={styles.mapHint}>Tap the map to place the hazard pin.</Text>
        </View>
      )}
      {manual && (
        <View style={styles.coordinateRow}>
          <Input
            label="Latitude"
            placeholder="e.g. 6.9271"
            value={latitude}
            onChangeText={val => editCoordinate(val, longitude)}
            appearance="light"
            keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'}
            editable={!props.disabled}
            containerStyle={styles.coordinateInput}
          />
          <Input
            label="Longitude"
            placeholder="e.g. 79.8612"
            value={longitude}
            onChangeText={val => editCoordinate(latitude, val)}
            appearance="light"
            keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'}
            editable={!props.disabled}
            containerStyle={styles.coordinateInput}
          />
        </View>
      )}
      {!!props.errors.location && (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {props.errors.location}
        </Text>
      )}
      <Input
        label="Street or landmark"
        placeholder="e.g. Kelani bridge, main road"
        appearance="light"
        value={props.locationName}
        onChangeText={props.onNameChange}
        editable={!props.disabled && !fetching && !resolvingDistrict}
        error={props.errors.locationName}
        icon={<Ionicons name="location-outline" size={18} color={LightColors.mutedText} />}
        containerStyle={styles.nameField}
      />
      {resolvingDistrict && (
        <View style={styles.lookupRow}>
          <ActivityIndicator size="small" color={LightColors.primary} />
          <Text style={styles.hint}>Finding street and district...</Text>
        </View>
      )}
      {!!districtHint && <Text style={styles.districtHint}>{districtHint}</Text>}
      <Select
        label="District"
        placeholder="Select district"
        appearance="light"
        options={SRI_LANKAN_DISTRICTS.map(d => ({ value: d, label: d }))}
        value={props.district}
        onSelect={props.onDistrictChange}
        disabled={props.disabled || fetching || resolvingDistrict}
        error={props.errors.district}
        containerStyle={styles.districtField}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  gpsButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    backgroundColor: LightColors.primarySoft,
    borderRadius: 13,
  },
  gpsText: {
    color: LightColors.primary,
    ...MobileTypography.button,
    fontWeight: '700',
    flexShrink: 1,
    textAlign: 'center',
  },
  locationStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EDF9F2',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  statusText: { color: '#07834B', ...MobileTypography.badge, flex: 1, fontWeight: '600' },
  coordinates: { color: LightColors.secondaryText, fontWeight: '400', ...MobileTypography.caption },
  manualLink: {
    minHeight: 44,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualText: { color: LightColors.secondaryText, ...MobileTypography.caption },
  coordinateRow: { flexDirection: 'row', gap: 10 },
  mapPanel: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: LightColors.primarySoft,
  },
  map: { height: 170, width: '100%' },
  mapHint: {
    padding: 8,
    color: LightColors.secondaryText,
    ...MobileTypography.caption,
    textAlign: 'center',
  },
  coordinateInput: { flex: 1, marginBottom: 8 },
  hint: { color: LightColors.secondaryText, ...MobileTypography.caption, marginTop: 8 },
  lookupRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  districtHint: { color: LightColors.secondaryText, ...MobileTypography.caption, marginBottom: 8 },
  error: { color: LightColors.danger, ...MobileTypography.caption, marginBottom: 12 },
  nameField: { marginTop: 6, marginBottom: 16 },
  districtField: { marginBottom: 0 },
});
