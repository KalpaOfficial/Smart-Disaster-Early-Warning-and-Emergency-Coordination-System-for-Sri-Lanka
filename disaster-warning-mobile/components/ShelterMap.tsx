import { MobileTypography } from '@/constants/colors';
import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let MapView: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Marker: any = null;
if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const maps = require('react-native-maps');
    MapView = maps.default;
    Marker = maps.Marker;
  } catch {
    /* Coordinates and directions remain available. */
  }
}
export function ShelterMap({ latitude, longitude }: { latitude: number; longitude: number }) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || (!latitude && !longitude))
    return <Text style={styles.hint}>Map location has not been recorded.</Text>;
  return (
    <View style={styles.map}>
      {Platform.OS === 'web' ? (
        <iframe
          title="Shelter location"
          src={`https://www.openstreetmap.org/export/embed.html?bbox=${longitude - 0.008},${latitude - 0.008},${longitude + 0.008},${latitude + 0.008}&layer=mapnik&marker=${latitude},${longitude}`}
          style={{ width: '100%', height: 190, border: 0 }}
        />
      ) : MapView && Marker ? (
        <MapView
          style={{ flex: 1 }}
          region={{ latitude, longitude, latitudeDelta: 0.025, longitudeDelta: 0.025 }}
        >
          <Marker coordinate={{ latitude, longitude }} />
        </MapView>
      ) : (
        <Text style={styles.hint}>
          {latitude.toFixed(5)}, {longitude.toFixed(5)}
        </Text>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  map: {
    height: 190,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#EAF2FF',
    marginVertical: 14,
  },
  hint: { color: '#5D6B80', ...MobileTypography.caption, padding: 14 },
});
