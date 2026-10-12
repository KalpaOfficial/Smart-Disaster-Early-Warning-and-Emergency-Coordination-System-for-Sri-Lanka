import { MobileTypography } from '@/constants/colors';
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { LightColors } from '@/constants/colors';

export const MAX_REPORT_PHOTOS = 5;
export function ReportPhotos({
  photos,
  onChange,
  disabled,
  error,
}: {
  photos: string[];
  onChange: (photos: string[]) => void;
  disabled: boolean;
  error?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [mediaError, setMediaError] = useState('');
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const cameraRequest = useRef(0);
  const busyLock = useRef(false);
  const mounted = useRef(true);
  const stopCamera = () => {
    cameraRequest.current += 1;
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
  };
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      stopCamera();
    };
  }, []);
  useEffect(() => {
    if (cameraOpen && video.current && stream.current) {
      video.current.srcObject = stream.current;
      video.current.play().catch(() => setMediaError('Tap the video to start the camera.'));
    }
  }, [cameraOpen]);
  const closeCamera = () => {
    stopCamera();
    setCameraOpen(false);
  };
  const takePhoto = async () => {
    if (disabled || busyLock.current || photos.length >= MAX_REPORT_PHOTOS) return;
    busyLock.current = true;
    setBusy(true);
    setMediaError('');
    try {
      if (Platform.OS === 'web') {
        if (!navigator.mediaDevices?.getUserMedia)
          throw new Error('Camera access requires HTTPS or localhost and a device with a camera.');
        const request = ++cameraRequest.current;
        const media = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (!mounted.current || request !== cameraRequest.current) {
          media.getTracks().forEach(track => track.stop());
          return;
        }
        stream.current = media;
        setCameraOpen(true);
      } else {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (permission.status !== 'granted')
          throw new Error('Allow camera access in device settings to take a photo.');
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          cameraType: ImagePicker.CameraType.back,
          quality: 0.7,
          allowsEditing: false,
        });
        if (!result.canceled && result.assets[0])
          onChange([...photos, result.assets[0].uri].slice(0, MAX_REPORT_PHOTOS));
      }
    } catch (err) {
      if (mounted.current)
        setMediaError(
          err instanceof Error && err.message.startsWith('Allow')
            ? err.message
            : 'Could not open the camera. Check camera permissions and try again.'
        );
    } finally {
      busyLock.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const choosePhotos = async () => {
    if (disabled || busyLock.current || photos.length >= MAX_REPORT_PHOTOS) return;
    busyLock.current = true;
    setBusy(true);
    setMediaError('');
    try {
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permission.status !== 'granted')
          throw new Error('Allow photo library access in device settings.');
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: MAX_REPORT_PHOTOS - photos.length,
        quality: 0.7,
        allowsEditing: false,
        base64: Platform.OS === 'web',
      });
      if (!result.canceled)
        onChange(
          [
            ...photos,
            ...result.assets.map(asset =>
              asset.base64
                ? `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`
                : asset.uri
            ),
          ].slice(0, MAX_REPORT_PHOTOS)
        );
    } catch (err) {
      if (mounted.current)
        setMediaError(err instanceof Error ? err.message : 'Could not open your photo library.');
    } finally {
      busyLock.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const captureWebPhoto = () => {
    const current = video.current;
    if (!current?.videoWidth || disabled) {
      setMediaError('The camera is still starting. Please try again.');
      return;
    }
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 1280 / Math.max(current.videoWidth, current.videoHeight));
    canvas.width = Math.round(current.videoWidth * scale);
    canvas.height = Math.round(current.videoHeight * scale);
    const context = canvas.getContext('2d');
    if (!context) {
      setMediaError('Could not capture a photo. Please try again.');
      return;
    }
    context.drawImage(current, 0, 0, canvas.width, canvas.height);
    onChange([...photos, canvas.toDataURL('image/jpeg', 0.75)].slice(0, MAX_REPORT_PHOTOS));
    closeCamera();
  };
  return (
    <View>
      <View style={styles.heading}>
        <Text style={styles.caption}>Add 1-5 photos from different angles</Text>
        <Text style={styles.count}>{photos.length}/5</Text>
      </View>
      {photos.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.previews}>
          {photos.map((uri, index) => (
            <View key={`${index}-${uri.slice(-30)}`} style={styles.thumbnail}>
              <Image source={{ uri }} style={styles.image} contentFit="cover" />
              <TouchableOpacity
                disabled={disabled || busy}
                onPress={() => onChange(photos.filter((_, i) => i !== index))}
                style={styles.remove}
                accessibilityRole="button"
                accessibilityLabel={`Remove photo ${index + 1}`}
              >
                <Ionicons name="close" size={16} color="#FFFFFF" />
              </TouchableOpacity>
              <View style={styles.number}>
                <Text style={styles.numberText}>{index + 1}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
      {photos.length < 5 && (
        <View style={styles.actions}>
          <TouchableOpacity
            onPress={takePhoto}
            disabled={disabled || busy}
            style={styles.cameraButton}
            accessibilityRole="button"
          >
            <Ionicons name="camera" size={19} color="#FFFFFF" />
            <Text style={styles.cameraText}>Take photo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={choosePhotos}
            disabled={disabled || busy}
            style={styles.galleryButton}
            accessibilityRole="button"
          >
            <Ionicons name="images-outline" size={19} color={LightColors.primary} />
            <Text style={styles.galleryText}>Gallery</Text>
          </TouchableOpacity>
        </View>
      )}
      {busy && <ActivityIndicator style={styles.loader} color={LightColors.primary} />}
      {!!(mediaError || error) && (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {mediaError || error}
        </Text>
      )}
      <Modal visible={cameraOpen} animationType="slide" onRequestClose={closeCamera}>
        <View style={styles.cameraScreen}>
          <View style={styles.cameraHeader}>
            <Text style={styles.cameraTitle}>Take a photo</Text>
            <TouchableOpacity
              onPress={closeCamera}
              style={styles.closeCamera}
              accessibilityRole="button"
              accessibilityLabel="Close camera"
            >
              <Ionicons name="close" size={25} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          {Platform.OS === 'web' && (
            <video
              ref={node => {
                video.current = node;
                if (node && stream.current) {
                  node.srcObject = stream.current;
                  node.play().catch(() => setMediaError('Tap the video to start the camera.'));
                }
              }}
              autoPlay
              playsInline
              muted
              onClick={() => video.current?.play()}
              style={{
                width: '100%',
                flex: 1,
                minHeight: 0,
                objectFit: 'contain',
                background: '#07101F',
              }}
            />
          )}
          {!!mediaError && <Text style={styles.cameraError}>{mediaError}</Text>}
          <TouchableOpacity
            onPress={captureWebPhoto}
            style={styles.shutter}
            accessibilityRole="button"
            accessibilityLabel="Capture photo"
          >
            <View style={styles.shutterInner} />
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}
const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  caption: { flex: 1, color: LightColors.secondaryText, ...MobileTypography.caption },
  count: { color: LightColors.primary, ...MobileTypography.caption, fontWeight: '700' },
  previews: { marginBottom: 14 },
  thumbnail: {
    width: 106,
    height: 108,
    borderRadius: 14,
    overflow: 'hidden',
    marginRight: 10,
    backgroundColor: LightColors.primarySoft,
  },
  image: { width: '100%', height: '100%' },
  remove: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(7,16,31,0.7)',
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  number: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(7,16,31,0.65)',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  numberText: { color: '#FFFFFF', ...MobileTypography.small },
  actions: { flexDirection: 'row', gap: 10 },
  cameraButton: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: LightColors.primary,
    borderRadius: 13,
  },
  cameraText: {
    color: '#FFFFFF',
    ...MobileTypography.button,
    fontWeight: '700',
    flexShrink: 1,
    textAlign: 'center',
  },
  galleryButton: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: LightColors.primarySoft,
    borderRadius: 13,
  },
  galleryText: {
    color: LightColors.primary,
    ...MobileTypography.button,
    fontWeight: '700',
    flexShrink: 1,
    textAlign: 'center',
  },
  loader: { marginTop: 10 },
  error: { color: LightColors.danger, ...MobileTypography.caption, marginTop: 10 },
  cameraScreen: { flex: 1, backgroundColor: '#07101F', paddingTop: 30, paddingBottom: 36 },
  cameraHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    marginBottom: 16,
  },
  cameraTitle: { flex: 1, color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  closeCamera: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  shutterInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#FFFFFF' },
  cameraError: { color: '#FFD5D5', textAlign: 'center', padding: 12 },
});
