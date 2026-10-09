/**
 * Photo Capture & Selection Component for UC02: Submit and Verify Ground Report.
 * Uses expo-image-picker to take camera shots or choose existing disaster photos.
 * Implements UC02 Main Flow Step 5 and Exception Flow: Photograph Capture Failure.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius, Spacing, FontSize } from '@/constants/colors';

interface PhotoCaptureProps {
  photoUri: string | null;
  onPhotoSelected: (uri: string) => void;
  onPhotoRemoved: () => void;
  error?: string | null;
}

export function PhotoCapture({
  photoUri,
  onPhotoSelected,
  onPhotoRemoved,
  error,
}: PhotoCaptureProps) {
  const [loading, setLoading] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const handleLaunchCamera = async () => {
    try {
      setLoading(true);
      setPermissionDenied(false);

      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        setPermissionDenied(true);
        Alert.alert(
          'Camera Permission Required',
          'Please enable camera permissions in device settings to capture photographic evidence of the hazard.',
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]?.uri) {
        onPhotoSelected(result.assets[0].uri);
      }
    } catch (err) {
      console.warn('Camera capture error:', err);
      Alert.alert(
        'Photo Capture Notice',
        'Could not complete camera capture. You can retry or choose an existing photo from the gallery.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleLaunchGallery = async () => {
    try {
      setLoading(true);
      setPermissionDenied(false);

      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        setPermissionDenied(true);
        Alert.alert(
          'Photo Library Access Required',
          'Please allow access to your photo library to attach existing evidence.',
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]?.uri) {
        onPhotoSelected(result.assets[0].uri);
      }
    } catch (err) {
      console.warn('Gallery pick error:', err);
      Alert.alert(
        'Gallery Access Notice',
        'Could not load gallery photos. Please retry.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        Photographic Evidence <Text style={styles.required}>*</Text>
      </Text>

      {photoUri ? (
        <View style={styles.previewContainer}>
          <Image
            source={{ uri: photoUri }}
            style={styles.previewImage}
            contentFit="cover"
            transition={300}
          />
          <View style={styles.previewOverlay}>
            <View style={styles.liveBadge}>
              <View style={styles.pulseDot} />
              <Text style={styles.liveBadgeText}>Evidence Attached</Text>
            </View>
            <TouchableOpacity
              style={styles.removeBtn}
              onPress={onPhotoRemoved}
              activeOpacity={0.8}
            >
              <Ionicons name="trash-outline" size={18} color="#FFF" />
              <Text style={styles.removeBtnText}>Remove</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={[styles.placeholderBox, !!error && styles.placeholderBoxError]}>
          {loading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color={Colors.accent.primary} />
              <Text style={styles.loadingText}>Opening Media Device...</Text>
            </View>
          ) : (
            <>
              <View style={styles.iconCircle}>
                <Ionicons name="camera-outline" size={32} color={Colors.accent.primary} />
              </View>
              <Text style={styles.placeholderTitle}>Capture or Upload Evidence</Text>
              <Text style={styles.placeholderSubtitle}>
                Clear photos help DMC officers verify hazard scale quickly.
              </Text>

              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.actionBtnPrimary}
                  onPress={handleLaunchCamera}
                  activeOpacity={0.8}
                >
                  <Ionicons name="camera" size={18} color="#FFF" />
                  <Text style={styles.actionBtnPrimaryText}>Take Photo</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionBtnSecondary}
                  onPress={handleLaunchGallery}
                  activeOpacity={0.8}
                >
                  <Ionicons name="images-outline" size={18} color={Colors.accent.primary} />
                  <Text style={styles.actionBtnSecondaryText}>Choose Gallery</Text>
                </TouchableOpacity>
              </View>

              {permissionDenied && (
                <Text style={styles.permWarning}>
                  Permission was denied. Please allow camera/photo access in settings.
                </Text>
              )}
            </>
          )}
        </View>
      )}

      {!!error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.xl,
  },
  label: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.text.secondary,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  required: {
    color: Colors.danger,
  },
  placeholderBox: {
    backgroundColor: '#0D1527',
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderStyle: 'dashed',
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderBoxError: {
    borderColor: Colors.danger,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  placeholderTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  placeholderSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.text.tertiary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
    maxWidth: 280,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    width: '100%',
    justifyContent: 'center',
  },
  actionBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accent.primary,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs + 2,
  },
  actionBtnPrimaryText: {
    color: '#080C14',
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  actionBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs + 2,
  },
  actionBtnSecondaryText: {
    color: Colors.accent.primary,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  loadingState: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  loadingText: {
    color: Colors.text.secondary,
    fontSize: FontSize.xs,
  },
  previewContainer: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    position: 'relative',
    height: 220,
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    backgroundColor: 'rgba(8, 12, 20, 0.75)',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: Colors.success,
    borderWidth: 1,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.success,
  },
  liveBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.success,
  },
  removeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.8)',
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
  },
  removeBtnText: {
    color: '#FFF',
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  permWarning: {
    color: Colors.warning,
    fontSize: FontSize.xs,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  errorText: {
    fontSize: FontSize.xs,
    color: Colors.danger,
    marginTop: Spacing.xs,
    marginLeft: Spacing.xs,
  },
});
