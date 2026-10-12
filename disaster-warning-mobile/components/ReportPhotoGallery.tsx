import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LightColors, MobileTypography } from '@/constants/colors';

export function ReportPhotoGallery({ urls }: { urls: string[] }) {
  const photos = urls.filter(Boolean);
  const photoKey = photos.join('\n');
  const [index, setIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const insets = useSafeAreaInsets();
  useEffect(() => {
    setIndex(0);
    setExpanded(false);
  }, [photoKey]);
  const current = Math.min(index, Math.max(0, photos.length - 1));
  if (!photos.length) return null;
  const navigation = (fullscreen = false) => (
    <View style={styles.navigation}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Previous photo"
        accessibilityState={{ disabled: current === 0 }}
        disabled={current === 0}
        onPress={() => setIndex(current - 1)}
        style={[styles.arrow, fullscreen && styles.darkArrow, current === 0 && styles.disabled]}
      >
        <Ionicons
          name="chevron-back"
          size={23}
          color={fullscreen ? '#FFFFFF' : LightColors.primary}
        />
      </TouchableOpacity>
      <Text style={[styles.count, fullscreen && styles.white]} accessibilityLiveRegion="polite">
        Photo {current + 1} of {photos.length}
      </Text>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Next photo"
        accessibilityState={{ disabled: current === photos.length - 1 }}
        disabled={current === photos.length - 1}
        onPress={() => setIndex(current + 1)}
        style={[
          styles.arrow,
          fullscreen && styles.darkArrow,
          current === photos.length - 1 && styles.disabled,
        ]}
      >
        <Ionicons
          name="chevron-forward"
          size={23}
          color={fullscreen ? '#FFFFFF' : LightColors.primary}
        />
      </TouchableOpacity>
    </View>
  );
  return (
    <View>
      <View
        accessibilityElementsHidden={expanded}
        importantForAccessibility={expanded ? 'no-hide-descendants' : 'auto'}
        aria-hidden={expanded}
      >
        <TouchableOpacity
          onPress={() => setExpanded(true)}
          style={styles.photo}
          accessibilityRole="button"
          accessibilityLabel={`Enlarge hazard photo ${current + 1} of ${photos.length}`}
        >
          <Image source={{ uri: photos[current] }} style={styles.image} contentFit="cover" />
          <View style={styles.zoom}>
            <Ionicons name="expand-outline" size={16} color="#FFFFFF" />
            <Text style={styles.zoomText}>Tap to enlarge</Text>
          </View>
        </TouchableOpacity>
        {photos.length > 1 && (
          <>
            {navigation()}
            <View style={styles.thumbnails}>
              {photos.map((uri, i) => (
                <TouchableOpacity
                  key={`${i}-${uri}`}
                  onPress={() => setIndex(i)}
                  accessibilityRole="button"
                  accessibilityLabel={`Show photo ${i + 1}`}
                  accessibilityState={{ selected: current === i }}
                  style={[styles.thumbnail, current === i && styles.selectedThumbnail]}
                >
                  <Image source={{ uri }} style={styles.image} contentFit="cover" />
                  {current === i && (
                    <View style={styles.selectedMark}>
                      <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </View>
      <Modal
        visible={expanded}
        transparent
        animationType="fade"
        onRequestClose={() => setExpanded(false)}
        statusBarTranslucent
      >
        <View style={styles.viewerBackdrop}>
          <View
            testID="report-photo-viewer-frame"
            style={[
              styles.viewer,
              { paddingTop: Math.max(insets.top, 16), paddingBottom: Math.max(insets.bottom, 16) },
            ]}
          >
            <View style={styles.viewerHeader}>
              <Text style={[styles.viewerTitle, styles.white]}>Report photos</Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Close photo viewer"
                onPress={() => setExpanded(false)}
                style={[styles.arrow, styles.darkArrow]}
              >
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <Image
              source={{ uri: photos[current] }}
              style={styles.expandedImage}
              contentFit="contain"
            />
            {navigation(true)}
          </View>
        </View>
      </Modal>
    </View>
  );
}
const styles = StyleSheet.create({
  photo: {
    height: 220,
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: LightColors.primarySoft,
  },
  image: { width: '100%', height: '100%' },
  zoom: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(7,16,31,0.75)',
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  zoomText: { color: '#FFFFFF', ...MobileTypography.caption },
  navigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 10,
  },
  arrow: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: LightColors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.35 },
  count: {
    ...MobileTypography.caption,
    color: LightColors.secondaryText,
    textAlign: 'center',
    flexShrink: 1,
  },
  thumbnails: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: LightColors.border,
  },
  selectedThumbnail: { borderColor: LightColors.primary },
  selectedMark: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: LightColors.primary,
    borderTopLeftRadius: 5,
    padding: 2,
  },
  viewerBackdrop: { flex: 1, alignItems: 'center', backgroundColor: 'rgba(4, 7, 17, 0.8)' },
  viewer: {
    flex: 1,
    width: '100%',
    maxWidth: 500,
    overflow: 'hidden',
    backgroundColor: '#07101F',
    paddingHorizontal: 18,
  },
  viewerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  viewerTitle: { ...MobileTypography.section, fontWeight: '700' },
  white: { color: '#FFFFFF' },
  darkArrow: { backgroundColor: '#1D2B42' },
  expandedImage: { flex: 1, width: '100%', minHeight: 0 },
});
